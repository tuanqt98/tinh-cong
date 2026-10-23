import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calculateAttendance } from '@tinh-cong/attendance-engine';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  EmployeeStatus,
  ExceptionStatus,
  PeriodStatus,
  Prisma,
  RoleCode,
} from '../generated/prisma/index.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AttendanceSummaryQueryDto,
  CalculatePreviewDto,
  ConfirmEmployeeImportDto,
  CreateDepartmentDto,
  CreateEmployeeDto,
  EmployeeQueryDto,
  CreatePeriodDto,
  CreateShiftDto,
  FeedbackDto,
  PaginationDto,
  ResolveExceptionDto,
  TransitionPeriodDto,
  UpdateEmployeeDto,
} from './dto.js';

const NEXT_STATUS: Partial<Record<PeriodStatus, PeriodStatus>> = {
  DRAFT: PeriodStatus.REVIEWED,
  REVIEWED: PeriodStatus.APPROVED,
  APPROVED: PeriodStatus.LOCKED,
  LOCKED: PeriodStatus.PUBLISHED,
};

type AttendanceProcessingStatus = 'VALID' | 'NEEDS_REVIEW' | 'NO_DATA';

export interface AttendanceSummaryRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  workedSeconds: number;
  tier100Seconds: number;
  tier130Seconds: number;
  tier150Seconds: number;
  tier210Seconds: number;
  lateSeconds: number;
  earlySeconds: number;
  workingDays: number | null;
  attendanceDays: number;
  exceptionCount: number;
  processingStatus: AttendanceProcessingStatus;
  approvalStatus: PeriodStatus;
  calculated: boolean;
}

export interface AttendanceSummaryTotals {
  employees: number;
  calculatedEmployees: number;
  workedSeconds: number;
  tier100Seconds: number;
  tier130Seconds: number;
  tier150Seconds: number;
  tier210Seconds: number;
  lateSeconds: number;
  earlySeconds: number;
  attendanceDays: number;
  exceptionCount: number;
}

@Injectable()
export class CoreService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async dashboard(user: AuthenticatedUser, year?: number, month?: number) {
    const employeeWhere = await this.employeeScope(user);
    const periodWhere: Prisma.AttendancePeriodWhereInput = {};
    if (year) periodWhere.year = year;
    if (month) periodWhere.month = month;
    const calculationWhere: Prisma.AttendanceCalculationWhereInput = {
      raw: { employee: employeeWhere },
      ...(year || month ? { period: periodWhere } : {}),
    };

    const [
      employees,
      employeesWithAttendance,
      totals,
      exceptions,
      pendingPeriods,
      publications,
      feedback,
    ] = await this.prisma.$transaction([
      this.prisma.employee.count({ where: employeeWhere }),
      this.prisma.attendanceCalculation.findMany({
        where: { ...calculationWhere, status: 'VALID' },
        distinct: ['rawId'],
        select: { raw: { select: { employeeId: true } } },
      }),
      this.prisma.attendanceCalculation.aggregate({
        where: { ...calculationWhere, status: 'VALID' },
        _sum: {
          workedSeconds: true,
          tier100Seconds: true,
          tier130Seconds: true,
          tier150Seconds: true,
          tier210Seconds: true,
        },
      }),
      this.prisma.attendanceException.count({
        where: {
          status: ExceptionStatus.OPEN,
          raw: { employee: employeeWhere },
          ...(year || month ? { calculation: { period: periodWhere } } : {}),
        },
      }),
      this.prisma.attendancePeriod.count({
        where: {
          ...periodWhere,
          status: { in: ['DRAFT', 'REVIEWED', 'APPROVED'] },
          ...(user.roles.includes(RoleCode.ADMIN)
            ? {}
            : { calculations: { some: { raw: { employee: employeeWhere } } } }),
        },
      }),
      this.prisma.timesheetPublication.count({
        where: { status: 'PUBLISHED', timesheet: { employee: employeeWhere } },
      }),
      this.prisma.employeeFeedback.count({
        where: { status: 'OPEN', employee: employeeWhere },
      }),
    ]);

    const employeeIds = new Set(
      employeesWithAttendance.flatMap((item) => (item.raw.employeeId ? [item.raw.employeeId] : [])),
    );
    return {
      employees,
      employeesWithAttendance: employeeIds.size,
      totalWorkedSeconds: totals._sum.workedSeconds ?? 0,
      tierSeconds: {
        tier100: totals._sum.tier100Seconds ?? 0,
        tier130: totals._sum.tier130Seconds ?? 0,
        tier150: totals._sum.tier150Seconds ?? 0,
        tier210: totals._sum.tier210Seconds ?? 0,
      },
      openExceptions: exceptions,
      pendingPeriods,
      publishedTimesheets: publications,
      openFeedback: feedback,
    };
  }

  async listEmployees(user: AuthenticatedUser, query: EmployeeQueryDto) {
    const page = Number(query.page);
    const pageSize = Number(query.pageSize);
    const scope = await this.employeeScope(user);
    const where: Prisma.EmployeeWhereInput = {
      AND: [
        scope,
        query.search
          ? {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {},
        query.departmentId ? { departmentId: query.departmentId } : {},
        query.status ? { status: query.status } : {},
      ],
    };
    const direction = query.sortOrder ?? 'asc';
    const orderBy: Prisma.EmployeeOrderByWithRelationInput[] =
      query.sortBy === 'name'
        ? [{ name: direction }, { code: 'asc' }]
        : query.sortBy === 'department'
          ? [{ department: { name: direction } }, { code: 'asc' }]
          : query.sortBy === 'status'
            ? [{ status: direction }, { code: 'asc' }]
            : [{ code: direction }];
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          departmentId: true,
          status: true,
          department: true,
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async employeeStatistics(user: AuthenticatedUser) {
    const scope = await this.employeeScope(user);
    const groups = await this.prisma.employee.groupBy({
      by: ['status'],
      where: scope,
      _count: { _all: true },
    });
    const counts: Record<EmployeeStatus, number> = {
      ACTIVE: 0,
      ON_LEAVE: 0,
      RESIGNED: 0,
    };
    for (const group of groups) counts[group.status] = group._count._all;
    return { total: Object.values(counts).reduce((sum, value) => sum + value, 0), ...counts };
  }

  async getEmployee(user: AuthenticatedUser, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, AND: [await this.employeeScope(user)] },
      select: {
        id: true,
        code: true,
        name: true,
        departmentId: true,
        status: true,
        department: true,
      },
    });
    if (!employee) throw new NotFoundException();
    return employee;
  }

  async employeeHistory(user: AuthenticatedUser, id: string) {
    await this.getEmployee(user, id);
    return this.prisma.employeeHistory.findMany({
      where: { employeeId: id },
      include: { actor: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createEmployee(user: AuthenticatedUser, dto: CreateEmployeeDto) {
    await this.assertDepartmentManaged(user, dto.departmentId);
    await this.assertReferenceData(dto.departmentId);
    const code = dto.code.trim();
    if (await this.prisma.employee.findUnique({ where: { code }, select: { id: true } })) {
      throw new ConflictException({
        code: 'EMPLOYEE_CODE_EXISTS',
        message: 'Mã nhân viên đã tồn tại.',
      });
    }
    const data = this.employeeCreateData(dto);
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data,
        select: {
          id: true,
          code: true,
          name: true,
          departmentId: true,
          status: true,
          department: true,
        },
      });
      const after = this.employeeSnapshot(employee);
      await tx.employeeHistory.create({
        data: {
          employeeId: employee.id,
          actorId: user.id,
          action: 'EMPLOYEE_CREATED',
          after,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'EMPLOYEE_CREATED',
          entity: 'Employee',
          entityId: employee.id,
          after,
        },
      });
      return employee;
    });
  }

  async updateEmployee(user: AuthenticatedUser, id: string, dto: UpdateEmployeeDto) {
    if (dto.name === undefined && dto.departmentId === undefined && dto.status === undefined) {
      throw new BadRequestException('Yêu cầu cập nhật không có trường hồ sơ hợp lệ.');
    }
    const current = await this.getEmployee(user, id);
    if (dto.departmentId) {
      await this.assertDepartmentManaged(user, dto.departmentId);
      await this.assertReferenceData(dto.departmentId);
    }
    const data: Prisma.EmployeeUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.departmentId !== undefined
        ? { department: { connect: { id: dto.departmentId } } }
        : {}),
      ...(dto.status !== undefined
        ? { status: dto.status, active: dto.status === EmployeeStatus.ACTIVE }
        : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id },
        data,
        select: {
          id: true,
          code: true,
          name: true,
          departmentId: true,
          status: true,
          department: true,
        },
      });
      const before = this.employeeSnapshot(current);
      const after = this.employeeSnapshot(updated);
      await tx.employeeHistory.create({
        data: {
          employeeId: id,
          actorId: user.id,
          action: 'EMPLOYEE_UPDATED',
          before,
          after,
          ...(dto.reason ? { reason: dto.reason.trim() } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'EMPLOYEE_UPDATED',
          entity: 'Employee',
          entityId: id,
          before,
          after,
          ...(dto.reason ? { reason: dto.reason.trim() } : {}),
        },
      });
      return updated;
    });
  }

  async deactivateEmployee(user: AuthenticatedUser, id: string, reason?: string) {
    const current = await this.getEmployee(user, id);
    const attendanceRecords = await this.prisma.attendanceRaw.count({ where: { employeeId: id } });
    if (current.status === EmployeeStatus.RESIGNED) {
      return { ...current, attendanceRecords, preservedAttendance: true };
    }
    const updated = await this.updateEmployee(user, id, {
      status: EmployeeStatus.RESIGNED,
      reason: reason?.trim() || 'Ngừng hoạt động từ màn quản lý nhân viên.',
    });
    return { ...updated, attendanceRecords, preservedAttendance: true };
  }

  listDepartments() {
    return this.prisma.department.findMany({ orderBy: { code: 'asc' } });
  }

  createDepartment(dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: { code: dto.code.trim(), name: dto.name.trim() },
    });
  }

  async employeeTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống chấm công In Nhật Hàn';
    const sheet = workbook.addWorksheet('NhanVien');
    const headers = ['Mã nhân viên', 'Tên nhân viên', 'Phòng ban', 'Trạng thái'];
    sheet.addRow(headers);
    sheet.addRow(['SYN-NV001', 'Nguyễn Văn Mẫu', 'SYN-FACTORY', 'ACTIVE']);
    sheet.columns = headers.map((header) => ({ header, width: Math.max(16, header.length + 4) }));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1769D2' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: 'D1' };

    const guide = workbook.addWorksheet('HuongDan');
    guide.columns = [{ width: 24 }, { width: 80 }];
    guide.addRows([
      ['Cột', 'Hướng dẫn'],
      ['Mã nhân viên', 'Bắt buộc và không được trùng trong file hoặc trong hệ thống.'],
      ['Tên nhân viên', 'Bắt buộc.'],
      ['Phòng ban', 'Nhập mã phòng ban đang hoạt động; cũng chấp nhận tên phòng ban duy nhất.'],
      ['Trạng thái', 'ACTIVE, ON_LEAVE hoặc RESIGNED.'],
      ['Chính sách trùng', 'Chỉ nhập nhân viên mới. Mã đã tồn tại sẽ chặn toàn bộ lần import.'],
      ['Dữ liệu mẫu', 'Toàn bộ dữ liệu ví dụ là synthetic, không phải thông tin cá nhân thật.'],
    ]);
    guide.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    guide.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1769D2' } };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async previewEmployeeImport(
    user: AuthenticatedUser,
    file?: { buffer: Buffer; originalname: string },
  ) {
    if (!file) throw new BadRequestException('Chưa chọn file Excel.');
    if (!/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('Chỉ hỗ trợ file Excel .xlsx.');
    }
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as never);
    } catch {
      throw new BadRequestException('Không thể đọc file Excel.');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('File Excel không có worksheet.');
    const expectedHeaders = ['Mã nhân viên', 'Tên nhân viên', 'Phòng ban', 'Trạng thái'];
    const actualHeaders = expectedHeaders.map((_, index) =>
      this.excelText(sheet.getRow(1).getCell(index + 1).value),
    );
    const hasExtraHeaders = Array.from(
      { length: Math.max(0, sheet.getRow(1).cellCount - expectedHeaders.length) },
      (_, index) =>
        this.excelText(sheet.getRow(1).getCell(expectedHeaders.length + index + 1).value),
    ).some(Boolean);
    if (
      expectedHeaders.some(
        (header, index) =>
          actualHeaders[index] !== header && !(index === 1 && actualHeaders[index] === 'Họ và tên'),
      ) ||
      hasExtraHeaders
    ) {
      throw new BadRequestException({
        code: 'INVALID_EMPLOYEE_IMPORT_HEADERS',
        message: 'Header file nhân viên không đúng mẫu.',
        expectedHeaders,
      });
    }

    const [departments, existingEmployees, managedDepartmentIds] = await Promise.all([
      this.prisma.department.findMany({
        where: { active: true },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.employee.findMany({ select: { code: true } }),
      this.managedDepartmentIds(user),
    ]);
    const departmentByCode = new Map<string, (typeof departments)[number]>();
    const departmentsByName = new Map<string, Array<(typeof departments)[number]>>();
    for (const department of departments) {
      departmentByCode.set(department.code.toLocaleUpperCase('vi-VN'), department);
      const nameKey = department.name.toLocaleUpperCase('vi-VN');
      departmentsByName.set(nameKey, [...(departmentsByName.get(nameKey) ?? []), department]);
    }
    const existingCodes = new Set(
      existingEmployees.map((item) => item.code.toLocaleUpperCase('vi-VN')),
    );
    const seenCodes = new Set<string>();
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const rows: CreateEmployeeDto[] = [];
    let dataRowCount = 0;

    for (let rowNo = 2; rowNo <= sheet.rowCount; rowNo++) {
      const row = sheet.getRow(rowNo);
      const values = Array.from({ length: 4 }, (_, index) =>
        this.excelText(row.getCell(index + 1).value),
      );
      if (values.every((value) => !value)) continue;
      dataRowCount += 1;
      const [rawCode = '', rawName = '', rawDepartment = '', rawStatus = ''] = values;
      const code = rawCode.trim();
      const name = rawName.trim();
      const departmentKey = rawDepartment.trim().toLocaleUpperCase('vi-VN');
      const departmentsWithName = departmentsByName.get(departmentKey) ?? [];
      const department =
        departmentByCode.get(departmentKey) ??
        (departmentsWithName.length === 1 ? departmentsWithName[0] : undefined);
      const status = rawStatus.trim().toLocaleUpperCase('vi-VN') as EmployeeStatus;
      const codeKey = code.toLocaleUpperCase('vi-VN');
      if (!code) errors.push({ row: rowNo, field: 'code', message: 'Mã nhân viên là bắt buộc.' });
      if (!name) errors.push({ row: rowNo, field: 'name', message: 'Tên nhân viên là bắt buộc.' });
      if (!department) {
        const departmentValue = rawDepartment.trim();
        errors.push({
          row: rowNo,
          field: 'department',
          message: !departmentValue
            ? 'Phòng ban là bắt buộc.'
            : departmentsWithName.length > 1
              ? `Tên phòng ban "${departmentValue}" không duy nhất; vui lòng dùng mã phòng ban.`
              : `Phòng ban "${departmentValue}" chưa tồn tại hoặc không hoạt động trong hệ thống.`,
        });
      }
      if (department && managedDepartmentIds && !managedDepartmentIds.has(department.id)) {
        errors.push({
          row: rowNo,
          field: 'department',
          message: 'Phòng ban nằm ngoài phạm vi được cấp quyền.',
        });
      }
      if (!Object.values(EmployeeStatus).includes(status))
        errors.push({ row: rowNo, field: 'status', message: 'Trạng thái không hợp lệ.' });
      if (existingCodes.has(codeKey))
        errors.push({ row: rowNo, field: 'code', message: 'Mã nhân viên đã tồn tại.' });
      if (seenCodes.has(codeKey))
        errors.push({ row: rowNo, field: 'code', message: 'Mã nhân viên bị trùng trong file.' });
      seenCodes.add(codeKey);
      if (department && Object.values(EmployeeStatus).includes(status)) {
        rows.push({
          code,
          name,
          departmentId: department.id,
          status,
        });
      }
    }
    if (rows.length === 0 && errors.length === 0) {
      errors.push({ row: 0, field: 'file', message: 'File không có dòng nhân viên.' });
    }
    return {
      fileName: file.originalname,
      rowCount: dataRowCount,
      rows,
      errors,
      canConfirm: errors.length === 0,
    };
  }

  async confirmEmployeeImport(user: AuthenticatedUser, dto: ConfirmEmployeeImportDto) {
    if (dto.rows.length === 0) throw new BadRequestException('Không có nhân viên để import.');
    const codes = dto.rows.map((row) => row.code.trim());
    if (new Set(codes.map((code) => code.toLocaleUpperCase('vi-VN'))).size !== codes.length) {
      throw new ConflictException('File import có mã nhân viên trùng nhau.');
    }
    const existing = await this.prisma.employee.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    if (existing.length) {
      throw new ConflictException({
        code: 'EMPLOYEE_IMPORT_CONFLICT',
        message: 'Import bị chặn vì có mã nhân viên đã tồn tại.',
        employeeCodes: existing.map((item) => item.code),
      });
    }
    for (const row of dto.rows) {
      await this.assertDepartmentManaged(user, row.departmentId);
      await this.assertReferenceData(row.departmentId);
    }
    const batchId = randomUUID();
    const preparedRows = dto.rows.map((row) => ({
      id: randomUUID(),
      source: row,
      data: this.employeeCreateData(row) satisfies Prisma.EmployeeCreateManyInput,
    }));
    const employeeRows = preparedRows.map((row) => ({ ...row.data, id: row.id }));
    await this.prisma.$transaction([
      this.prisma.employee.createMany({ data: employeeRows }),
      this.prisma.employeeHistory.createMany({
        data: preparedRows.map((row) => ({
          id: randomUUID(),
          employeeId: row.id,
          actorId: user.id,
          action: 'EMPLOYEE_IMPORTED',
          after: { id: row.id, ...row.data } as Prisma.InputJsonValue,
          reason: `Employee import batch ${batchId}`,
        })),
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'EMPLOYEE_IMPORT_CONFIRMED',
          entity: 'EmployeeImport',
          entityId: batchId,
          after: { rowCount: employeeRows.length, employeeIds: preparedRows.map((row) => row.id) },
        },
      }),
    ]);
    return { batchId, imported: employeeRows.length };
  }

  listPeriods() {
    return this.prisma.attendancePeriod.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  createPeriod(dto: CreatePeriodDto) {
    return this.prisma.attendancePeriod.create({ data: dto });
  }

  async transitionPeriod(id: string, dto: TransitionPeriodDto, user: AuthenticatedUser) {
    if (this.config.get('WORKFLOW_ENABLED') !== 'true') {
      throw new ConflictException({
        code: 'BUSINESS_RULE_NOT_CONFIGURED',
        message: 'Workflow đang tắt cho tới khi Q10/Q11 được phê duyệt.',
      });
    }
    if (!user.roles.includes(RoleCode.ADMIN)) {
      throw new ForbiddenException('Mặc định an toàn chỉ ADMIN được chuyển trạng thái.');
    }

    return this.prisma.$transaction(async (tx) => {
      const period = await tx.attendancePeriod.findUnique({ where: { id } });
      if (!period) throw new NotFoundException();
      if (period.version !== dto.expectedVersion)
        throw new ConflictException('Phiên bản kỳ đã thay đổi.');
      if (NEXT_STATUS[period.status] !== dto.targetStatus) {
        throw new ConflictException('Chuyển trạng thái không hợp lệ.');
      }
      const blocking = await tx.attendanceException.count({
        where: {
          blocking: true,
          status: ExceptionStatus.OPEN,
          calculation: { periodId: id },
        },
      });
      if (blocking > 0) throw new ConflictException('Kỳ còn ngoại lệ chặn.');

      const result = await tx.attendancePeriod.updateMany({
        where: { id, version: dto.expectedVersion, status: period.status },
        data: {
          status: dto.targetStatus,
          version: { increment: 1 },
          ...(dto.targetStatus === PeriodStatus.LOCKED ? { lockedAt: new Date() } : {}),
          ...(dto.targetStatus === PeriodStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
        },
      });
      if (result.count !== 1) throw new ConflictException('Xung đột cập nhật kỳ.');
      await tx.attendanceApproval.create({
        data: {
          periodId: id,
          fromStatus: period.status,
          toStatus: dto.targetStatus,
          actorId: user.id,
          periodVersion: dto.expectedVersion,
          ...(dto.reason ? { reason: dto.reason } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'PERIOD_TRANSITION',
          entity: 'AttendancePeriod',
          entityId: id,
          before: { status: period.status, version: period.version },
          after: { status: dto.targetStatus, version: period.version + 1 },
          ...(dto.reason ? { reason: dto.reason } : {}),
        },
      });
      return tx.attendancePeriod.findUniqueOrThrow({ where: { id } });
    });
  }

  calculatePreview(dto: CalculatePreviewDto) {
    return calculateAttendance(
      {
        employeeCode: dto.employeeCode,
        shiftCode: dto.shiftCode,
        shiftDate: dto.shiftDate,
        checkInAt: dto.checkInAt,
        checkOutAt: dto.checkOutAt,
        shiftDateEvidence: dto.shiftDateEvidence,
        checkOutDateEvidence: dto.checkOutDateEvidence,
      },
      {
        abnormalDurationThresholdSeconds: dto.abnormalDurationThresholdSeconds ?? 57_600,
        timezone: 'Asia/Ho_Chi_Minh',
      },
    );
  }

  async listExceptions(user: AuthenticatedUser, query: PaginationDto) {
    const where: Prisma.AttendanceExceptionWhereInput = user.roles.includes(RoleCode.ADMIN)
      ? {}
      : { raw: { employee: await this.employeeScope(user) } };
    return this.prisma.attendanceException.findMany({
      where,
      include: {
        raw: { select: { employeeCode: true, sheet: true, rowNo: true } },
        resolutions: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
  }

  async resolveException(id: string, dto: ResolveExceptionDto, user: AuthenticatedUser) {
    const where: Prisma.AttendanceExceptionWhereInput = user.roles.includes(RoleCode.ADMIN)
      ? { id }
      : { id, raw: { employee: await this.employeeScope(user) } };
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.attendanceException.findFirst({ where });
      if (!current) throw new NotFoundException();
      await tx.exceptionResolution.create({
        data: {
          exceptionId: id,
          action: dto.action,
          reason: dto.reason,
          actorId: user.id,
          before: { status: current.status },
          ...(dto.after ? { after: dto.after as Prisma.InputJsonValue } : {}),
        },
      });
      await tx.attendanceException.update({
        where: { id },
        data: { status: ExceptionStatus.RESOLVED },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'EXCEPTION_RESOLVED',
          entity: 'AttendanceException',
          entityId: id,
          before: { status: current.status },
          after: { status: ExceptionStatus.RESOLVED, requiresRevalidation: true },
          reason: dto.reason,
        },
      });
      return { id, status: ExceptionStatus.RESOLVED, requiresRevalidation: true };
    });
  }

  listShifts() {
    return this.prisma.shift.findMany({ include: { rules: true }, orderBy: { code: 'asc' } });
  }

  createShift(dto: CreateShiftDto) {
    return this.prisma.shift.create({ data: { code: dto.code, name: dto.name } });
  }

  listAudit(query: PaginationDto) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        actorId: true,
        action: true,
        entity: true,
        entityId: true,
        reason: true,
        requestId: true,
        createdAt: true,
      },
    });
  }

  async listAttendance(user: AuthenticatedUser, query: PaginationDto) {
    const employeeScope = await this.employeeScope(user);
    const where: Prisma.AttendanceCalculationWhereInput = {
      raw: {
        employee: employeeScope,
        ...(query.search
          ? {
              OR: [
                { employeeCode: { contains: query.search, mode: 'insensitive' } },
                { employeeName: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceCalculation.findMany({
        where,
        include: {
          raw: {
            select: {
              employeeId: true,
              employeeCode: true,
              employeeName: true,
              departmentName: true,
            },
          },
          normalization: true,
          period: { select: { id: true, year: true, month: true, status: true } },
          exceptions: { select: { id: true, code: true, blocking: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.attendanceCalculation.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async attendanceSummary(user: AuthenticatedUser, query: AttendanceSummaryQueryDto) {
    const result = await this.buildAttendanceSummary(user, query);
    return result.response;
  }

  async employeeAttendance(user: AuthenticatedUser, employeeId: string, periodId?: string) {
    await this.getEmployee(user, employeeId);
    return this.prisma.attendanceCalculation.findMany({
      where: { raw: { employeeId }, ...(periodId ? { periodId } : {}) },
      include: {
        raw: true,
        normalization: true,
        period: true,
        exceptions: true,
      },
      orderBy: [{ normalization: { shiftDate: 'desc' } }, { revision: 'desc' }],
    });
  }

  private emptyAttendanceTotals(): AttendanceSummaryTotals {
    return {
      employees: 0,
      calculatedEmployees: 0,
      workedSeconds: 0,
      tier100Seconds: 0,
      tier130Seconds: 0,
      tier150Seconds: 0,
      tier210Seconds: 0,
      lateSeconds: 0,
      earlySeconds: 0,
      attendanceDays: 0,
      exceptionCount: 0,
    };
  }

  private async buildAttendanceSummary(user: AuthenticatedUser, query: AttendanceSummaryQueryDto) {
    const page = Number(query.page || 1);
    const pageSize = Number(query.pageSize || 10);
    const period = query.periodId
      ? await this.prisma.attendancePeriod.findUnique({ where: { id: query.periodId } })
      : await this.prisma.attendancePeriod.findFirst({
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        });
    if (query.periodId && !period) throw new NotFoundException('Không tìm thấy kỳ công.');
    if (!period) {
      return {
        allRows: [] as AttendanceSummaryRow[],
        response: {
          items: [] as AttendanceSummaryRow[],
          total: 0,
          page,
          pageSize,
          period: null,
          totals: this.emptyAttendanceTotals(),
          workingDaysAvailable: false,
          calculationVersion: {
            engineVersions: [] as string[],
            maxRevision: null as number | null,
          },
        },
      };
    }

    const employeeScope = await this.employeeScope(user);
    const search = query.search?.trim();
    const scopedEmployees = await this.prisma.employee.findMany({
      where: employeeScope,
      select: {
        id: true,
        code: true,
        name: true,
        department: { select: { name: true } },
      },
      orderBy: { code: 'asc' },
    });
    const normalizedSearch = search ? this.normalizeSearchText(search) : '';
    const employees = normalizedSearch
      ? scopedEmployees.filter((employee) =>
          this.normalizeSearchText(`${employee.code} ${employee.name}`).includes(normalizedSearch),
        )
      : scopedEmployees;
    const employeeIds = employees.map((employee) => employee.id);
    const monthPrefix = `${period.year}-${String(period.month).padStart(2, '0')}`;

    const [calculations, rawRows] = employeeIds.length
      ? await this.prisma.$transaction([
          this.prisma.attendanceCalculation.findMany({
            where: {
              periodId: period.id,
              raw: { employeeId: { in: employeeIds } },
              ...(query.shiftCode ? { normalization: { shiftCode: query.shiftCode } } : {}),
            },
            select: {
              rawId: true,
              revision: true,
              status: true,
              engineVersion: true,
              workedSeconds: true,
              tier100Seconds: true,
              tier130Seconds: true,
              tier150Seconds: true,
              tier210Seconds: true,
              lateSeconds: true,
              earlySeconds: true,
              raw: { select: { employeeId: true, departmentName: true } },
              normalization: { select: { shiftDate: true, shiftCode: true } },
            },
            orderBy: [{ rawId: 'asc' }, { revision: 'desc' }],
          }),
          this.prisma.attendanceRaw.findMany({
            where: {
              employeeId: { in: employeeIds },
              attendanceDateRaw: { startsWith: monthPrefix },
              ...(query.shiftCode
                ? { normalizations: { some: { shiftCode: query.shiftCode } } }
                : {}),
            },
            select: {
              id: true,
              employeeId: true,
              departmentName: true,
              exceptions: {
                where: { status: ExceptionStatus.OPEN },
                select: { id: true, blocking: true },
              },
            },
          }),
        ])
      : [[], []];

    const latestCalculations = new Map<string, (typeof calculations)[number]>();
    for (const calculation of calculations) {
      if (!latestCalculations.has(calculation.rawId)) {
        latestCalculations.set(calculation.rawId, calculation);
      }
    }

    type Accumulator = {
      workedSeconds: number;
      tier100Seconds: number;
      tier130Seconds: number;
      tier150Seconds: number;
      tier210Seconds: number;
      lateSeconds: number;
      earlySeconds: number;
      shiftDates: Set<string>;
      exceptionCount: number;
      blockingExceptionCount: number;
      hasReviewCalculation: boolean;
      departmentCounts: Map<string, number>;
    };
    const byEmployee = new Map<string, Accumulator>();
    const accumulatorFor = (employeeId: string) => {
      let accumulator = byEmployee.get(employeeId);
      if (!accumulator) {
        accumulator = {
          workedSeconds: 0,
          tier100Seconds: 0,
          tier130Seconds: 0,
          tier150Seconds: 0,
          tier210Seconds: 0,
          lateSeconds: 0,
          earlySeconds: 0,
          shiftDates: new Set<string>(),
          exceptionCount: 0,
          blockingExceptionCount: 0,
          hasReviewCalculation: false,
          departmentCounts: new Map<string, number>(),
        };
        byEmployee.set(employeeId, accumulator);
      }
      return accumulator;
    };
    const countDepartment = (accumulator: Accumulator, departmentName: string | null) => {
      const name = departmentName?.trim();
      if (!name) return;
      accumulator.departmentCounts.set(name, (accumulator.departmentCounts.get(name) ?? 0) + 1);
    };

    for (const raw of rawRows) {
      if (!raw.employeeId) continue;
      const accumulator = accumulatorFor(raw.employeeId);
      countDepartment(accumulator, raw.departmentName);
      accumulator.exceptionCount += raw.exceptions.length;
      accumulator.blockingExceptionCount += raw.exceptions.filter((item) => item.blocking).length;
    }
    const engineVersions = new Set<string>();
    let maxRevision: number | null = null;
    for (const calculation of latestCalculations.values()) {
      const employeeId = calculation.raw.employeeId;
      if (!employeeId) continue;
      const accumulator = accumulatorFor(employeeId);
      countDepartment(accumulator, calculation.raw.departmentName);
      engineVersions.add(calculation.engineVersion);
      maxRevision = Math.max(maxRevision ?? calculation.revision, calculation.revision);
      if (calculation.status !== 'VALID') {
        accumulator.hasReviewCalculation = true;
        continue;
      }
      accumulator.workedSeconds += calculation.workedSeconds ?? 0;
      accumulator.tier100Seconds += calculation.tier100Seconds ?? 0;
      accumulator.tier130Seconds += calculation.tier130Seconds ?? 0;
      accumulator.tier150Seconds += calculation.tier150Seconds ?? 0;
      accumulator.tier210Seconds += calculation.tier210Seconds ?? 0;
      accumulator.lateSeconds += calculation.lateSeconds ?? 0;
      accumulator.earlySeconds += calculation.earlySeconds ?? 0;
      if (calculation.normalization.shiftDate) {
        accumulator.shiftDates.add(calculation.normalization.shiftDate.toISOString().slice(0, 10));
      }
    }

    let rows: AttendanceSummaryRow[] = employees.map((employee) => {
      const accumulator = byEmployee.get(employee.id);
      const calculated = Boolean(accumulator && accumulator.shiftDates.size > 0);
      const processingStatus: AttendanceProcessingStatus =
        accumulator && (accumulator.blockingExceptionCount > 0 || accumulator.hasReviewCalculation)
          ? 'NEEDS_REVIEW'
          : calculated
            ? 'VALID'
            : 'NO_DATA';
      const periodDepartment = accumulator
        ? [...accumulator.departmentCounts.entries()].sort(
            (left, right) => right[1] - left[1],
          )[0]?.[0]
        : undefined;
      return {
        employeeId: employee.id,
        employeeCode: employee.code,
        employeeName: employee.name,
        departmentName: periodDepartment ?? employee.department?.name ?? null,
        workedSeconds: accumulator?.workedSeconds ?? 0,
        tier100Seconds: accumulator?.tier100Seconds ?? 0,
        tier130Seconds: accumulator?.tier130Seconds ?? 0,
        tier150Seconds: accumulator?.tier150Seconds ?? 0,
        tier210Seconds: accumulator?.tier210Seconds ?? 0,
        lateSeconds: accumulator?.lateSeconds ?? 0,
        earlySeconds: accumulator?.earlySeconds ?? 0,
        workingDays: null,
        attendanceDays: accumulator?.shiftDates.size ?? 0,
        exceptionCount: accumulator?.exceptionCount ?? 0,
        processingStatus,
        approvalStatus: period.status,
        calculated,
      };
    });

    if (query.shiftCode) rows = rows.filter((row) => byEmployee.has(row.employeeId));
    if (query.department) {
      const department = this.normalizeSearchText(query.department);
      rows = rows.filter(
        (row) => row.departmentName && this.normalizeSearchText(row.departmentName) === department,
      );
    }
    if (query.processingStatus) {
      rows = rows.filter((row) => row.processingStatus === query.processingStatus);
    }
    if (query.approvalStatus && query.approvalStatus !== period.status) rows = [];

    const sortBy = query.sortBy ?? 'code';
    const direction = query.sortOrder === 'desc' ? -1 : 1;
    const valueFor = (row: AttendanceSummaryRow): string | number => {
      if (sortBy === 'name') return row.employeeName;
      if (sortBy === 'department') return row.departmentName ?? '';
      if (sortBy === 'workedSeconds') return row.workedSeconds;
      if (sortBy === 'attendanceDays') return row.attendanceDays;
      if (sortBy === 'exceptionCount') return row.exceptionCount;
      if (sortBy === 'processingStatus') return row.processingStatus;
      return row.employeeCode;
    };
    rows.sort((left, right) => {
      const leftValue = valueFor(left);
      const rightValue = valueFor(right);
      const compared =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), 'vi', { sensitivity: 'base' });
      return compared === 0
        ? left.employeeCode.localeCompare(right.employeeCode, 'vi', { sensitivity: 'base' })
        : compared * direction;
    });

    const totals = rows.reduce<AttendanceSummaryTotals>(
      (total, row) => ({
        employees: total.employees + 1,
        calculatedEmployees: total.calculatedEmployees + (row.calculated ? 1 : 0),
        workedSeconds: total.workedSeconds + row.workedSeconds,
        tier100Seconds: total.tier100Seconds + row.tier100Seconds,
        tier130Seconds: total.tier130Seconds + row.tier130Seconds,
        tier150Seconds: total.tier150Seconds + row.tier150Seconds,
        tier210Seconds: total.tier210Seconds + row.tier210Seconds,
        lateSeconds: total.lateSeconds + row.lateSeconds,
        earlySeconds: total.earlySeconds + row.earlySeconds,
        attendanceDays: total.attendanceDays + row.attendanceDays,
        exceptionCount: total.exceptionCount + row.exceptionCount,
      }),
      this.emptyAttendanceTotals(),
    );
    const offset = (page - 1) * pageSize;
    return {
      allRows: rows,
      response: {
        items: rows.slice(offset, offset + pageSize),
        total: rows.length,
        page,
        pageSize,
        period: {
          id: period.id,
          year: period.year,
          month: period.month,
          status: period.status,
          version: period.version,
          lockedAt: period.lockedAt,
          publishedAt: period.publishedAt,
        },
        totals,
        workingDaysAvailable: false,
        calculationVersion: {
          engineVersions: [...engineVersions].sort(),
          maxRevision,
        },
      },
    };
  }

  async listPublications(user: AuthenticatedUser) {
    const employeeScope = await this.employeeScope(user);
    return this.prisma.timesheetPublication.findMany({
      where: { timesheet: { employee: employeeScope } },
      include: {
        timesheet: {
          include: {
            employee: { select: { id: true, code: true, name: true } },
            period: { select: { id: true, year: true, month: true, status: true } },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async myTimesheets(user: AuthenticatedUser) {
    if (!user.employeeId) throw new ForbiddenException('Tài khoản chưa gắn nhân viên.');
    return this.prisma.timesheet.findMany({
      where: {
        employeeId: user.employeeId,
        publications: { some: { status: 'PUBLISHED' } },
      },
      include: { period: true, publications: true },
      orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }, { revision: 'desc' }],
    });
  }

  async markPublication(
    user: AuthenticatedUser,
    publicationId: string,
    action: 'view' | 'confirm',
  ) {
    if (!user.employeeId) throw new ForbiddenException();
    const publication = await this.prisma.timesheetPublication.findFirst({
      where: { id: publicationId, timesheet: { employeeId: user.employeeId }, status: 'PUBLISHED' },
    });
    if (!publication) throw new NotFoundException();
    return this.prisma.timesheetPublication.update({
      where: { id: publicationId },
      data: action === 'view' ? { viewedAt: new Date() } : { confirmedAt: new Date() },
    });
  }

  async createFeedback(user: AuthenticatedUser, publicationId: string, dto: FeedbackDto) {
    if (!user.employeeId) throw new ForbiddenException();
    const publication = await this.prisma.timesheetPublication.findFirst({
      where: { id: publicationId, timesheet: { employeeId: user.employeeId }, status: 'PUBLISHED' },
    });
    if (!publication) throw new NotFoundException();
    return this.prisma.employeeFeedback.create({
      data: {
        publicationId,
        employeeId: user.employeeId,
        type: dto.type,
        body: dto.body,
      },
    });
  }

  async exportAttendanceSummaryExcel(user: AuthenticatedUser, query: AttendanceSummaryQueryDto) {
    const { allRows, response } = await this.buildAttendanceSummary(user, query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống chấm công In Nhật Hàn';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('TongHopKyCong', {
      views: [{ state: 'frozen', ySplit: 8, xSplit: 3 }],
    });
    const periodLabel = response.period
      ? `Tháng ${String(response.period.month).padStart(2, '0')}/${response.period.year}`
      : 'Chưa có kỳ công';
    const temporary = !response.period || !['LOCKED', 'PUBLISHED'].includes(response.period.status);
    sheet.mergeCells('A1:P1');
    sheet.getCell('A1').value = 'CÔNG TY TNHH IN NHẬT HÀN';
    sheet.mergeCells('A2:P2');
    sheet.getCell('A2').value = 'BẢNG CÔNG TỔNG HỢP';
    sheet.mergeCells('A3:P3');
    sheet.getCell('A3').value = `${periodLabel}${temporary ? ' — DỮ LIỆU TẠM, CHƯA CHỐT' : ''}`;
    sheet.mergeCells('A4:P4');
    sheet.getCell('A4').value =
      `Bộ lọc: Phòng ban=${this.safeExcelText(query.department ?? 'Tất cả')}; Ca=${this.safeExcelText(query.shiftCode ?? 'Tất cả')}; Trạng thái xử lý=${query.processingStatus ?? 'Tất cả'}; Trạng thái kỳ=${query.approvalStatus ?? 'Tất cả'}; Tìm kiếm=${this.safeExcelText(query.search ?? 'Không')}`;
    sheet.mergeCells('A5:P5');
    sheet.getCell('A5').value =
      `Xuất lúc: ${new Date().toISOString()}; phiên bản kỳ: ${response.period?.version ?? 'N/A'}; engine: ${response.calculationVersion.engineVersions.join(', ') || 'N/A'}; revision cao nhất: ${response.calculationVersion.maxRevision ?? 'N/A'}`;
    sheet.mergeCells('A6:P6');
    sheet.getCell('A6').value =
      `Tổng nhân viên: ${response.totals.employees}; đã tính công: ${response.totals.calculatedEmployees}; ngoại lệ mở: ${response.totals.exceptionCount}`;
    for (const rowNumber of [1, 2, 3]) {
      sheet.getRow(rowNumber).font = {
        bold: true,
        size: rowNumber === 2 ? 16 : 11,
        color: { argb: rowNumber === 3 && temporary ? 'FFB45309' : 'FF14213D' },
      };
      sheet.getRow(rowNumber).alignment = { horizontal: 'center' };
    }
    sheet.getRow(4).font = { size: 9, color: { argb: 'FF475569' } };
    sheet.getRow(5).font = { size: 9, color: { argb: 'FF475569' } };
    sheet.getRow(6).font = { bold: true, size: 10, color: { argb: 'FF14213D' } };

    const headers = [
      'STT',
      'Mã NV',
      'Họ tên',
      'Phòng ban trong kỳ',
      'Tổng công',
      'Giờ 100%',
      'Giờ 130%',
      'Giờ 150%',
      'Giờ 210%',
      'Đi muộn',
      'Về sớm',
      'Số ngày làm việc',
      'Số ngày có mặt',
      'Số ngoại lệ',
      'Trạng thái xử lý',
      'Trạng thái kỳ',
    ];
    sheet.addRow([]);
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1769D2' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 32;
    const durationColumns = [5, 6, 7, 8, 9, 10, 11];
    allRows.forEach((row, index) => {
      const values: Array<string | number> = [
        index + 1,
        this.safeExcelText(row.employeeCode),
        this.safeExcelText(row.employeeName),
        this.safeExcelText(row.departmentName ?? '—'),
        row.workedSeconds / 86_400,
        row.tier100Seconds / 86_400,
        row.tier130Seconds / 86_400,
        row.tier150Seconds / 86_400,
        row.tier210Seconds / 86_400,
        row.lateSeconds / 86_400,
        row.earlySeconds / 86_400,
        row.workingDays ?? 'N/A',
        row.attendanceDays,
        row.exceptionCount,
        row.processingStatus,
        row.approvalStatus,
      ];
      const excelRow = sheet.addRow(values);
      durationColumns.forEach((column) => {
        excelRow.getCell(column).numFmt = '[h]:mm:ss';
      });
    });
    const totalRow = sheet.addRow([
      '',
      '',
      'TỔNG CỘNG',
      '',
      response.totals.workedSeconds / 86_400,
      response.totals.tier100Seconds / 86_400,
      response.totals.tier130Seconds / 86_400,
      response.totals.tier150Seconds / 86_400,
      response.totals.tier210Seconds / 86_400,
      response.totals.lateSeconds / 86_400,
      response.totals.earlySeconds / 86_400,
      'N/A',
      response.totals.attendanceDays,
      response.totals.exceptionCount,
      '',
      '',
    ]);
    totalRow.font = { bold: true, color: { argb: 'FF14213D' } };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    durationColumns.forEach((column) => {
      totalRow.getCell(column).numFmt = '[h]:mm:ss';
    });
    sheet.columns = [8, 14, 28, 24, 15, 15, 15, 15, 15, 14, 14, 18, 16, 14, 20, 18].map(
      (width) => ({ width }),
    );
    sheet.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8, column: 16 } };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async exportAttendanceExcel(user: AuthenticatedUser) {
    const employeeScope = await this.employeeScope(user);
    const calculations = await this.prisma.attendanceCalculation.findMany({
      where: { raw: { employee: employeeScope } },
      include: { raw: true, normalization: true, period: true },
      orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
      take: 50_000,
    });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống chấm công In Nhật Hàn';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('BangCong');
    const columns: Array<[string, string]> = [
      ['Mã NV', 'employeeCode'],
      ['Họ tên', 'employeeName'],
      ['Phòng ban', 'departmentName'],
      ['Kỳ', 'period'],
      ['Ngày ca', 'shiftDate'],
      ['Giờ vào', 'checkInAt'],
      ['Giờ ra', 'checkOutAt'],
      ['Giờ công (giây)', 'workedSeconds'],
      ['Đi muộn (giây)', 'lateSeconds'],
      ['Về sớm (giây)', 'earlySeconds'],
      ['100% (giây)', 'tier100Seconds'],
      ['130% (giây)', 'tier130Seconds'],
      ['150% (giây)', 'tier150Seconds'],
      ['210% (giây)', 'tier210Seconds'],
      ['Trạng thái', 'status'],
    ];
    sheet.columns = columns.map(([header, key]) => ({ header, key, width: 20 }));
    for (const item of calculations) {
      sheet.addRow({
        employeeCode: this.safeExcelText(item.raw.employeeCode),
        employeeName: this.safeExcelText(item.raw.employeeName),
        departmentName: this.safeExcelText(item.raw.departmentName),
        period: `${item.period.month}/${item.period.year}`,
        shiftDate: item.normalization.shiftDate,
        checkInAt: item.normalization.checkInAt,
        checkOutAt: item.normalization.checkOutAt,
        workedSeconds: item.workedSeconds,
        lateSeconds: item.lateSeconds,
        earlySeconds: item.earlySeconds,
        tier100Seconds: item.tier100Seconds,
        tier130Seconds: item.tier130Seconds,
        tier150Seconds: item.tier150Seconds,
        tier210Seconds: item.tier210Seconds,
        status: item.status,
      });
    }
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1769D2' } };
    sheet.autoFilter = { from: 'A1', to: 'O1' };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async timesheetPdf(user: AuthenticatedUser, timesheetId: string) {
    const employeeScope = await this.employeeScope(user);
    const timesheet = await this.prisma.timesheet.findFirst({
      where: { id: timesheetId, employee: employeeScope },
      include: { employee: { include: { department: true } }, period: true },
    });
    if (!timesheet) throw new NotFoundException();
    const require = createRequire(import.meta.url);
    const packageFile = require.resolve('@fontsource/noto-sans/package.json');
    const fontFile = join(dirname(packageFile), 'files', 'noto-sans-vietnamese-400-normal.woff');
    const document = new PDFDocument({ size: 'A4', margin: 42, info: { Title: 'Bảng công mẫu' } });
    document.registerFont('NotoSans', fontFile);
    document.font('NotoSans');
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolveBuffer, reject) => {
      document.on('end', () => resolveBuffer(Buffer.concat(chunks)));
      document.on('error', reject);
    });
    document
      .fillColor('#DC2626')
      .fontSize(9)
      .text('MẪU PHÁT TRIỂN – CHƯA PHÊ DUYỆT', { align: 'center' });
    document
      .moveDown()
      .fillColor('#14213D')
      .fontSize(18)
      .text('IN NHẬT HÀN – BẢNG CÔNG', { align: 'center' });
    document
      .fontSize(10)
      .fillColor('#475569')
      .text('Wordmark tạm – chờ mẫu PDF chính thức', { align: 'center' });
    document.moveDown(2).fillColor('#14213D').fontSize(11);
    document.text(`Nhân viên: ${timesheet.employee.code} – ${timesheet.employee.name}`);
    document.text(`Phòng ban: ${timesheet.employee.department?.name ?? '—'}`);
    document.text(`Kỳ công: ${timesheet.period.month}/${timesheet.period.year}`);
    document.text(`Phiên bản: ${timesheet.revision}`);
    document.text(`Tổng thời gian: ${timesheet.totalSeconds} giây`);
    document.moveDown().fontSize(9).fillColor('#64748B');
    document.text(
      'Dữ liệu lấy từ snapshot đã khóa; tài liệu này không phát hành cho nhân viên thật.',
    );
    document
      .moveDown()
      .fontSize(7)
      .text(JSON.stringify(timesheet.snapshot, null, 2), { width: 510 });
    document.end();
    return completed;
  }

  private employeeCreateData(dto: CreateEmployeeDto): Prisma.EmployeeUncheckedCreateInput {
    return {
      code: dto.code.trim(),
      name: dto.name.trim(),
      departmentId: dto.departmentId,
      status: dto.status,
      active: dto.status === EmployeeStatus.ACTIVE,
    };
  }

  private employeeSnapshot(employee: {
    id: string;
    code: string;
    name: string;
    departmentId: string | null;
    status: EmployeeStatus;
  }): Prisma.InputJsonObject {
    return {
      id: employee.id,
      code: employee.code,
      name: employee.name,
      departmentId: employee.departmentId,
      status: employee.status,
    };
  }

  private excelText(value: ExcelJS.CellValue) {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object') {
      if ('formula' in value) return '';
      if ('text' in value) return String(value.text).trim();
      if ('richText' in value)
        return value.richText
          .map((part) => part.text)
          .join('')
          .trim();
      return '';
    }
    return String(value).trim();
  }

  private async managedDepartmentIds(user: AuthenticatedUser): Promise<Set<string> | null> {
    if (user.roles.includes(RoleCode.ADMIN)) return null;
    const scopes = await this.prisma.managerScope.findMany({
      where: {
        userId: user.id,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        departmentId: { not: null },
      },
      select: { departmentId: true },
    });
    return new Set(scopes.flatMap((scope) => (scope.departmentId ? [scope.departmentId] : [])));
  }

  private async assertDepartmentManaged(user: AuthenticatedUser, departmentId: string) {
    const managed = await this.managedDepartmentIds(user);
    if (managed && !managed.has(departmentId)) {
      throw new ForbiddenException('Phòng ban nằm ngoài phạm vi được cấp quyền.');
    }
  }

  private async assertReferenceData(departmentId: string | null) {
    const department = departmentId
      ? await this.prisma.department.findFirst({
          where: { id: departmentId, active: true },
          select: { id: true },
        })
      : null;
    if (departmentId && !department) throw new BadRequestException('Phòng ban không hợp lệ.');
  }

  private safeExcelText(value: string) {
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }

  private normalizeSearchText(value: string) {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/giu, 'd')
      .toLocaleLowerCase('vi-VN')
      .trim();
  }

  private async employeeScope(user: AuthenticatedUser): Promise<Prisma.EmployeeWhereInput> {
    if (user.roles.includes(RoleCode.ADMIN)) return {};
    const isScopedRole = user.roles.includes(RoleCode.HR) || user.roles.includes(RoleCode.MANAGER);
    if (!isScopedRole) {
      return user.roles.includes(RoleCode.EMPLOYEE) && user.employeeId
        ? { id: user.employeeId }
        : { id: { in: [] } };
    }
    const scopes = await this.prisma.managerScope.findMany({
      where: {
        userId: user.id,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      select: { departmentId: true, employeeId: true },
    });
    const departmentIds = scopes.flatMap((scope) =>
      scope.departmentId ? [scope.departmentId] : [],
    );
    const employeeIds = scopes.flatMap((scope) => (scope.employeeId ? [scope.employeeId] : []));
    if (departmentIds.length === 0 && employeeIds.length === 0) return { id: { in: [] } };
    return {
      OR: [
        ...(departmentIds.length ? [{ departmentId: { in: departmentIds } }] : []),
        ...(employeeIds.length ? [{ id: { in: employeeIds } }] : []),
      ],
    };
  }
}

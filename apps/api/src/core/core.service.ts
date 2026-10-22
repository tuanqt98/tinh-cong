import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
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
import { ExceptionStatus, PeriodStatus, Prisma, RoleCode } from '../generated/prisma/index.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CalculatePreviewDto,
  CreateDepartmentDto,
  CreateEmployeeDto,
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

  async listEmployees(user: AuthenticatedUser, query: PaginationDto) {
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
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: { department: true },
        orderBy: [{ active: 'desc' }, { code: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getEmployee(user: AuthenticatedUser, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, AND: [await this.employeeScope(user)] },
      include: { department: true },
    });
    if (!employee) throw new NotFoundException();
    return employee;
  }

  createEmployee(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        code: dto.code.trim(),
        name: dto.name.trim(),
        ...(dto.departmentId ? { departmentId: dto.departmentId } : {}),
      },
      include: { department: true },
    });
  }

  updateEmployee(id: string, dto: UpdateEmployeeDto) {
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
      include: { department: true },
    });
  }

  listDepartments() {
    return this.prisma.department.findMany({ orderBy: { code: 'asc' } });
  }

  createDepartment(dto: CreateDepartmentDto) {
    return this.prisma.department.create({
      data: { code: dto.code.trim(), name: dto.name.trim() },
    });
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

  async employeeAttendance(user: AuthenticatedUser, employeeId: string) {
    await this.getEmployee(user, employeeId);
    return this.prisma.attendanceCalculation.findMany({
      where: { raw: { employeeId } },
      include: {
        raw: true,
        normalization: true,
        period: true,
        exceptions: true,
      },
      orderBy: [{ normalization: { shiftDate: 'desc' } }, { revision: 'desc' }],
    });
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

  private safeExcelText(value: string) {
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
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

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calculateAttendance, type EngineShiftRule } from '@tinh-cong/attendance-engine';
import { CalculationStatus, Prisma } from '../generated/prisma/index.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PaginationDto } from '../core/dto.js';
import { ExcelParserService } from './excel-parser.service.js';
import {
  SOURCE_FIELDS,
  isBlankAttendance,
  isSundayRestWithoutAttendance,
  type ColumnMapping,
  type ParsedSourceRow,
  type SourceField,
  type UploadedWorkbook,
} from './imports.types.js';

interface PreviewMetadata {
  mapping: ColumnMapping;
  sheets: string[];
  rowCount: number;
  previewRows: ParsedSourceRow[];
  duplicateKeyFields: SourceField[];
  duplicateRuleConfigured: boolean;
}

type RawRow = Prisma.AttendanceRawGetPayload<Record<string, never>>;
type ShiftWithRules = Prisma.ShiftGetPayload<{
  include: { rules: true };
}>;

type SupportedShiftCode = 'CA1' | 'CA3';

const SHIFT_DEFINITIONS: Record<
  SupportedShiftCode,
  {
    name: string;
    effectiveFrom: string;
    scheduledStartSeconds: number;
    scheduledCompletionSeconds: number;
    breakStartSeconds: number;
    breakEndSeconds: number;
    abnormalDurationThresholdSeconds: number;
    tiers: Prisma.InputJsonObject;
  }
> = {
  CA1: {
    name: 'Ca 1',
    effectiveFrom: '2026-09-01',
    scheduledStartSeconds: 25_200,
    scheduledCompletionSeconds: 68_400,
    breakStartSeconds: 43_200,
    breakEndSeconds: 46_800,
    abnormalDurationThresholdSeconds: 57_600,
    tiers: {
      tier100: 28_800,
      tier150After: 28_800,
      targetWorkedSeconds: 39_600,
      countEarlyArrivalSeconds: false,
      checkOutBlockSeconds: 1_800,
      postCompletionBlockSeconds: 1_800,
      sundayTierPercentage: 200,
      lateAfterSeconds: 28_860,
    },
  },
  CA3: {
    name: 'Ca 3',
    effectiveFrom: '2026-09-01',
    scheduledStartSeconds: 68_400,
    scheduledCompletionSeconds: 111_600,
    breakStartSeconds: 86_400,
    breakEndSeconds: 90_000,
    abnormalDurationThresholdSeconds: 57_600,
    tiers: {
      tier100: 14_400,
      tier130: 14_400,
      tier210After: 28_800,
      targetWorkedSeconds: 39_600,
      countEarlyArrivalSeconds: false,
      postCompletionBlockSeconds: 1_800,
      sundayTierPercentage: 230,
      lateAfterSeconds: 79_260,
    },
  },
};

@Injectable()
export class ImportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ExcelParserService) private readonly parser: ExcelParserService,
  ) {}

  async preview(file: UploadedWorkbook | undefined, mappingText: string, user: AuthenticatedUser) {
    this.assertWorkbook(file);
    const mapping = this.parser.parseMapping(mappingText);
    const parsed = await this.parser.parse(file.buffer, mapping);
    const companyHolidayDates = await this.companyHolidayDates(
      parsed.rows.flatMap((row) => (row.attendanceDate ? [row.attendanceDate] : [])),
    );
    const companyHolidayRestRows = new Set(
      parsed.rows
        .filter(
          (row) =>
            Boolean(row.attendanceDate && companyHolidayDates.has(row.attendanceDate)) &&
            isBlankAttendance(row),
        )
        .map((row) => `${row.sheet}\u0000${row.rowNo}`),
    );
    const restAttendanceIssueCodes = new Set([
      'INVALID_SHIFT',
      'NO_ATTENDANCE',
      'MISSING_CHECKIN',
      'MISSING_CHECKOUT',
    ]);
    const issues = parsed.issues.filter(
      (issue) =>
        !(
          companyHolidayRestRows.has(`${issue.sheet}\u0000${issue.rowNo}`) &&
          restAttendanceIssueCodes.has(issue.code)
        ),
    );
    const duplicateKeyFields = this.duplicateKeyFields();
    const duplicateRuleConfigured = duplicateKeyFields.length > 0;
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = await this.storeSource(file.buffer);

    const importRecord = await this.prisma.attendanceImport.create({
      data: {
        originalName: basename(file.originalname),
        storageKey,
        sha256,
        mappingVersion: 'manual-v1',
        attemptedById: user.id,
        metadata: {
          mapping,
          sheets: parsed.sheets,
          rowCount: parsed.rows.length,
          previewRows: parsed.rows.slice(0, 100),
          duplicateKeyFields,
          duplicateRuleConfigured,
        } as unknown as Prisma.InputJsonValue,
        issues: {
          create: issues.map((issue) => ({
            sheet: issue.sheet,
            rowNo: issue.rowNo,
            issueCode: issue.code,
            evidence: issue as unknown as Prisma.InputJsonValue,
          })),
        },
      },
    });

    return {
      id: importRecord.id,
      status: importRecord.status,
      sha256,
      sheets: parsed.sheets,
      rowCount: parsed.rows.length,
      previewRows: parsed.rows.slice(0, 100),
      issues,
      duplicateRuleConfigured,
      canConfirm: !issues.some((issue) => issue.blocking) && duplicateRuleConfigured,
    };
  }

  async confirm(id: string, user: AuthenticatedUser) {
    const record = await this.prisma.attendanceImport.findUnique({
      where: { id },
      include: { issues: true },
    });
    if (!record || !record.storageKey) throw new NotFoundException();
    if (record.attemptedById !== user.id) {
      throw new ConflictException('Chỉ người tạo preview được confirm trong phiên bản này.');
    }
    if (record.status !== 'PREVIEW') {
      throw new ConflictException({
        code: 'IMPORT_ALREADY_PROCESSED',
        message: `Import đã được xử lý với trạng thái ${record.status}.`,
      });
    }
    const duplicateKeyFields = this.duplicateKeyFields();
    if (!duplicateKeyFields.length) {
      throw new ConflictException({
        code: 'DUPLICATE_RULE_UNCONFIGURED',
        message: 'Chưa cấu hình khóa trùng được HR phê duyệt.',
      });
    }
    if (
      record.issues.some((issue) => {
        const evidence = issue.evidence as { blocking?: boolean } | null;
        return evidence?.blocking === true;
      })
    ) {
      throw new BadRequestException('Preview còn lỗi cấu trúc chặn import.');
    }

    const metadata = record.metadata as unknown as PreviewMetadata;
    const parsed = await this.parser.parse(await readFile(record.storageKey), metadata.mapping);
    const keyedRows = parsed.rows.map((row) => ({
      row,
      key: this.duplicateKey(row, duplicateKeyFields),
    }));
    const withinFile = new Map<string, ParsedSourceRow[]>();
    for (const item of keyedRows) {
      const rows = withinFile.get(item.key) ?? [];
      rows.push(item.row);
      withinFile.set(item.key, rows);
    }
    const duplicateIssues: Array<{
      row: ParsedSourceRow;
      key: string;
      scope: 'WITHIN_FILE' | 'STORED_DATA';
    }> = [...withinFile.entries()]
      .filter(([, rows]) => rows.length > 1)
      .flatMap(([key, rows]) => rows.map((row) => ({ row, key, scope: 'WITHIN_FILE' as const })));
    const stored = await this.prisma.attendanceRaw.findMany({
      where: { sourceIdentityHash: { in: keyedRows.map((item) => item.key) } },
      select: { sourceIdentityHash: true },
    });
    const storedKeys = new Set(
      stored.flatMap((item) => (item.sourceIdentityHash ? [item.sourceIdentityHash] : [])),
    );
    for (const item of keyedRows) {
      if (storedKeys.has(item.key))
        duplicateIssues.push({ row: item.row, key: item.key, scope: 'STORED_DATA' });
    }

    if (duplicateIssues.length) {
      await this.prisma.$transaction([
        this.prisma.attendanceImportIssue.createMany({
          data: duplicateIssues.map((issue) => ({
            importId: id,
            sheet: issue.row.sheet,
            rowNo: issue.row.rowNo,
            issueCode: 'DUPLICATE',
            matchScope: issue.scope,
            evidence: { keyHash: issue.key },
          })),
        }),
        this.prisma.attendanceImport.update({
          where: { id },
          data: { status: 'REJECTED', rejectionReason: 'DUPLICATE_DETECTED' },
        }),
        this.prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: 'IMPORT_REJECTED',
            entity: 'AttendanceImport',
            entityId: id,
            reason: 'DUPLICATE_DETECTED',
            after: { duplicateCount: duplicateIssues.length },
          },
        }),
      ]);
      return { id, status: 'REJECTED', duplicateCount: duplicateIssues.length };
    }

    await this.prisma.$transaction([
      this.prisma.attendanceRaw.createMany({
        data: keyedRows.map(({ row, key }) => ({
          importId: id,
          sheet: row.sheet,
          rowNo: row.rowNo,
          employeeCode: row.employeeCode ?? '',
          employeeName: row.employeeName ?? '',
          departmentName: row.departmentName ?? '',
          attendanceDateRaw: row.attendanceDate,
          checkInRaw: row.checkIn,
          checkOutRaw: row.checkOut,
          shiftNameRaw: row.shiftName,
          rawCells: row.rawCells,
          sourceIdentityHash: key,
        })),
      }),
      this.prisma.attendanceImport.update({
        where: { id },
        data: { status: 'ACCEPTED', confirmedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'IMPORT_CONFIRMED',
          entity: 'AttendanceImport',
          entityId: id,
          after: { rowCount: keyedRows.length },
        },
      }),
    ]);
    const accepted = { id, status: 'ACCEPTED' as const, rowCount: keyedRows.length };
    try {
      return { ...accepted, processing: await this.process(id, user) };
    } catch (error) {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'IMPORT_PROCESSING_FAILED',
          entity: 'AttendanceImport',
          entityId: id,
          reason:
            error instanceof Error ? error.message.slice(0, 1000) : 'UNKNOWN_PROCESSING_ERROR',
        },
      });
      return { ...accepted, processing: { status: 'FAILED' as const } };
    }
  }

  async list(query: PaginationDto) {
    const where: Prisma.AttendanceImportWhereInput = query.search
      ? { originalName: { contains: query.search, mode: 'insensitive' } }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceImport.findMany({
        where,
        orderBy: { attemptedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { issues: true, rawRows: true } } },
      }),
      this.prisma.attendanceImport.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async detail(id: string) {
    const record = await this.prisma.attendanceImport.findUnique({
      where: { id },
      include: {
        issues: { orderBy: [{ rowNo: 'asc' }, { issueCode: 'asc' }] },
        _count: { select: { issues: true, rawRows: true } },
      },
    });
    if (!record) throw new NotFoundException();
    const [linkedRows, normalizedRows, calculatedRows, exceptions] = await Promise.all([
      this.prisma.attendanceRaw.count({ where: { importId: id, employeeId: { not: null } } }),
      this.prisma.attendanceNormalization.count({ where: { raw: { importId: id } } }),
      this.prisma.attendanceCalculation.count({ where: { raw: { importId: id } } }),
      this.prisma.attendanceException.count({ where: { raw: { importId: id } } }),
    ]);
    return { ...record, processing: { linkedRows, normalizedRows, calculatedRows, exceptions } };
  }

  async rows(id: string, query: PaginationDto) {
    const exists = await this.prisma.attendanceImport.count({ where: { id } });
    if (!exists) throw new NotFoundException();
    const where: Prisma.AttendanceRawWhereInput = {
      importId: id,
      ...(query.search
        ? {
            OR: [
              { employeeCode: { contains: query.search, mode: 'insensitive' } },
              { employeeName: { contains: query.search, mode: 'insensitive' } },
              { departmentName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceRaw.findMany({
        where,
        orderBy: [{ sheet: 'asc' }, { rowNo: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          sheet: true,
          rowNo: true,
          employeeId: true,
          employeeCode: true,
          employeeName: true,
          departmentName: true,
          attendanceDateRaw: true,
          checkInRaw: true,
          checkOutRaw: true,
          shiftNameRaw: true,
          _count: { select: { exceptions: true, calculations: true } },
        },
      }),
      this.prisma.attendanceRaw.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async process(id: string, user: AuthenticatedUser) {
    const record = await this.prisma.attendanceImport.findUnique({
      where: { id },
      include: { rawRows: true, issues: true },
    });
    if (!record) throw new NotFoundException();
    if (record.status !== 'ACCEPTED') {
      throw new ConflictException('Chỉ xử lý import đã ACCEPTED.');
    }

    const sourceDates = [
      ...new Set(
        record.rawRows.flatMap((raw) =>
          raw.attendanceDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(raw.attendanceDateRaw)
            ? [raw.attendanceDateRaw]
            : [],
        ),
      ),
    ];
    const companyHolidayDates = await this.companyHolidayDates(sourceDates);
    const sundayRestRowIds = new Set(
      record.rawRows
        .filter((raw) =>
          isSundayRestWithoutAttendance({
            attendanceDate: raw.attendanceDateRaw,
            checkIn: raw.checkInRaw,
            checkOut: raw.checkOutRaw,
          }),
        )
        .map((raw) => raw.id),
    );
    const companyHolidayRestRowIds = new Set(
      record.rawRows
        .filter(
          (raw) =>
            !sundayRestRowIds.has(raw.id) &&
            Boolean(raw.attendanceDateRaw && companyHolidayDates.has(raw.attendanceDateRaw)) &&
            isBlankAttendance({ checkIn: raw.checkInRaw, checkOut: raw.checkOutRaw }),
        )
        .map((raw) => raw.id),
    );
    const restRowIds = new Set([...sundayRestRowIds, ...companyHolidayRestRowIds]);
    const attendanceRows = record.rawRows.filter((raw) => !restRowIds.has(raw.id));
    const employeeCodes = [...new Set(attendanceRows.map((row) => row.employeeCode))];
    const employees = await this.prisma.employee.findMany({
      where: { code: { in: employeeCodes }, active: true },
      select: { id: true, code: true },
    });
    const employeeByCode = new Map(employees.map((employee) => [employee.code, employee.id]));

    await this.prisma.$transaction(
      employees.map((employee) =>
        this.prisma.attendanceRaw.updateMany({
          where: { importId: id, employeeCode: employee.code, employeeId: null },
          data: { employeeId: employee.id },
        }),
      ),
    );

    const rawBySource = new Map(
      record.rawRows.map((row) => [`${row.sheet}\u0000${row.rowNo}`, row]),
    );
    const existing = await this.prisma.attendanceException.findMany({
      where: {
        OR: [
          { rawId: { in: record.rawRows.map((row) => row.id) } },
          { importIssueId: { in: record.issues.map((issue) => issue.id) } },
        ],
      },
      select: { rawId: true, importIssueId: true, code: true },
    });
    const existingKeys = new Set(
      existing.flatMap((item) => [
        ...(item.importIssueId ? [`issue:${item.importIssueId}`] : []),
        ...(item.rawId ? [`raw:${item.rawId}:${item.code}`] : []),
      ]),
    );
    const exceptionData: Prisma.AttendanceExceptionCreateManyInput[] = [];
    let promotedImportIssues = 0;

    for (const issue of record.issues) {
      const raw = rawBySource.get(`${issue.sheet}\u0000${issue.rowNo}`);
      if (raw && restRowIds.has(raw.id)) continue;
      promotedImportIssues++;
      if (existingKeys.has(`issue:${issue.id}`)) continue;
      const evidence = issue.evidence as { blocking?: boolean } | null;
      exceptionData.push({
        ...(raw ? { rawId: raw.id } : {}),
        importIssueId: issue.id,
        code: issue.issueCode,
        blocking: evidence?.blocking ?? false,
        ...(issue.evidence ? { details: issue.evidence as Prisma.InputJsonValue } : {}),
      });
      existingKeys.add(`issue:${issue.id}`);
    }

    const linkedRows: Array<RawRow & { employeeId: string }> = [];
    let missingEmployees = 0;
    const missingEmployeeCodes = new Set<string>();
    for (const raw of attendanceRows) {
      const employeeId = employeeByCode.get(raw.employeeCode);
      if (!employeeId) {
        const key = `raw:${raw.id}:EMPLOYEE_NOT_FOUND`;
        if (!existingKeys.has(key)) {
          exceptionData.push({
            rawId: raw.id,
            code: 'EMPLOYEE_NOT_FOUND',
            blocking: true,
            details: { employeeCode: raw.employeeCode },
          });
          existingKeys.add(key);
        }
        missingEmployees++;
        missingEmployeeCodes.add(raw.employeeCode);
      } else {
        linkedRows.push({ ...raw, employeeId });
      }
    }
    if (exceptionData.length) {
      await this.prisma.attendanceException.createMany({ data: exceptionData });
    }

    await this.resolveRestDayExceptions(user.id, sundayRestRowIds, companyHolidayRestRowIds);

    await this.resolveRecoveredExceptions(
      user.id,
      new Map([['EMPLOYEE_NOT_FOUND', new Set(linkedRows.map((row) => row.id))]]),
    );

    await this.ensureCalculationCoverage(id, linkedRows, user.id);
    const calculationSummary = await this.processLinkedRows(linkedRows, existingKeys, user.id);
    const summary = {
      rawRows: record.rawRows.length,
      restRows: restRowIds.size,
      sundayRestRows: sundayRestRowIds.size,
      companyHolidayRestRows: companyHolidayRestRowIds.size,
      linkedEmployees: linkedRows.length,
      missingEmployees,
      missingEmployeeCodes: [...missingEmployeeCodes].sort((left, right) =>
        left.localeCompare(right, 'vi-VN'),
      ),
      promotedImportIssues,
      ...calculationSummary,
    };
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'IMPORT_PROCESSED',
        entity: 'AttendanceImport',
        entityId: id,
        after: summary,
      },
    });
    return summary;
  }

  async approveSourceAndProcess(id: string, user: AuthenticatedUser) {
    if (this.config.get<string>('SOURCE_MASTER_PROVISIONING_ENABLED') !== 'true') {
      throw new ConflictException({
        code: 'SOURCE_MASTER_APPROVAL_REQUIRED',
        message: 'Chưa có phê duyệt tạo hồ sơ nhân viên/phòng ban từ dữ liệu nguồn.',
      });
    }

    const record = await this.prisma.attendanceImport.findUnique({
      where: { id },
      include: { rawRows: true },
    });
    if (!record) throw new NotFoundException();
    if (record.status !== 'ACCEPTED') {
      throw new ConflictException('Chỉ có thể duyệt nguồn cho import đã ACCEPTED.');
    }
    if (!record.rawRows.length) {
      throw new ConflictException('Import không có dữ liệu raw để tạo master.');
    }

    const employeeMaster = new Map<
      string,
      {
        name: string;
        departmentName: string;
      }
    >();
    let masterConflictCount = 0;
    for (const raw of record.rawRows) {
      const code = raw.employeeCode.trim();
      const name = raw.employeeName.trim();
      const departmentName = raw.departmentName.trim();
      if (!code || !name || !departmentName) {
        masterConflictCount++;
        continue;
      }
      const existing = employeeMaster.get(code);
      if (existing && (existing.name !== name || existing.departmentName !== departmentName)) {
        masterConflictCount++;
        continue;
      }
      employeeMaster.set(code, { name, departmentName });
    }
    if (masterConflictCount) {
      throw new ConflictException({
        code: 'SOURCE_MASTER_CONFLICT',
        message: `Nguồn có ${masterConflictCount} dòng thiếu hoặc mâu thuẫn hồ sơ nhân viên.`,
      });
    }

    const validDates = record.rawRows
      .flatMap((raw) => (this.isIsoDate(raw.attendanceDateRaw) ? [raw.attendanceDateRaw] : []))
      .sort();
    if (!validDates.length) {
      throw new ConflictException('Nguồn không có ngày ca hợp lệ.');
    }
    const sourceFrom = validDates[0]!;
    const sourceTo = validDates.at(-1)!;
    const rowsByEmployeeDate = new Map<string, RawRow[]>();
    for (const raw of record.rawRows) {
      if (!this.isIsoDate(raw.attendanceDateRaw)) continue;
      const key = `${raw.employeeCode}\u0000${raw.attendanceDateRaw}`;
      const grouped = rowsByEmployeeDate.get(key) ?? [];
      grouped.push(raw);
      rowsByEmployeeDate.set(key, grouped);
    }
    const multipleRowIds = new Set(
      [...rowsByEmployeeDate.values()]
        .filter((rows) => rows.length > 1)
        .flatMap((rows) => rows.map((row) => row.id)),
    );
    const departmentNames = [
      ...new Set([...employeeMaster.values()].map((employee) => employee.departmentName)),
    ];
    const departmentCodeByName = new Map(
      departmentNames.map((name) => [name, this.sourceDepartmentCode(name)]),
    );

    const provisioned = await this.prisma.$transaction(
      async (tx) => {
        const possibleDepartments = await tx.department.findMany({
          where: {
            OR: [
              { name: { in: departmentNames } },
              { code: { in: [...departmentCodeByName.values()] } },
            ],
          },
        });
        const departmentsByName = new Map<string, typeof possibleDepartments>();
        for (const department of possibleDepartments) {
          const matches = departmentsByName.get(department.name) ?? [];
          matches.push(department);
          departmentsByName.set(department.name, matches);
        }
        if ([...departmentsByName.values()].some((matches) => matches.length > 1)) {
          throw new ConflictException({
            code: 'DEPARTMENT_MASTER_AMBIGUOUS',
            message: 'Master hiện có nhiều phòng ban trùng tên; cần HR xử lý trước.',
          });
        }
        for (const department of possibleDepartments) {
          const expectedName = [...departmentCodeByName.entries()].find(
            ([, code]) => code === department.code,
          )?.[0];
          if (expectedName && expectedName !== department.name) {
            throw new ConflictException({
              code: 'DEPARTMENT_CODE_CONFLICT',
              message: 'Mã phòng ban dẫn xuất đã tồn tại cho một tên khác.',
            });
          }
        }
        const missingDepartments = departmentNames.filter((name) => !departmentsByName.has(name));
        if (missingDepartments.length) {
          await tx.department.createMany({
            data: missingDepartments.map((name) => ({
              code: departmentCodeByName.get(name)!,
              name,
              active: true,
            })),
          });
        }
        const departments = await tx.department.findMany({
          where: { name: { in: departmentNames } },
        });
        const departmentByName = new Map(
          departments.map((department) => [department.name, department]),
        );

        const employeeCodes = [...employeeMaster.keys()];
        const existingEmployees = await tx.employee.findMany({
          where: { code: { in: employeeCodes } },
          include: { department: true },
        });
        const conflictingEmployees = existingEmployees.filter((employee) => {
          const expected = employeeMaster.get(employee.code)!;
          return (
            employee.name !== expected.name || employee.department?.name !== expected.departmentName
          );
        });
        if (conflictingEmployees.length) {
          throw new ConflictException({
            code: 'EMPLOYEE_MASTER_CONFLICT',
            message: `${conflictingEmployees.length} mã nhân viên đã tồn tại nhưng khác tên hoặc phòng ban.`,
          });
        }
        const existingEmployeeCodes = new Set(existingEmployees.map((employee) => employee.code));
        const missingEmployees = employeeCodes.filter((code) => !existingEmployeeCodes.has(code));
        if (missingEmployees.length) {
          await tx.employee.createMany({
            data: missingEmployees.map((code) => {
              const source = employeeMaster.get(code)!;
              return {
                code,
                name: source.name,
                departmentId: departmentByName.get(source.departmentName)!.id,
                active: true,
              };
            }),
          });
        }
        const employees = await tx.employee.findMany({
          where: { code: { in: employeeCodes } },
          select: { id: true, code: true },
        });
        for (const employee of employees) {
          await tx.attendanceRaw.updateMany({
            where: { importId: id, employeeCode: employee.code },
            data: { employeeId: employee.id },
          });
        }

        for (const code of Object.keys(SHIFT_DEFINITIONS) as SupportedShiftCode[]) {
          const definition = SHIFT_DEFINITIONS[code];
          const shift = await tx.shift.upsert({
            where: { code },
            update: { active: true },
            create: { code, name: definition.name, active: true },
            select: { id: true, code: true },
          });
          await this.ensureApprovedRuleCoverage(tx, shift.id, code, sourceFrom, sourceTo);
        }

        const periodKeys = [...new Set(validDates.map((date) => date.slice(0, 7)))];
        await tx.attendancePeriod.createMany({
          data: periodKeys.map((key) => {
            const year = Number(key.slice(0, 4));
            const month = Number(key.slice(5, 7));
            return { year, month };
          }),
          skipDuplicates: true,
        });

        const sourceShiftAssignments = record.rawRows.filter(
          (raw) =>
            this.sourceShiftCode(raw.shiftNameRaw) &&
            this.isIsoDate(raw.attendanceDateRaw) &&
            !multipleRowIds.has(raw.id),
        ).length;

        const existingMultipleExceptions = multipleRowIds.size
          ? await tx.attendanceException.findMany({
              where: {
                rawId: { in: [...multipleRowIds] },
                code: 'MULTIPLE_ROWS_SAME_EMPLOYEE_DATE',
              },
              select: { rawId: true },
            })
          : [];
        const rawIdsWithMultipleException = new Set(
          existingMultipleExceptions.flatMap((item) => (item.rawId ? [item.rawId] : [])),
        );
        const newMultipleExceptions = [...multipleRowIds]
          .filter((rawId) => !rawIdsWithMultipleException.has(rawId))
          .map((rawId) => ({
            rawId,
            code: 'MULTIPLE_ROWS_SAME_EMPLOYEE_DATE',
            blocking: true,
            details: { reason: 'Không tự cộng/ghép nhiều dòng cùng nhân viên và ngày ca.' },
          }));
        if (newMultipleExceptions.length) {
          await tx.attendanceException.createMany({ data: newMultipleExceptions });
        }

        const summary = {
          departments: departments.length,
          employees: employees.length,
          sourceShiftAssignments,
          multipleRowExceptions: multipleRowIds.size,
          periods: periodKeys.length,
          sourceFrom,
          sourceTo,
        };
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: 'IMPORT_SOURCE_MASTER_PROVISIONED',
            entity: 'AttendanceImport',
            entityId: id,
            reason:
              'Tạo hồ sơ nhân viên/phòng ban theo thao tác được bật; Tên ca trong file là nguồn phân ca, không tạo lịch phân ca riêng.',
            after: {
              ...summary,
              approval: {
                employeeAndDepartmentMasterFromSource: true,
                shiftAliases: { Ca1: 'CA1', Ca3: 'CA3' },
                sourceDateIsShiftStartDate: true,
                ca3CheckoutEarlierThanCheckinIsNextDay: true,
                workScheduleRequired: false,
              },
            },
          },
        });
        return summary;
      },
      { maxWait: 10_000, timeout: 60_000 },
    );

    return { master: provisioned, processing: await this.process(id, user) };
  }

  async source(id: string) {
    const record = await this.prisma.attendanceImport.findUnique({ where: { id } });
    if (!record?.storageKey) throw new NotFoundException();
    return { buffer: await readFile(record.storageKey), filename: record.originalName };
  }

  private assertWorkbook(file: UploadedWorkbook | undefined): asserts file is UploadedWorkbook {
    if (!file) throw new BadRequestException('Thiếu file XLSX.');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('File vượt quá 10 MB.');
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Chỉ chấp nhận file .xlsx.');
    }
  }

  private duplicateKeyFields(): SourceField[] {
    const value = this.config.get<string>('DUPLICATE_KEY_FIELDS')?.trim();
    if (!value) return [];
    const fields = value.split(',').map((field) => field.trim());
    if (fields.some((field) => !SOURCE_FIELDS.includes(field as SourceField))) {
      throw new Error('DUPLICATE_KEY_FIELDS chứa trường không hợp lệ.');
    }
    return [...new Set(fields)] as SourceField[];
  }

  private duplicateKey(row: ParsedSourceRow, fields: SourceField[]) {
    const canonical = fields.map((field) => [field, row[field] ?? null]);
    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  private async processLinkedRows(
    rows: Array<RawRow & { employeeId: string }>,
    existingKeys: Set<string>,
    actorId: string,
  ) {
    if (!rows.length) {
      return { missingSchedules: 0, missingTimestampEvidence: 0, calculatedRows: 0 };
    }
    const shifts: ShiftWithRules[] = await this.prisma.shift.findMany({
      where: { code: { in: Object.keys(SHIFT_DEFINITIONS) }, active: true },
      include: { rules: true },
    });
    const shiftByCode = new Map(shifts.map((shift) => [shift.code, shift]));
    const periods = await this.prisma.attendancePeriod.findMany();
    const periodByKey = new Map(
      periods.map((period) => [`${period.year}-${period.month}`, period]),
    );
    const immutablePeriod = rows
      .filter((raw) => this.isIsoDate(raw.attendanceDateRaw))
      .map((raw) => raw.attendanceDateRaw!.slice(0, 7))
      .map((key) => periodByKey.get(`${Number(key.slice(0, 4))}-${Number(key.slice(5, 7))}`))
      .find((period) => period?.status === 'LOCKED' || period?.status === 'PUBLISHED');
    if (immutablePeriod) {
      throw new ConflictException({
        code: 'ATTENDANCE_PERIOD_IMMUTABLE',
        message: `Kỳ ${immutablePeriod.month}/${immutablePeriod.year} đã ${immutablePeriod.status}; không được tính lại trực tiếp.`,
      });
    }
    const rowsPerEmployeeDate = new Map<string, number>();
    for (const raw of rows) {
      if (!this.isIsoDate(raw.attendanceDateRaw)) continue;
      const key = `${raw.employeeId}\u0000${raw.attendanceDateRaw}`;
      rowsPerEmployeeDate.set(key, (rowsPerEmployeeDate.get(key) ?? 0) + 1);
    }
    const recovered = new Map<string, Set<string>>();
    const markRecovered = (rawId: string, code: string) => {
      const rawIds = recovered.get(code) ?? new Set<string>();
      rawIds.add(rawId);
      recovered.set(code, rawIds);
    };
    let missingTimestampEvidence = 0;
    let calculatedRows = 0;

    for (const raw of rows) {
      markRecovered(raw.id, 'WORK_SCHEDULE_NOT_FOUND');
      markRecovered(raw.id, 'SHIFT_MISMATCH');
      if (!this.isIsoDate(raw.attendanceDateRaw)) {
        await this.ensureRawException(raw.id, 'INVALID_SHIFT_DATE', true, existingKeys);
        continue;
      }
      const shiftDate = raw.attendanceDateRaw!;
      const employeeDateKey = `${raw.employeeId}\u0000${shiftDate}`;
      if ((rowsPerEmployeeDate.get(employeeDateKey) ?? 0) > 1) {
        await this.ensureRawException(
          raw.id,
          'MULTIPLE_ROWS_SAME_EMPLOYEE_DATE',
          true,
          existingKeys,
          { reason: 'Không tự cộng/ghép nhiều dòng cùng nhân viên và ngày ca.' },
        );
        continue;
      }
      const sourceShiftCode = this.sourceShiftCode(raw.shiftNameRaw);
      if (!sourceShiftCode) {
        await this.ensureRawException(
          raw.id,
          'UNSUPPORTED_SHIFT_FOR_CALCULATION',
          true,
          existingKeys,
        );
        continue;
      }
      const shift = shiftByCode.get(sourceShiftCode);
      const timestamps = this.approvedSourceTimestamps(raw, sourceShiftCode);
      if (!timestamps) {
        await this.ensureRawException(raw.id, 'TIMESTAMP_EVIDENCE_REQUIRED', true, existingKeys, {
          reason: 'Thiếu ngày/giờ vào-ra hợp lệ để tạo timestamp từ phân ca trong file.',
        });
        missingTimestampEvidence++;
        continue;
      }
      markRecovered(raw.id, 'TIMESTAMP_EVIDENCE_REQUIRED');
      const rule = shift?.rules
        .filter((candidate) => candidate.effectiveFrom <= new Date(`${shiftDate}T00:00:00.000Z`))
        .filter(
          (candidate) =>
            !candidate.effectiveTo ||
            candidate.effectiveTo >= new Date(`${shiftDate}T00:00:00.000Z`),
        )
        .filter((candidate) => this.ruleMatchesApprovedDefinition(candidate, sourceShiftCode))
        .sort((a, b) => b.version - a.version)[0];
      const [year, month] = shiftDate.split('-').map(Number);
      const period = periodByKey.get(`${year}-${month}`);
      if (!rule) {
        await this.ensureRawException(raw.id, 'SHIFT_RULE_NOT_FOUND', true, existingKeys);
        continue;
      }
      markRecovered(raw.id, 'SHIFT_RULE_NOT_FOUND');
      if (!period) {
        await this.ensureRawException(raw.id, 'ATTENDANCE_PERIOD_NOT_FOUND', true, existingKeys);
        continue;
      }
      markRecovered(raw.id, 'ATTENDANCE_PERIOD_NOT_FOUND');
      const result = calculateAttendance(
        {
          employeeCode: raw.employeeCode,
          shiftCode: sourceShiftCode,
          shiftDate,
          checkInAt: timestamps.checkInAt,
          checkOutAt: timestamps.checkOutAt,
          shiftDateEvidence: {
            type: 'APPROVED_MAPPING',
            reference: `import:${raw.importId}:raw:${raw.id}:SOURCE_SHIFT_ASSIGNMENT`,
          },
          checkOutDateEvidence: timestamps.checkOutDateEvidence,
        },
        {
          timezone: 'Asia/Ho_Chi_Minh',
          abnormalDurationThresholdSeconds: rule.abnormalDurationThresholdSeconds,
          shiftRule: this.engineShiftRule(rule),
        },
      );
      const inputHash = createHash('sha256')
        .update(
          JSON.stringify({
            rawId: raw.id,
            shiftDate,
            checkIn: timestamps.checkInAt,
            checkOut: timestamps.checkOutAt,
            shift: sourceShiftCode,
            shiftRuleId: rule.id,
            rule: rule.version,
            engineVersion: result.ruleVersion,
            shiftRule: this.engineShiftRule(rule),
          }),
        )
        .digest('hex');
      const latestCalculation = await this.prisma.attendanceCalculation.findFirst({
        where: { rawId: raw.id },
        orderBy: { revision: 'desc' },
        select: { revision: true, inputHash: true },
      });
      if (latestCalculation?.inputHash === inputHash) {
        calculatedRows++;
        continue;
      }
      const revision = (latestCalculation?.revision ?? 0) + 1;
      const normalizationId = randomUUID();
      const calculationId = randomUUID();
      const normalizationCreate = this.prisma.attendanceNormalization.create({
        data: {
          id: normalizationId,
          rawId: raw.id,
          revision,
          shiftDate: new Date(`${shiftDate}T00:00:00.000Z`),
          checkInAt:
            result.checkInEpochSeconds === null
              ? null
              : new Date(result.checkInEpochSeconds * 1000),
          checkOutAt:
            result.checkOutEpochSeconds === null
              ? null
              : new Date(result.checkOutEpochSeconds * 1000),
          shiftCode: result.shiftCode,
          shiftDateEvidence: {
            type: 'APPROVED_MAPPING',
            reference: `import:${raw.importId}:raw:${raw.id}:SOURCE_SHIFT_ASSIGNMENT`,
          },
          checkOutDateEvidence: timestamps.checkOutDateEvidence,
          ruleVersion: `engine-${result.ruleVersion}`,
        },
      });
      const calculationCreate = this.prisma.attendanceCalculation.create({
        data: {
          id: calculationId,
          rawId: raw.id,
          normalizationId,
          periodId: period.id,
          shiftRuleId: rule.id,
          engineVersion: result.ruleVersion,
          revision,
          inputHash,
          status:
            result.status === 'VALID' ? CalculationStatus.VALID : CalculationStatus.NEEDS_REVIEW,
          ...(result.calculation ?? {}),
        },
      });
      await this.prisma.$transaction([normalizationCreate, calculationCreate]);
      for (const exception of result.exceptions) {
        const key = `raw:${raw.id}:${exception.code}`;
        if (existingKeys.has(key)) continue;
        await this.prisma.attendanceException.create({
          data: {
            rawId: raw.id,
            calculationId,
            code: exception.code,
            blocking: exception.blocking,
            details: { message: exception.message },
          },
        });
        existingKeys.add(key);
      }
      calculatedRows++;
    }
    await this.resolveRecoveredExceptions(actorId, recovered);
    return { missingSchedules: 0, missingTimestampEvidence, calculatedRows };
  }

  private engineShiftRule(rule: ShiftWithRules['rules'][number]): EngineShiftRule {
    const tiers = rule.tiers as Record<string, unknown>;
    const scheduledNetSeconds =
      rule.scheduledCompletionSeconds -
      rule.scheduledStartSeconds -
      Math.max(rule.breakEndSeconds - rule.breakStartSeconds, 0);
    return {
      scheduledStartSeconds: rule.scheduledStartSeconds,
      scheduledCompletionSeconds: rule.scheduledCompletionSeconds,
      breakStartSeconds: rule.breakStartSeconds,
      breakEndSeconds: rule.breakEndSeconds,
      targetWorkedSeconds:
        typeof tiers.targetWorkedSeconds === 'number'
          ? tiers.targetWorkedSeconds
          : scheduledNetSeconds,
      countEarlyArrivalSeconds:
        typeof tiers.countEarlyArrivalSeconds === 'boolean' ? tiers.countEarlyArrivalSeconds : true,
      checkOutBlockSeconds:
        typeof tiers.checkOutBlockSeconds === 'number' ? tiers.checkOutBlockSeconds : null,
      postCompletionBlockSeconds:
        typeof tiers.postCompletionBlockSeconds === 'number'
          ? tiers.postCompletionBlockSeconds
          : null,
      sundayTierPercentage:
        tiers.sundayTierPercentage === 200 || tiers.sundayTierPercentage === 230
          ? tiers.sundayTierPercentage
          : null,
      lateAfterSeconds:
        typeof tiers.lateAfterSeconds === 'number'
          ? tiers.lateAfterSeconds
          : rule.scheduledStartSeconds,
    };
  }

  private ruleMatchesApprovedDefinition(
    rule: ShiftWithRules['rules'][number],
    shiftCode: SupportedShiftCode,
  ) {
    const definition = SHIFT_DEFINITIONS[shiftCode];
    const tiers = rule.tiers as Record<string, unknown>;
    return (
      rule.scheduledStartSeconds === definition.scheduledStartSeconds &&
      rule.scheduledCompletionSeconds === definition.scheduledCompletionSeconds &&
      rule.breakStartSeconds === definition.breakStartSeconds &&
      rule.breakEndSeconds === definition.breakEndSeconds &&
      rule.abnormalDurationThresholdSeconds === definition.abnormalDurationThresholdSeconds &&
      Object.entries(definition.tiers).every(([key, value]) => tiers[key] === value)
    );
  }

  private async ensureCalculationCoverage(
    importId: string,
    rows: Array<RawRow & { employeeId: string }>,
    actorId: string,
  ) {
    const datesByShift = new Map<SupportedShiftCode, string[]>();
    for (const raw of rows) {
      const shiftCode = this.sourceShiftCode(raw.shiftNameRaw);
      if (!shiftCode || !this.isIsoDate(raw.attendanceDateRaw)) continue;
      const dates = datesByShift.get(shiftCode) ?? [];
      dates.push(raw.attendanceDateRaw);
      datesByShift.set(shiftCode, dates);
    }
    if (!datesByShift.size) return;

    const periodKeys = [
      ...new Set([...datesByShift.values()].flat().map((date) => date.slice(0, 7))),
    ].sort();
    const immutablePeriod = await this.prisma.attendancePeriod.findFirst({
      where: {
        status: { in: ['LOCKED', 'PUBLISHED'] },
        OR: periodKeys.map((key) => ({
          year: Number(key.slice(0, 4)),
          month: Number(key.slice(5, 7)),
        })),
      },
    });
    if (immutablePeriod) {
      throw new ConflictException({
        code: 'ATTENDANCE_PERIOD_IMMUTABLE',
        message: `Kỳ ${immutablePeriod.month}/${immutablePeriod.year} đã ${immutablePeriod.status}; không được chuẩn bị hoặc tính lại trực tiếp.`,
      });
    }
    await this.prisma.$transaction(
      async (tx) => {
        const shifts = await tx.shift.findMany({
          where: { code: { in: [...datesByShift.keys()] }, active: true },
          select: { id: true, code: true },
        });
        const shiftByCode = new Map(shifts.map((shift) => [shift.code, shift]));
        const extendedShiftRules: string[] = [];
        for (const [shiftCode, dates] of datesByShift) {
          const shift = shiftByCode.get(shiftCode);
          if (!shift) {
            throw new ConflictException({
              code: 'APPROVED_SHIFT_NOT_AVAILABLE',
              message: `Chưa có ca ${shiftCode} đang hoạt động để xử lý dữ liệu nguồn.`,
            });
          }
          dates.sort();
          const coverage = await this.ensureApprovedRuleCoverage(
            tx,
            shift.id,
            shiftCode,
            dates[0]!,
            dates.at(-1)!,
          );
          if (coverage === 'EXTENDED') extendedShiftRules.push(shiftCode);
        }

        const periods = await tx.attendancePeriod.createMany({
          data: periodKeys.map((key) => ({
            year: Number(key.slice(0, 4)),
            month: Number(key.slice(5, 7)),
          })),
          skipDuplicates: true,
        });
        if (extendedShiftRules.length || periods.count) {
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'IMPORT_CALCULATION_COVERAGE_PREPARED',
              entity: 'AttendanceImport',
              entityId: importId,
              reason:
                'Mở rộng đúng bộ quy tắc Ca1/Ca3 đã duyệt và tạo kỳ DRAFT cho ngày nguồn; không tạo master nhân viên/phòng ban.',
              after: {
                extendedShiftRules,
                createdPeriods: periods.count,
                periodKeys,
              },
            },
          });
        }
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  }

  private async ensureApprovedRuleCoverage(
    tx: Prisma.TransactionClient,
    shiftId: string,
    shiftCode: SupportedShiftCode,
    sourceFrom: string,
    sourceTo: string,
  ) {
    const from = new Date(`${sourceFrom}T00:00:00.000Z`);
    const to = new Date(`${sourceTo}T00:00:00.000Z`);
    const approvedEffectiveFrom = new Date(
      `${SHIFT_DEFINITIONS[shiftCode].effectiveFrom}T00:00:00.000Z`,
    );
    if (from < approvedEffectiveFrom) {
      throw new ConflictException({
        code: 'APPROVED_SHIFT_RULE_NOT_AVAILABLE',
        message: `Quy tắc ${shiftCode} hiện hành chỉ được phê duyệt từ ${SHIFT_DEFINITIONS[shiftCode].effectiveFrom}; không tự áp dụng lùi cho dữ liệu ${sourceFrom}.`,
      });
    }
    const rules = await tx.shiftRule.findMany({ where: { shiftId }, orderBy: { version: 'asc' } });
    const coveringRule = rules.find(
      (rule) =>
        rule.effectiveFrom <= from &&
        (!rule.effectiveTo || rule.effectiveTo >= to) &&
        this.ruleMatchesApprovedDefinition(rule, shiftCode),
    );
    if (coveringRule) return 'UNCHANGED' as const;

    const extendableRule = rules.find(
      (rule) =>
        rule.effectiveFrom > from &&
        (!rule.effectiveTo || rule.effectiveTo >= to) &&
        this.ruleMatchesApprovedDefinition(rule, shiftCode),
    );
    if (!extendableRule) {
      throw new ConflictException({
        code: 'APPROVED_SHIFT_RULE_NOT_AVAILABLE',
        message: `Chưa có bộ quy tắc ${shiftCode} khớp quyết định đã duyệt cho kỳ nguồn.`,
      });
    }
    const overlapsAnotherRule = rules.some(
      (rule) =>
        rule.id !== extendableRule.id &&
        rule.effectiveFrom <= extendableRule.effectiveFrom &&
        (!rule.effectiveTo || rule.effectiveTo >= from),
    );
    if (overlapsAnotherRule) {
      throw new ConflictException({
        code: 'SHIFT_RULE_PERIOD_CONFLICT',
        message: `Khoảng hiệu lực quy tắc ${shiftCode} bị chồng lấn; không tự điều chỉnh.`,
      });
    }
    await tx.shiftRule.update({
      where: { id: extendableRule.id },
      data: { effectiveFrom: from },
    });
    return 'EXTENDED' as const;
  }

  private approvedSourceTimestamps(raw: RawRow, shiftCode: SupportedShiftCode) {
    if (this.isFullOffsetTimestamp(raw.checkInRaw) && this.isFullOffsetTimestamp(raw.checkOutRaw)) {
      return {
        checkInAt: raw.checkInRaw,
        checkOutAt: raw.checkOutRaw,
        checkOutDateEvidence: {
          type: 'SOURCE_TIMESTAMP' as const,
          reference: `${raw.sheet}:${raw.rowNo}`,
        },
      };
    }
    if (!this.isIsoDate(raw.attendanceDateRaw)) return null;
    const checkIn = this.timeOnly(raw.checkInRaw);
    const checkOut = this.timeOnly(raw.checkOutRaw);
    if (!checkIn || !checkOut || this.sourceShiftCode(raw.shiftNameRaw) !== shiftCode) return null;

    const checkoutDate =
      shiftCode === 'CA3' && checkOut.seconds < checkIn.seconds
        ? this.nextIsoDate(raw.attendanceDateRaw)
        : raw.attendanceDateRaw;
    return {
      checkInAt: `${raw.attendanceDateRaw}T${checkIn.value}+07:00`,
      checkOutAt: `${checkoutDate}T${checkOut.value}+07:00`,
      checkOutDateEvidence: {
        type: 'APPROVED_MAPPING' as const,
        reference:
          shiftCode === 'CA3' && checkoutDate !== raw.attendanceDateRaw
            ? `import:${raw.importId}:raw:${raw.id}:CA3_D_PLUS_1`
            : `import:${raw.importId}:raw:${raw.id}:SOURCE_SHIFT_DATE`,
      },
    };
  }

  private timeOnly(value: string | null) {
    const match = value?.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] ?? 0);
    return {
      seconds: hours * 3600 + minutes * 60 + seconds,
      value: `${match[1]}:${match[2]}:${String(seconds).padStart(2, '0')}`,
    };
  }

  private nextIsoDate(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  private sourceShiftCode(value: string | null): SupportedShiftCode | null {
    const normalized = value?.trim().toLocaleLowerCase('vi-VN');
    if (normalized === 'ca1') return 'CA1';
    if (normalized === 'ca3') return 'CA3';
    return null;
  }

  private sourceDepartmentCode(name: string) {
    return `SX-${createHash('sha256').update(name.normalize('NFC')).digest('hex').slice(0, 16).toUpperCase()}`;
  }

  private async companyHolidayDates(values: string[]) {
    const dates = [...new Set(values.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))];
    if (!dates.length) return new Set<string>();
    const holidays = await this.prisma.companyHoliday.findMany({
      where: {
        holidayDate: {
          in: dates.map((date) => new Date(`${date}T00:00:00.000Z`)),
        },
      },
      select: { holidayDate: true },
    });
    return new Set(holidays.map((holiday) => holiday.holidayDate.toISOString().slice(0, 10)));
  }

  private async resolveRestDayExceptions(
    actorId: string,
    sundayRawIds: Set<string>,
    companyHolidayRawIds: Set<string>,
  ) {
    const rawIds = new Set([...sundayRawIds, ...companyHolidayRawIds]);
    if (!rawIds.size) return;
    const exceptions = await this.prisma.attendanceException.findMany({
      where: { status: 'OPEN', rawId: { in: [...rawIds] } },
      select: { id: true, rawId: true },
    });
    if (!exceptions.length) return;
    await this.prisma.$transaction([
      this.prisma.exceptionResolution.createMany({
        data: exceptions.map((item) => ({
          exceptionId: item.id,
          action: companyHolidayRawIds.has(item.rawId ?? '')
            ? 'REVALIDATED_COMPANY_HOLIDAY'
            : 'REVALIDATED_SUNDAY_REST',
          before: { status: 'OPEN' },
          after: { status: 'RESOLVED' },
          reason: companyHolidayRawIds.has(item.rawId ?? '')
            ? 'Ngày được HR cấu hình là ngày nghỉ lễ; dòng không có cả giờ vào và giờ ra không cần xử lý ngoại lệ.'
            : 'Chủ nhật là ngày nghỉ; dòng không có cả giờ vào và giờ ra không cần xử lý ngoại lệ.',
          actorId,
        })),
      }),
      this.prisma.attendanceException.updateMany({
        where: { id: { in: exceptions.map((item) => item.id) } },
        data: { status: 'RESOLVED' },
      }),
    ]);
  }

  private async resolveRecoveredExceptions(actorId: string, recovered: Map<string, Set<string>>) {
    for (const [code, rawIds] of recovered) {
      if (!rawIds.size) continue;
      const exceptions = await this.prisma.attendanceException.findMany({
        where: { code, status: 'OPEN', rawId: { in: [...rawIds] } },
        select: { id: true },
      });
      if (!exceptions.length) continue;
      await this.prisma.$transaction([
        this.prisma.exceptionResolution.createMany({
          data: exceptions.map((exception) => ({
            exceptionId: exception.id,
            action: 'REVALIDATED',
            before: { status: 'OPEN' },
            after: { status: 'RESOLVED' },
            reason: 'Điều kiện nguồn đã được bổ sung và pipeline kiểm tra lại thành công.',
            actorId,
          })),
        }),
        this.prisma.attendanceException.updateMany({
          where: { id: { in: exceptions.map((exception) => exception.id) } },
          data: { status: 'RESOLVED' },
        }),
      ]);
    }
  }

  private async ensureRawException(
    rawId: string,
    code: string,
    blocking: boolean,
    existingKeys: Set<string>,
    details?: Prisma.InputJsonObject,
  ) {
    const key = `raw:${rawId}:${code}`;
    if (existingKeys.has(key)) return;
    await this.prisma.attendanceException.create({
      data: { rawId, code, blocking, ...(details ? { details } : {}) },
    });
    existingKeys.add(key);
  }

  private isIsoDate(value: string | null): value is string {
    return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
  }

  private isFullOffsetTimestamp(value: string | null): value is string {
    return Boolean(
      value &&
        /^\d{4}-\d{2}-\d{2}T/.test(value) &&
        /(Z|[+-]\d{2}:\d{2})$/.test(value) &&
        !Number.isNaN(Date.parse(value)),
    );
  }

  private async storeSource(buffer: Buffer) {
    const configured = this.config.get<string>('UPLOAD_DIR') ?? './storage/uploads';
    const directory = resolve(configured);
    await mkdir(directory, { recursive: true });
    const storageKey = join(directory, `${randomUUID()}.xlsx`);
    await writeFile(storageKey, buffer, { flag: 'wx' });
    return storageKey;
  }
}

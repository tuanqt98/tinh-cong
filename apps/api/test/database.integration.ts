import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import ExcelJS from 'exceljs';
import request, { type Response as SuperTestResponse } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

function binaryParser(
  response: SuperTestResponse,
  callback: (error: Error | null, body?: Buffer) => void,
) {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
  response.on('error', (error: Error) => callback(error));
}

describe('API + PostgreSQL integration (synthetic dataset)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let hrToken: string;
  let employeeToken: string;
  let adminUserId: string;
  let ownEmployeeId: string;
  let otherEmployeeId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL)
      throw new Error('DATABASE_URL is required for integration tests.');
    if (
      !process.env.INTEGRATION_ADMIN_PASSWORD ||
      !process.env.INTEGRATION_HR_PASSWORD ||
      !process.env.INTEGRATION_EMPLOYEE_PASSWORD
    ) {
      throw new Error('Synthetic integration credentials are required.');
    }

    process.env.JWT_ACCESS_SECRET ??= 'synthetic-integration-access-secret-32-characters';
    process.env.JWT_REFRESH_SECRET ??= 'synthetic-integration-refresh-secret-32-characters';
    process.env.WORKFLOW_ENABLED = 'false';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const ownUser = await prisma.user.findUniqueOrThrow({
      where: { username: 'employee.synthetic' },
    });
    if (!ownUser.employeeId)
      throw new Error('Synthetic employee user is not linked to an employee.');
    ownEmployeeId = ownUser.employeeId;
    const other = await prisma.employee.upsert({
      where: { code: 'SYN-E2E-OTHER' },
      update: { name: 'Synthetic E2E scope target', active: true },
      create: { code: 'SYN-E2E-OTHER', name: 'Synthetic E2E scope target' },
    });
    otherEmployeeId = other.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin.synthetic', password: process.env.INTEGRATION_ADMIN_PASSWORD })
      .expect(201);
    adminToken = adminLogin.body.accessToken as string;
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { username: 'admin.synthetic' },
    });
    adminUserId = adminUser.id;

    const hrLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'hr.synthetic', password: process.env.INTEGRATION_HR_PASSWORD })
      .expect(201);
    hrToken = hrLogin.body.accessToken as string;

    const employeeLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'employee.synthetic', password: process.env.INTEGRATION_EMPLOYEE_PASSWORD })
      .expect(201);
    employeeToken = employeeLogin.body.accessToken as string;
  }, 30_000);

  afterAll(async () => {
    if (prisma && otherEmployeeId) {
      await prisma.employee.deleteMany({ where: { id: otherEmployeeId, code: 'SYN-E2E-OTHER' } });
    }
    if (app) await app.close();
  });

  it('migration and seed expose the expected reference data', async () => {
    await expect(prisma.role.count()).resolves.toBe(4);
    await expect(prisma.shift.count({ where: { code: { in: ['CA1', 'CA3'] } } })).resolves.toBe(2);
    await expect(
      prisma.shiftRule.count({
        where: {
          shift: { code: 'CA1' },
          version: 5,
          effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
          scheduledStartSeconds: 25_200,
          scheduledCompletionSeconds: 68_400,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.shiftRule.count({
        where: {
          shift: { code: 'CA3' },
          version: 4,
          effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
          scheduledStartSeconds: 68_400,
          scheduledCompletionSeconds: 111_600,
        },
      }),
    ).resolves.toBe(1);
    await expect(prisma.attendancePeriod.count({ where: { year: 2026, month: 10 } })).resolves.toBe(
      1,
    );
  });

  it('protects private API and permits ADMIN dashboard access', async () => {
    await request(app.getHttpServer()).get('/api/v1/dashboard').expect(401);
    const response = await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(response.body.employees).toBeGreaterThanOrEqual(1);
    expect(response.body.employeesWithAttendance).toBeGreaterThanOrEqual(0);
    expect(response.body.totalWorkedSeconds).toBeGreaterThanOrEqual(0);
    expect(response.body.tierSeconds).toEqual(
      expect.objectContaining({
        tier100: expect.any(Number),
        tier130: expect.any(Number),
        tier150: expect.any(Number),
        tier200: expect.any(Number),
        tier210: expect.any(Number),
        tier230: expect.any(Number),
      }),
    );
  });

  it('prevents EMPLOYEE IDOR while allowing self access', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${ownEmployeeId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${otherEmployeeId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('keeps period transitions fail-closed while business workflow is open', async () => {
    const period = await prisma.attendancePeriod.findUniqueOrThrow({
      where: { year_month: { year: 2026, month: 10 } },
    });
    const response = await request(app.getHttpServer())
      .post(`/api/v1/periods/${period.id}/transitions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetStatus: 'REVIEWED',
        expectedVersion: period.version,
        reason: 'Synthetic integration check',
      })
      .expect(409);
    expect(response.body.message).toContain('Workflow đang tắt');
  });

  it('keeps source master provisioning fail-closed while HR approvals are missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/imports/00000000-0000-0000-0000-000000000001/approve-source-and-process')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect(response.body).toMatchObject({
      code: 'SOURCE_MASTER_APPROVAL_REQUIRED',
    });
  });

  it('manages employees with server filters, audit history and attendance-preserving deactivation', async () => {
    const code = 'SYN-EMP-MGMT';
    let employeeId = '';
    let importId = '';
    let departmentId = '';
    try {
      await request(app.getHttpServer())
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ code: 'SYN-DEPT-MGMT', name: 'Phòng quản lý synthetic' })
        .expect(403);

      const createdDepartment = await request(app.getHttpServer())
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'SYN-DEPT-MGMT', name: 'Phòng quản lý synthetic' })
        .expect(201);
      departmentId = createdDepartment.body.id as string;
      const department = createdDepartment.body as { id: string; name: string };

      const created = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code,
          name: 'Nhân viên quản lý synthetic',
          departmentId: department.id,
          status: 'ACTIVE',
        })
        .expect(201);
      employeeId = created.body.id as string;
      expect(created.body).not.toHaveProperty('currentShiftId');
      expect(created.body).not.toHaveProperty('startDate');

      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code,
          name: 'Mã trùng',
          departmentId: department.id,
          status: 'ACTIVE',
        })
        .expect(409);

      const list = await request(app.getHttpServer())
        .get(
          `/api/v1/employees?search=SYN-EMP&departmentId=${department.id}&status=ACTIVE&page=1&pageSize=10`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(list.body.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: employeeId, code })]),
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ phone: '0900000000' })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Nhân viên quản lý đã sửa',
          status: 'ON_LEAVE',
          reason: 'Synthetic update',
        })
        .expect(200);

      const history = await request(app.getHttpServer())
        .get(`/api/v1/employees/${employeeId}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(history.body.length).toBeGreaterThanOrEqual(2);
      expect(history.body[0]).toEqual(
        expect.objectContaining({
          actor: expect.objectContaining({ username: 'admin.synthetic' }),
        }),
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${employeeId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ name: 'Không được phép' })
        .expect(403);

      const importRecord = await prisma.attendanceImport.create({
        data: {
          originalName: 'employee-management-preservation.xlsx',
          sha256: 'c'.repeat(64),
          mappingVersion: 'employee-management-integration-v1',
          status: 'ACCEPTED',
          attemptedById: adminUserId,
          confirmedAt: new Date(),
        },
      });
      importId = importRecord.id;
      await prisma.attendanceRaw.create({
        data: {
          importId,
          employeeId,
          sheet: 'Synthetic',
          rowNo: 2,
          employeeCode: code,
          employeeName: 'Nhân viên quản lý synthetic',
          departmentName: department.name,
          attendanceDateRaw: '2026-10-20',
          checkInRaw: '08:00',
          checkOutRaw: '17:00',
          shiftNameRaw: 'Ca1',
          rawCells: {},
        },
      });

      const deactivated = await request(app.getHttpServer())
        .delete(`/api/v1/employees/${employeeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Synthetic preservation test' })
        .expect(200);
      expect(deactivated.body).toMatchObject({
        status: 'RESIGNED',
        preservedAttendance: true,
        attendanceRecords: 1,
      });
      await expect(prisma.attendanceRaw.count({ where: { employeeId } })).resolves.toBe(1);
      await expect(
        prisma.auditLog.count({ where: { entity: 'Employee', entityId: employeeId } }),
      ).resolves.toBeGreaterThanOrEqual(3);

      const statistics = await request(app.getHttpServer())
        .get('/api/v1/employees/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(statistics.body).toEqual(
        expect.objectContaining({ total: expect.any(Number), RESIGNED: expect.any(Number) }),
      );
    } finally {
      if (employeeId) {
        await prisma.attendanceRaw.deleteMany({ where: { employeeId } });
        await prisma.employeeHistory.deleteMany({ where: { employeeId } });
        await prisma.auditLog.deleteMany({ where: { entity: 'Employee', entityId: employeeId } });
        await prisma.employee.deleteMany({ where: { id: employeeId } });
      }
      if (importId) await prisma.attendanceImport.deleteMany({ where: { id: importId } });
      if (departmentId) await prisma.department.deleteMany({ where: { id: departmentId } });
    }
  });

  it('downloads a synthetic template and imports only non-conflicting employee masters', async () => {
    let importedEmployeeId = '';
    try {
      const template = await request(app.getHttpServer())
        .get('/api/v1/employees/template')
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(template.headers['content-type']).toContain('spreadsheetml');
      expect(Buffer.isBuffer(template.body)).toBe(true);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(template.body as never);
      const templateSheet = workbook.worksheets[0];
      expect(templateSheet?.getRow(1).values).toEqual([
        undefined,
        'Mã nhân viên',
        'Tên nhân viên',
        'Phòng ban',
        'Trạng thái',
      ]);

      templateSheet!.getCell('B1').value = 'Họ và tên';
      const legacyTemplate = Buffer.from(await workbook.xlsx.writeBuffer());
      const legacyPreview = await request(app.getHttpServer())
        .post('/api/v1/employees/import/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', legacyTemplate, {
          filename: 'synthetic-employees-legacy.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        .expect(201);
      expect(legacyPreview.body).toMatchObject({ rowCount: 1, canConfirm: true, errors: [] });

      templateSheet!.getCell('C2').value = 'AKO';
      const unknownDepartmentTemplate = Buffer.from(await workbook.xlsx.writeBuffer());
      const invalidDepartmentPreview = await request(app.getHttpServer())
        .post('/api/v1/employees/import/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', unknownDepartmentTemplate, {
          filename: 'synthetic-employees-unknown-department.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        .expect(201);
      expect(invalidDepartmentPreview.body).toMatchObject({ rowCount: 1, canConfirm: false });
      expect(invalidDepartmentPreview.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            row: 2,
            field: 'department',
            message: 'Phòng ban "AKO" chưa tồn tại hoặc không hoạt động trong hệ thống.',
          }),
        ]),
      );

      const preview = await request(app.getHttpServer())
        .post('/api/v1/employees/import/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', template.body as Buffer, {
          filename: 'synthetic-employees.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        .expect(201);
      expect(preview.body).toMatchObject({ rowCount: 1, canConfirm: true, errors: [] });

      const confirmed = await request(app.getHttpServer())
        .post('/api/v1/employees/import/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rows: preview.body.rows })
        .expect(201);
      expect(confirmed.body).toMatchObject({ imported: 1 });
      const imported = await prisma.employee.findUniqueOrThrow({ where: { code: 'SYN-NV001' } });
      importedEmployeeId = imported.id;

      const conflict = await request(app.getHttpServer())
        .post('/api/v1/employees/import/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', template.body as Buffer, {
          filename: 'synthetic-employees.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        .expect(201);
      expect(conflict.body.canConfirm).toBe(false);
      expect(conflict.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'code' })]),
      );
    } finally {
      if (importedEmployeeId) {
        await prisma.employeeHistory.deleteMany({ where: { employeeId: importedEmployeeId } });
        await prisma.employee.deleteMany({ where: { id: importedEmployeeId } });
      }
      await prisma.auditLog.deleteMany({ where: { entity: 'EmployeeImport' } });
    }
  });

  it('prepares period coverage and calculates with the approved Ca 1 rule without a work schedule', async () => {
    const ca1Rule = await prisma.shiftRule.findFirstOrThrow({
      where: { shift: { code: 'CA1' }, version: 5 },
    });
    const existingSourcePeriod = await prisma.attendancePeriod.findUnique({
      where: { year_month: { year: 2026, month: 9 } },
    });
    const importRecord = await prisma.attendanceImport.create({
      data: {
        originalName: 'synthetic-source-shift.xlsx',
        sha256: 'a'.repeat(64),
        mappingVersion: 'integration-v1',
        status: 'ACCEPTED',
        attemptedById: adminUserId,
        confirmedAt: new Date(),
      },
    });
    const raw = await prisma.attendanceRaw.create({
      data: {
        importId: importRecord.id,
        employeeId: ownEmployeeId,
        sheet: 'Synthetic',
        rowNo: 4,
        employeeCode: 'SYN-001',
        employeeName: 'Nhân viên synthetic 001',
        departmentName: 'Phòng sản xuất mẫu',
        attendanceDateRaw: '2026-09-10',
        checkInRaw: '08:00',
        checkOutRaw: '17:00',
        shiftNameRaw: 'Ca1',
        rawCells: {},
      },
    });
    const missingRaw = await prisma.attendanceRaw.create({
      data: {
        importId: importRecord.id,
        sheet: 'Synthetic',
        rowNo: 5,
        employeeCode: 'SYN-MISSING-EMPLOYEE',
        employeeName: 'Nhân viên chưa có hồ sơ',
        departmentName: 'Phòng sản xuất mẫu',
        attendanceDateRaw: '2026-09-10',
        checkInRaw: '08:00',
        checkOutRaw: '17:00',
        shiftNameRaw: 'Ca1',
        rawCells: {},
      },
    });
    const sundayRestRaw = await prisma.attendanceRaw.create({
      data: {
        importId: importRecord.id,
        sheet: 'Synthetic',
        rowNo: 6,
        employeeCode: 'SYN-SUNDAY-REST',
        employeeName: 'Nhân viên nghỉ Chủ nhật',
        departmentName: 'Phòng sản xuất mẫu',
        attendanceDateRaw: '2026-09-06',
        checkInRaw: null,
        checkOutRaw: null,
        shiftNameRaw: null,
        rawCells: {},
      },
    });
    await prisma.attendanceImportIssue.createMany({
      data: [
        {
          importId: importRecord.id,
          sheet: 'Synthetic',
          rowNo: 6,
          issueCode: 'INVALID_SHIFT',
          evidence: { blocking: false },
        },
        {
          importId: importRecord.id,
          sheet: 'Synthetic',
          rowNo: 6,
          issueCode: 'NO_ATTENDANCE',
          evidence: { blocking: false },
        },
      ],
    });
    await prisma.attendanceException.createMany({
      data: [
        { rawId: sundayRestRaw.id, code: 'INVALID_SHIFT', blocking: false },
        { rawId: sundayRestRaw.id, code: 'NO_ATTENDANCE', blocking: false },
        {
          rawId: sundayRestRaw.id,
          code: 'UNSUPPORTED_SHIFT_FOR_CALCULATION',
          blocking: true,
        },
        { rawId: sundayRestRaw.id, code: 'EMPLOYEE_NOT_FOUND', blocking: true },
      ],
    });

    try {
      await expect(
        prisma.workSchedule.count({
          where: { employeeId: ownEmployeeId, shiftDate: new Date('2026-09-10T00:00:00.000Z') },
        }),
      ).resolves.toBe(0);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/imports/${importRecord.id}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        sundayRestRows: 1,
        linkedEmployees: 1,
        missingEmployees: 1,
        missingEmployeeCodes: ['SYN-MISSING-EMPLOYEE'],
        promotedImportIssues: 0,
        missingSchedules: 0,
        missingTimestampEvidence: 0,
        calculatedRows: 1,
      });
      await expect(prisma.attendanceCalculation.count({ where: { rawId: raw.id } })).resolves.toBe(
        1,
      );
      await expect(
        prisma.attendanceException.count({
          where: { rawId: sundayRestRaw.id, status: 'OPEN' },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.attendanceException.count({
          where: { rawId: sundayRestRaw.id, status: 'RESOLVED' },
        }),
      ).resolves.toBe(4);
      await expect(
        prisma.exceptionResolution.count({
          where: { exception: { rawId: sundayRestRaw.id } },
        }),
      ).resolves.toBe(4);
      await expect(
        prisma.attendanceCalculation.count({ where: { rawId: sundayRestRaw.id } }),
      ).resolves.toBe(0);
      const repeated = await request(app.getHttpServer())
        .post(`/api/v1/imports/${importRecord.id}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      expect(repeated.body).toMatchObject({ calculatedRows: 1 });
      await expect(prisma.attendanceCalculation.count({ where: { rawId: raw.id } })).resolves.toBe(
        1,
      );
      await expect(
        prisma.attendancePeriod.count({ where: { year: 2026, month: 9, status: 'DRAFT' } }),
      ).resolves.toBe(1);
      await expect(
        prisma.shiftRule.count({
          where: {
            id: ca1Rule.id,
            effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
          },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.workSchedule.count({
          where: { employeeId: ownEmployeeId, shiftDate: new Date('2026-09-10T00:00:00.000Z') },
        }),
      ).resolves.toBe(0);
    } finally {
      await prisma.exceptionResolution.deleteMany({
        where: { exception: { rawId: sundayRestRaw.id } },
      });
      await prisma.attendanceException.deleteMany({
        where: { rawId: { in: [raw.id, missingRaw.id, sundayRestRaw.id] } },
      });
      await prisma.attendanceCalculation.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceNormalization.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceRaw.deleteMany({
        where: { id: { in: [raw.id, missingRaw.id, sundayRestRaw.id] } },
      });
      await prisma.auditLog.deleteMany({
        where: { entity: 'AttendanceImport', entityId: importRecord.id },
      });
      await prisma.attendanceImport.delete({ where: { id: importRecord.id } });
      if (!existingSourcePeriod) {
        await prisma.attendancePeriod.deleteMany({ where: { year: 2026, month: 9 } });
      }
    }
  });

  it('lets HR configure a company holiday and suppresses blank-attendance exceptions', async () => {
    const holidayDate = '2026-10-02';
    const importRecord = await prisma.attendanceImport.create({
      data: {
        originalName: 'synthetic-company-holiday.xlsx',
        sha256: '9'.repeat(64),
        mappingVersion: 'integration-company-holiday',
        status: 'ACCEPTED',
        attemptedById: adminUserId,
        confirmedAt: new Date(),
      },
    });
    const raw = await prisma.attendanceRaw.create({
      data: {
        importId: importRecord.id,
        sheet: 'Synthetic holiday',
        rowNo: 4,
        employeeCode: 'SYN-HOLIDAY-REST',
        employeeName: 'Nhân viên nghỉ lễ synthetic',
        departmentName: 'Phòng sản xuất mẫu',
        attendanceDateRaw: holidayDate,
        checkInRaw: null,
        checkOutRaw: null,
        shiftNameRaw: null,
        rawCells: {},
      },
    });
    await prisma.attendanceImportIssue.createMany({
      data: [
        {
          importId: importRecord.id,
          sheet: 'Synthetic holiday',
          rowNo: 4,
          issueCode: 'INVALID_SHIFT',
          evidence: { blocking: false },
        },
        {
          importId: importRecord.id,
          sheet: 'Synthetic holiday',
          rowNo: 4,
          issueCode: 'NO_ATTENDANCE',
          evidence: { blocking: false },
        },
      ],
    });
    await prisma.attendanceException.createMany({
      data: [
        { rawId: raw.id, code: 'INVALID_SHIFT', blocking: false },
        { rawId: raw.id, code: 'NO_ATTENDANCE', blocking: false },
      ],
    });
    let holidayId = '';

    try {
      await request(app.getHttpServer())
        .post('/api/v1/company-holidays')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ holidayDate, name: 'Ngày nghỉ lễ synthetic' })
        .expect(403);

      const created = await request(app.getHttpServer())
        .post('/api/v1/company-holidays')
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ holidayDate, name: 'Ngày nghỉ lễ synthetic' })
        .expect(201);
      holidayId = created.body.id as string;
      expect(created.body).toMatchObject({ name: 'Ngày nghỉ lễ synthetic', resolvedExceptions: 2 });

      const listed = await request(app.getHttpServer())
        .get('/api/v1/company-holidays?month=2026-10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(listed.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: holidayId, name: 'Ngày nghỉ lễ synthetic' }),
        ]),
      );
      await expect(
        prisma.attendanceException.count({ where: { rawId: raw.id, status: 'OPEN' } }),
      ).resolves.toBe(0);

      const processed = await request(app.getHttpServer())
        .post(`/api/v1/imports/${importRecord.id}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      expect(processed.body).toMatchObject({
        rawRows: 1,
        restRows: 1,
        sundayRestRows: 0,
        companyHolidayRestRows: 1,
        promotedImportIssues: 0,
        calculatedRows: 0,
      });
      await expect(prisma.attendanceCalculation.count({ where: { rawId: raw.id } })).resolves.toBe(
        0,
      );

      await request(app.getHttpServer())
        .delete(`/api/v1/company-holidays/${holidayId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
    } finally {
      await prisma.exceptionResolution.deleteMany({ where: { exception: { rawId: raw.id } } });
      await prisma.attendanceException.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceImportIssue.deleteMany({ where: { importId: importRecord.id } });
      await prisma.attendanceRaw.deleteMany({ where: { id: raw.id } });
      await prisma.attendanceImport.delete({ where: { id: importRecord.id } });
      if (holidayId) await prisma.companyHoliday.deleteMany({ where: { id: holidayId } });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { entity: 'AttendanceImport', entityId: importRecord.id },
            ...(holidayId ? [{ entity: 'CompanyHoliday', entityId: holidayId }] : []),
          ],
        },
      });
    }
  });

  it('does not backdate the approved Ca 1 rule before 01/09/2026', async () => {
    const ca1Rule = await prisma.shiftRule.findFirstOrThrow({
      where: { shift: { code: 'CA1' }, version: 5 },
    });
    const importRecord = await prisma.attendanceImport.create({
      data: {
        originalName: 'synthetic-ca1-before-effective-date.xlsx',
        sha256: 'e'.repeat(64),
        mappingVersion: 'integration-ca1-effective-date',
        status: 'ACCEPTED',
        attemptedById: adminUserId,
        confirmedAt: new Date(),
      },
    });
    const raw = await prisma.attendanceRaw.create({
      data: {
        importId: importRecord.id,
        employeeId: ownEmployeeId,
        sheet: 'Synthetic CA1 before effective date',
        rowNo: 4,
        employeeCode: 'SYN-001',
        employeeName: 'Nhân viên synthetic 001',
        departmentName: 'Phòng sản xuất mẫu',
        attendanceDateRaw: '2026-08-31',
        checkInRaw: '06:30',
        checkOutRaw: '19:30',
        shiftNameRaw: 'Ca1',
        rawCells: {},
      },
    });

    try {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/imports/${importRecord.id}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
      expect(response.body).toMatchObject({ code: 'APPROVED_SHIFT_RULE_NOT_AVAILABLE' });
      await expect(
        prisma.shiftRule.count({
          where: {
            id: ca1Rule.id,
            effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
          },
        }),
      ).resolves.toBe(1);
      await expect(prisma.attendanceCalculation.count({ where: { rawId: raw.id } })).resolves.toBe(
        0,
      );
    } finally {
      await prisma.attendanceException.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceRaw.delete({ where: { id: raw.id } });
      await prisma.attendanceImport.delete({ where: { id: importRecord.id } });
    }
  });

  it('applies Ca 1 07:00 credit boundaries and full 30-minute checkout blocks', async () => {
    const existingSourcePeriod = await prisma.attendancePeriod.findUnique({
      where: { year_month: { year: 2026, month: 9 } },
    });
    const importRecord = await prisma.attendanceImport.create({
      data: {
        originalName: 'synthetic-ca1-boundary.xlsx',
        sha256: 'd'.repeat(64),
        mappingVersion: 'integration-ca1-v4',
        status: 'ACCEPTED',
        attemptedById: adminUserId,
        confirmedAt: new Date(),
      },
    });
    const rawRows = await Promise.all([
      prisma.attendanceRaw.create({
        data: {
          importId: importRecord.id,
          employeeId: ownEmployeeId,
          sheet: 'Synthetic CA1',
          rowNo: 4,
          employeeCode: 'SYN-001',
          employeeName: 'Nhân viên synthetic 001',
          departmentName: 'Phòng sản xuất mẫu',
          attendanceDateRaw: '2026-09-18',
          checkInRaw: '06:30',
          checkOutRaw: '19:20',
          shiftNameRaw: 'Ca1',
          rawCells: {},
        },
      }),
      prisma.attendanceRaw.create({
        data: {
          importId: importRecord.id,
          employeeId: ownEmployeeId,
          sheet: 'Synthetic CA1',
          rowNo: 6,
          employeeCode: 'SYN-001',
          employeeName: 'Nhân viên synthetic 001',
          departmentName: 'Phòng sản xuất mẫu',
          attendanceDateRaw: '2026-09-25',
          checkInRaw: '06:37',
          checkOutRaw: '18:11',
          shiftNameRaw: 'Ca1',
          rawCells: {},
        },
      }),
      prisma.attendanceRaw.create({
        data: {
          importId: importRecord.id,
          employeeId: ownEmployeeId,
          sheet: 'Synthetic CA1',
          rowNo: 5,
          employeeCode: 'SYN-001',
          employeeName: 'Nhân viên synthetic 001',
          departmentName: 'Phòng sản xuất mẫu',
          attendanceDateRaw: '2026-09-19',
          checkInRaw: '06:30',
          checkOutRaw: '19:30',
          shiftNameRaw: 'Ca1',
          rawCells: {},
        },
      }),
    ]);

    try {
      await request(app.getHttpServer())
        .post(`/api/v1/imports/${importRecord.id}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const at1920 = await prisma.attendanceCalculation.findFirstOrThrow({
        where: { rawId: rawRows[0]!.id },
        include: { normalization: true, shiftRule: true },
      });
      expect(at1920).toMatchObject({
        revision: 1,
        presenceSeconds: 43_200,
        breakSeconds: 3_600,
        workedSeconds: 39_600,
        lateCount: 0,
        earlyCount: 0,
        tier100Seconds: 28_800,
        tier130Seconds: 0,
        tier150Seconds: 10_800,
        tier200Seconds: 0,
        tier210Seconds: 0,
        tier230Seconds: 0,
        shiftRule: {
          version: 5,
          scheduledStartSeconds: 25_200,
          scheduledCompletionSeconds: 68_400,
        },
      });
      expect(at1920.normalization.checkInAt?.toISOString()).toBe('2026-09-17T23:30:00.000Z');
      expect(at1920.normalization.checkOutAt?.toISOString()).toBe('2026-09-18T12:20:00.000Z');

      const at1930 = await prisma.attendanceCalculation.findFirstOrThrow({
        where: { rawId: rawRows[2]!.id },
        include: { normalization: true, shiftRule: true },
      });
      expect(at1930).toMatchObject({
        presenceSeconds: 45_000,
        breakSeconds: 3_600,
        workedSeconds: 41_400,
        tier100Seconds: 28_800,
        tier150Seconds: 12_600,
        tier200Seconds: 0,
        tier230Seconds: 0,
        shiftRule: { version: 5 },
      });
      expect(at1930.normalization.checkInAt?.toISOString()).toBe('2026-09-18T23:30:00.000Z');
      expect(at1930.normalization.checkOutAt?.toISOString()).toBe('2026-09-19T12:30:00.000Z');

      const at1811 = await prisma.attendanceCalculation.findFirstOrThrow({
        where: { rawId: rawRows[1]!.id },
        include: { normalization: true, shiftRule: true },
      });
      expect(at1811).toMatchObject({
        presenceSeconds: 39_600,
        breakSeconds: 3_600,
        workedSeconds: 36_000,
        earlyCount: 1,
        tier100Seconds: 28_800,
        tier150Seconds: 7_200,
        tier200Seconds: 0,
        tier230Seconds: 0,
        shiftRule: { version: 5 },
      });
      expect(at1811.normalization.checkInAt?.toISOString()).toBe('2026-09-24T23:37:00.000Z');
      expect(at1811.normalization.checkOutAt?.toISOString()).toBe('2026-09-25T11:11:00.000Z');
    } finally {
      const rawIds = rawRows.map((row) => row.id);
      await prisma.attendanceException.deleteMany({ where: { rawId: { in: rawIds } } });
      await prisma.attendanceCalculation.deleteMany({ where: { rawId: { in: rawIds } } });
      await prisma.attendanceNormalization.deleteMany({ where: { rawId: { in: rawIds } } });
      await prisma.attendanceRaw.deleteMany({ where: { id: { in: rawIds } } });
      await prisma.auditLog.deleteMany({
        where: { entity: 'AttendanceImport', entityId: importRecord.id },
      });
      await prisma.attendanceImport.delete({ where: { id: importRecord.id } });
      if (!existingSourcePeriod) {
        await prisma.attendancePeriod.deleteMany({ where: { year: 2026, month: 9 } });
      }
    }
  });

  it('uses shiftDate Sunday to allocate all Ca 1 to 200% and all Ca 3 to 230%', async () => {
    const existingSourcePeriod = await prisma.attendancePeriod.findUnique({
      where: { year_month: { year: 2026, month: 9 } },
    });
    const importRecord = await prisma.attendanceImport.create({
      data: {
        originalName: 'synthetic-sunday-tiers.xlsx',
        sha256: 'e'.repeat(64),
        mappingVersion: 'integration-dec010-v1',
        status: 'ACCEPTED',
        attemptedById: adminUserId,
        confirmedAt: new Date(),
      },
    });
    const rawRows = await Promise.all([
      prisma.attendanceRaw.create({
        data: {
          importId: importRecord.id,
          employeeId: ownEmployeeId,
          sheet: 'Synthetic Sunday',
          rowNo: 4,
          employeeCode: 'SYN-001',
          employeeName: 'Nhân viên synthetic 001',
          departmentName: 'Phòng sản xuất mẫu',
          attendanceDateRaw: '2026-09-06',
          checkInRaw: '06:30',
          checkOutRaw: '19:30',
          shiftNameRaw: 'Ca1',
          rawCells: {},
        },
      }),
      prisma.attendanceRaw.create({
        data: {
          importId: importRecord.id,
          employeeId: ownEmployeeId,
          sheet: 'Synthetic Sunday',
          rowNo: 5,
          employeeCode: 'SYN-001',
          employeeName: 'Nhân viên synthetic 001',
          departmentName: 'Phòng sản xuất mẫu',
          attendanceDateRaw: '2026-09-13',
          checkInRaw: '18:45',
          checkOutRaw: '07:30',
          shiftNameRaw: 'Ca3',
          rawCells: {},
        },
      }),
    ]);

    try {
      await request(app.getHttpServer())
        .post(`/api/v1/imports/${importRecord.id}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const calculations = await prisma.attendanceCalculation.findMany({
        where: { rawId: { in: rawRows.map((row) => row.id) } },
        include: { normalization: true, shiftRule: true },
        orderBy: { normalization: { shiftDate: 'asc' } },
      });
      expect(calculations).toHaveLength(2);
      expect(calculations[0]).toMatchObject({
        workedSeconds: 41_400,
        tier100Seconds: 0,
        tier130Seconds: 0,
        tier150Seconds: 0,
        tier200Seconds: 41_400,
        tier210Seconds: 0,
        tier230Seconds: 0,
        shiftRule: { version: 5 },
      });
      expect(calculations[1]).toMatchObject({
        workedSeconds: 41_400,
        tier100Seconds: 0,
        tier130Seconds: 0,
        tier150Seconds: 0,
        tier200Seconds: 0,
        tier210Seconds: 0,
        tier230Seconds: 41_400,
        shiftRule: { version: 4 },
      });
      expect(calculations[0]!.normalization.shiftDate?.toISOString().slice(0, 10)).toBe(
        '2026-09-06',
      );
      expect(calculations[1]!.normalization.shiftDate?.toISOString().slice(0, 10)).toBe(
        '2026-09-13',
      );
    } finally {
      const rawIds = rawRows.map((row) => row.id);
      await prisma.attendanceException.deleteMany({ where: { rawId: { in: rawIds } } });
      await prisma.attendanceCalculation.deleteMany({ where: { rawId: { in: rawIds } } });
      await prisma.attendanceNormalization.deleteMany({ where: { rawId: { in: rawIds } } });
      await prisma.attendanceRaw.deleteMany({ where: { id: { in: rawIds } } });
      await prisma.auditLog.deleteMany({
        where: { entity: 'AttendanceImport', entityId: importRecord.id },
      });
      await prisma.attendanceImport.delete({ where: { id: importRecord.id } });
      if (!existingSourcePeriod) {
        await prisma.attendancePeriod.deleteMany({ where: { year: 2026, month: 9 } });
      }
    }
  });

  it('applies Ca 3 19:00 credit boundaries and creates a new immutable revision', async () => {
    const existingSourcePeriod = await prisma.attendancePeriod.findUnique({
      where: { year_month: { year: 2026, month: 9 } },
    });
    const ca3 = await prisma.shift.findUniqueOrThrow({ where: { code: 'CA3' } });
    const importRecord = await prisma.attendanceImport.create({
      data: {
        originalName: 'synthetic-ca3-boundary.xlsx',
        sha256: 'c'.repeat(64),
        mappingVersion: 'integration-ca3-v1',
        status: 'ACCEPTED',
        attemptedById: adminUserId,
        confirmedAt: new Date(),
      },
    });
    const raw = await prisma.attendanceRaw.create({
      data: {
        importId: importRecord.id,
        employeeId: ownEmployeeId,
        sheet: 'Synthetic CA3',
        rowNo: 4,
        employeeCode: 'SYN-001',
        employeeName: 'Nhân viên synthetic 001',
        departmentName: 'Phòng sản xuất mẫu',
        attendanceDateRaw: '2026-09-18',
        checkInRaw: '18:45',
        checkOutRaw: '07:15',
        shiftNameRaw: 'Ca3',
        rawCells: {},
      },
    });
    let extraRuleId: string | undefined;

    try {
      await request(app.getHttpServer())
        .post(`/api/v1/imports/${importRecord.id}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const first = await prisma.attendanceCalculation.findFirstOrThrow({
        where: { rawId: raw.id },
        include: { normalization: true, shiftRule: true },
      });
      expect(first).toMatchObject({
        revision: 1,
        presenceSeconds: 43_200,
        breakSeconds: 3_600,
        workedSeconds: 39_600,
        lateCount: 0,
        earlyCount: 0,
        tier100Seconds: 14_400,
        tier130Seconds: 14_400,
        tier150Seconds: 0,
        tier200Seconds: 0,
        tier210Seconds: 10_800,
        tier230Seconds: 0,
        shiftRule: { version: 4, scheduledStartSeconds: 68_400 },
      });
      expect(first.normalization.checkInAt?.toISOString()).toBe('2026-09-18T11:45:00.000Z');
      expect(first.normalization.checkOutAt?.toISOString()).toBe('2026-09-19T00:15:00.000Z');

      const version5 = await prisma.shiftRule.create({
        data: {
          shiftId: ca3.id,
          version: 5,
          effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
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
      });
      extraRuleId = version5.id;

      await request(app.getHttpServer())
        .post(`/api/v1/imports/${importRecord.id}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
      const revisions = await prisma.attendanceCalculation.findMany({
        where: { rawId: raw.id },
        orderBy: { revision: 'asc' },
      });
      expect(revisions.map((item) => item.revision)).toEqual([1, 2]);
      expect(revisions[0]?.shiftRuleId).not.toBe(revisions[1]?.shiftRuleId);
      await expect(
        prisma.attendanceNormalization.count({ where: { rawId: raw.id } }),
      ).resolves.toBe(2);
    } finally {
      await prisma.attendanceException.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceCalculation.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceNormalization.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceRaw.delete({ where: { id: raw.id } });
      await prisma.auditLog.deleteMany({
        where: { entity: 'AttendanceImport', entityId: importRecord.id },
      });
      await prisma.attendanceImport.delete({ where: { id: importRecord.id } });
      if (extraRuleId) await prisma.shiftRule.delete({ where: { id: extraRuleId } });
      if (!existingSourcePeriod) {
        await prisma.attendancePeriod.deleteMany({ where: { year: 2026, month: 9 } });
      }
    }
  });

  it('serves scoped attendance summary and filtered Excel from PostgreSQL data', async () => {
    const period = await prisma.attendancePeriod.findUniqueOrThrow({
      where: { year_month: { year: 2026, month: 10 } },
    });
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: ownEmployeeId } });
    const shiftRule = await prisma.shiftRule.findFirstOrThrow({
      where: { shift: { code: 'CA1' } },
      orderBy: { version: 'desc' },
    });
    const importRecord = await prisma.attendanceImport.create({
      data: {
        originalName: 'attendance-summary-integration.xlsx',
        sha256: 'b'.repeat(64),
        mappingVersion: 'attendance-summary-integration-v1',
        status: 'ACCEPTED',
        attemptedById: adminUserId,
        confirmedAt: new Date(),
      },
    });
    const raw = await prisma.attendanceRaw.create({
      data: {
        importId: importRecord.id,
        employeeId: ownEmployeeId,
        sheet: 'Synthetic summary',
        rowNo: 2,
        employeeCode: employee.code,
        employeeName: employee.name,
        departmentName: 'Phòng trong kỳ synthetic',
        attendanceDateRaw: '2026-10-15',
        checkInRaw: '08:00',
        checkOutRaw: '17:00',
        shiftNameRaw: 'Ca1',
        rawCells: {},
      },
    });
    const normalization = await prisma.attendanceNormalization.create({
      data: {
        rawId: raw.id,
        revision: 1,
        shiftDate: new Date('2026-10-15T00:00:00.000Z'),
        checkInAt: new Date('2026-10-15T01:00:00.000Z'),
        checkOutAt: new Date('2026-10-15T10:00:00.000Z'),
        shiftCode: 'CA1',
        shiftDateEvidence: { type: 'SOURCE_TIMESTAMP', reference: 'synthetic:summary' },
        checkOutDateEvidence: { type: 'SOURCE_TIMESTAMP', reference: 'synthetic:summary' },
        ruleVersion: 'integration-v1',
      },
    });
    await prisma.attendanceCalculation.create({
      data: {
        rawId: raw.id,
        normalizationId: normalization.id,
        periodId: period.id,
        shiftRuleId: shiftRule.id,
        engineVersion: 'attendance-summary-integration-v1',
        revision: 1,
        inputHash: 'd'.repeat(64),
        status: 'VALID',
        presenceSeconds: 32_400,
        breakSeconds: 3_600,
        workedSeconds: 28_800,
        lateCount: 0,
        earlyCount: 0,
        tier100Seconds: 28_800,
        tier130Seconds: 0,
        tier150Seconds: 0,
        tier200Seconds: 0,
        tier210Seconds: 0,
        tier230Seconds: 0,
      },
    });

    try {
      const summary = await request(app.getHttpServer())
        .get(
          `/api/v1/attendance/summary?periodId=${period.id}&search=${encodeURIComponent(employee.code)}&page=1&pageSize=10`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(summary.body).toMatchObject({
        total: 1,
        period: { id: period.id, status: period.status },
        workingDaysAvailable: false,
        totals: {
          employees: 1,
          calculatedEmployees: 1,
          workedSeconds: expect.any(Number),
        },
      });
      expect(summary.body.items[0]).toMatchObject({
        employeeId: ownEmployeeId,
        departmentName: 'Phòng trong kỳ synthetic',
        processingStatus: 'VALID',
        workingDays: null,
      });
      expect(summary.body.totals.workedSeconds).toBeGreaterThanOrEqual(28_800);

      const ownScope = await request(app.getHttpServer())
        .get(`/api/v1/attendance/summary?periodId=${period.id}&page=1&pageSize=100`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);
      expect(
        ownScope.body.items.every(
          (item: { employeeId: string }) => item.employeeId === ownEmployeeId,
        ),
      ).toBe(true);

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/attendance/employee/${ownEmployeeId}?periodId=${period.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(detail.body).toMatchObject({
        employee: { id: ownEmployeeId, code: employee.code },
        period: { id: period.id },
        workingDays: null,
        workingDaysAvailable: false,
        totals: { workedSeconds: expect.any(Number), attendanceDays: expect.any(Number) },
      });
      expect(detail.body.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rawId: raw.id,
            revision: 1,
            source: expect.objectContaining({ shiftName: 'Ca1' }),
          }),
        ]),
      );

      const ownDetail = await request(app.getHttpServer())
        .get(`/api/v1/attendance/employee/${ownEmployeeId}?periodId=${period.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);
      expect(ownDetail.body.employee.id).toBe(ownEmployeeId);

      const detailPdf = await request(app.getHttpServer())
        .get(`/api/v1/attendance/employee/${ownEmployeeId}/pdf?periodId=${period.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(String(detailPdf.headers['content-type'])).toContain('application/pdf');
      expect((detailPdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');

      await request(app.getHttpServer())
        .get('/api/v1/attendance/summary?periodId=00000000-0000-0000-0000-000000000999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      const exported = await request(app.getHttpServer())
        .get(
          `/api/v1/attendance/export?periodId=${period.id}&search=${encodeURIComponent(employee.code)}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(exported.body as never);
      const sheet = workbook.getWorksheet('TongHopKyCong');
      expect(sheet?.getCell('A3').value).toContain('DỮ LIỆU TẠM');
      expect(sheet?.getCell('B9').value).toBe(employee.code);
      expect(sheet?.getCell('C10').value).toBe('TỔNG CỘNG');

      await request(app.getHttpServer())
        .get(`/api/v1/attendance/export?periodId=${period.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    } finally {
      await prisma.attendanceCalculation.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceNormalization.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceRaw.deleteMany({ where: { id: raw.id } });
      await prisma.attendanceImport.deleteMany({ where: { id: importRecord.id } });
    }
  });

  it('serves grouped exception workflow reads, preview and fail-closed mutations', async () => {
    const importRecord = await prisma.attendanceImport.create({
      data: {
        originalName: 'synthetic-exceptions.xlsx',
        sha256: 'e'.repeat(64),
        mappingVersion: 'synthetic-exception-v1',
        status: 'ACCEPTED',
        attemptedById: adminUserId,
        confirmedAt: new Date(),
      },
    });
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: ownEmployeeId } });
    const raw = await prisma.attendanceRaw.create({
      data: {
        importId: importRecord.id,
        employeeId: employee.id,
        sheet: 'NgoaiLe',
        rowNo: 1,
        employeeCode: employee.code,
        employeeName: employee.name,
        departmentName: 'Phòng sản xuất mẫu',
        attendanceDateRaw: '2026-10-03',
        checkInRaw: '06:37',
        checkOutRaw: '18:11',
        shiftNameRaw: 'CA1',
        rawCells: { source: 'synthetic-exception-integration' },
      },
    });
    await prisma.attendanceNormalization.create({
      data: {
        rawId: raw.id,
        revision: 1,
        shiftDate: new Date('2026-10-03T00:00:00.000Z'),
        checkInAt: new Date('2026-10-02T23:37:00.000Z'),
        checkOutAt: new Date('2026-10-03T11:11:00.000Z'),
        shiftCode: 'CA1',
        shiftDateEvidence: { type: 'SOURCE_TIMESTAMP', reference: 'synthetic:exception' },
        checkOutDateEvidence: { type: 'SOURCE_TIMESTAMP', reference: 'synthetic:exception' },
        ruleVersion: 'source-shift-v1',
      },
    });
    await prisma.attendanceException.createMany({
      data: [
        {
          rawId: raw.id,
          code: 'MISSING_CHECKIN',
          blocking: true,
          details: { message: 'Synthetic missing check-in' },
        },
        {
          rawId: raw.id,
          code: 'MULTIPLE_ROWS_SAME_EMPLOYEE_DATE',
          blocking: true,
          details: { reason: 'Synthetic multiple rows' },
        },
      ],
    });

    try {
      const list = await request(app.getHttpServer())
        .get(`/api/v1/exceptions?month=2026-10&search=${employee.code}&page=1&pageSize=20`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(list.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0].exceptions).toHaveLength(2);
      expect(list.body.items[0].exceptions.map((item: { code: string }) => item.code)).toEqual(
        expect.arrayContaining(['MISSING_CHECKIN', 'MULTIPLE_ROWS_SAME_EMPLOYEE_DATE']),
      );

      const summary = await request(app.getHttpServer())
        .get(`/api/v1/exceptions/summary?month=2026-10&search=${employee.code}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(summary.body).toMatchObject({
        totalRecords: 1,
        totalCodes: 2,
        blockingRecords: 1,
        resolvedRecords: 0,
        workflowEnabled: false,
      });

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/exceptions/${raw.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(detail.body).toMatchObject({
        id: raw.id,
        employee: { code: employee.code },
        raw: { fileName: 'synthetic-exceptions.xlsx', rowNo: 1 },
        version: 1,
      });

      const preview = await request(app.getHttpServer())
        .post(`/api/v1/exceptions/${raw.id}/preview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          shiftCode: 'CA1',
          shiftDate: '2026-10-03',
          checkInAt: '2026-10-03T06:37:00+07:00',
          checkOutAt: '2026-10-03T18:11:00+07:00',
        })
        .expect(201);
      expect(preview.body).toMatchObject({
        persisted: false,
        inputVersion: 1,
        preview: { status: 'VALID', calculation: { workedSeconds: 36_000 } },
      });

      const exportResponse = await request(app.getHttpServer())
        .get(`/api/v1/exceptions/export?month=2026-10&search=${employee.code}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(exportResponse.body as never);
      expect(workbook.getWorksheet('Ngoại lệ')?.getCell('B2').value).toBe(employee.code);
      expect(String(workbook.getWorksheet('Ngoại lệ')?.getCell('I2').value)).toContain(
        'MISSING_CHECKIN',
      );

      const firstException = await prisma.attendanceException.findFirstOrThrow({
        where: { rawId: raw.id },
      });
      await request(app.getHttpServer())
        .post(`/api/v1/exceptions/${firstException.id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'REVIEWED_NO_CHANGE', reason: 'Synthetic fail-closed integration test' })
        .expect(409);
      await expect(
        prisma.attendanceException.count({ where: { rawId: raw.id, status: 'OPEN' } }),
      ).resolves.toBe(2);

      await request(app.getHttpServer())
        .get('/api/v1/exceptions')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    } finally {
      await prisma.exceptionResolution.deleteMany({
        where: { exception: { rawId: raw.id } },
      });
      await prisma.attendanceException.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceNormalization.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceRaw.deleteMany({ where: { id: raw.id } });
      await prisma.attendanceImport.deleteMany({ where: { id: importRecord.id } });
    }
  });
});

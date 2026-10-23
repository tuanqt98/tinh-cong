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
  let employeeToken: string;
  let adminUserId: string;
  let ownEmployeeId: string;
  let otherEmployeeId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL)
      throw new Error('DATABASE_URL is required for integration tests.');
    if (!process.env.INTEGRATION_ADMIN_PASSWORD || !process.env.INTEGRATION_EMPLOYEE_PASSWORD) {
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
        tier210: expect.any(Number),
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

  it('calculates from source shift without creating a work schedule', async () => {
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
        attendanceDateRaw: '2026-10-10',
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
        attendanceDateRaw: '2026-10-10',
        checkInRaw: '08:00',
        checkOutRaw: '17:00',
        shiftNameRaw: 'Ca1',
        rawCells: {},
      },
    });

    try {
      await expect(
        prisma.workSchedule.count({
          where: { employeeId: ownEmployeeId, shiftDate: new Date('2026-10-10T00:00:00.000Z') },
        }),
      ).resolves.toBe(0);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/imports/${importRecord.id}/process`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body).toMatchObject({
        linkedEmployees: 1,
        missingEmployees: 1,
        missingEmployeeCodes: ['SYN-MISSING-EMPLOYEE'],
        missingSchedules: 0,
        missingTimestampEvidence: 0,
        calculatedRows: 1,
      });
      await expect(prisma.attendanceCalculation.count({ where: { rawId: raw.id } })).resolves.toBe(
        1,
      );
      await expect(
        prisma.workSchedule.count({
          where: { employeeId: ownEmployeeId, shiftDate: new Date('2026-10-10T00:00:00.000Z') },
        }),
      ).resolves.toBe(0);
    } finally {
      await prisma.attendanceException.deleteMany({
        where: { rawId: { in: [raw.id, missingRaw.id] } },
      });
      await prisma.attendanceCalculation.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceNormalization.deleteMany({ where: { rawId: raw.id } });
      await prisma.attendanceRaw.deleteMany({ where: { id: { in: [raw.id, missingRaw.id] } } });
      await prisma.auditLog.deleteMany({
        where: { entity: 'AttendanceImport', entityId: importRecord.id },
      });
      await prisma.attendanceImport.delete({ where: { id: importRecord.id } });
    }
  });
});

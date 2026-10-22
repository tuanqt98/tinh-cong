import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('API + PostgreSQL integration (synthetic dataset)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let employeeToken: string;
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
});

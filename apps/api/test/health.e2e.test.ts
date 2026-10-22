import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('health API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'synthetic-access-secret-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'synthetic-refresh-secret-at-least-32-characters';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /health công khai và không lộ dữ liệu', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'tinh-cong-api',
      timezone: 'Asia/Ho_Chi_Minh',
    });
    expect(response.body).not.toHaveProperty('databaseUrl');
  });
});

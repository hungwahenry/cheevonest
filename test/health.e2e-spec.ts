import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp, createFastifyAdapter } from '../src/app.setup';

describe('Health (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      createFastifyAdapter(),
    );
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the success envelope with service status', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'success',
      message: 'Service healthy.',
      data: { service: 'cheevo', database: 'ok' },
    });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('echoes a provided X-Request-Id header', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('X-Request-Id', 'test-request-id');

    expect(response.headers['x-request-id']).toBe('test-request-id');
  });

  it('renders unknown routes with the error envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .expect(404);

    const body = response.body as { request_id?: string };

    expect(response.body).toMatchObject({
      status: 'error',
      message: 'Resource not found.',
      code: 'not_found',
    });
    expect(body.request_id).toBeTruthy();
  });
});

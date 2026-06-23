import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { setupApp } from '../src/common';
import { AppModule } from './../src/app.module';

interface ApiResponseBody<T> {
  code: number;
  message: string;
  data: T | null;
  timestamp: number;
  path: string;
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((response) => {
        const body = response.body as ApiResponseBody<{ status: string }>;
        expect(typeof body.timestamp).toBe('number');
        expect(body).toMatchObject({
          code: 0,
          message: 'success',
          data: { status: 'ok' },
          path: '/',
        });
      });
  });

  it('/auth/register validates request body', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'a', password: 'short', extra: true })
      .expect(400)
      .expect((response) => {
        const body = response.body as ApiResponseBody<null>;
        expect(typeof body.timestamp).toBe('number');
        expect(body.message).toContain('property extra should not exist');
        expect(body).toMatchObject({
          code: 400,
          data: null,
          path: '/auth/register',
        });
      });
  });

  it('/auth/login requires platformID', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'alice', password: 'password123' })
      .expect(400)
      .expect((response) => {
        const body = response.body as ApiResponseBody<null>;
        expect(typeof body.timestamp).toBe('number');
        expect(body.message).toContain('platformID 必须是整数');
        expect(body).toMatchObject({
          code: 400,
          data: null,
          path: '/auth/login',
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});

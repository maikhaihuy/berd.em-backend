import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureHelmet } from './../src/common/helmet.middleware';
import { buildOpenApiDocument } from './../src/swagger.config';

/**
 * End-to-end coverage for the harden-api-security-perimeter change:
 * CORS origin allowlisting, baseline helmet response headers, and the
 * global ThrottlerGuard actually enforcing the existing @Throttle overrides
 * on public auth endpoints.
 *
 * Requires DATABASE_URL to point at a reachable, seeded database.
 */
describe('API security perimeter (e2e)', () => {
  const allowedOrigin = 'http://localhost:3016';
  const disallowedOrigin = 'http://evil.example.com';

  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(configureHelmet());
    app.enableCors({ origin: [allowedOrigin], credentials: true });
    SwaggerModule.setup('docs', app, buildOpenApiDocument(app));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CORS allowlist', () => {
    it('grants CORS access to an allowlisted origin', async () => {
      const res = await request(app.getHttpServer())
        .get('/')
        .set('Origin', allowedOrigin);

      expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('denies CORS access to a non-allowlisted origin', async () => {
      const res = await request(app.getHttpServer())
        .get('/')
        .set('Origin', disallowedOrigin);

      expect(res.headers['access-control-allow-origin']).not.toBe(
        disallowedOrigin,
      );
    });
  });

  describe('Baseline security headers', () => {
    it('applies helmet security headers to a JSON route', async () => {
      const res = await request(app.getHttpServer()).get('/');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-dns-prefetch-control']).toBeDefined();
      expect(res.headers['strict-transport-security']).toBeDefined();
    });

    it('applies a strict Content-Security-Policy outside /docs', async () => {
      const res = await request(app.getHttpServer()).get('/');

      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('serves Swagger UI at /docs without a blocking Content-Security-Policy', async () => {
      const res = await request(app.getHttpServer()).get('/docs');

      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toBeUndefined();
      // Non-CSP headers still apply to /docs.
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Rate limiting', () => {
    it('rejects requests past the per-route limit on a public auth endpoint', async () => {
      const server = app.getHttpServer();
      const attempt = () =>
        request(server)
          .post('/auth/login')
          .send({ username: 'nonexistent-user', password: 'wrong-password' });

      // /auth/login is throttled to 5 attempts/min; the first 5 should be
      // processed by the route handler (and fail auth, not throttling).
      for (let i = 0; i < 5; i++) {
        const res = await attempt();
        expect(res.status).not.toBe(429);
      }

      const res = await attempt();
      expect(res.status).toBe(429);
    });
  });
});

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { configureFrontend } from '../../frontend/configure-frontend';
import { applyApiPrefix } from '../../main';

describe('configureFrontend', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }
  });

  it('redirects the root route to login', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server).get('/').expect(302).expect('Location', '/login');
  });

  it('serves static frontend pages with extensionless URLs', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server).get('/login').expect(200).expect('Content-Type', /html/);
    await request(server).get('/register').expect(200).expect('Content-Type', /html/);
    await request(server).get('/projects').expect(200).expect('Content-Type', /html/);
  });

  it('does not serve frontend pages through the API prefix', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server).get('/api/login').expect(404);
  });

  async function initHttpApp(): Promise<void> {
    const module = await Test.createTestingModule({}).compile();

    app = module.createNestApplication<NestExpressApplication>();
    configureFrontend(app);
    applyApiPrefix(app);
    await app.init();
  }
});

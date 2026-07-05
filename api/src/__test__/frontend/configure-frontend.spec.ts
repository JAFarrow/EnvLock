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
    const projectsResponse = await request(server)
      .get('/projects')
      .expect(200)
      .expect('Content-Type', /html/);

    expect(projectsResponse.text).toContain('Create Project');
    expect(projectsResponse.text).toContain('Scoped Projects');
    expect(projectsResponse.text).not.toContain('Create Environment');
    expect(projectsResponse.text).not.toContain('Add Member');
    expect(projectsResponse.text).not.toContain('Create Token');
  });

  it('serves dynamic project management frontend pages', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];
    const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';

    const environmentsResponse = await request(server)
      .get(`/projects/${projectId}/environments`)
      .expect(200)
      .expect('Content-Type', /html/);
    const rolesResponse = await request(server)
      .get(`/projects/${projectId}/roles`)
      .expect(200)
      .expect('Content-Type', /html/);
    const patsResponse = await request(server)
      .get(`/projects/${projectId}/pats`)
      .expect(200)
      .expect('Content-Type', /html/);

    expect(environmentsResponse.text).toContain('Create Environment');
    expect(rolesResponse.text).toContain('Add Member');
    expect(patsResponse.text).toContain('Create Token');
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

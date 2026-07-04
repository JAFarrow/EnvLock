import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { applyApiPrefix } from '../../api-prefix';
import { type AuthenticatedRequest } from '../../auth/contracts/authenticated-request';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { type CreatePersonalAccessTokenDto } from '../../personal-access-tokens/contracts/create-personal-access-token.dto';
import { type PersonalAccessTokenResponseDto } from '../../personal-access-tokens/contracts/personal-access-token.response.dto';
import { PersonalAccessTokensController } from '../../personal-access-tokens/personal-access-tokens.controller';
import { PersonalAccessTokensService } from '../../personal-access-tokens/personal-access-tokens.service';

type PersonalAccessTokensServiceMock = {
  create: jest.Mock<
    Promise<PersonalAccessTokenResponseDto>,
    [string, string, CreatePersonalAccessTokenDto]
  >;
  revoke: jest.Mock<Promise<void>, [string, string, string]>;
};

type ConfigServiceMock = {
  get: jest.Mock<string, ['JWT_SECRET', { infer: true }]>;
};

const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const tokenId = 'a65de020-3ac3-4f9d-b3df-3cde79de0511';
const tokenResponse: PersonalAccessTokenResponseDto = {
  id: tokenId,
  projectId,
  name: 'local dev laptop',
  token: 'envlock_pat_a65de020-3ac3-4f9d-b3df-3cde79de0511.secret',
  tokenType: 'Bearer',
  expiresAt: '2026-09-04T12:00:00.000Z',
  createdAt: '2026-07-04T12:00:00.000Z'
};

function createRequest(): AuthenticatedRequest {
  return {
    user: { id: userId }
  } as AuthenticatedRequest;
}

describe('PersonalAccessTokensController', () => {
  let controller: PersonalAccessTokensController;
  let service: PersonalAccessTokensServiceMock;
  let app: INestApplication | undefined;

  beforeEach(async () => {
    service = {
      create: jest.fn<
        Promise<PersonalAccessTokenResponseDto>,
        [string, string, CreatePersonalAccessTokenDto]
      >(() => Promise.resolve(tokenResponse)),
      revoke: jest.fn<Promise<void>, [string, string, string]>(() => Promise.resolve())
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PersonalAccessTokensController],
      providers: [
        {
          provide: PersonalAccessTokensService,
          useValue: service
        }
      ]
    }).compile();

    controller = module.get(PersonalAccessTokensController);
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }

    jest.restoreAllMocks();
  });

  it('creates project-scoped PATs for the authenticated user', async () => {
    await expect(
      controller.create(createRequest(), projectId, {
        name: 'local dev laptop',
        expiresAt: '2026-09-04T12:00:00.000Z'
      })
    ).resolves.toBe(tokenResponse);

    expect(service.create).toHaveBeenCalledWith(userId, projectId, {
      name: 'local dev laptop',
      expiresAt: '2026-09-04T12:00:00.000Z'
    });
  });

  it('rejects unauthenticated HTTP requests', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .post(`/api/projects/${projectId}/pats`)
      .send({ name: 'local dev laptop', expiresAt: '2026-09-04T12:00:00.000Z' })
      .expect(401);
  });

  it('returns 400 for invalid route UUIDs and invalid bodies', async () => {
    await initHttpApp();

    const token = await new JwtService({ secret: 'test-secret' }).signAsync({ sub: userId });
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .post('/api/projects/not-a-uuid/pats')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'local dev laptop', expiresAt: '2026-09-04T12:00:00.000Z' })
      .expect(400);
    await request(server)
      .post(`/api/projects/${projectId}/pats`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'local dev laptop' })
      .expect(400);
    await request(server)
      .post(`/api/projects/${projectId}/pats`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', expiresAt: '2026-09-04T12:00:00.000Z' })
      .expect(400);
    await request(server)
      .delete(`/api/projects/${projectId}/pats/not-a-uuid`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('revokes project-scoped PATs for the authenticated user', async () => {
    await expect(controller.revoke(createRequest(), projectId, tokenId)).resolves.toBeUndefined();

    expect(service.revoke).toHaveBeenCalledWith(userId, projectId, tokenId);
  });

  it('returns 204 when revoking a PAT over HTTP', async () => {
    await initHttpApp();

    const token = await new JwtService({ secret: 'test-secret' }).signAsync({ sub: userId });
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .delete(`/api/projects/${projectId}/pats/${tokenId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('returns the expected HTTP status and one-time raw token response', async () => {
    await initHttpApp();

    const token = await new JwtService({ secret: 'test-secret' }).signAsync({ sub: userId });
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    const response = await request(server)
      .post(`/api/projects/${projectId}/pats`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'local dev laptop', expiresAt: '2026-09-04T12:00:00.000Z' })
      .expect(201);

    expect(response.body).toEqual(tokenResponse);
    expect(response.body).toHaveProperty('token');
    expect(response.body).not.toHaveProperty('tokenHash');
    expect(response.body).not.toHaveProperty('tokenLastFour');
    expect(response.body).not.toHaveProperty('environmentId');
  });

  async function initHttpApp(): Promise<void> {
    const configService: ConfigServiceMock = {
      get: jest.fn<string, ['JWT_SECRET', { infer: true }]>(() => 'test-secret')
    };
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [PersonalAccessTokensController],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: configService
        },
        {
          provide: PersonalAccessTokensService,
          useValue: service
        }
      ]
    }).compile();

    app = module.createNestApplication();
    applyApiPrefix(app);
    await app.init();
  }
});

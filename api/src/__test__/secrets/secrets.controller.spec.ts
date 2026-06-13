import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { type AuthenticatedRequest } from '../../auth/contracts/authenticated-request';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { type CreateSecretDto } from '../../secrets/contracts/create-secret.dto';
import { type UpdateSecretDto } from '../../secrets/contracts/update-secret.dto';
import { type SecretListResponseDto } from '../../secrets/contracts/secret-list.response.dto';
import { type SecretResponseDto } from '../../secrets/contracts/secret.response.dto';
import { SecretsController } from '../../secrets/secrets.controller';
import { SecretsService } from '../../secrets/secrets.service';

type SecretsServiceMock = {
  create: jest.Mock<Promise<SecretResponseDto>, [string, string, string, CreateSecretDto]>;
  findAll: jest.Mock<Promise<SecretListResponseDto>, [string, string, string]>;
  update: jest.Mock<Promise<SecretResponseDto>, [string, string, string, string, UpdateSecretDto]>;
  archive: jest.Mock<Promise<void>, [string, string, string, string]>;
};

type ConfigServiceMock = {
  get: jest.Mock<string, ['JWT_SECRET', { infer: true }]>;
};

const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const environmentId = '7ea93715-1cc6-428d-937f-e7d8eec105dc';
const secretId = '1f2e3d4c-5b6a-4789-9012-3456789abcde';

const secretResponse: SecretResponseDto = {
  id: secretId,
  environmentId,
  key: 'DATABASE_URL',
  createdAt: '2026-06-13T14:00:00.000Z',
  updatedAt: '2026-06-13T14:00:00.000Z'
};

function createRequest(): AuthenticatedRequest {
  return {
    user: { id: userId }
  } as AuthenticatedRequest;
}

describe('SecretsController', () => {
  let secretsController: SecretsController;
  let secretsService: SecretsServiceMock;
  let app: INestApplication | undefined;

  beforeEach(async () => {
    secretsService = {
      create: jest.fn<Promise<SecretResponseDto>, [string, string, string, CreateSecretDto]>(() =>
        Promise.resolve(secretResponse)
      ),
      findAll: jest.fn<Promise<SecretListResponseDto>, [string, string, string]>(() =>
        Promise.resolve({ items: [secretResponse] })
      ),
      update: jest.fn<
        Promise<SecretResponseDto>,
        [string, string, string, string, UpdateSecretDto]
      >(() => Promise.resolve({ ...secretResponse, key: 'PRIMARY_DATABASE_URL' })),
      archive: jest.fn<Promise<void>, [string, string, string, string]>(() => Promise.resolve())
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecretsController],
      providers: [
        {
          provide: SecretsService,
          useValue: secretsService
        }
      ]
    }).compile();

    secretsController = module.get(SecretsController);
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }

    jest.restoreAllMocks();
  });

  it('creates secrets for the authenticated user', async () => {
    await expect(
      secretsController.create(createRequest(), projectId, environmentId, {
        key: 'DATABASE_URL',
        value: 'postgresql://example'
      })
    ).resolves.toBe(secretResponse);

    expect(secretsService.create).toHaveBeenCalledWith(userId, projectId, environmentId, {
      key: 'DATABASE_URL',
      value: 'postgresql://example'
    });
  });

  it('lists secret metadata for the authenticated user', async () => {
    await expect(
      secretsController.findAll(createRequest(), projectId, environmentId)
    ).resolves.toEqual({
      items: [secretResponse]
    });

    expect(secretsService.findAll).toHaveBeenCalledWith(userId, projectId, environmentId);
  });

  it('updates secrets for the authenticated user', async () => {
    await expect(
      secretsController.update(createRequest(), projectId, environmentId, secretId, {
        key: 'PRIMARY_DATABASE_URL',
        value: ''
      })
    ).resolves.toMatchObject({ key: 'PRIMARY_DATABASE_URL' });

    expect(secretsService.update).toHaveBeenCalledWith(userId, projectId, environmentId, secretId, {
      key: 'PRIMARY_DATABASE_URL',
      value: ''
    });
  });

  it('archives secrets for the authenticated user', async () => {
    await expect(
      secretsController.archive(createRequest(), projectId, environmentId, secretId)
    ).resolves.toBeUndefined();

    expect(secretsService.archive).toHaveBeenCalledWith(userId, projectId, environmentId, secretId);
  });

  it('rejects unauthenticated HTTP requests for every route', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .post(`/projects/${projectId}/environments/${environmentId}/secrets`)
      .expect(401);
    await request(server)
      .get(`/projects/${projectId}/environments/${environmentId}/secrets`)
      .expect(401);
    await request(server)
      .patch(`/projects/${projectId}/environments/${environmentId}/secrets/${secretId}`)
      .expect(401);
    await request(server)
      .delete(`/projects/${projectId}/environments/${environmentId}/secrets/${secretId}`)
      .expect(401);
  });

  it('returns 400 for invalid route UUIDs', async () => {
    await initHttpApp();

    const token = await new JwtService({ secret: 'test-secret' }).signAsync({ sub: userId });
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get(`/projects/not-a-uuid/environments/${environmentId}/secrets`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(server)
      .get(`/projects/${projectId}/environments/not-a-uuid/secrets`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(server)
      .patch(`/projects/${projectId}/environments/${environmentId}/secrets/not-a-uuid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'DATABASE_URL' })
      .expect(400);
  });

  it('returns the expected HTTP statuses and metadata-only responses', async () => {
    await initHttpApp();

    const token = await new JwtService({ secret: 'test-secret' }).signAsync({ sub: userId });
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    const createResponse = await request(server)
      .post(`/projects/${projectId}/environments/${environmentId}/secrets`)
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'DATABASE_URL', value: 'postgresql://example' })
      .expect(201);
    const listResponse = await request(server)
      .get(`/projects/${projectId}/environments/${environmentId}/secrets`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const updateResponse = await request(server)
      .patch(`/projects/${projectId}/environments/${environmentId}/secrets/${secretId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ key: 'PRIMARY_DATABASE_URL' })
      .expect(200);

    await request(server)
      .delete(`/projects/${projectId}/environments/${environmentId}/secrets/${secretId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(createResponse.body).toEqual(secretResponse);
    expect(listResponse.body).toEqual({ items: [secretResponse] });
    expect(updateResponse.body).toMatchObject({ id: secretId, key: 'PRIMARY_DATABASE_URL' });
    expect(createResponse.body).not.toHaveProperty('value');
    expect(createResponse.body).not.toHaveProperty('encryptedValue');
    expect(createResponse.body).not.toHaveProperty('initializationVector');
    expect(createResponse.body).not.toHaveProperty('authenticationTag');
    expect(createResponse.body).not.toHaveProperty('encryptionKeyVersion');
    expect(createResponse.body).not.toHaveProperty('encryptionFormatVersion');
  });

  async function initHttpApp(): Promise<void> {
    const configService: ConfigServiceMock = {
      get: jest.fn<string, ['JWT_SECRET', { infer: true }]>(() => 'test-secret')
    };
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [SecretsController],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: configService
        },
        {
          provide: SecretsService,
          useValue: secretsService
        }
      ]
    }).compile();

    app = module.createNestApplication();
    await app.init();
  }
});

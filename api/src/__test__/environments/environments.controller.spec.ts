import { BadRequestException, type INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { type AuthenticatedRequest } from '../../auth/contracts/authenticated-request';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { type CreateEnvironmentDto } from '../../environments/contracts/create-environment.dto';
import {
  type EnvironmentListResponseDto,
  type EnvironmentResponseDto
} from '../../environments/contracts/environment-response.dto';
import { type UpdateEnvironmentDto } from '../../environments/contracts/update-environment.dto';
import { EnvironmentsController } from '../../environments/environments.controller';
import { EnvironmentsService } from '../../environments/environments.service';

type EnvironmentsServiceMock = {
  createEnvironment: jest.Mock<
    Promise<EnvironmentResponseDto>,
    [string, string, CreateEnvironmentDto]
  >;
  listEnvironments: jest.Mock<Promise<EnvironmentListResponseDto>, [string, string]>;
  getEnvironment: jest.Mock<Promise<EnvironmentResponseDto>, [string, string, string]>;
  updateEnvironment: jest.Mock<
    Promise<EnvironmentResponseDto>,
    [string, string, string, UpdateEnvironmentDto]
  >;
  archiveEnvironment: jest.Mock<Promise<void>, [string, string, string]>;
};

type ConfigServiceMock = {
  get: jest.Mock<string, ['JWT_SECRET', { infer: true }]>;
};

const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const environmentId = '7ea93715-1cc6-428d-937f-e7d8eec105dc';

const environmentResponse: EnvironmentResponseDto = {
  id: environmentId,
  projectId,
  name: 'Production',
  slug: 'production',
  description: 'Production deployment environment',
  createdAt: '2026-06-13T14:00:00.000Z',
  updatedAt: '2026-06-13T14:00:00.000Z'
};

function createRequest(): AuthenticatedRequest {
  return {
    user: { id: userId }
  } as AuthenticatedRequest;
}

describe('EnvironmentsController', () => {
  let environmentsController: EnvironmentsController;
  let environmentsService: EnvironmentsServiceMock;
  let app: INestApplication | undefined;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    environmentsService = {
      createEnvironment: jest.fn<
        Promise<EnvironmentResponseDto>,
        [string, string, CreateEnvironmentDto]
      >(() => Promise.resolve(environmentResponse)),
      listEnvironments: jest.fn<Promise<EnvironmentListResponseDto>, [string, string]>(() =>
        Promise.resolve({ items: [environmentResponse] })
      ),
      getEnvironment: jest.fn<Promise<EnvironmentResponseDto>, [string, string, string]>(() =>
        Promise.resolve(environmentResponse)
      ),
      updateEnvironment: jest.fn<
        Promise<EnvironmentResponseDto>,
        [string, string, string, UpdateEnvironmentDto]
      >(() => Promise.resolve(environmentResponse)),
      archiveEnvironment: jest.fn<Promise<void>, [string, string, string]>(() => Promise.resolve())
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnvironmentsController],
      providers: [
        {
          provide: EnvironmentsService,
          useValue: environmentsService
        }
      ]
    }).compile();

    environmentsController = module.get(EnvironmentsController);
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }

    jest.restoreAllMocks();
  });

  it('creates environments for the authenticated user with trimmed body fields', async () => {
    await expect(
      environmentsController.createEnvironment(createRequest(), projectId, {
        name: ' Production ',
        slug: ' production ',
        description: ' Production deployment environment '
      })
    ).resolves.toBe(environmentResponse);

    expect(environmentsService.createEnvironment).toHaveBeenCalledWith(userId, projectId, {
      name: 'Production',
      slug: 'production',
      description: 'Production deployment environment'
    });
  });

  it('rejects invalid create environment bodies', () => {
    expect(() =>
      environmentsController.createEnvironment(createRequest(), projectId, {
        name: 'Production EU',
        slug: 'Production EU'
      })
    ).toThrow(BadRequestException);

    expect(environmentsService.createEnvironment).not.toHaveBeenCalled();
  });

  it('rejects empty update environment bodies', () => {
    expect(() =>
      environmentsController.updateEnvironment(createRequest(), projectId, environmentId, {})
    ).toThrow(BadRequestException);

    expect(environmentsService.updateEnvironment).not.toHaveBeenCalled();
  });

  it('updates environments for the authenticated user with supported fields only', async () => {
    await expect(
      environmentsController.updateEnvironment(createRequest(), projectId, environmentId, {
        name: ' Production EU ',
        slug: ' production-eu ',
        description: null
      })
    ).resolves.toBe(environmentResponse);

    expect(environmentsService.updateEnvironment).toHaveBeenCalledWith(
      userId,
      projectId,
      environmentId,
      {
        name: 'Production EU',
        slug: 'production-eu',
        description: null
      }
    );
  });

  it('lists environments for the authenticated user', async () => {
    await expect(
      environmentsController.listEnvironments(createRequest(), projectId)
    ).resolves.toEqual({ items: [environmentResponse] });

    expect(environmentsService.listEnvironments).toHaveBeenCalledWith(userId, projectId);
  });

  it('retrieves environments for the authenticated user', async () => {
    await expect(
      environmentsController.getEnvironment(createRequest(), projectId, environmentId)
    ).resolves.toBe(environmentResponse);

    expect(environmentsService.getEnvironment).toHaveBeenCalledWith(
      userId,
      projectId,
      environmentId
    );
  });

  it('archives environments for the authenticated user', async () => {
    await expect(
      environmentsController.archiveEnvironment(createRequest(), projectId, environmentId)
    ).resolves.toBeUndefined();

    expect(environmentsService.archiveEnvironment).toHaveBeenCalledWith(
      userId,
      projectId,
      environmentId
    );
  });

  it('rejects unauthenticated HTTP requests', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server).get(`/projects/${projectId}/environments`).expect(401);
  });

  it('returns 400 for invalid project UUIDs', async () => {
    await initHttpApp();

    const token = await new JwtService({ secret: 'test-secret' }).signAsync({ sub: userId });
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get('/projects/not-a-uuid/environments')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('returns 400 for invalid environment UUIDs', async () => {
    await initHttpApp();

    const token = await new JwtService({ secret: 'test-secret' }).signAsync({ sub: userId });
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get(`/projects/${projectId}/environments/not-a-uuid`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  async function initHttpApp(): Promise<void> {
    const configService: ConfigServiceMock = {
      get: jest.fn<string, ['JWT_SECRET', { infer: true }]>(() => 'test-secret')
    };
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [EnvironmentsController],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: configService
        },
        {
          provide: EnvironmentsService,
          useValue: environmentsService
        }
      ]
    }).compile();

    app = module.createNestApplication();
    await app.init();
  }
});

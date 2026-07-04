import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { type AuthenticatedRequest } from '../../auth/contracts/authenticated-request';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { applyApiPrefix } from '../../main';
import { type CreateProjectDto } from '../../projects/contracts/create-project.dto';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import {
  type ProjectListResponseDto,
  type ProjectResponseDto
} from '../../projects/contracts/project-response.dto';
import { ProjectsController } from '../../projects/projects.controller';
import { ProjectsService } from '../../projects/projects.service';
import { type UpdateProjectDto } from '../../projects/contracts/update-project.dto';

type ProjectsServiceMock = {
  createProject: jest.Mock<Promise<ProjectResponseDto>, [string, CreateProjectDto]>;
  listProjects: jest.Mock<Promise<ProjectListResponseDto>, [string]>;
  getProject: jest.Mock<Promise<ProjectResponseDto>, [string, string]>;
  updateProject: jest.Mock<Promise<ProjectResponseDto>, [string, string, UpdateProjectDto]>;
  archiveProject: jest.Mock<Promise<void>, [string, string]>;
};

const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const accessTokenCookieName = 'test_access_token';

const projectResponse: ProjectResponseDto = {
  id: projectId,
  name: 'Payments API',
  description: 'Backend payment service',
  repositoryUrl: 'https://github.com/example/payments-api',
  role: ProjectRole.OWNER,
  createdAt: '2026-06-13T14:00:00.000Z',
  updatedAt: '2026-06-13T14:00:00.000Z'
};

function createRequest(): AuthenticatedRequest {
  return {
    user: { id: userId }
  } as AuthenticatedRequest;
}

describe('ProjectsController', () => {
  let projectsController: ProjectsController;
  let projectsService: ProjectsServiceMock;
  let app: INestApplication | undefined;

  beforeEach(async () => {
    projectsService = {
      createProject: jest.fn<Promise<ProjectResponseDto>, [string, CreateProjectDto]>(() =>
        Promise.resolve(projectResponse)
      ),
      listProjects: jest.fn<Promise<ProjectListResponseDto>, [string]>(() =>
        Promise.resolve({ projects: [projectResponse] })
      ),
      getProject: jest.fn<Promise<ProjectResponseDto>, [string, string]>(() =>
        Promise.resolve(projectResponse)
      ),
      updateProject: jest.fn<Promise<ProjectResponseDto>, [string, string, UpdateProjectDto]>(() =>
        Promise.resolve(projectResponse)
      ),
      archiveProject: jest.fn<Promise<void>, [string, string]>(() => Promise.resolve())
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [ProjectsController],
      providers: [
        JwtAuthGuard,
        createConfigServiceProvider(),
        {
          provide: ProjectsService,
          useValue: projectsService
        }
      ]
    }).compile();

    projectsController = module.get(ProjectsController);
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }

    jest.restoreAllMocks();
  });

  it('creates projects for the authenticated user', async () => {
    await expect(
      projectsController.createProject(createRequest(), {
        name: 'Payments API',
        description: 'Backend payment service',
        repositoryUrl: 'https://github.com/example/payments-api'
      })
    ).resolves.toBe(projectResponse);

    expect(projectsService.createProject).toHaveBeenCalledWith(userId, {
      name: 'Payments API',
      description: 'Backend payment service',
      repositoryUrl: 'https://github.com/example/payments-api'
    });
  });

  it('updates projects for the authenticated user with supported fields only', async () => {
    await expect(
      projectsController.updateProject(createRequest(), projectId, { name: 'Payments API' })
    ).resolves.toBe(projectResponse);

    expect(projectsService.updateProject).toHaveBeenCalledWith(userId, projectId, {
      name: 'Payments API'
    });
  });

  it('archives projects for the authenticated user', async () => {
    await expect(
      projectsController.archiveProject(createRequest(), projectId)
    ).resolves.toBeUndefined();

    expect(projectsService.archiveProject).toHaveBeenCalledWith(userId, projectId);
  });

  it('rejects unauthenticated HTTP requests', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server).get('/api/projects').expect(401);
  });

  it('returns 400 for invalid project UUIDs', async () => {
    await initHttpApp();

    const token = await new JwtService({ secret: 'test-secret' }).signAsync({ sub: userId });
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get('/api/projects/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('accepts JWTs from the access token cookie', async () => {
    await initHttpApp();

    const token = await new JwtService({ secret: 'test-secret' }).signAsync({ sub: userId });
    const server = app?.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server)
      .get('/api/projects')
      .set('Cookie', `${accessTokenCookieName}=${token}`)
      .expect(200);

    expect(response.body).toEqual({ projects: [projectResponse] });
    expect(projectsService.listProjects).toHaveBeenCalledWith(userId);
  });

  async function initHttpApp(): Promise<void> {
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [ProjectsController],
      providers: [
        JwtAuthGuard,
        createConfigServiceProvider(),
        {
          provide: ProjectsService,
          useValue: projectsService
        }
      ]
    }).compile();

    app = module.createNestApplication();
    applyApiPrefix(app);
    await app.init();
  }
});

function createConfigServiceProvider(): { provide: typeof ConfigService; useValue: unknown } {
  return {
    provide: ConfigService,
    useValue: {
      get: jest.fn<string, ['JWT_ACCESS_TOKEN_COOKIE_NAME', { infer: true }]>(
        () => accessTokenCookieName
      )
    }
  };
}

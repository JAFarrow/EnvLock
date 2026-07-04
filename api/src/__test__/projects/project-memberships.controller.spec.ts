import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { applyApiPrefix } from '../../api-prefix';
import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { type AddProjectMemberDto } from '../../projects/contracts/add-project-member.dto';
import { type ProjectMemberListResponseDto } from '../../projects/contracts/project-member-list.response.dto';
import { type ProjectMemberResponseDto } from '../../projects/contracts/project-member.response.dto';
import { type UpdateProjectMemberRoleDto } from '../../projects/contracts/update-project-member-role.dto';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { ProjectMembershipsController } from '../../projects/project-memberships.controller';
import { ProjectMembershipsService } from '../../projects/project-memberships.service';

type ProjectMembershipsServiceMock = {
  findAll: jest.Mock<Promise<ProjectMemberListResponseDto>, [string, string]>;
  add: jest.Mock<Promise<ProjectMemberResponseDto>, [string, string, AddProjectMemberDto]>;
  updateRole: jest.Mock<
    Promise<ProjectMemberResponseDto>,
    [string, string, string, UpdateProjectMemberRoleDto]
  >;
  remove: jest.Mock<Promise<void>, [string, string, string]>;
};

type ConfigServiceMock = {
  get: jest.Mock<string, ['JWT_SECRET', { infer: true }]>;
};

const actorUserId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const memberUserId = '0a8d4a1f-d93d-4a6d-9ec4-6c2d688f0c79';

const memberResponse: ProjectMemberResponseDto = {
  userId: memberUserId,
  email: 'developer@example.com',
  role: ProjectRole.DEVELOPER,
  createdAt: '2026-06-13T15:00:00.000Z'
};

describe('ProjectMembershipsController', () => {
  let projectMembershipsService: ProjectMembershipsServiceMock;
  let app: INestApplication | undefined;

  beforeEach(() => {
    projectMembershipsService = {
      findAll: jest.fn<Promise<ProjectMemberListResponseDto>, [string, string]>(() =>
        Promise.resolve({ items: [memberResponse] })
      ),
      add: jest.fn<Promise<ProjectMemberResponseDto>, [string, string, AddProjectMemberDto]>(() =>
        Promise.resolve(memberResponse)
      ),
      updateRole: jest.fn<
        Promise<ProjectMemberResponseDto>,
        [string, string, string, UpdateProjectMemberRoleDto]
      >(() => Promise.resolve({ ...memberResponse, role: ProjectRole.MAINTAINER })),
      remove: jest.fn<Promise<void>, [string, string, string]>(() => Promise.resolve())
    };
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
      app = undefined;
    }

    jest.restoreAllMocks();
  });

  it('rejects unauthenticated HTTP requests for every route', async () => {
    await initHttpApp();

    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server).get(`/api/projects/${projectId}/members`).expect(401);
    await request(server).post(`/api/projects/${projectId}/members`).expect(401);
    await request(server).patch(`/api/projects/${projectId}/members/${memberUserId}`).expect(401);
    await request(server).delete(`/api/projects/${projectId}/members/${memberUserId}`).expect(401);
  });

  it('returns 400 for invalid project and user UUIDs', async () => {
    await initHttpApp();

    const token = await createToken();
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get('/api/projects/not-a-uuid/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(server)
      .patch(`/api/projects/${projectId}/members/not-a-uuid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: ProjectRole.MAINTAINER })
      .expect(400);
    await request(server)
      .delete(`/api/projects/${projectId}/members/not-a-uuid`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('delegates valid requests with the authenticated actor id and expected statuses', async () => {
    await initHttpApp();

    const token = await createToken();
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    const listResponse = await request(server)
      .get(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const addResponse = await request(server)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: '  Developer@Example.COM ', role: ProjectRole.DEVELOPER })
      .expect(201);
    const updateResponse = await request(server)
      .patch(`/api/projects/${projectId}/members/${memberUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: ProjectRole.MAINTAINER })
      .expect(200);

    await request(server)
      .delete(`/api/projects/${projectId}/members/${memberUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(projectMembershipsService.findAll).toHaveBeenCalledWith(actorUserId, projectId);
    expect(projectMembershipsService.add).toHaveBeenCalledWith(actorUserId, projectId, {
      email: 'developer@example.com',
      role: ProjectRole.DEVELOPER
    });
    expect(projectMembershipsService.updateRole).toHaveBeenCalledWith(
      actorUserId,
      projectId,
      memberUserId,
      { role: ProjectRole.MAINTAINER }
    );
    expect(projectMembershipsService.remove).toHaveBeenCalledWith(
      actorUserId,
      projectId,
      memberUserId
    );
    expect(listResponse.body).toEqual({ items: [memberResponse] });
    expect(addResponse.body).toEqual(memberResponse);
    expect(updateResponse.body).toEqual({ ...memberResponse, role: ProjectRole.MAINTAINER });
  });

  it('rejects unsupported roles and unexpected request fields', async () => {
    await initHttpApp();

    const token = await createToken();
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'owner@example.com', role: ProjectRole.OWNER })
      .expect(400);
    await request(server)
      .patch(`/api/projects/${projectId}/members/${memberUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: ProjectRole.OWNER })
      .expect(400);
    await request(server)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'developer@example.com', role: ProjectRole.DEVELOPER, userId: actorUserId })
      .expect(400);
  });

  it('returns only approved member response fields', async () => {
    await initHttpApp();

    const token = await createToken();
    const server = app?.getHttpServer() as Parameters<typeof request>[0];

    const response = await request(server)
      .get(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = response.body as ProjectMemberListResponseDto;

    expect(body.items[0]).toEqual(memberResponse);
    expect(body.items[0]).not.toHaveProperty('passwordHash');
    expect(body.items[0]).not.toHaveProperty('user');
    expect(body.items[0]).not.toHaveProperty('project');
    expect(body.items[0]).not.toHaveProperty('addedByUserId');
  });

  async function initHttpApp(): Promise<void> {
    const configService: ConfigServiceMock = {
      get: jest.fn<string, ['JWT_SECRET', { infer: true }]>(() => 'test-secret')
    };
    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [ProjectMembershipsController],
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: configService
        },
        {
          provide: ProjectMembershipsService,
          useValue: projectMembershipsService
        }
      ]
    }).compile();

    app = module.createNestApplication();
    applyApiPrefix(app);
    await app.init();
  }

  async function createToken(): Promise<string> {
    return new JwtService({ secret: 'test-secret' }).signAsync({ sub: actorUserId });
  }
});

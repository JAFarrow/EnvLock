import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { AuditEventsService } from '../../audit-events/audit-events.service';
import { ProjectMembershipEntity } from '../../projects/entities/project-membership.entity';
import {
  type CreateProjectMembershipRecord,
  ProjectMembershipsRepository
} from '../../projects/repositories/project-memberships.repository';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { ProjectEntity } from '../../projects/entities/project.entity';
import {
  type CreateProjectRecord,
  ProjectsRepository
} from '../../projects/repositories/projects.repository';
import { ProjectAccessService } from '../../projects/project-access.service';
import { ProjectsService } from '../../projects/projects.service';

type TransactionRunner = (manager: EntityManager) => Promise<unknown>;

type DataSourceMock = {
  transaction: jest.Mock<Promise<unknown>, [TransactionRunner]>;
};

type ProjectsRepositoryMock = {
  create: jest.Mock<Promise<ProjectEntity>, [CreateProjectRecord, EntityManager?]>;
  save: jest.Mock<Promise<ProjectEntity>, [ProjectEntity, EntityManager?]>;
};

type ProjectMembershipsRepositoryMock = {
  create: jest.Mock<
    Promise<ProjectMembershipEntity>,
    [CreateProjectMembershipRecord, EntityManager?]
  >;
  findActiveProjectsByUserId: jest.Mock<Promise<ProjectMembershipEntity[]>, [string]>;
  findActiveProjectByProjectAndUser: jest.Mock<
    Promise<ProjectMembershipEntity | null>,
    [string, string]
  >;
};

type AuditEventsServiceMock = {
  record: jest.Mock<Promise<void>, [Record<string, unknown>, EntityManager?]>;
};

const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const otherUserId = '0a8d4a1f-d93d-4a6d-9ec4-6c2d688f0c79';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const now = new Date('2026-06-13T14:00:00.000Z');

function createProject(overrides: Partial<ProjectEntity> = {}): ProjectEntity {
  return Object.assign(new ProjectEntity(), {
    id: projectId,
    name: 'Payments API',
    description: 'Backend payment service',
    repositoryUrl: 'https://github.com/example/payments-api',
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    ...overrides
  });
}

function createMembership(
  overrides: Partial<ProjectMembershipEntity> = {}
): ProjectMembershipEntity {
  const project = overrides.project ?? createProject();

  return Object.assign(new ProjectMembershipEntity(), {
    id: '77c14d50-d566-4a7e-b459-2c6cd1f64a60',
    projectId: project.id,
    userId,
    role: ProjectRole.OWNER,
    addedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    project,
    ...overrides
  });
}

describe('ProjectsService', () => {
  let projectsService: ProjectsService;
  let dataSource: DataSourceMock;
  let projectsRepository: ProjectsRepositoryMock;
  let projectMembershipsRepository: ProjectMembershipsRepositoryMock;
  let auditEventsService: AuditEventsServiceMock;
  let transactionManager: EntityManager;

  beforeEach(() => {
    transactionManager = { getRepository: jest.fn() } as unknown as EntityManager;
    dataSource = {
      transaction: jest.fn<Promise<unknown>, [TransactionRunner]>((run) => run(transactionManager))
    };
    projectsRepository = {
      create: jest.fn<Promise<ProjectEntity>, [CreateProjectRecord, EntityManager?]>((input) =>
        Promise.resolve(createProject(input))
      ),
      save: jest.fn<Promise<ProjectEntity>, [ProjectEntity, EntityManager?]>((project) =>
        Promise.resolve(project)
      )
    };
    projectMembershipsRepository = {
      create: jest.fn<
        Promise<ProjectMembershipEntity>,
        [CreateProjectMembershipRecord, EntityManager?]
      >((input) => Promise.resolve(createMembership(input))),
      findActiveProjectsByUserId: jest.fn<Promise<ProjectMembershipEntity[]>, [string]>(() =>
        Promise.resolve([])
      ),
      findActiveProjectByProjectAndUser: jest.fn<
        Promise<ProjectMembershipEntity | null>,
        [string, string]
      >(() => Promise.resolve(null))
    };
    auditEventsService = {
      record: jest.fn<Promise<void>, [Record<string, unknown>, EntityManager?]>(() =>
        Promise.resolve()
      )
    };

    projectsService = new ProjectsService(
      dataSource as unknown as DataSource,
      projectsRepository as unknown as ProjectsRepository,
      projectMembershipsRepository as unknown as ProjectMembershipsRepository,
      new ProjectAccessService(
        projectMembershipsRepository as unknown as ProjectMembershipsRepository
      ),
      auditEventsService as unknown as AuditEventsService
    );
  });

  it('creates a project and owner membership in one transaction', async () => {
    await expect(
      projectsService.createProject(userId, {
        name: 'Payments API',
        description: 'Backend payment service',
        repositoryUrl: 'https://github.com/example/payments-api'
      })
    ).resolves.toEqual({
      id: projectId,
      name: 'Payments API',
      description: 'Backend payment service',
      repositoryUrl: 'https://github.com/example/payments-api',
      role: ProjectRole.OWNER,
      createdAt: '2026-06-13T14:00:00.000Z',
      updatedAt: '2026-06-13T14:00:00.000Z'
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(projectsRepository.create).toHaveBeenCalledWith(
      {
        name: 'Payments API',
        description: 'Backend payment service',
        repositoryUrl: 'https://github.com/example/payments-api',
        createdByUserId: userId
      },
      transactionManager
    );
    expect(projectMembershipsRepository.create).toHaveBeenCalledWith(
      {
        projectId,
        userId,
        role: ProjectRole.OWNER,
        addedByUserId: userId
      },
      transactionManager
    );
    expect(auditEventsService.record).toHaveBeenCalledWith(
      {
        projectId,
        actorUserId: userId,
        action: 'project.created',
        targetType: 'project',
        targetId: projectId,
        details: {
          fields: ['name', 'description', 'repositoryUrl']
        }
      },
      transactionManager
    );
  });

  it('rejects the atomic create operation when membership insertion fails', async () => {
    const error = new Error('membership insert failed');
    projectMembershipsRepository.create.mockRejectedValueOnce(error);

    await expect(projectsService.createProject(userId, { name: 'Payments API' })).rejects.toBe(
      error
    );

    expect(projectsRepository.create).toHaveBeenCalledTimes(1);
    expect(projectMembershipsRepository.create).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('lists only active projects returned through authenticated user memberships', async () => {
    const membership = createMembership();
    projectMembershipsRepository.findActiveProjectsByUserId.mockResolvedValueOnce([membership]);

    await expect(projectsService.listProjects(userId)).resolves.toEqual({
      projects: [
        {
          id: projectId,
          name: 'Payments API',
          description: 'Backend payment service',
          repositoryUrl: 'https://github.com/example/payments-api',
          role: ProjectRole.OWNER,
          createdAt: '2026-06-13T14:00:00.000Z',
          updatedAt: '2026-06-13T14:00:00.000Z'
        }
      ]
    });

    expect(projectMembershipsRepository.findActiveProjectsByUserId).toHaveBeenCalledWith(userId);
  });

  it('returns an empty project list when the user has no memberships', async () => {
    await expect(projectsService.listProjects(userId)).resolves.toEqual({ projects: [] });
  });

  it('retrieves an accessible active project for a member', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership()
    );

    await expect(projectsService.getProject(userId, projectId)).resolves.toMatchObject({
      id: projectId,
      role: ProjectRole.OWNER
    });
  });

  it('returns 404 when a non-member retrieves a project', async () => {
    await expect(projectsService.getProject(otherUserId, projectId)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('returns 404 when an archived project is not returned by the active membership lookup', async () => {
    await expect(projectsService.getProject(userId, projectId)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('allows an owner to update project metadata', async () => {
    const membership = createMembership();
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      membership
    );

    await expect(
      projectsService.updateProject(userId, projectId, {
        name: 'Updated API',
        description: null,
        repositoryUrl: null
      })
    ).resolves.toMatchObject({
      name: 'Updated API',
      description: null,
      repositoryUrl: null,
      role: ProjectRole.OWNER
    });

    expect(projectsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated API',
        description: null,
        repositoryUrl: null
      })
    );
    expect(auditEventsService.record).toHaveBeenCalledWith({
      projectId,
      actorUserId: userId,
      action: 'project.updated',
      targetType: 'project',
      targetId: projectId,
      details: {
        changedFields: ['name', 'description', 'repositoryUrl']
      }
    });
  });

  it('returns 403 when a non-owner member updates a project', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.DEVELOPER })
    );

    await expect(
      projectsService.updateProject(userId, projectId, { name: 'Updated API' })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(projectsRepository.save).not.toHaveBeenCalled();
  });

  it('returns 403 when a maintainer updates a project', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.MAINTAINER })
    );

    await expect(
      projectsService.updateProject(userId, projectId, { name: 'Updated API' })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(projectsRepository.save).not.toHaveBeenCalled();
  });

  it('returns 404 when a non-member updates a project', async () => {
    await expect(
      projectsService.updateProject(otherUserId, projectId, { name: 'Updated API' })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows an owner to archive a project without deleting memberships', async () => {
    const membership = createMembership();
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      membership
    );

    await expect(projectsService.archiveProject(userId, projectId)).resolves.toBeUndefined();

    expect(membership.project.archivedAt).toBeInstanceOf(Date);
    expect(projectsRepository.save).toHaveBeenCalledWith(membership.project);
    expect(projectMembershipsRepository.create).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-owner member archives a project', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.MAINTAINER })
    );

    await expect(projectsService.archiveProject(userId, projectId)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(projectsRepository.save).not.toHaveBeenCalled();
  });

  it('returns 403 when a developer archives a project', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.DEVELOPER })
    );

    await expect(projectsService.archiveProject(userId, projectId)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(projectsRepository.save).not.toHaveBeenCalled();
  });
});

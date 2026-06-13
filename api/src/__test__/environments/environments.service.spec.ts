import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { EnvironmentEntity } from '../../environments/entities/environment.entity';
import { EnvironmentRepository } from '../../environments/repositories/environment.repository';
import { ProjectMembershipEntity } from '../../projects/entities/project-membership.entity';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { ProjectEntity } from '../../projects/entities/project.entity';
import { ProjectAccessService } from '../../projects/project-access.service';
import { ProjectMembershipsRepository } from '../../projects/repositories/project-memberships.repository';
import { EnvironmentsService } from '../../environments/environments.service';

type EnvironmentRepositoryMock = {
  create: jest.Mock<
    Promise<EnvironmentEntity>,
    [
      {
        projectId: string;
        name: string;
        slug: string;
        createdByUserId: string;
        description?: string | null;
      }
    ]
  >;
  save: jest.Mock<Promise<EnvironmentEntity>, [EnvironmentEntity]>;
  findActiveByProjectId: jest.Mock<Promise<EnvironmentEntity[]>, [string]>;
  findActiveByProjectAndId: jest.Mock<Promise<EnvironmentEntity | null>, [string, string]>;
  findActiveByProjectAndSlug: jest.Mock<Promise<EnvironmentEntity | null>, [string, string]>;
};

type ProjectMembershipsRepositoryMock = {
  findActiveProjectByProjectAndUser: jest.Mock<
    Promise<ProjectMembershipEntity | null>,
    [string, string]
  >;
};

const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const otherUserId = '0a8d4a1f-d93d-4a6d-9ec4-6c2d688f0c79';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const otherProjectId = 'c348bb1d-d0bc-46ea-a3f8-fac78dacb3f4';
const environmentId = '7ea93715-1cc6-428d-937f-e7d8eec105dc';
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

function createEnvironment(overrides: Partial<EnvironmentEntity> = {}): EnvironmentEntity {
  return Object.assign(new EnvironmentEntity(), {
    id: environmentId,
    projectId,
    name: 'Production',
    slug: 'production',
    description: 'Production deployment environment',
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    ...overrides
  });
}

describe('EnvironmentsService', () => {
  let environmentsService: EnvironmentsService;
  let environmentRepository: EnvironmentRepositoryMock;
  let projectMembershipsRepository: ProjectMembershipsRepositoryMock;

  beforeEach(() => {
    environmentRepository = {
      create: jest.fn<
        Promise<EnvironmentEntity>,
        [
          {
            projectId: string;
            name: string;
            slug: string;
            createdByUserId: string;
            description?: string | null;
          }
        ]
      >((input) => Promise.resolve(createEnvironment(input))),
      save: jest.fn<Promise<EnvironmentEntity>, [EnvironmentEntity]>((environment) =>
        Promise.resolve(environment)
      ),
      findActiveByProjectId: jest.fn<Promise<EnvironmentEntity[]>, [string]>(() =>
        Promise.resolve([])
      ),
      findActiveByProjectAndId: jest.fn<Promise<EnvironmentEntity | null>, [string, string]>(() =>
        Promise.resolve(null)
      ),
      findActiveByProjectAndSlug: jest.fn<Promise<EnvironmentEntity | null>, [string, string]>(() =>
        Promise.resolve(null)
      )
    };
    projectMembershipsRepository = {
      findActiveProjectByProjectAndUser: jest.fn<
        Promise<ProjectMembershipEntity | null>,
        [string, string]
      >(() => Promise.resolve(createMembership()))
    };

    environmentsService = new EnvironmentsService(
      environmentRepository as unknown as EnvironmentRepository,
      new ProjectAccessService(
        projectMembershipsRepository as unknown as ProjectMembershipsRepository
      )
    );
  });

  it('allows an owner to create an environment', async () => {
    await expect(
      environmentsService.createEnvironment(userId, projectId, {
        name: 'Production',
        slug: 'production',
        description: 'Production deployment environment'
      })
    ).resolves.toEqual({
      id: environmentId,
      projectId,
      name: 'Production',
      slug: 'production',
      description: 'Production deployment environment',
      createdAt: '2026-06-13T14:00:00.000Z',
      updatedAt: '2026-06-13T14:00:00.000Z'
    });

    expect(environmentRepository.create).toHaveBeenCalledWith({
      projectId,
      name: 'Production',
      slug: 'production',
      description: 'Production deployment environment',
      createdByUserId: userId
    });
  });

  it('returns 403 when a non-owner project member creates an environment', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.DEVELOPER })
    );

    await expect(
      environmentsService.createEnvironment(userId, projectId, {
        name: 'Production',
        slug: 'production'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(environmentRepository.create).not.toHaveBeenCalled();
  });

  it('allows a maintainer to create an environment', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.MAINTAINER })
    );

    await expect(
      environmentsService.createEnvironment(userId, projectId, {
        name: 'Production',
        slug: 'production'
      })
    ).resolves.toMatchObject({ projectId, slug: 'production' });

    expect(environmentRepository.create).toHaveBeenCalledWith({
      projectId,
      name: 'Production',
      slug: 'production',
      description: null,
      createdByUserId: userId
    });
  });

  it('returns 404 when a non-member creates an environment', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(null);

    await expect(
      environmentsService.createEnvironment(otherUserId, projectId, {
        name: 'Production',
        slug: 'production'
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 409 for duplicate active slugs in the same project', async () => {
    environmentRepository.findActiveByProjectAndSlug.mockResolvedValueOnce(createEnvironment());

    await expect(
      environmentsService.createEnvironment(userId, projectId, {
        name: 'Production',
        slug: 'production'
      })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(environmentRepository.create).not.toHaveBeenCalled();
  });

  it('allows the same slug in different projects', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({
        project: createProject({ id: otherProjectId }),
        projectId: otherProjectId
      })
    );

    await expect(
      environmentsService.createEnvironment(userId, otherProjectId, {
        name: 'Production',
        slug: 'production'
      })
    ).resolves.toMatchObject({ projectId: otherProjectId, slug: 'production' });

    expect(environmentRepository.findActiveByProjectAndSlug).toHaveBeenCalledWith(
      otherProjectId,
      'production'
    );
  });

  it('allows a project member to list active environments', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.DEVELOPER })
    );
    environmentRepository.findActiveByProjectId.mockResolvedValueOnce([createEnvironment()]);

    await expect(environmentsService.listEnvironments(userId, projectId)).resolves.toEqual({
      items: [
        {
          id: environmentId,
          projectId,
          name: 'Production',
          slug: 'production',
          description: 'Production deployment environment',
          createdAt: '2026-06-13T14:00:00.000Z',
          updatedAt: '2026-06-13T14:00:00.000Z'
        }
      ]
    });
  });

  it('returns an empty list when no active environments exist', async () => {
    await expect(environmentsService.listEnvironments(userId, projectId)).resolves.toEqual({
      items: []
    });
  });

  it('excludes archived environments through the active repository lookup', async () => {
    environmentRepository.findActiveByProjectId.mockResolvedValueOnce([
      createEnvironment({ slug: 'active' })
    ]);

    await environmentsService.listEnvironments(userId, projectId);

    expect(environmentRepository.findActiveByProjectId).toHaveBeenCalledWith(projectId);
  });

  it('allows a project member to retrieve an active environment', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.DEVELOPER })
    );
    environmentRepository.findActiveByProjectAndId.mockResolvedValueOnce(createEnvironment());

    await expect(
      environmentsService.getEnvironment(userId, projectId, environmentId)
    ).resolves.toMatchObject({ id: environmentId, projectId });
  });

  it('does not retrieve an environment through a different project id', async () => {
    environmentRepository.findActiveByProjectAndId.mockResolvedValueOnce(null);

    await expect(
      environmentsService.getEnvironment(userId, otherProjectId, environmentId)
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(environmentRepository.findActiveByProjectAndId).toHaveBeenCalledWith(
      otherProjectId,
      environmentId
    );
  });

  it('returns 404 when a non-member retrieves an environment', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(null);

    await expect(
      environmentsService.getEnvironment(otherUserId, projectId, environmentId)
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(environmentRepository.findActiveByProjectAndId).not.toHaveBeenCalled();
  });

  it('returns 404 when an archived environment is not returned by active lookup', async () => {
    await expect(
      environmentsService.getEnvironment(userId, projectId, environmentId)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows an owner to update environment metadata', async () => {
    environmentRepository.findActiveByProjectAndId.mockResolvedValueOnce(createEnvironment());

    await expect(
      environmentsService.updateEnvironment(userId, projectId, environmentId, {
        name: 'Production EU',
        slug: 'production-eu',
        description: 'European production deployment'
      })
    ).resolves.toMatchObject({
      name: 'Production EU',
      slug: 'production-eu',
      description: 'European production deployment'
    });

    expect(environmentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Production EU',
        slug: 'production-eu',
        description: 'European production deployment'
      })
    );
  });

  it('returns 403 when a non-owner member updates an environment', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.DEVELOPER })
    );

    await expect(
      environmentsService.updateEnvironment(userId, projectId, environmentId, {
        name: 'Production EU'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(environmentRepository.save).not.toHaveBeenCalled();
  });

  it('allows a maintainer to update environment metadata', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.MAINTAINER })
    );
    environmentRepository.findActiveByProjectAndId.mockResolvedValueOnce(createEnvironment());

    await expect(
      environmentsService.updateEnvironment(userId, projectId, environmentId, {
        name: 'Production EU'
      })
    ).resolves.toMatchObject({ name: 'Production EU' });

    expect(environmentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Production EU' })
    );
  });

  it('returns 409 when updating to a conflicting slug', async () => {
    environmentRepository.findActiveByProjectAndId.mockResolvedValueOnce(createEnvironment());
    environmentRepository.findActiveByProjectAndSlug.mockResolvedValueOnce(
      createEnvironment({ id: '3f412040-1283-4f40-afca-91110ee81e16', slug: 'staging' })
    );

    await expect(
      environmentsService.updateEnvironment(userId, projectId, environmentId, {
        slug: 'staging'
      })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(environmentRepository.save).not.toHaveBeenCalled();
  });

  it('allows an owner to archive an environment without deleting it', async () => {
    const environment = createEnvironment();
    environmentRepository.findActiveByProjectAndId.mockResolvedValueOnce(environment);

    await expect(
      environmentsService.archiveEnvironment(userId, projectId, environmentId)
    ).resolves.toBeUndefined();

    expect(environment.archivedAt).toBeInstanceOf(Date);
    expect(environmentRepository.save).toHaveBeenCalledWith(environment);
  });
});

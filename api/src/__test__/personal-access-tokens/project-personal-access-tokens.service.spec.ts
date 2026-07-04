import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { ProjectPersonalAccessTokenEntity } from '../../personal-access-tokens/entities/project-personal-access-token.entity';
import {
  type CreateProjectPersonalAccessTokenRecord,
  ProjectPersonalAccessTokenRepository
} from '../../personal-access-tokens/repositories/project-personal-access-token.repository';
import { ProjectPersonalAccessTokensService } from '../../personal-access-tokens/project-personal-access-tokens.service';
import { ProjectMembershipEntity } from '../../projects/entities/project-membership.entity';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { ProjectEntity } from '../../projects/entities/project.entity';
import { ProjectAccessService } from '../../projects/project-access.service';
import { ProjectMembershipsRepository } from '../../projects/repositories/project-memberships.repository';

type ProjectMembershipsRepositoryMock = {
  findActiveProjectByProjectAndUser: jest.Mock<
    Promise<ProjectMembershipEntity | null>,
    [string, string]
  >;
};

type ProjectPersonalAccessTokenRepositoryMock = {
  create: jest.Mock<
    Promise<ProjectPersonalAccessTokenEntity>,
    [CreateProjectPersonalAccessTokenRecord]
  >;
};

const now = new Date('2026-07-04T12:00:00.000Z');
const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';

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
    role: ProjectRole.DEVELOPER,
    addedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    project,
    ...overrides
  });
}

function createPersonalAccessToken(
  input: CreateProjectPersonalAccessTokenRecord
): ProjectPersonalAccessTokenEntity {
  return Object.assign(new ProjectPersonalAccessTokenEntity(), {
    ...input,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now
  });
}

describe('ProjectPersonalAccessTokensService', () => {
  let service: ProjectPersonalAccessTokensService;
  let projectMembershipsRepository: ProjectMembershipsRepositoryMock;
  let personalAccessTokenRepository: ProjectPersonalAccessTokenRepositoryMock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);

    projectMembershipsRepository = {
      findActiveProjectByProjectAndUser: jest.fn<
        Promise<ProjectMembershipEntity | null>,
        [string, string]
      >(() => Promise.resolve(createMembership()))
    };
    personalAccessTokenRepository = {
      create: jest.fn<
        Promise<ProjectPersonalAccessTokenEntity>,
        [CreateProjectPersonalAccessTokenRecord]
      >((input) => Promise.resolve(createPersonalAccessToken(input)))
    };

    service = new ProjectPersonalAccessTokensService(
      new ProjectAccessService(
        projectMembershipsRepository as unknown as ProjectMembershipsRepository
      ),
      personalAccessTokenRepository as unknown as ProjectPersonalAccessTokenRepository
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows any active project member to create a project-scoped PAT', async () => {
    await expect(
      service.create(userId, projectId, {
        name: 'local dev laptop',
        expiresAt: '2026-09-04T12:00:00.000Z'
      })
    ).resolves.toEqual({
      id: expect.any(String) as string,
      projectId,
      name: 'local dev laptop',
      token: expect.stringMatching(/^envlock_pat_[0-9a-f-]+\.[A-Za-z0-9_-]+$/) as string,
      tokenType: 'Bearer',
      expiresAt: '2026-09-04T12:00:00.000Z',
      createdAt: '2026-07-04T12:00:00.000Z'
    });

    expect(projectMembershipsRepository.findActiveProjectByProjectAndUser).toHaveBeenCalledWith(
      projectId,
      userId
    );
  });

  it('also allows maintainers and owners to create PATs', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.MAINTAINER })
    );
    await expect(
      service.create(userId, projectId, {
        name: 'maintainer token',
        expiresAt: '2026-08-04T12:00:00.000Z'
      })
    ).resolves.toMatchObject({ name: 'maintainer token' });

    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.OWNER })
    );
    await expect(
      service.create(userId, projectId, {
        name: 'owner token',
        expiresAt: '2026-08-04T12:00:00.000Z'
      })
    ).resolves.toMatchObject({ name: 'owner token' });
  });

  it('returns 404 when a non-member creates a PAT', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(null);

    await expect(
      service.create(userId, projectId, {
        name: 'missing membership',
        expiresAt: '2026-08-04T12:00:00.000Z'
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(personalAccessTokenRepository.create).not.toHaveBeenCalled();
  });

  it('persists only the token hash and token suffix', async () => {
    const response = await service.create(userId, projectId, {
      name: 'local dev laptop',
      expiresAt: '2026-09-04T12:00:00.000Z'
    });
    const createdRecord = personalAccessTokenRepository.create.mock.calls[0]?.[0];
    const [tokenIdPart, tokenSecret] = response.token.replace('envlock_pat_', '').split('.');

    expect(tokenIdPart).toBe(createdRecord?.id);
    expect(createdRecord).toMatchObject({
      projectId,
      userId,
      name: 'local dev laptop',
      tokenLastFour: tokenSecret?.slice(-4),
      expiresAt: new Date('2026-09-04T12:00:00.000Z')
    });
    expect(createdRecord?.tokenHash).toBe(
      createHash('sha256')
        .update(tokenSecret ?? '', 'utf8')
        .digest('hex')
    );
    expect(createdRecord?.tokenHash).not.toBe(tokenSecret);
    expect(JSON.stringify(createdRecord)).not.toContain(response.token);
  });

  it('rejects expirations in the past', async () => {
    await expect(
      service.create(userId, projectId, {
        name: 'expired token',
        expiresAt: '2026-07-04T11:59:59.000Z'
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(personalAccessTokenRepository.create).not.toHaveBeenCalled();
  });

  it('allows expirations exactly 90 days in the future', async () => {
    await expect(
      service.create(userId, projectId, {
        name: 'max lifetime',
        expiresAt: '2026-10-02T12:00:00.000Z'
      })
    ).resolves.toMatchObject({ expiresAt: '2026-10-02T12:00:00.000Z' });
  });

  it('rejects expirations beyond 90 days', async () => {
    await expect(
      service.create(userId, projectId, {
        name: 'too long',
        expiresAt: '2026-10-02T12:00:01.000Z'
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(personalAccessTokenRepository.create).not.toHaveBeenCalled();
  });
});

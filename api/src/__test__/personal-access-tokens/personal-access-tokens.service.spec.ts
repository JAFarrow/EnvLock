import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { AuditEventsService } from '../../audit-events/audit-events.service';
import { PersonalAccessTokenEntity } from '../../personal-access-tokens/entities/personal-access-token.entity';
import {
  type CreatePersonalAccessTokenRecord,
  PersonalAccessTokenRepository
} from '../../personal-access-tokens/repositories/personal-access-token.repository';
import { PersonalAccessTokensService } from '../../personal-access-tokens/personal-access-tokens.service';
import { ProjectMembershipEntity } from '../../projects/entities/project-membership.entity';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { ProjectEntity } from '../../projects/entities/project.entity';
import { ProjectAccessService } from '../../projects/project-access.service';
import { ProjectMembershipsRepository } from '../../projects/repositories/project-memberships.repository';
import { UserEntity } from '../../users/entities/user.entity';

type ProjectMembershipsRepositoryMock = {
  findActiveProjectByProjectAndUser: jest.Mock<
    Promise<ProjectMembershipEntity | null>,
    [string, string]
  >;
};

type PersonalAccessTokenRepositoryMock = {
  create: jest.Mock<Promise<PersonalAccessTokenEntity>, [CreatePersonalAccessTokenRecord]>;
  findUnrevokedByProjectId: jest.Mock<Promise<PersonalAccessTokenEntity[]>, [string]>;
  findUnrevokedByProjectAndUserId: jest.Mock<
    Promise<PersonalAccessTokenEntity[]>,
    [string, string]
  >;
  findUnrevokedByProjectAndId: jest.Mock<
    Promise<PersonalAccessTokenEntity | null>,
    [string, string]
  >;
  save: jest.Mock<Promise<PersonalAccessTokenEntity>, [PersonalAccessTokenEntity]>;
};

type AuditEventsServiceMock = {
  record: jest.Mock<Promise<void>, [Record<string, unknown>]>;
};

const now = new Date('2026-07-04T12:00:00.000Z');
const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const otherUserId = '38ad4ca2-6416-4c58-a574-61c2d1a53d08';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const tokenId = 'a65de020-3ac3-4f9d-b3df-3cde79de0511';

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
  overrides: Partial<PersonalAccessTokenEntity> = {}
): PersonalAccessTokenEntity {
  const user =
    overrides.user ??
    Object.assign(new UserEntity(), {
      id: overrides.userId ?? userId,
      email: 'user@example.com',
      passwordHash: 'hashed-password',
      status: 'active',
      createdAt: now,
      updatedAt: now
    });

  return Object.assign(new PersonalAccessTokenEntity(), {
    id: tokenId,
    projectId,
    userId: user.id,
    name: 'local dev laptop',
    tokenHash: 'a'.repeat(64),
    tokenLastFour: 'last',
    expiresAt: new Date('2026-09-04T12:00:00.000Z'),
    lastUsedAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    user,
    ...overrides
  });
}

describe('PersonalAccessTokensService', () => {
  let service: PersonalAccessTokensService;
  let projectMembershipsRepository: ProjectMembershipsRepositoryMock;
  let personalAccessTokenRepository: PersonalAccessTokenRepositoryMock;
  let auditEventsService: AuditEventsServiceMock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);

    projectMembershipsRepository = {
      findActiveProjectByProjectAndUser: jest.fn<
        Promise<ProjectMembershipEntity | null>,
        [string, string]
      >(() => Promise.resolve(createMembership()))
    };
    personalAccessTokenRepository = {
      create: jest.fn<Promise<PersonalAccessTokenEntity>, [CreatePersonalAccessTokenRecord]>(
        (input) => Promise.resolve(createPersonalAccessToken(input))
      ),
      findUnrevokedByProjectId: jest.fn<Promise<PersonalAccessTokenEntity[]>, [string]>(() =>
        Promise.resolve([createPersonalAccessToken()])
      ),
      findUnrevokedByProjectAndUserId: jest.fn<
        Promise<PersonalAccessTokenEntity[]>,
        [string, string]
      >(() => Promise.resolve([createPersonalAccessToken()])),
      findUnrevokedByProjectAndId: jest.fn<
        Promise<PersonalAccessTokenEntity | null>,
        [string, string]
      >(() => Promise.resolve(createPersonalAccessToken())),
      save: jest.fn<Promise<PersonalAccessTokenEntity>, [PersonalAccessTokenEntity]>((token) =>
        Promise.resolve(token)
      )
    };
    auditEventsService = {
      record: jest.fn<Promise<void>, [Record<string, unknown>]>(() => Promise.resolve())
    };

    service = new PersonalAccessTokensService(
      new ProjectAccessService(
        projectMembershipsRepository as unknown as ProjectMembershipsRepository
      ),
      personalAccessTokenRepository as unknown as PersonalAccessTokenRepository,
      auditEventsService as unknown as AuditEventsService
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
    expect(auditEventsService.record).toHaveBeenCalledWith({
      projectId,
      actorUserId: userId,
      action: 'pat.created',
      targetType: 'personal_access_token',
      targetId: expect.any(String) as string,
      details: {
        fields: ['name', 'expiresAt']
      }
    });
  });

  it.each([ProjectRole.OWNER, ProjectRole.MAINTAINER])(
    'allows %s members to list all unrevoked project PATs',
    async (role) => {
      projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
        createMembership({ role })
      );
      const otherUser = Object.assign(new UserEntity(), {
        id: otherUserId,
        email: 'other@example.com',
        passwordHash: 'hashed-password',
        status: 'active',
        createdAt: now,
        updatedAt: now
      });
      personalAccessTokenRepository.findUnrevokedByProjectId.mockResolvedValueOnce([
        createPersonalAccessToken({ user: otherUser, userId: otherUser.id })
      ]);

      await expect(service.list(userId, projectId)).resolves.toEqual({
        items: [
          {
            id: tokenId,
            projectId,
            userId: otherUserId,
            userEmail: 'other@example.com',
            name: 'local dev laptop',
            tokenLastFour: 'last',
            expiresAt: '2026-09-04T12:00:00.000Z',
            lastUsedAt: null,
            createdAt: '2026-07-04T12:00:00.000Z'
          }
        ]
      });

      expect(personalAccessTokenRepository.findUnrevokedByProjectId).toHaveBeenCalledWith(
        projectId
      );
      expect(personalAccessTokenRepository.findUnrevokedByProjectAndUserId).not.toHaveBeenCalled();
    }
  );

  it('allows developers to list only their own unrevoked project PATs', async () => {
    await expect(service.list(userId, projectId)).resolves.toMatchObject({
      items: [
        {
          userId,
          userEmail: 'user@example.com',
          tokenLastFour: 'last'
        }
      ]
    });

    expect(personalAccessTokenRepository.findUnrevokedByProjectAndUserId).toHaveBeenCalledWith(
      projectId,
      userId
    );
    expect(personalAccessTokenRepository.findUnrevokedByProjectId).not.toHaveBeenCalled();
  });

  it('does not expose raw or hashed token values when listing PATs', async () => {
    const response = await service.list(userId, projectId);

    expect(response.items[0]).not.toHaveProperty('token');
    expect(response.items[0]).not.toHaveProperty('tokenHash');
  });

  it('returns 404 when a non-member lists PATs', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(null);

    await expect(service.list(userId, projectId)).rejects.toBeInstanceOf(NotFoundException);

    expect(personalAccessTokenRepository.findUnrevokedByProjectId).not.toHaveBeenCalled();
    expect(personalAccessTokenRepository.findUnrevokedByProjectAndUserId).not.toHaveBeenCalled();
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
    expect(JSON.stringify(auditEventsService.record.mock.calls)).not.toContain(response.token);
    expect(JSON.stringify(auditEventsService.record.mock.calls)).not.toContain(
      createdRecord?.tokenHash ?? ''
    );
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

  it('allows developers to revoke their own PATs', async () => {
    await expect(service.revoke(userId, projectId, tokenId)).resolves.toBeUndefined();

    const savedToken = personalAccessTokenRepository.save.mock.calls[0]?.[0];

    expect(personalAccessTokenRepository.findUnrevokedByProjectAndId).toHaveBeenCalledWith(
      projectId,
      tokenId
    );
    expect(savedToken?.revokedAt).toBeInstanceOf(Date);
    expect(auditEventsService.record).toHaveBeenCalledWith({
      projectId,
      actorUserId: userId,
      action: 'pat.revoked',
      targetType: 'personal_access_token',
      targetId: tokenId
    });
  });

  it.each([ProjectRole.OWNER, ProjectRole.MAINTAINER])(
    'allows %s members to revoke any project PAT',
    async (role) => {
      projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
        createMembership({ role })
      );
      personalAccessTokenRepository.findUnrevokedByProjectAndId.mockResolvedValueOnce(
        createPersonalAccessToken({ userId: otherUserId })
      );

      await expect(service.revoke(userId, projectId, tokenId)).resolves.toBeUndefined();

      expect(personalAccessTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) as Date })
      );
    }
  );

  it("rejects developers revoking another user's PAT", async () => {
    personalAccessTokenRepository.findUnrevokedByProjectAndId.mockResolvedValueOnce(
      createPersonalAccessToken({ userId: otherUserId })
    );

    await expect(service.revoke(userId, projectId, tokenId)).rejects.toBeInstanceOf(
      ForbiddenException
    );

    expect(personalAccessTokenRepository.save).not.toHaveBeenCalled();
  });

  it('returns 404 when a non-member revokes a PAT', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(null);

    await expect(service.revoke(userId, projectId, tokenId)).rejects.toBeInstanceOf(
      NotFoundException
    );

    expect(personalAccessTokenRepository.findUnrevokedByProjectAndId).not.toHaveBeenCalled();
    expect(personalAccessTokenRepository.save).not.toHaveBeenCalled();
  });

  it('returns 404 when revoking a missing or already revoked PAT', async () => {
    personalAccessTokenRepository.findUnrevokedByProjectAndId.mockResolvedValueOnce(null);

    await expect(service.revoke(userId, projectId, tokenId)).rejects.toBeInstanceOf(
      NotFoundException
    );

    expect(personalAccessTokenRepository.save).not.toHaveBeenCalled();
  });
});

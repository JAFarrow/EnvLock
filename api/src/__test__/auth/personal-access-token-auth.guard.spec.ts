import { type ExecutionContext } from '@nestjs/common';

import { hashPersonalAccessTokenSecret } from '../../auth/personal-access-token-secret';
import { type AuthenticatedPersonalAccessTokenRequest } from '../../auth/contracts/personal-access-token-request';
import { PersonalAccessTokenAuthGuard } from '../../auth/guards/personal-access-token-auth.guard';
import { PersonalAccessTokenAuthService } from '../../auth/personal-access-token-auth.service';
import { PersonalAccessTokenEntity } from '../../personal-access-tokens/entities/personal-access-token.entity';
import { PersonalAccessTokenRepository } from '../../personal-access-tokens/repositories/personal-access-token.repository';
import { ProjectMembershipEntity } from '../../projects/entities/project-membership.entity';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { ProjectMembershipsRepository } from '../../projects/repositories/project-memberships.repository';

type PersonalAccessTokenRepositoryMock = {
  findActiveByIdAndHash: jest.Mock<Promise<PersonalAccessTokenEntity | null>, [string, string]>;
  save: jest.Mock<Promise<PersonalAccessTokenEntity>, [PersonalAccessTokenEntity]>;
};

type ProjectMembershipsRepositoryMock = {
  findActiveProjectByProjectAndUser: jest.Mock<
    Promise<ProjectMembershipEntity | null>,
    [string, string]
  >;
};

const now = new Date('2026-07-04T12:00:00.000Z');
const tokenId = 'a65de020-3ac3-4f9d-b3df-3cde79de0511';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const tokenSecret = 'test-secret';

function createPersonalAccessToken(
  overrides: Partial<PersonalAccessTokenEntity> = {}
): PersonalAccessTokenEntity {
  return Object.assign(new PersonalAccessTokenEntity(), {
    id: tokenId,
    projectId,
    userId,
    name: 'local dev laptop',
    tokenHash: hashPersonalAccessTokenSecret(tokenSecret),
    tokenLastFour: 'cret',
    expiresAt: new Date('2026-09-04T12:00:00.000Z'),
    lastUsedAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  });
}

function createMembership(
  overrides: Partial<ProjectMembershipEntity> = {}
): ProjectMembershipEntity {
  return Object.assign(new ProjectMembershipEntity(), {
    id: '77c14d50-d566-4a7e-b459-2c6cd1f64a60',
    projectId,
    userId,
    role: ProjectRole.DEVELOPER,
    addedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    ...overrides
  });
}

describe('PersonalAccessTokenAuthGuard', () => {
  let authService: PersonalAccessTokenAuthService;
  let guard: PersonalAccessTokenAuthGuard;
  let personalAccessTokenRepository: PersonalAccessTokenRepositoryMock;
  let projectMembershipsRepository: ProjectMembershipsRepositoryMock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);

    personalAccessTokenRepository = {
      findActiveByIdAndHash: jest.fn<Promise<PersonalAccessTokenEntity | null>, [string, string]>(
        () => Promise.resolve(createPersonalAccessToken())
      ),
      save: jest.fn<Promise<PersonalAccessTokenEntity>, [PersonalAccessTokenEntity]>((token) =>
        Promise.resolve(token)
      )
    };
    projectMembershipsRepository = {
      findActiveProjectByProjectAndUser: jest.fn<
        Promise<ProjectMembershipEntity | null>,
        [string, string]
      >(() => Promise.resolve(createMembership()))
    };

    authService = new PersonalAccessTokenAuthService(
      personalAccessTokenRepository as unknown as PersonalAccessTokenRepository,
      projectMembershipsRepository as unknown as ProjectMembershipsRepository
    );
    guard = new PersonalAccessTokenAuthGuard(authService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('authenticates valid PATs and records last usage', async () => {
    await expect(
      authService.validate(`Bearer envlock_pat_${tokenId}.${tokenSecret}`)
    ).resolves.toEqual({
      id: tokenId,
      projectId,
      userId
    });

    expect(personalAccessTokenRepository.findActiveByIdAndHash).toHaveBeenCalledWith(
      tokenId,
      hashPersonalAccessTokenSecret(tokenSecret)
    );
    expect(projectMembershipsRepository.findActiveProjectByProjectAndUser).toHaveBeenCalledWith(
      projectId,
      userId
    );
    expect(personalAccessTokenRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ lastUsedAt: now })
    );
  });

  it('attaches authenticated PATs to HTTP requests', async () => {
    const { context, request } = createExecutionContext(
      `Bearer envlock_pat_${tokenId}.${tokenSecret}`
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.user).toEqual({
      id: tokenId,
      projectId,
      userId
    });
  });

  it('rejects malformed PATs before querying storage', async () => {
    await expect(authService.validate(undefined)).resolves.toBeNull();
    await expect(authService.validate('not-a-pat')).resolves.toBeNull();
    await expect(
      authService.validate(`Bearer envlock_pat_not-a-uuid.${tokenSecret}`)
    ).resolves.toBeNull();
    await expect(
      authService.validate(`Bearer envlock_pat_${tokenId}.${tokenSecret} extra`)
    ).resolves.toBeNull();

    expect(personalAccessTokenRepository.findActiveByIdAndHash).not.toHaveBeenCalled();
  });

  it('rejects unknown, expired, or revoked PATs', async () => {
    personalAccessTokenRepository.findActiveByIdAndHash.mockResolvedValueOnce(null);

    await expect(
      authService.validate(`Bearer envlock_pat_${tokenId}.${tokenSecret}`)
    ).resolves.toBeNull();

    expect(personalAccessTokenRepository.save).not.toHaveBeenCalled();
  });

  it('rejects PATs whose owner no longer has project access', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(null);

    await expect(
      authService.validate(`Bearer envlock_pat_${tokenId}.${tokenSecret}`)
    ).resolves.toBeNull();

    expect(personalAccessTokenRepository.save).not.toHaveBeenCalled();
  });
});

function createExecutionContext(authorization: string): {
  context: ExecutionContext;
  request: AuthenticatedPersonalAccessTokenRequest;
} {
  const request = {
    headers: { authorization }
  } as AuthenticatedPersonalAccessTokenRequest;

  return {
    context: {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as ExecutionContext,
    request
  };
}

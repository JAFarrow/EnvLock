import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from '@nestjs/common';

import { addProjectMemberSchema } from '../../projects/contracts/add-project-member.dto';
import { type UpdateProjectMemberRoleDto } from '../../projects/contracts/update-project-member-role.dto';
import { ProjectMembershipEntity } from '../../projects/entities/project-membership.entity';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { ProjectEntity } from '../../projects/entities/project.entity';
import { ProjectAccessService } from '../../projects/project-access.service';
import { ProjectMembershipsRepository } from '../../projects/repositories/project-memberships.repository';
import { ProjectMembershipsService } from '../../projects/project-memberships.service';
import { UserEntity } from '../../users/entities/user.entity';
import { UsersRepository } from '../../users/repositories/users.repository';

type ProjectMembershipsRepositoryMock = {
  create: jest.Mock<
    Promise<ProjectMembershipEntity>,
    [
      {
        projectId: string;
        userId: string;
        role: ProjectRole;
        addedByUserId?: string | null;
      }
    ]
  >;
  findActiveProjectByProjectAndUser: jest.Mock<
    Promise<ProjectMembershipEntity | null>,
    [string, string]
  >;
  findByProjectAndUser: jest.Mock<Promise<ProjectMembershipEntity | null>, [string, string]>;
  findByProjectWithUsers: jest.Mock<Promise<ProjectMembershipEntity[]>, [string]>;
  save: jest.Mock<Promise<ProjectMembershipEntity>, [ProjectMembershipEntity]>;
  remove: jest.Mock<Promise<void>, [ProjectMembershipEntity]>;
};

type UsersRepositoryMock = {
  findByEmail: jest.Mock<Promise<UserEntity | null>, [string]>;
};

const ownerUserId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const maintainerUserId = 'f0b7d5df-0d78-4702-b4a6-70bd5c474d43';
const developerUserId = '0a8d4a1f-d93d-4a6d-9ec4-6c2d688f0c79';
const outsiderUserId = '96254d95-5c51-4755-a714-67597330d4d0';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const now = new Date('2026-06-13T15:00:00.000Z');

function createUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return Object.assign(new UserEntity(), {
    id: developerUserId,
    email: 'developer@example.com',
    passwordHash: 'hashed-password',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides
  });
}

function createProject(overrides: Partial<ProjectEntity> = {}): ProjectEntity {
  return Object.assign(new ProjectEntity(), {
    id: projectId,
    name: 'Payments API',
    description: 'Backend payment service',
    repositoryUrl: 'https://github.com/example/payments-api',
    createdByUserId: ownerUserId,
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
  const user =
    overrides.user ??
    createUser({ id: overrides.userId ?? ownerUserId, email: 'owner@example.com' });

  return Object.assign(new ProjectMembershipEntity(), {
    id: '77c14d50-d566-4a7e-b459-2c6cd1f64a60',
    projectId: project.id,
    userId: user.id,
    role: ProjectRole.OWNER,
    addedByUserId: ownerUserId,
    createdAt: now,
    updatedAt: now,
    project,
    user,
    ...overrides
  });
}

describe('ProjectMembershipsService', () => {
  let projectMembershipsService: ProjectMembershipsService;
  let projectMembershipsRepository: ProjectMembershipsRepositoryMock;
  let usersRepository: UsersRepositoryMock;

  beforeEach(() => {
    projectMembershipsRepository = {
      create: jest.fn<
        Promise<ProjectMembershipEntity>,
        [
          {
            projectId: string;
            userId: string;
            role: ProjectRole;
            addedByUserId?: string | null;
          }
        ]
      >((input) =>
        Promise.resolve(
          createMembership({
            projectId: input.projectId,
            userId: input.userId,
            role: input.role,
            addedByUserId: input.addedByUserId ?? null
          })
        )
      ),
      findActiveProjectByProjectAndUser: jest.fn<
        Promise<ProjectMembershipEntity | null>,
        [string, string]
      >(() => Promise.resolve(createMembership())),
      findByProjectAndUser: jest.fn<Promise<ProjectMembershipEntity | null>, [string, string]>(() =>
        Promise.resolve(null)
      ),
      findByProjectWithUsers: jest.fn<Promise<ProjectMembershipEntity[]>, [string]>(() =>
        Promise.resolve([])
      ),
      save: jest.fn<Promise<ProjectMembershipEntity>, [ProjectMembershipEntity]>((membership) =>
        Promise.resolve(membership)
      ),
      remove: jest.fn<Promise<void>, [ProjectMembershipEntity]>(() => Promise.resolve())
    };
    usersRepository = {
      findByEmail: jest.fn<Promise<UserEntity | null>, [string]>(() =>
        Promise.resolve(createUser())
      )
    };

    projectMembershipsService = new ProjectMembershipsService(
      new ProjectAccessService(
        projectMembershipsRepository as unknown as ProjectMembershipsRepository
      ),
      projectMembershipsRepository as unknown as ProjectMembershipsRepository,
      usersRepository as unknown as UsersRepository
    );
  });

  it.each([
    ['owner', ProjectRole.OWNER, ownerUserId],
    ['maintainer', ProjectRole.MAINTAINER, maintainerUserId],
    ['developer', ProjectRole.DEVELOPER, developerUserId]
  ])('allows a project %s to list project members', async (_label, role, actorUserId) => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role, userId: actorUserId, user: createUser({ id: actorUserId }) })
    );
    projectMembershipsRepository.findByProjectWithUsers.mockResolvedValueOnce([
      createMembership({ user: createUser({ id: ownerUserId, email: 'owner@example.com' }) }),
      createMembership({
        userId: developerUserId,
        role: ProjectRole.DEVELOPER,
        user: createUser({ id: developerUserId, email: 'developer@example.com' })
      })
    ]);

    await expect(projectMembershipsService.findAll(actorUserId, projectId)).resolves.toEqual({
      items: [
        {
          userId: ownerUserId,
          email: 'owner@example.com',
          role: ProjectRole.OWNER,
          createdAt: '2026-06-13T15:00:00.000Z'
        },
        {
          userId: developerUserId,
          email: 'developer@example.com',
          role: ProjectRole.DEVELOPER,
          createdAt: '2026-06-13T15:00:00.000Z'
        }
      ]
    });
  });

  it('returns 404 when a non-member lists members', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(null);

    await expect(
      projectMembershipsService.findAll(outsiderUserId, projectId)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([ProjectRole.MAINTAINER, ProjectRole.DEVELOPER])(
    'allows an owner to add a registered user as %s',
    async (role) => {
      const targetUser = createUser({ id: developerUserId, email: 'developer@example.com' });
      usersRepository.findByEmail.mockResolvedValueOnce(targetUser);

      await expect(
        projectMembershipsService.add(ownerUserId, projectId, {
          email: 'developer@example.com',
          role
        })
      ).resolves.toEqual({
        userId: developerUserId,
        email: 'developer@example.com',
        role,
        createdAt: '2026-06-13T15:00:00.000Z'
      });

      expect(projectMembershipsRepository.create).toHaveBeenCalledWith({
        projectId,
        userId: developerUserId,
        role,
        addedByUserId: ownerUserId
      });
    }
  );

  it('looks up users using the normalized email produced by the shared schema', async () => {
    const input = addProjectMemberSchema.parse({
      email: '  Developer@Example.COM ',
      role: ProjectRole.DEVELOPER
    });

    await projectMembershipsService.add(ownerUserId, projectId, input);

    expect(usersRepository.findByEmail).toHaveBeenCalledWith('developer@example.com');
  });

  it('returns 404 when the target user does not exist', async () => {
    usersRepository.findByEmail.mockResolvedValueOnce(null);

    await expect(
      projectMembershipsService.add(ownerUserId, projectId, {
        email: 'missing@example.com',
        role: ProjectRole.DEVELOPER
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(projectMembershipsRepository.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the target user is already a member', async () => {
    projectMembershipsRepository.findByProjectAndUser.mockResolvedValueOnce(
      createMembership({ userId: developerUserId, role: ProjectRole.DEVELOPER })
    );

    await expect(
      projectMembershipsService.add(ownerUserId, projectId, {
        email: 'developer@example.com',
        role: ProjectRole.DEVELOPER
      })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(projectMembershipsRepository.create).not.toHaveBeenCalled();
  });

  it.each([ProjectRole.MAINTAINER, ProjectRole.DEVELOPER])(
    'returns 403 when a %s attempts to add members',
    async (role) => {
      projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
        createMembership({ role, userId: maintainerUserId })
      );

      await expect(
        projectMembershipsService.add(maintainerUserId, projectId, {
          email: 'developer@example.com',
          role: ProjectRole.DEVELOPER
        })
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(usersRepository.findByEmail).not.toHaveBeenCalled();
      expect(projectMembershipsRepository.create).not.toHaveBeenCalled();
    }
  );

  it.each([
    [ProjectRole.DEVELOPER, ProjectRole.MAINTAINER],
    [ProjectRole.MAINTAINER, ProjectRole.DEVELOPER]
  ])('allows an owner to change %s to %s', async (fromRole, toRole) => {
    const membership = createMembership({
      userId: developerUserId,
      role: fromRole,
      user: createUser({ id: developerUserId, email: 'developer@example.com' })
    });
    projectMembershipsRepository.findByProjectAndUser.mockResolvedValueOnce(membership);

    await expect(
      projectMembershipsService.updateRole(ownerUserId, projectId, developerUserId, {
        role: toRole
      })
    ).resolves.toMatchObject({ role: toRole });

    expect(membership.role).toBe(toRole);
    expect(projectMembershipsRepository.save).toHaveBeenCalledWith(membership);
  });

  it('returns 400 when assigning the owner role', async () => {
    await expect(
      projectMembershipsService.updateRole(ownerUserId, projectId, developerUserId, {
        role: ProjectRole.OWNER
      } as UpdateProjectMemberRoleDto)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 409 when modifying an owner membership', async () => {
    projectMembershipsRepository.findByProjectAndUser.mockResolvedValueOnce(
      createMembership({ userId: ownerUserId, role: ProjectRole.OWNER })
    );

    await expect(
      projectMembershipsService.updateRole(ownerUserId, projectId, ownerUserId, {
        role: ProjectRole.DEVELOPER
      })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(projectMembershipsRepository.save).not.toHaveBeenCalled();
  });

  it.each([ProjectRole.MAINTAINER, ProjectRole.DEVELOPER])(
    'allows an owner to remove a %s',
    async (role) => {
      const membership = createMembership({ userId: developerUserId, role });
      projectMembershipsRepository.findByProjectAndUser.mockResolvedValueOnce(membership);

      await expect(
        projectMembershipsService.remove(ownerUserId, projectId, developerUserId)
      ).resolves.toBeUndefined();

      expect(projectMembershipsRepository.remove).toHaveBeenCalledWith(membership);
      expect(usersRepository.findByEmail).not.toHaveBeenCalled();
    }
  );

  it('returns 409 when removing an owner membership', async () => {
    projectMembershipsRepository.findByProjectAndUser.mockResolvedValueOnce(
      createMembership({ userId: ownerUserId, role: ProjectRole.OWNER })
    );

    await expect(
      projectMembershipsService.remove(ownerUserId, projectId, ownerUserId)
    ).rejects.toBeInstanceOf(ConflictException);

    expect(projectMembershipsRepository.remove).not.toHaveBeenCalled();
  });

  it('returns 404 when the target membership does not exist', async () => {
    await expect(
      projectMembershipsService.remove(ownerUserId, projectId, developerUserId)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not expose persistence relations or sensitive user fields in responses', async () => {
    projectMembershipsRepository.findByProjectWithUsers.mockResolvedValueOnce([
      createMembership({
        userId: developerUserId,
        role: ProjectRole.DEVELOPER,
        user: createUser({ id: developerUserId, email: 'developer@example.com' })
      })
    ]);

    const response = await projectMembershipsService.findAll(ownerUserId, projectId);

    expect(response.items[0]).toEqual({
      userId: developerUserId,
      email: 'developer@example.com',
      role: ProjectRole.DEVELOPER,
      createdAt: '2026-06-13T15:00:00.000Z'
    });
    expect(response.items[0]).not.toHaveProperty('passwordHash');
    expect(response.items[0]).not.toHaveProperty('user');
    expect(response.items[0]).not.toHaveProperty('project');
  });
});

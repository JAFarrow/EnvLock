import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { type Repository } from 'typeorm';

import { ProjectMembershipEntity } from '../../projects/entities/project-membership.entity';
import { ProjectMembershipsRepository } from '../../projects/repositories/project-memberships.repository';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { ProjectEntity } from '../../projects/entities/project.entity';

interface MembershipQueryBuilderMock {
  innerJoinAndSelect: jest.Mock<MembershipQueryBuilderMock, [string, string]>;
  where: jest.Mock<MembershipQueryBuilderMock, [string, Record<string, string>]>;
  andWhere: jest.Mock<MembershipQueryBuilderMock, [string, Record<string, string>?]>;
  orderBy: jest.Mock<MembershipQueryBuilderMock, [string, 'ASC' | 'DESC']>;
  getMany: jest.Mock<Promise<ProjectMembershipEntity[]>, []>;
  getOne: jest.Mock<Promise<ProjectMembershipEntity | null>, []>;
}

type TypeOrmMembershipRepositoryMock = {
  create: jest.Mock<ProjectMembershipEntity, [Partial<ProjectMembershipEntity>]>;
  save: jest.Mock<Promise<ProjectMembershipEntity>, [ProjectMembershipEntity]>;
  createQueryBuilder: jest.Mock<MembershipQueryBuilderMock, [string]>;
};

const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const now = new Date('2026-06-13T14:00:00.000Z');

function createProject(): ProjectEntity {
  return Object.assign(new ProjectEntity(), {
    id: projectId,
    name: 'Payments API',
    description: null,
    repositoryUrl: null,
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  });
}

function createMembership(): ProjectMembershipEntity {
  const project = createProject();

  return Object.assign(new ProjectMembershipEntity(), {
    id: '77c14d50-d566-4a7e-b459-2c6cd1f64a60',
    projectId,
    userId,
    role: ProjectRole.OWNER,
    addedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    project
  });
}

function createQueryBuilder(memberships: ProjectMembershipEntity[]): MembershipQueryBuilderMock {
  const queryBuilder = {
    innerJoinAndSelect: jest.fn<MembershipQueryBuilderMock, [string, string]>(),
    where: jest.fn<MembershipQueryBuilderMock, [string, Record<string, string>]>(),
    andWhere: jest.fn<MembershipQueryBuilderMock, [string, Record<string, string>?]>(),
    orderBy: jest.fn<MembershipQueryBuilderMock, [string, 'ASC' | 'DESC']>(),
    getMany: jest.fn<Promise<ProjectMembershipEntity[]>, []>(() => Promise.resolve(memberships)),
    getOne: jest.fn<Promise<ProjectMembershipEntity | null>, []>(() =>
      Promise.resolve(memberships[0] ?? null)
    )
  };

  queryBuilder.innerJoinAndSelect.mockReturnValue(queryBuilder);
  queryBuilder.where.mockReturnValue(queryBuilder);
  queryBuilder.andWhere.mockReturnValue(queryBuilder);
  queryBuilder.orderBy.mockReturnValue(queryBuilder);

  return queryBuilder;
}

describe('ProjectMembershipsRepository', () => {
  let repository: ProjectMembershipsRepository;
  let typeOrmRepository: TypeOrmMembershipRepositoryMock;
  let queryBuilder: MembershipQueryBuilderMock;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    queryBuilder = createQueryBuilder([createMembership()]);
    typeOrmRepository = {
      create: jest.fn<ProjectMembershipEntity, [Partial<ProjectMembershipEntity>]>((input) =>
        Object.assign(createMembership(), input)
      ),
      save: jest.fn<Promise<ProjectMembershipEntity>, [ProjectMembershipEntity]>((membership) =>
        Promise.resolve(membership)
      ),
      createQueryBuilder: jest.fn<MembershipQueryBuilderMock, [string]>(() => queryBuilder)
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectMembershipsRepository,
        {
          provide: getRepositoryToken(ProjectMembershipEntity),
          useValue: typeOrmRepository satisfies Partial<Repository<ProjectMembershipEntity>>
        }
      ]
    }).compile();

    repository = module.get(ProjectMembershipsRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists active project memberships for a user through projects ordered by updated time', async () => {
    await expect(repository.findActiveProjectsByUserId(userId)).resolves.toEqual([
      expect.objectContaining({ userId, projectId })
    ]);

    expect(typeOrmRepository.createQueryBuilder).toHaveBeenCalledWith('membership');
    expect(queryBuilder.innerJoinAndSelect).toHaveBeenCalledWith('membership.project', 'project');
    expect(queryBuilder.where).toHaveBeenCalledWith('membership.userId = :userId', { userId });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('project.archivedAt IS NULL');
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('project.updatedAt', 'DESC');
  });

  it('finds one active project membership by project and user without exposing archived projects', async () => {
    await expect(repository.findActiveProjectByProjectAndUser(projectId, userId)).resolves.toEqual(
      expect.objectContaining({ userId, projectId })
    );

    expect(queryBuilder.where).toHaveBeenCalledWith('membership.projectId = :projectId', {
      projectId
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('membership.userId = :userId', { userId });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('project.archivedAt IS NULL');
  });
});

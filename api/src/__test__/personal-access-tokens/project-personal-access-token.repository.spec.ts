import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { type EntityManager, type FindOneOptions, type Repository } from 'typeorm';

import { ProjectPersonalAccessTokenEntity } from '../../personal-access-tokens/entities/project-personal-access-token.entity';
import {
  type CreateProjectPersonalAccessTokenRecord,
  ProjectPersonalAccessTokenRepository
} from '../../personal-access-tokens/repositories/project-personal-access-token.repository';

type TypeOrmProjectPersonalAccessTokenRepositoryMock = {
  create: jest.Mock<ProjectPersonalAccessTokenEntity, [Partial<ProjectPersonalAccessTokenEntity>]>;
  save: jest.Mock<Promise<ProjectPersonalAccessTokenEntity>, [ProjectPersonalAccessTokenEntity]>;
  findOne: jest.Mock<
    Promise<ProjectPersonalAccessTokenEntity | null>,
    [FindOneOptions<ProjectPersonalAccessTokenEntity>]
  >;
};

const tokenId = 'a65de020-3ac3-4f9d-b3df-3cde79de0511';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const now = new Date('2026-07-04T12:00:00.000Z');

function createPersonalAccessToken(
  overrides: Partial<ProjectPersonalAccessTokenEntity> = {}
): ProjectPersonalAccessTokenEntity {
  return Object.assign(new ProjectPersonalAccessTokenEntity(), {
    id: tokenId,
    projectId,
    userId,
    name: 'local dev laptop',
    tokenHash: 'a'.repeat(64),
    tokenLastFour: 'last',
    expiresAt: new Date('2026-09-04T12:00:00.000Z'),
    lastUsedAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  });
}

function createPersonalAccessTokenRecord(
  overrides: Partial<CreateProjectPersonalAccessTokenRecord> = {}
): CreateProjectPersonalAccessTokenRecord {
  return {
    id: tokenId,
    projectId,
    userId,
    name: 'local dev laptop',
    tokenHash: 'a'.repeat(64),
    tokenLastFour: 'last',
    expiresAt: new Date('2026-09-04T12:00:00.000Z'),
    ...overrides
  };
}

function createTypeOrmRepository(): TypeOrmProjectPersonalAccessTokenRepositoryMock {
  return {
    create: jest.fn<ProjectPersonalAccessTokenEntity, [Partial<ProjectPersonalAccessTokenEntity>]>(
      (input) => createPersonalAccessToken(input)
    ),
    save: jest.fn<Promise<ProjectPersonalAccessTokenEntity>, [ProjectPersonalAccessTokenEntity]>(
      (token) => Promise.resolve(token)
    ),
    findOne: jest.fn<
      Promise<ProjectPersonalAccessTokenEntity | null>,
      [FindOneOptions<ProjectPersonalAccessTokenEntity>]
    >(() => Promise.resolve(null))
  };
}

describe('ProjectPersonalAccessTokenRepository', () => {
  let repository: ProjectPersonalAccessTokenRepository;
  let typeOrmRepository: TypeOrmProjectPersonalAccessTokenRepositoryMock;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    typeOrmRepository = createTypeOrmRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectPersonalAccessTokenRepository,
        {
          provide: getRepositoryToken(ProjectPersonalAccessTokenEntity),
          useValue: typeOrmRepository satisfies Partial<
            Repository<ProjectPersonalAccessTokenEntity>
          >
        }
      ]
    }).compile();

    repository = module.get(ProjectPersonalAccessTokenRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates PAT records as unrevoked and unused', async () => {
    const input = createPersonalAccessTokenRecord();

    await expect(repository.create(input)).resolves.toMatchObject({
      id: tokenId,
      projectId,
      userId,
      lastUsedAt: null,
      revokedAt: null
    });

    expect(typeOrmRepository.create).toHaveBeenCalledWith({
      ...input,
      lastUsedAt: null,
      revokedAt: null
    });
    expect(typeOrmRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: tokenId }));
  });

  it('uses manager.getRepository when an EntityManager is supplied', async () => {
    const managerRepository = createTypeOrmRepository();
    const getRepository = jest.fn<
      Repository<ProjectPersonalAccessTokenEntity>,
      [typeof ProjectPersonalAccessTokenEntity]
    >(() => managerRepository as unknown as Repository<ProjectPersonalAccessTokenEntity>);
    const manager = {
      getRepository
    } as unknown as EntityManager;

    await repository.create(createPersonalAccessTokenRecord(), manager);

    expect(getRepository).toHaveBeenCalledWith(ProjectPersonalAccessTokenEntity);
    expect(managerRepository.create).toHaveBeenCalledTimes(1);
    expect(typeOrmRepository.create).not.toHaveBeenCalled();
  });

  it('finds unrevoked PATs by project and token id', async () => {
    await repository.findUnrevokedByProjectAndId(projectId, tokenId);

    const findOptions = typeOrmRepository.findOne.mock.calls[0]?.[0];

    expect(findOptions?.where).toMatchObject({ id: tokenId, projectId });
    expect(findOptions?.where).toHaveProperty('revokedAt');
  });

  it('saves PAT records', async () => {
    const token = createPersonalAccessToken({ revokedAt: now });

    await expect(repository.save(token)).resolves.toBe(token);

    expect(typeOrmRepository.save).toHaveBeenCalledWith(token);
  });
});

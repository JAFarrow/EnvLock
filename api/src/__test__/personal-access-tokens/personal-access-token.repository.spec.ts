import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import {
  type EntityManager,
  type FindManyOptions,
  type FindOneOptions,
  type Repository
} from 'typeorm';

import { PersonalAccessTokenEntity } from '../../personal-access-tokens/entities/personal-access-token.entity';
import {
  type CreatePersonalAccessTokenRecord,
  PersonalAccessTokenRepository
} from '../../personal-access-tokens/repositories/personal-access-token.repository';

type TypeOrmPersonalAccessTokenRepositoryMock = {
  create: jest.Mock<PersonalAccessTokenEntity, [Partial<PersonalAccessTokenEntity>]>;
  save: jest.Mock<Promise<PersonalAccessTokenEntity>, [PersonalAccessTokenEntity]>;
  findOne: jest.Mock<
    Promise<PersonalAccessTokenEntity | null>,
    [FindOneOptions<PersonalAccessTokenEntity>]
  >;
  find: jest.Mock<
    Promise<PersonalAccessTokenEntity[]>,
    [FindManyOptions<PersonalAccessTokenEntity>]
  >;
};

const tokenId = 'a65de020-3ac3-4f9d-b3df-3cde79de0511';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const now = new Date('2026-07-04T12:00:00.000Z');

function createPersonalAccessToken(
  overrides: Partial<PersonalAccessTokenEntity> = {}
): PersonalAccessTokenEntity {
  return Object.assign(new PersonalAccessTokenEntity(), {
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
  overrides: Partial<CreatePersonalAccessTokenRecord> = {}
): CreatePersonalAccessTokenRecord {
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

function createTypeOrmRepository(): TypeOrmPersonalAccessTokenRepositoryMock {
  return {
    create: jest.fn<PersonalAccessTokenEntity, [Partial<PersonalAccessTokenEntity>]>((input) =>
      createPersonalAccessToken(input)
    ),
    save: jest.fn<Promise<PersonalAccessTokenEntity>, [PersonalAccessTokenEntity]>((token) =>
      Promise.resolve(token)
    ),
    findOne: jest.fn<
      Promise<PersonalAccessTokenEntity | null>,
      [FindOneOptions<PersonalAccessTokenEntity>]
    >(() => Promise.resolve(null)),
    find: jest.fn<
      Promise<PersonalAccessTokenEntity[]>,
      [FindManyOptions<PersonalAccessTokenEntity>]
    >(() => Promise.resolve([]))
  };
}

describe('PersonalAccessTokenRepository', () => {
  let repository: PersonalAccessTokenRepository;
  let typeOrmRepository: TypeOrmPersonalAccessTokenRepositoryMock;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    typeOrmRepository = createTypeOrmRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalAccessTokenRepository,
        {
          provide: getRepositoryToken(PersonalAccessTokenEntity),
          useValue: typeOrmRepository satisfies Partial<Repository<PersonalAccessTokenEntity>>
        }
      ]
    }).compile();

    repository = module.get(PersonalAccessTokenRepository);
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
      Repository<PersonalAccessTokenEntity>,
      [typeof PersonalAccessTokenEntity]
    >(() => managerRepository as unknown as Repository<PersonalAccessTokenEntity>);
    const manager = {
      getRepository
    } as unknown as EntityManager;

    await repository.create(createPersonalAccessTokenRecord(), manager);

    expect(getRepository).toHaveBeenCalledWith(PersonalAccessTokenEntity);
    expect(managerRepository.create).toHaveBeenCalledTimes(1);
    expect(typeOrmRepository.create).not.toHaveBeenCalled();
  });

  it('finds unrevoked PATs by project and token id', async () => {
    await repository.findUnrevokedByProjectAndId(projectId, tokenId);

    const findOptions = typeOrmRepository.findOne.mock.calls[0]?.[0];

    expect(findOptions?.where).toMatchObject({ id: tokenId, projectId });
    expect(findOptions?.where).toHaveProperty('revokedAt');
  });

  it('finds active PATs by token id and hash', async () => {
    await repository.findActiveByIdAndHash(tokenId, 'a'.repeat(64));

    const findOptions = typeOrmRepository.findOne.mock.calls[0]?.[0];

    expect(findOptions?.where).toMatchObject({ id: tokenId, tokenHash: 'a'.repeat(64) });
    expect(findOptions?.where).toHaveProperty('revokedAt');
    expect(findOptions?.where).toHaveProperty('expiresAt');
  });

  it('finds unrevoked PATs by project with users', async () => {
    await repository.findUnrevokedByProjectId(projectId);

    const findOptions = typeOrmRepository.find.mock.calls[0]?.[0];

    expect(findOptions?.where).toMatchObject({ projectId });
    expect(findOptions?.where).toHaveProperty('revokedAt');
    expect(findOptions?.relations).toEqual({ user: true });
    expect(findOptions?.order).toEqual({ createdAt: 'DESC' });
  });

  it('finds unrevoked PATs by project and user with users', async () => {
    await repository.findUnrevokedByProjectAndUserId(projectId, userId);

    const findOptions = typeOrmRepository.find.mock.calls[0]?.[0];

    expect(findOptions?.where).toMatchObject({ projectId, userId });
    expect(findOptions?.where).toHaveProperty('revokedAt');
    expect(findOptions?.relations).toEqual({ user: true });
    expect(findOptions?.order).toEqual({ createdAt: 'DESC' });
  });

  it('saves PAT records', async () => {
    const token = createPersonalAccessToken({ revokedAt: now });

    await expect(repository.save(token)).resolves.toBe(token);

    expect(typeOrmRepository.save).toHaveBeenCalledWith(token);
  });
});

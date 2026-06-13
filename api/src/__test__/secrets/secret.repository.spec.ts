import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import {
  type EntityManager,
  type FindManyOptions,
  type FindOneOptions,
  type Repository
} from 'typeorm';

import { SecretEntity } from '../../secrets/entities/secret.entity';
import {
  type CreateSecretRecord,
  SecretRepository
} from '../../secrets/repositories/secret.repository';

type TypeOrmSecretRepositoryMock = {
  create: jest.Mock<SecretEntity, [Partial<SecretEntity>]>;
  save: jest.Mock<Promise<SecretEntity>, [SecretEntity]>;
  findOne: jest.Mock<Promise<SecretEntity | null>, [FindOneOptions<SecretEntity>]>;
  find: jest.Mock<Promise<SecretEntity[]>, [FindManyOptions<SecretEntity>?]>;
};

const secretId = '1f2e3d4c-5b6a-4789-9012-3456789abcde';
const environmentId = '9abc8def-7654-4321-9abc-def012345678';
const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const now = new Date('2026-06-13T14:00:00.000Z');

function createSecret(overrides: Partial<SecretEntity> = {}): SecretEntity {
  return Object.assign(new SecretEntity(), {
    id: secretId,
    environmentId,
    key: 'DATABASE_URL',
    encryptedValue: Buffer.from('ciphertext'),
    initializationVector: Buffer.alloc(12, 1),
    authenticationTag: Buffer.alloc(16, 2),
    encryptionKeyVersion: 1,
    encryptionFormatVersion: 1,
    createdByUserId: userId,
    updatedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    ...overrides
  });
}

function createSecretRecord(overrides: Partial<CreateSecretRecord> = {}): CreateSecretRecord {
  return {
    id: secretId,
    environmentId,
    key: 'DATABASE_URL',
    encryptedValue: Buffer.from('ciphertext'),
    initializationVector: Buffer.alloc(12, 1),
    authenticationTag: Buffer.alloc(16, 2),
    encryptionKeyVersion: 1,
    encryptionFormatVersion: 1,
    createdByUserId: userId,
    updatedByUserId: userId,
    ...overrides
  };
}

function createTypeOrmRepository(): TypeOrmSecretRepositoryMock {
  return {
    create: jest.fn<SecretEntity, [Partial<SecretEntity>]>((input) => createSecret(input)),
    save: jest.fn<Promise<SecretEntity>, [SecretEntity]>((secret) => Promise.resolve(secret)),
    findOne: jest.fn<Promise<SecretEntity | null>, [FindOneOptions<SecretEntity>]>(() =>
      Promise.resolve(null)
    ),
    find: jest.fn<Promise<SecretEntity[]>, [FindManyOptions<SecretEntity>?]>(() =>
      Promise.resolve([])
    )
  };
}

describe('SecretRepository', () => {
  let secretRepository: SecretRepository;
  let typeOrmRepository: TypeOrmSecretRepositoryMock;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    typeOrmRepository = createTypeOrmRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecretRepository,
        {
          provide: getRepositoryToken(SecretEntity),
          useValue: typeOrmRepository satisfies Partial<Repository<SecretEntity>>
        }
      ]
    }).compile();

    secretRepository = module.get(SecretRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the default repository without an EntityManager', async () => {
    const input = createSecretRecord();

    await expect(secretRepository.create(input)).resolves.toMatchObject({
      id: secretId,
      environmentId,
      key: 'DATABASE_URL',
      archivedAt: null
    });

    expect(typeOrmRepository.create).toHaveBeenCalledWith({ ...input, archivedAt: null });
    expect(typeOrmRepository.save).toHaveBeenCalledWith(expect.objectContaining({ id: secretId }));
  });

  it('uses manager.getRepository when an EntityManager is supplied', async () => {
    const managerRepository = createTypeOrmRepository();
    const getRepository = jest.fn<Repository<SecretEntity>, [typeof SecretEntity]>(
      () => managerRepository as unknown as Repository<SecretEntity>
    );
    const manager = {
      getRepository
    } as unknown as EntityManager;

    await secretRepository.create(createSecretRecord(), manager);

    expect(getRepository).toHaveBeenCalledWith(SecretEntity);
    expect(managerRepository.create).toHaveBeenCalledTimes(1);
    expect(typeOrmRepository.create).not.toHaveBeenCalled();
  });

  it('finds active secrets by environment and secret id', async () => {
    await secretRepository.findActiveByEnvironmentAndId(environmentId, secretId);

    const findOptions = typeOrmRepository.findOne.mock.calls[0]?.[0];

    expect(findOptions?.where).toMatchObject({ id: secretId, environmentId });
    expect(findOptions?.where).toHaveProperty('archivedAt');
  });

  it('finds active secrets by environment and key', async () => {
    await secretRepository.findActiveByEnvironmentAndKey(environmentId, 'DATABASE_URL');

    const findOptions = typeOrmRepository.findOne.mock.calls[0]?.[0];

    expect(findOptions?.where).toMatchObject({ environmentId, key: 'DATABASE_URL' });
    expect(findOptions?.where).toHaveProperty('archivedAt');
  });

  it('lists metadata without selecting encrypted fields ordered by key', async () => {
    await secretRepository.listActiveMetadataByEnvironmentId(environmentId);

    const findOptions = typeOrmRepository.find.mock.calls[0]?.[0];

    expect(findOptions?.where).toMatchObject({ environmentId });
    expect(findOptions?.where).toHaveProperty('archivedAt');
    expect(findOptions?.order).toEqual({ key: 'ASC' });
    expect(findOptions?.select).not.toHaveProperty('encryptedValue');
    expect(findOptions?.select).not.toHaveProperty('initializationVector');
    expect(findOptions?.select).not.toHaveProperty('authenticationTag');
  });

  it('does not filter archived records for including-archived lookup', async () => {
    await secretRepository.findByEnvironmentAndIdIncludingArchived(environmentId, secretId);

    const findOptions = typeOrmRepository.findOne.mock.calls[0]?.[0];

    expect(findOptions?.where).toMatchObject({ id: secretId, environmentId });
    expect(findOptions?.where).not.toHaveProperty('archivedAt');
  });
});

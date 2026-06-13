import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, type Repository } from 'typeorm';

import { EnvironmentEntity } from '../../environments/entities/environment.entity';
import {
  type CreateEnvironmentRecord,
  EnvironmentRepository
} from '../../environments/repositories/environment.repository';

type TypeOrmEnvironmentRepositoryMock = {
  create: jest.Mock<EnvironmentEntity, [Partial<EnvironmentEntity>]>;
  save: jest.Mock<Promise<EnvironmentEntity>, [EnvironmentEntity]>;
};

type EntityManagerMock = {
  getRepository: jest.Mock<TypeOrmEnvironmentRepositoryMock, [typeof EnvironmentEntity]>;
};

const environmentId = '7ea93715-1cc6-428d-937f-e7d8eec105dc';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const now = new Date('2026-06-13T14:00:00.000Z');

function createEnvironment(overrides: Partial<EnvironmentEntity> = {}): EnvironmentEntity {
  return Object.assign(new EnvironmentEntity(), {
    id: environmentId,
    projectId,
    name: 'Production',
    slug: 'production',
    description: 'Production environment',
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    ...overrides
  });
}

function createTypeOrmRepository(): TypeOrmEnvironmentRepositoryMock {
  return {
    create: jest.fn<EnvironmentEntity, [Partial<EnvironmentEntity>]>((input) =>
      createEnvironment(input)
    ),
    save: jest.fn<Promise<EnvironmentEntity>, [EnvironmentEntity]>((environment) =>
      Promise.resolve(environment)
    )
  };
}

describe('EnvironmentRepository', () => {
  let environmentRepository: EnvironmentRepository;
  let typeOrmRepository: TypeOrmEnvironmentRepositoryMock;
  let debugSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    typeOrmRepository = createTypeOrmRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnvironmentRepository,
        {
          provide: getRepositoryToken(EnvironmentEntity),
          useValue: typeOrmRepository satisfies Partial<Repository<EnvironmentEntity>>
        }
      ]
    }).compile();

    environmentRepository = module.get(EnvironmentRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates active environment records with nullable fields defaulted', async () => {
    await expect(
      environmentRepository.create({
        projectId,
        name: 'Development',
        slug: 'development',
        createdByUserId: userId
      })
    ).resolves.toMatchObject({
      projectId,
      name: 'Development',
      slug: 'development',
      description: null,
      createdByUserId: userId,
      archivedAt: null
    });

    expect(typeOrmRepository.create).toHaveBeenCalledWith({
      projectId,
      name: 'Development',
      slug: 'development',
      description: null,
      createdByUserId: userId,
      archivedAt: null
    });
    expect(typeOrmRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ projectId, slug: 'development' })
    );
    expect(debugSpy).toHaveBeenCalledWith('Creating environment record', {
      createdByUserId: userId,
      name: 'Development',
      projectId,
      slug: 'development'
    });
    expect(logSpy).toHaveBeenCalledWith('Environment record created', {
      environmentId,
      projectId,
      slug: 'development'
    });
  });

  it('preserves explicit descriptions when creating environments', async () => {
    const input: CreateEnvironmentRecord = {
      projectId,
      name: 'Staging',
      slug: 'staging',
      description: 'Pre-production environment',
      createdByUserId: userId
    };

    await environmentRepository.create(input);

    expect(typeOrmRepository.create).toHaveBeenCalledWith({
      projectId,
      name: 'Staging',
      slug: 'staging',
      description: 'Pre-production environment',
      createdByUserId: userId,
      archivedAt: null
    });
  });

  it('saves environment records', async () => {
    const environment = createEnvironment({ name: 'Updated Production' });

    await expect(environmentRepository.save(environment)).resolves.toBe(environment);

    expect(typeOrmRepository.save).toHaveBeenCalledWith(environment);
    expect(debugSpy).toHaveBeenCalledWith('Saving environment record', { environmentId });
    expect(logSpy).toHaveBeenCalledWith('Environment record saved', { environmentId });
  });

  it('uses an entity manager repository when provided', async () => {
    const managerRepository = createTypeOrmRepository();
    const manager: EntityManagerMock = {
      getRepository: jest.fn<TypeOrmEnvironmentRepositoryMock, [typeof EnvironmentEntity]>(() =>
        managerRepository
      )
    };

    await environmentRepository.create(
      {
        projectId,
        name: 'Production',
        slug: 'production',
        createdByUserId: userId
      },
      manager as unknown as EntityManager
    );

    expect(manager.getRepository).toHaveBeenCalledWith(EnvironmentEntity);
    expect(managerRepository.create).toHaveBeenCalledTimes(1);
    expect(managerRepository.save).toHaveBeenCalledTimes(1);
    expect(typeOrmRepository.create).not.toHaveBeenCalled();
    expect(typeOrmRepository.save).not.toHaveBeenCalled();
  });
});

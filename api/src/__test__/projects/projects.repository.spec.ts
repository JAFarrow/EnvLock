import { Logger } from '@nestjs/common';
import { type EntityManager, type Repository } from 'typeorm';

import { ProjectEntity } from '../../projects/entities/project.entity';
import {
  type CreateProjectRecord,
  ProjectsRepository
} from '../../projects/repositories/projects.repository';

type TypeOrmProjectRepositoryMock = {
  create: jest.Mock<ProjectEntity, [Partial<ProjectEntity>]>;
  save: jest.Mock<Promise<ProjectEntity>, [ProjectEntity]>;
};

const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';

function createProject(overrides: Partial<ProjectEntity> = {}): ProjectEntity {
  return Object.assign(new ProjectEntity(), {
    id: projectId,
    name: 'Payments API',
    description: null,
    repositoryUrl: null,
    createdByUserId: userId,
    archivedAt: null,
    ...overrides
  });
}

function createTypeOrmRepository(): TypeOrmProjectRepositoryMock {
  return {
    create: jest.fn<ProjectEntity, [Partial<ProjectEntity>]>((input) => createProject(input)),
    save: jest.fn<Promise<ProjectEntity>, [ProjectEntity]>((project) => Promise.resolve(project))
  };
}

describe('ProjectsRepository', () => {
  let typeOrmRepository: TypeOrmProjectRepositoryMock;
  let repository: ProjectsRepository;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    typeOrmRepository = createTypeOrmRepository();
    repository = new ProjectsRepository(typeOrmRepository as unknown as Repository<ProjectEntity>);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates active projects with nullable metadata defaults', async () => {
    const input: CreateProjectRecord = { name: 'Payments API', createdByUserId: userId };

    await expect(repository.create(input)).resolves.toMatchObject({
      description: null,
      repositoryUrl: null,
      archivedAt: null
    });
    expect(typeOrmRepository.create).toHaveBeenCalledWith({
      ...input,
      description: null,
      repositoryUrl: null,
      archivedAt: null
    });
  });

  it('uses a transaction repository and preserves optional metadata', async () => {
    const managerRepository = createTypeOrmRepository();
    const getRepository = jest.fn(() => managerRepository as unknown as Repository<ProjectEntity>);
    const manager = { getRepository } as unknown as EntityManager;
    const input: CreateProjectRecord = {
      name: 'Payments API',
      createdByUserId: userId,
      description: 'Handles payment processing',
      repositoryUrl: 'https://github.com/example/payments'
    };

    await repository.create(input, manager);

    expect(getRepository).toHaveBeenCalledWith(ProjectEntity);
    expect(managerRepository.create).toHaveBeenCalledWith({ ...input, archivedAt: null });
    expect(typeOrmRepository.create).not.toHaveBeenCalled();
  });

  it('saves projects through the selected transaction repository', async () => {
    const managerRepository = createTypeOrmRepository();
    const manager = {
      getRepository: jest.fn(() => managerRepository as unknown as Repository<ProjectEntity>)
    } as unknown as EntityManager;
    const project = createProject();

    await expect(repository.save(project, manager)).resolves.toBe(project);
    expect(managerRepository.save).toHaveBeenCalledWith(project);
    expect(typeOrmRepository.save).not.toHaveBeenCalled();
  });
});

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { EnvironmentEntity } from '../entities/environment.entity';

export interface CreateEnvironmentRecord {
  projectId: string;
  name: string;
  slug: string;
  createdByUserId: string;
  description?: string | null;
}

@Injectable()
export class EnvironmentRepository {
  private readonly logger = new Logger(EnvironmentRepository.name);

  constructor(
    @InjectRepository(EnvironmentEntity)
    private readonly repository: Repository<EnvironmentEntity>
  ) {}

  async create(
    input: CreateEnvironmentRecord,
    manager?: EntityManager
  ): Promise<EnvironmentEntity> {
    this.logger.debug('Creating environment record', {
      createdByUserId: input.createdByUserId,
      name: input.name,
      projectId: input.projectId,
      slug: input.slug
    });

    const repository = this.repositoryFor(manager);
    const environment = repository.create({
      projectId: input.projectId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      createdByUserId: input.createdByUserId,
      archivedAt: null
    });

    const savedEnvironment = await repository.save(environment);

    this.logger.log('Environment record created', {
      environmentId: savedEnvironment.id,
      projectId: savedEnvironment.projectId,
      slug: savedEnvironment.slug
    });

    return savedEnvironment;
  }

  async save(
    environment: EnvironmentEntity,
    manager?: EntityManager
  ): Promise<EnvironmentEntity> {
    this.logger.debug('Saving environment record', { environmentId: environment.id });

    const savedEnvironment = await this.repositoryFor(manager).save(environment);

    this.logger.log('Environment record saved', { environmentId: savedEnvironment.id });

    return savedEnvironment;
  }

  private repositoryFor(manager?: EntityManager): Repository<EnvironmentEntity> {
    return manager?.getRepository(EnvironmentEntity) ?? this.repository;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

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

  async create(input: CreateEnvironmentRecord): Promise<EnvironmentEntity> {
    this.logger.debug('Creating environment record', {
      createdByUserId: input.createdByUserId,
      name: input.name,
      projectId: input.projectId,
      slug: input.slug
    });

    const environment = this.repository.create({
      projectId: input.projectId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      createdByUserId: input.createdByUserId,
      archivedAt: null
    });

    const savedEnvironment = await this.repository.save(environment);

    this.logger.log('Environment record created', {
      environmentId: savedEnvironment.id,
      projectId: savedEnvironment.projectId,
      slug: savedEnvironment.slug
    });

    return savedEnvironment;
  }

  async save(environment: EnvironmentEntity): Promise<EnvironmentEntity> {
    this.logger.debug('Saving environment record', { environmentId: environment.id });

    const savedEnvironment = await this.repository.save(environment);

    this.logger.log('Environment record saved', { environmentId: savedEnvironment.id });

    return savedEnvironment;
  }

  async findActiveByProjectId(projectId: string): Promise<EnvironmentEntity[]> {
    this.logger.debug('Finding active environments by project id', { projectId });

    const environments = await this.repository.find({
      where: {
        projectId,
        archivedAt: IsNull()
      },
      order: {
        createdAt: 'ASC'
      }
    });

    this.logger.debug('Active environment lookup by project id completed', {
      count: environments.length,
      projectId
    });

    return environments;
  }

  async findActiveByProjectAndId(
    projectId: string,
    environmentId: string
  ): Promise<EnvironmentEntity | null> {
    this.logger.debug('Finding active environment by project and id', {
      environmentId,
      projectId
    });

    const environment = await this.repository.findOne({
      where: {
        id: environmentId,
        projectId,
        archivedAt: IsNull()
      }
    });

    this.logger.debug('Active environment lookup by project and id completed', {
      environmentId,
      found: environment !== null,
      projectId
    });

    return environment;
  }

  async findActiveByProjectAndSlug(
    projectId: string,
    slug: string
  ): Promise<EnvironmentEntity | null> {
    this.logger.debug('Finding active environment by project and slug', {
      projectId,
      slug
    });

    const environment = await this.repository.findOne({
      where: {
        projectId,
        slug,
        archivedAt: IsNull()
      }
    });

    this.logger.debug('Active environment lookup by project and slug completed', {
      found: environment !== null,
      projectId,
      slug
    });

    return environment;
  }
}

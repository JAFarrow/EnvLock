import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';

import { ProjectPersonalAccessTokenEntity } from '../entities/project-personal-access-token.entity';

export interface CreateProjectPersonalAccessTokenRecord {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  tokenHash: string;
  tokenLastFour: string;
  expiresAt: Date;
}

@Injectable()
export class ProjectPersonalAccessTokenRepository {
  private readonly logger = new Logger(ProjectPersonalAccessTokenRepository.name);

  constructor(
    @InjectRepository(ProjectPersonalAccessTokenEntity)
    private readonly repository: Repository<ProjectPersonalAccessTokenEntity>
  ) {}

  async create(
    input: CreateProjectPersonalAccessTokenRecord,
    manager?: EntityManager
  ): Promise<ProjectPersonalAccessTokenEntity> {
    this.logger.debug('Creating project personal access token record', {
      projectId: input.projectId,
      userId: input.userId
    });

    const repository = this.repositoryFor(manager);
    const token = repository.create({
      ...input,
      lastUsedAt: null,
      revokedAt: null
    });

    const savedToken = await repository.save(token);

    this.logger.log('Project personal access token record created', {
      projectId: savedToken.projectId,
      tokenId: savedToken.id,
      userId: savedToken.userId
    });

    return savedToken;
  }

  async findUnrevokedByProjectAndId(
    projectId: string,
    tokenId: string,
    manager?: EntityManager
  ): Promise<ProjectPersonalAccessTokenEntity | null> {
    return this.repositoryFor(manager).findOne({
      where: {
        id: tokenId,
        projectId,
        revokedAt: IsNull()
      }
    });
  }

  async save(
    token: ProjectPersonalAccessTokenEntity,
    manager?: EntityManager
  ): Promise<ProjectPersonalAccessTokenEntity> {
    this.logger.debug('Saving project personal access token record', {
      projectId: token.projectId,
      tokenId: token.id,
      userId: token.userId
    });

    const savedToken = await this.repositoryFor(manager).save(token);

    this.logger.log('Project personal access token record saved', {
      projectId: savedToken.projectId,
      tokenId: savedToken.id,
      userId: savedToken.userId
    });

    return savedToken;
  }

  private repositoryFor(manager?: EntityManager): Repository<ProjectPersonalAccessTokenEntity> {
    return manager?.getRepository(ProjectPersonalAccessTokenEntity) ?? this.repository;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, MoreThan, Repository } from 'typeorm';

import { PersonalAccessTokenEntity } from '../entities/personal-access-token.entity';

export interface CreatePersonalAccessTokenRecord {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  tokenHash: string;
  tokenLastFour: string;
  expiresAt: Date;
}

@Injectable()
export class PersonalAccessTokenRepository {
  private readonly logger = new Logger(PersonalAccessTokenRepository.name);

  constructor(
    @InjectRepository(PersonalAccessTokenEntity)
    private readonly repository: Repository<PersonalAccessTokenEntity>
  ) {}

  async create(
    input: CreatePersonalAccessTokenRecord,
    manager?: EntityManager
  ): Promise<PersonalAccessTokenEntity> {
    this.logger.debug('Creating personal access token record', {
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

    this.logger.log('Personal access token record created', {
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
  ): Promise<PersonalAccessTokenEntity | null> {
    return this.repositoryFor(manager).findOne({
      where: {
        id: tokenId,
        projectId,
        revokedAt: IsNull()
      }
    });
  }

  async findUnrevokedByProjectId(
    projectId: string,
    manager?: EntityManager
  ): Promise<PersonalAccessTokenEntity[]> {
    return this.repositoryFor(manager).find({
      where: {
        projectId,
        revokedAt: IsNull()
      },
      relations: {
        user: true
      },
      order: {
        createdAt: 'DESC'
      }
    });
  }

  async findUnrevokedByProjectAndUserId(
    projectId: string,
    userId: string,
    manager?: EntityManager
  ): Promise<PersonalAccessTokenEntity[]> {
    return this.repositoryFor(manager).find({
      where: {
        projectId,
        userId,
        revokedAt: IsNull()
      },
      relations: {
        user: true
      },
      order: {
        createdAt: 'DESC'
      }
    });
  }

  async findActiveByIdAndHash(
    tokenId: string,
    tokenHash: string,
    manager?: EntityManager
  ): Promise<PersonalAccessTokenEntity | null> {
    return this.repositoryFor(manager).findOne({
      where: {
        id: tokenId,
        tokenHash,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date())
      }
    });
  }

  async save(
    token: PersonalAccessTokenEntity,
    manager?: EntityManager
  ): Promise<PersonalAccessTokenEntity> {
    this.logger.debug('Saving personal access token record', {
      projectId: token.projectId,
      tokenId: token.id,
      userId: token.userId
    });

    const savedToken = await this.repositoryFor(manager).save(token);

    this.logger.log('Personal access token record saved', {
      projectId: savedToken.projectId,
      tokenId: savedToken.id,
      userId: savedToken.userId
    });

    return savedToken;
  }

  private repositoryFor(manager?: EntityManager): Repository<PersonalAccessTokenEntity> {
    return manager?.getRepository(PersonalAccessTokenEntity) ?? this.repository;
  }
}

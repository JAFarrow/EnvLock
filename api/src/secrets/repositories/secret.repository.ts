import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';

import { SecretEntity } from '../entities/secret.entity';

export interface CreateSecretRecord {
  id: string;
  environmentId: string;
  key: string;
  encryptedValue: Buffer;
  initializationVector: Buffer;
  authenticationTag: Buffer;
  encryptionKeyVersion: number;
  encryptionFormatVersion: number;
  createdByUserId: string;
  updatedByUserId: string;
}

export type SecretMetadata = Pick<
  SecretEntity,
  | 'id'
  | 'environmentId'
  | 'key'
  | 'encryptionKeyVersion'
  | 'encryptionFormatVersion'
  | 'createdByUserId'
  | 'updatedByUserId'
  | 'createdAt'
  | 'updatedAt'
  | 'archivedAt'
>;

@Injectable()
export class SecretRepository {
  private readonly logger = new Logger(SecretRepository.name);

  constructor(
    @InjectRepository(SecretEntity)
    private readonly repository: Repository<SecretEntity>
  ) {}

  async create(input: CreateSecretRecord, manager?: EntityManager): Promise<SecretEntity> {
    this.logger.debug('Creating secret record', {
      environmentId: input.environmentId,
      key: input.key,
      secretId: input.id
    });

    const repository = this.repositoryFor(manager);
    const secret = repository.create({
      ...input,
      archivedAt: null
    });

    const savedSecret = await repository.save(secret);

    this.logger.log('Secret record created', {
      environmentId: savedSecret.environmentId,
      key: savedSecret.key,
      secretId: savedSecret.id
    });

    return savedSecret;
  }

  async save(secret: SecretEntity, manager?: EntityManager): Promise<SecretEntity> {
    this.logger.debug('Saving secret record', {
      environmentId: secret.environmentId,
      key: secret.key,
      secretId: secret.id
    });

    const savedSecret = await this.repositoryFor(manager).save(secret);

    this.logger.log('Secret record saved', {
      environmentId: savedSecret.environmentId,
      key: savedSecret.key,
      secretId: savedSecret.id
    });

    return savedSecret;
  }

  async findActiveByEnvironmentAndId(
    environmentId: string,
    secretId: string,
    manager?: EntityManager
  ): Promise<SecretEntity | null> {
    return this.repositoryFor(manager).findOne({
      where: {
        id: secretId,
        environmentId,
        archivedAt: IsNull()
      }
    });
  }

  async findActiveByEnvironmentAndKey(
    environmentId: string,
    key: string,
    manager?: EntityManager
  ): Promise<SecretEntity | null> {
    return this.repositoryFor(manager).findOne({
      where: {
        environmentId,
        key,
        archivedAt: IsNull()
      }
    });
  }

  async findByEnvironmentAndIdIncludingArchived(
    environmentId: string,
    secretId: string,
    manager?: EntityManager
  ): Promise<SecretEntity | null> {
    return this.repositoryFor(manager).findOne({
      where: {
        id: secretId,
        environmentId
      }
    });
  }

  async listActiveMetadataByEnvironmentId(
    environmentId: string,
    manager?: EntityManager
  ): Promise<SecretMetadata[]> {
    return this.repositoryFor(manager).find({
      select: {
        id: true,
        environmentId: true,
        key: true,
        encryptionKeyVersion: true,
        encryptionFormatVersion: true,
        createdByUserId: true,
        updatedByUserId: true,
        createdAt: true,
        updatedAt: true,
        archivedAt: true
      },
      where: {
        environmentId,
        archivedAt: IsNull()
      },
      order: {
        key: 'ASC'
      }
    });
  }

  private repositoryFor(manager?: EntityManager): Repository<SecretEntity> {
    return manager?.getRepository(SecretEntity) ?? this.repository;
  }
}

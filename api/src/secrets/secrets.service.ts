import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AuditEventsService } from '../audit-events/audit-events.service';
import { type EnvironmentEntity } from '../environments/entities/environment.entity';
import { EnvironmentRepository } from '../environments/repositories/environment.repository';
import { type AuthenticatedPersonalAccessToken } from '../auth/contracts/personal-access-token-request';
import { ProjectAccessService } from '../projects/project-access.service';
import { getDefinedFieldNames } from '../utils/get-defined-field-names';
import { type CliSecretKeysResponseDto } from './contracts/cli-secret-keys.response.dto';
import { type CliSecretValuesResponseDto } from './contracts/cli-secret-values.response.dto';
import { type CreateSecretDto } from './contracts/create-secret.dto';
import { type UpdateSecretDto } from './contracts/update-secret.dto';
import { type SecretListResponseDto } from './contracts/secret-list.response.dto';
import { type SecretResponseDto, toSecretResponse } from './contracts/secret.response.dto';
import { SecretEncryptionService } from './encryption/secret-encryption.service';
import { SecretEntity } from './entities/secret.entity';
import { SecretRepository } from './repositories/secret.repository';

@Injectable()
export class SecretsService {
  constructor(
    private readonly secretRepository: SecretRepository,
    private readonly secretEncryptionService: SecretEncryptionService,
    private readonly projectAccessService: ProjectAccessService,
    private readonly environmentRepository: EnvironmentRepository,
    private readonly auditEventsService?: AuditEventsService
  ) {}

  async create(
    actorUserId: string,
    projectId: string,
    environmentId: string,
    input: CreateSecretDto
  ): Promise<SecretResponseDto> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      actorUserId,
      projectId
    );
    this.projectAccessService.assertEnvironmentManager(membership);
    const environment = await this.assertActiveEnvironmentInProject(projectId, environmentId);

    const secretId = randomUUID();
    const encryptedPayload = this.encryptSecret(input.value, secretId, environmentId);

    const secret = await this.secretRepository.create({
      id: secretId,
      environmentId,
      key: input.key,
      ...encryptedPayload,
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId
    });

    await this.auditEventsService?.record({
      projectId,
      environmentId,
      actorUserId,
      action: 'secret.created',
      targetType: 'secret',
      targetId: secret.id,
      details: {
        environmentName: environment.name,
        fields: ['key', 'value'],
        secretKey: secret.key
      }
    });

    return toSecretResponse(secret);
  }

  async findAll(
    actorUserId: string,
    projectId: string,
    environmentId: string
  ): Promise<SecretListResponseDto> {
    await this.projectAccessService.findAccessibleActiveMembership(actorUserId, projectId);
    await this.assertActiveEnvironmentInProject(projectId, environmentId);

    const secrets = await this.secretRepository.listActiveMetadataByEnvironmentId(environmentId);

    return {
      items: secrets.map(toSecretResponse)
    };
  }

  async findCliValues(
    personalAccessToken: AuthenticatedPersonalAccessToken,
    environmentSlug: string
  ): Promise<CliSecretValuesResponseDto> {
    const environment = await this.environmentRepository.findActiveByProjectAndSlug(
      personalAccessToken.projectId,
      environmentSlug
    );

    if (environment === null) {
      throw new NotFoundException('Environment not found');
    }

    const secrets = await this.secretRepository.listActiveByEnvironmentId(environment.id);
    const variables: Record<string, string> = {};

    for (const secret of secrets) {
      variables[secret.key] = this.decryptSecret(secret);
    }

    await this.auditEventsService?.record({
      projectId: personalAccessToken.projectId,
      environmentId: environment.id,
      actorUserId: personalAccessToken.userId,
      action: 'secret.values_read',
      targetType: 'environment',
      targetId: environment.id,
      details: {
        environmentName: environment.name,
        environmentSlug,
        patId: personalAccessToken.id,
        secretCount: secrets.length
      }
    });

    return {
      projectId: personalAccessToken.projectId,
      environmentId: environment.id,
      environment: environment.slug,
      variables
    };
  }

  async findCliKeys(
    personalAccessToken: AuthenticatedPersonalAccessToken,
    environmentSlug: string
  ): Promise<CliSecretKeysResponseDto> {
    const environment = await this.environmentRepository.findActiveByProjectAndSlug(
      personalAccessToken.projectId,
      environmentSlug
    );

    if (environment === null) {
      throw new NotFoundException('Environment not found');
    }

    const secrets = await this.secretRepository.listActiveMetadataByEnvironmentId(environment.id);

    return {
      projectId: personalAccessToken.projectId,
      environmentId: environment.id,
      environment: environment.slug,
      keys: secrets.map((secret) => secret.key)
    };
  }

  async update(
    actorUserId: string,
    projectId: string,
    environmentId: string,
    secretId: string,
    input: UpdateSecretDto
  ): Promise<SecretResponseDto> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      actorUserId,
      projectId
    );
    this.projectAccessService.assertEnvironmentManager(membership);
    const environment = await this.assertActiveEnvironmentInProject(projectId, environmentId);

    const secret = await this.findActiveSecret(environmentId, secretId);

    if (input.key !== undefined) {
      secret.key = input.key;
    }

    if (input.value !== undefined) {
      const encryptedPayload = this.encryptSecret(input.value, secret.id, secret.environmentId);

      secret.encryptedValue = encryptedPayload.encryptedValue;
      secret.initializationVector = encryptedPayload.initializationVector;
      secret.authenticationTag = encryptedPayload.authenticationTag;
      secret.encryptionKeyVersion = encryptedPayload.encryptionKeyVersion;
      secret.encryptionFormatVersion = encryptedPayload.encryptionFormatVersion;
    }

    secret.updatedByUserId = actorUserId;

    const savedSecret = await this.secretRepository.save(secret);

    await this.auditEventsService?.record({
      projectId,
      environmentId,
      actorUserId,
      action: 'secret.updated',
      targetType: 'secret',
      targetId: savedSecret.id,
      details: {
        environmentName: environment.name,
        changedFields: getDefinedFieldNames(input),
        secretKey: savedSecret.key
      }
    });

    return toSecretResponse(savedSecret);
  }

  async archive(
    actorUserId: string,
    projectId: string,
    environmentId: string,
    secretId: string
  ): Promise<void> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      actorUserId,
      projectId
    );
    this.projectAccessService.assertEnvironmentManager(membership);
    const environment = await this.assertActiveEnvironmentInProject(projectId, environmentId);

    const secret = await this.findActiveSecret(environmentId, secretId);
    secret.archivedAt = new Date();
    secret.updatedByUserId = actorUserId;

    await this.secretRepository.save(secret);

    await this.auditEventsService?.record({
      projectId,
      environmentId,
      actorUserId,
      action: 'secret.archived',
      targetType: 'secret',
      targetId: secret.id,
      details: {
        environmentName: environment.name,
        secretKey: secret.key
      }
    });
  }

  private async assertActiveEnvironmentInProject(
    projectId: string,
    environmentId: string
  ): Promise<EnvironmentEntity> {
    const environment = await this.environmentRepository.findActiveByProjectAndId(
      projectId,
      environmentId
    );

    if (environment === null) {
      throw new NotFoundException('Environment not found');
    }

    return environment;
  }

  private async findActiveSecret(environmentId: string, secretId: string): Promise<SecretEntity> {
    const secret = await this.secretRepository.findActiveByEnvironmentAndId(
      environmentId,
      secretId
    );

    if (secret === null) {
      throw new NotFoundException('Secret not found');
    }

    return secret;
  }

  private encryptSecret(plaintext: string, secretId: string, environmentId: string) {
    try {
      return this.secretEncryptionService.encrypt(plaintext, { secretId, environmentId });
    } catch {
      throw new InternalServerErrorException('Unable to process secret');
    }
  }

  private decryptSecret(secret: SecretEntity): string {
    try {
      return this.secretEncryptionService.decrypt(
        {
          encryptedValue: secret.encryptedValue,
          initializationVector: secret.initializationVector,
          authenticationTag: secret.authenticationTag,
          encryptionKeyVersion: secret.encryptionKeyVersion,
          encryptionFormatVersion: secret.encryptionFormatVersion
        },
        { secretId: secret.id, environmentId: secret.environmentId }
      );
    } catch {
      throw new InternalServerErrorException('Unable to process secret');
    }
  }
}

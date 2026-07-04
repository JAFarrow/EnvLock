import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';

import { EnvironmentEntity } from '../../environments/entities/environment.entity';
import { EnvironmentRepository } from '../../environments/repositories/environment.repository';
import { ProjectMembershipEntity } from '../../projects/entities/project-membership.entity';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { ProjectEntity } from '../../projects/entities/project.entity';
import { ProjectAccessService } from '../../projects/project-access.service';
import { ProjectMembershipsRepository } from '../../projects/repositories/project-memberships.repository';
import { SecretEncryptionService } from '../../secrets/encryption/secret-encryption.service';
import { type EncryptedSecretPayload } from '../../secrets/encryption/secret-encryption.types';
import { SecretEntity } from '../../secrets/entities/secret.entity';
import {
  type CreateSecretRecord,
  type SecretMetadata,
  SecretRepository
} from '../../secrets/repositories/secret.repository';
import { SecretsService } from '../../secrets/secrets.service';

type ProjectMembershipsRepositoryMock = {
  findActiveProjectByProjectAndUser: jest.Mock<
    Promise<ProjectMembershipEntity | null>,
    [string, string]
  >;
};

type EnvironmentRepositoryMock = {
  findActiveByProjectAndId: jest.Mock<Promise<EnvironmentEntity | null>, [string, string]>;
  findActiveByProjectAndSlug: jest.Mock<Promise<EnvironmentEntity | null>, [string, string]>;
};

type SecretRepositoryMock = {
  create: jest.Mock<Promise<SecretEntity>, [CreateSecretRecord]>;
  save: jest.Mock<Promise<SecretEntity>, [SecretEntity]>;
  findActiveByEnvironmentAndId: jest.Mock<Promise<SecretEntity | null>, [string, string]>;
  listActiveMetadataByEnvironmentId: jest.Mock<Promise<SecretMetadata[]>, [string]>;
  listActiveByEnvironmentId: jest.Mock<Promise<SecretEntity[]>, [string]>;
};

type SecretEncryptionServiceMock = {
  encrypt: jest.Mock<EncryptedSecretPayload, [string, { secretId: string; environmentId: string }]>;
  decrypt: jest.Mock<string, [EncryptedSecretPayload, { secretId: string; environmentId: string }]>;
};

const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const otherUserId = '0a8d4a1f-d93d-4a6d-9ec4-6c2d688f0c79';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const otherProjectId = 'c348bb1d-d0bc-46ea-a3f8-fac78dacb3f4';
const environmentId = '7ea93715-1cc6-428d-937f-e7d8eec105dc';
const otherEnvironmentId = 'b1d64158-7193-40c4-b92c-cad95e23f9f2';
const secretId = '1f2e3d4c-5b6a-4789-9012-3456789abcde';
const plaintext = 'postgresql://example';
const now = new Date('2026-06-13T14:00:00.000Z');

function createProject(overrides: Partial<ProjectEntity> = {}): ProjectEntity {
  return Object.assign(new ProjectEntity(), {
    id: projectId,
    name: 'Payments API',
    description: 'Backend payment service',
    repositoryUrl: 'https://github.com/example/payments-api',
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    ...overrides
  });
}

function createMembership(
  overrides: Partial<ProjectMembershipEntity> = {}
): ProjectMembershipEntity {
  const project = overrides.project ?? createProject();

  return Object.assign(new ProjectMembershipEntity(), {
    id: '77c14d50-d566-4a7e-b459-2c6cd1f64a60',
    projectId: project.id,
    userId,
    role: ProjectRole.OWNER,
    addedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    project,
    ...overrides
  });
}

function createEnvironment(overrides: Partial<EnvironmentEntity> = {}): EnvironmentEntity {
  return Object.assign(new EnvironmentEntity(), {
    id: environmentId,
    projectId,
    name: 'Production',
    slug: 'production',
    description: 'Production deployment environment',
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    ...overrides
  });
}

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

function createEncryptedPayload(
  overrides: Partial<EncryptedSecretPayload> = {}
): EncryptedSecretPayload {
  return {
    encryptedValue: Buffer.from('new-ciphertext'),
    initializationVector: Buffer.alloc(12, 3),
    authenticationTag: Buffer.alloc(16, 4),
    encryptionKeyVersion: 2,
    encryptionFormatVersion: 1,
    ...overrides
  };
}

describe('SecretsService', () => {
  let secretsService: SecretsService;
  let projectMembershipsRepository: ProjectMembershipsRepositoryMock;
  let environmentRepository: EnvironmentRepositoryMock;
  let secretRepository: SecretRepositoryMock;
  let secretEncryptionService: SecretEncryptionServiceMock;

  beforeEach(() => {
    projectMembershipsRepository = {
      findActiveProjectByProjectAndUser: jest.fn<
        Promise<ProjectMembershipEntity | null>,
        [string, string]
      >(() => Promise.resolve(createMembership()))
    };
    environmentRepository = {
      findActiveByProjectAndId: jest.fn<Promise<EnvironmentEntity | null>, [string, string]>(() =>
        Promise.resolve(createEnvironment())
      ),
      findActiveByProjectAndSlug: jest.fn<Promise<EnvironmentEntity | null>, [string, string]>(() =>
        Promise.resolve(createEnvironment())
      )
    };
    secretRepository = {
      create: jest.fn<Promise<SecretEntity>, [CreateSecretRecord]>((input) =>
        Promise.resolve(createSecret(input))
      ),
      save: jest.fn<Promise<SecretEntity>, [SecretEntity]>((secret) => Promise.resolve(secret)),
      findActiveByEnvironmentAndId: jest.fn<Promise<SecretEntity | null>, [string, string]>(() =>
        Promise.resolve(createSecret())
      ),
      listActiveMetadataByEnvironmentId: jest.fn<Promise<SecretMetadata[]>, [string]>(() =>
        Promise.resolve([createSecret()])
      ),
      listActiveByEnvironmentId: jest.fn<Promise<SecretEntity[]>, [string]>(() =>
        Promise.resolve([createSecret()])
      )
    };
    secretEncryptionService = {
      encrypt: jest.fn<
        EncryptedSecretPayload,
        [string, { secretId: string; environmentId: string }]
      >(() => createEncryptedPayload()),
      decrypt: jest.fn<
        string,
        [EncryptedSecretPayload, { secretId: string; environmentId: string }]
      >(() => plaintext)
    };

    secretsService = new SecretsService(
      secretRepository as unknown as SecretRepository,
      secretEncryptionService as unknown as SecretEncryptionService,
      new ProjectAccessService(
        projectMembershipsRepository as unknown as ProjectMembershipsRepository
      ),
      environmentRepository as unknown as EnvironmentRepository
    );
  });

  it('allows an owner to create a secret', async () => {
    await expect(
      secretsService.create(userId, projectId, environmentId, {
        key: 'DATABASE_URL',
        value: plaintext
      })
    ).resolves.toEqual({
      id: expect.any(String) as string,
      environmentId,
      key: 'DATABASE_URL',
      createdAt: '2026-06-13T14:00:00.000Z',
      updatedAt: '2026-06-13T14:00:00.000Z'
    });

    expect(secretRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentId,
        key: 'DATABASE_URL',
        createdByUserId: userId,
        updatedByUserId: userId,
        encryptedValue: Buffer.from('new-ciphertext')
      })
    );
  });

  it('allows a maintainer to create a secret', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.MAINTAINER })
    );

    await expect(
      secretsService.create(userId, projectId, environmentId, {
        key: 'DATABASE_URL',
        value: plaintext
      })
    ).resolves.toMatchObject({ key: 'DATABASE_URL' });
  });

  it('returns 403 when a non-owner or maintainer member creates a secret', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.DEVELOPER })
    );

    await expect(
      secretsService.create(userId, projectId, environmentId, {
        key: 'DATABASE_URL',
        value: plaintext
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(secretRepository.create).not.toHaveBeenCalled();
  });

  it('returns 404 when a non-member creates a secret', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(null);

    await expect(
      secretsService.create(otherUserId, projectId, environmentId, {
        key: 'DATABASE_URL',
        value: plaintext
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires the environment to belong to the project', async () => {
    environmentRepository.findActiveByProjectAndId.mockResolvedValueOnce(null);

    await expect(
      secretsService.create(userId, otherProjectId, environmentId, {
        key: 'DATABASE_URL',
        value: plaintext
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(secretRepository.create).not.toHaveBeenCalled();
  });

  it('generates the secret id before encryption and uses it for persistence', async () => {
    await secretsService.create(userId, projectId, environmentId, {
      key: 'DATABASE_URL',
      value: plaintext
    });

    const encryptedContext = secretEncryptionService.encrypt.mock.calls[0]?.[1];
    const createdRecord = secretRepository.create.mock.calls[0]?.[0];

    expect(encryptedContext?.secretId).toBeDefined();
    expect(createdRecord?.id).toBe(encryptedContext?.secretId);
    expect(secretEncryptionService.encrypt.mock.invocationCallOrder[0]).toBeLessThan(
      secretRepository.create.mock.invocationCallOrder[0] ?? 0
    );
  });

  it('passes the generated secret id and environment id to encryption', async () => {
    await secretsService.create(userId, projectId, environmentId, {
      key: 'DATABASE_URL',
      value: plaintext
    });

    const createdRecord = secretRepository.create.mock.calls[0]?.[0];

    expect(secretEncryptionService.encrypt).toHaveBeenCalledWith(plaintext, {
      secretId: createdRecord?.id,
      environmentId
    });
  });

  it('never passes plaintext to SecretRepository', async () => {
    await secretsService.create(userId, projectId, environmentId, {
      key: 'DATABASE_URL',
      value: plaintext
    });

    expect(secretRepository.create.mock.calls[0]?.[0]).not.toHaveProperty('value');
    expect(secretRepository.create.mock.calls[0]?.[0].encryptedValue.toString()).not.toBe(
      plaintext
    );
  });

  it('allows a project member to list metadata', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.DEVELOPER })
    );

    await expect(secretsService.findAll(userId, projectId, environmentId)).resolves.toEqual({
      items: [
        {
          id: secretId,
          environmentId,
          key: 'DATABASE_URL',
          createdAt: '2026-06-13T14:00:00.000Z',
          updatedAt: '2026-06-13T14:00:00.000Z'
        }
      ]
    });

    expect(secretRepository.listActiveMetadataByEnvironmentId).toHaveBeenCalledWith(environmentId);
  });

  it('returns an empty metadata list when no active secrets exist', async () => {
    secretRepository.listActiveMetadataByEnvironmentId.mockResolvedValueOnce([]);

    await expect(secretsService.findAll(userId, projectId, environmentId)).resolves.toEqual({
      items: []
    });
  });

  it('does not decrypt or return encrypted fields while listing', async () => {
    const response = await secretsService.findAll(userId, projectId, environmentId);

    expect(secretEncryptionService.decrypt).not.toHaveBeenCalled();
    expect(response.items[0]).not.toHaveProperty('encryptedValue');
    expect(response.items[0]).not.toHaveProperty('initializationVector');
    expect(response.items[0]).not.toHaveProperty('authenticationTag');
    expect(response.items[0]).not.toHaveProperty('encryptionKeyVersion');
    expect(response.items[0]).not.toHaveProperty('encryptionFormatVersion');
  });

  it('returns decrypted secret values for CLI requests authenticated by project PAT', async () => {
    await expect(
      secretsService.findCliValues({ id: 'pat-id', projectId, userId }, 'production')
    ).resolves.toEqual({
      projectId,
      environmentId,
      environment: 'production',
      variables: {
        DATABASE_URL: plaintext
      }
    });

    expect(environmentRepository.findActiveByProjectAndSlug).toHaveBeenCalledWith(
      projectId,
      'production'
    );
    expect(secretRepository.listActiveByEnvironmentId).toHaveBeenCalledWith(environmentId);
    expect(secretEncryptionService.decrypt).toHaveBeenCalledWith(
      expect.objectContaining({ encryptedValue: Buffer.from('ciphertext') }),
      { secretId, environmentId }
    );
  });

  it('returns an empty CLI variables object when no active secrets exist', async () => {
    secretRepository.listActiveByEnvironmentId.mockResolvedValueOnce([]);

    await expect(
      secretsService.findCliValues({ id: 'pat-id', projectId, userId }, 'production')
    ).resolves.toMatchObject({ variables: {} });
  });

  it('returns 404 for missing CLI environments', async () => {
    environmentRepository.findActiveByProjectAndSlug.mockResolvedValueOnce(null);

    await expect(
      secretsService.findCliValues({ id: 'pat-id', projectId, userId }, 'missing')
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(secretRepository.listActiveByEnvironmentId).not.toHaveBeenCalled();
  });

  it('does not expose plaintext when CLI decryption fails', async () => {
    secretEncryptionService.decrypt.mockImplementationOnce(() => {
      throw new Error(`decryption failed for ${plaintext}`);
    });

    try {
      await secretsService.findCliValues({ id: 'pat-id', projectId, userId }, 'production');
      throw new Error('Expected findCliValues to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect((error as Error).message).not.toContain(plaintext);
    }
  });

  it('allows an owner to rename a secret without re-encryption', async () => {
    const secret = createSecret();
    secretRepository.findActiveByEnvironmentAndId.mockResolvedValueOnce(secret);

    await expect(
      secretsService.update(userId, projectId, environmentId, secretId, {
        key: 'PRIMARY_DATABASE_URL'
      })
    ).resolves.toMatchObject({ key: 'PRIMARY_DATABASE_URL' });

    expect(secretEncryptionService.encrypt).not.toHaveBeenCalled();
    expect(secret.key).toBe('PRIMARY_DATABASE_URL');
    expect(secretRepository.save).toHaveBeenCalledWith(secret);
  });

  it('allows a maintainer to update a secret', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.MAINTAINER })
    );

    await expect(
      secretsService.update(userId, projectId, environmentId, secretId, {
        key: 'PRIMARY_DATABASE_URL'
      })
    ).resolves.toMatchObject({ key: 'PRIMARY_DATABASE_URL' });
  });

  it('returns 403 when a developer updates a secret', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.DEVELOPER })
    );

    await expect(
      secretsService.update(userId, projectId, environmentId, secretId, {
        key: 'PRIMARY_DATABASE_URL'
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(secretRepository.save).not.toHaveBeenCalled();
  });

  it('encrypts a supplied replacement value', async () => {
    const secret = createSecret();
    secretRepository.findActiveByEnvironmentAndId.mockResolvedValueOnce(secret);

    await secretsService.update(userId, projectId, environmentId, secretId, {
      value: 'postgresql://new-value'
    });

    expect(secretEncryptionService.encrypt).toHaveBeenCalledWith('postgresql://new-value', {
      secretId,
      environmentId
    });
    expect(secret.encryptedValue).toEqual(Buffer.from('new-ciphertext'));
  });

  it('encrypts empty-string replacement values rather than ignoring them', async () => {
    await secretsService.update(userId, projectId, environmentId, secretId, {
      value: ''
    });

    expect(secretEncryptionService.encrypt).toHaveBeenCalledWith('', {
      secretId,
      environmentId
    });
  });

  it('updates updatedByUserId during updates', async () => {
    const secret = createSecret({ updatedByUserId: otherUserId });
    secretRepository.findActiveByEnvironmentAndId.mockResolvedValueOnce(secret);

    await secretsService.update(userId, projectId, environmentId, secretId, {
      key: 'PRIMARY_DATABASE_URL'
    });

    expect(secret.updatedByUserId).toBe(userId);
  });

  it('allows an owner to archive a secret without deleting it', async () => {
    const secret = createSecret();
    secretRepository.findActiveByEnvironmentAndId.mockResolvedValueOnce(secret);

    await expect(
      secretsService.archive(userId, projectId, environmentId, secretId)
    ).resolves.toBeUndefined();

    expect(secret.archivedAt).toBeInstanceOf(Date);
    expect(secret.updatedByUserId).toBe(userId);
    expect(secretRepository.save).toHaveBeenCalledWith(secret);
  });

  it('allows a maintainer to archive a secret', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.MAINTAINER })
    );

    await expect(
      secretsService.archive(userId, projectId, environmentId, secretId)
    ).resolves.toBeUndefined();
  });

  it('returns 403 when a developer archives a secret', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership({ role: ProjectRole.DEVELOPER })
    );

    await expect(
      secretsService.archive(userId, projectId, environmentId, secretId)
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(secretRepository.save).not.toHaveBeenCalled();
  });

  it('does not decrypt the value while archiving', async () => {
    await secretsService.archive(userId, projectId, environmentId, secretId);

    expect(secretEncryptionService.decrypt).not.toHaveBeenCalled();
  });

  it('cannot access a secret through another environment or project', async () => {
    secretRepository.findActiveByEnvironmentAndId.mockResolvedValueOnce(null);

    await expect(
      secretsService.update(userId, projectId, otherEnvironmentId, secretId, {
        key: 'PRIMARY_DATABASE_URL'
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(secretRepository.findActiveByEnvironmentAndId).toHaveBeenCalledWith(
      otherEnvironmentId,
      secretId
    );
  });

  it('returns 404 for archived secrets through normal operations', async () => {
    secretRepository.findActiveByEnvironmentAndId.mockResolvedValueOnce(null);

    await expect(
      secretsService.archive(userId, projectId, environmentId, secretId)
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not expose plaintext when encryption fails', async () => {
    secretEncryptionService.encrypt.mockImplementationOnce(() => {
      throw new Error(`encryption failed for ${plaintext}`);
    });

    try {
      await secretsService.create(userId, projectId, environmentId, {
        key: 'DATABASE_URL',
        value: plaintext
      });
      throw new Error('Expected create to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect((error as Error).message).not.toContain(plaintext);
    }
  });
});

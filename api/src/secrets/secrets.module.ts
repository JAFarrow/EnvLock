import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigSecretEncryptionKeyProvider } from './encryption/config-secret-encryption-key.provider';
import { SecretEncryptionKeyProvider } from './encryption/secret-encryption-key.provider';
import { SecretEncryptionService } from './encryption/secret-encryption.service';
import { SecretEntity } from './persistence/entities/secret.entity';
import { SecretRepository } from './persistence/repositories/secret.repository';

@Module({
  imports: [TypeOrmModule.forFeature([SecretEntity])],
  providers: [
    SecretRepository,
    SecretEncryptionService,
    ConfigSecretEncryptionKeyProvider,
    {
      provide: SecretEncryptionKeyProvider,
      useExisting: ConfigSecretEncryptionKeyProvider
    }
  ],
  exports: [SecretRepository, SecretEncryptionService]
})
export class SecretsModule {}

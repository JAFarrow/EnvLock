import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { EnvironmentsModule } from '../environments/environments.module';
import { ProjectsModule } from '../projects/projects.module';
import { SecretsController } from './secrets.controller';
import { ConfigSecretEncryptionKeyProvider } from './encryption/config-secret-encryption-key.provider';
import { SecretEncryptionKeyProvider } from './encryption/secret-encryption-key.provider';
import { SecretEncryptionService } from './encryption/secret-encryption.service';
import { SecretEntity } from './entities/secret.entity';
import { SecretRepository } from './repositories/secret.repository';
import { SecretsService } from './secrets.service';

@Module({
  imports: [AuthModule, EnvironmentsModule, ProjectsModule, TypeOrmModule.forFeature([SecretEntity])],
  controllers: [SecretsController],
  providers: [
    SecretsService,
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

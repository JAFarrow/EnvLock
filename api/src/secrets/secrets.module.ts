import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AuthModule } from '../auth/auth.module';
import { EnvironmentsModule } from '../environments/environments.module';
import { ProjectsModule } from '../projects/projects.module';
import { CliSecretsController } from './cli-secrets.controller';
import { SecretsController } from './secrets.controller';
import { ConfigSecretEncryptionKeyProvider } from './encryption/config-secret-encryption-key.provider';
import { SecretEncryptionKeyProvider } from './encryption/secret-encryption-key.provider';
import { SecretEncryptionService } from './encryption/secret-encryption.service';
import { SecretEntity } from './entities/secret.entity';
import { SecretRepository } from './repositories/secret.repository';
import { SecretsService } from './secrets.service';

@Module({
  imports: [
    AuditEventsModule,
    AuthModule,
    EnvironmentsModule,
    ProjectsModule,
    TypeOrmModule.forFeature([SecretEntity])
  ],
  controllers: [SecretsController, CliSecretsController],
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

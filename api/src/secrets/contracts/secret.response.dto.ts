import { SecretEntity } from '../entities/secret.entity';
import { type SecretMetadata } from '../repositories/secret.repository';

export interface SecretResponseDto {
  id: string;
  environmentId: string;
  key: string;
  createdAt: string;
  updatedAt: string;
}

export function toSecretResponse(secret: SecretEntity | SecretMetadata): SecretResponseDto {
  return {
    id: secret.id,
    environmentId: secret.environmentId,
    key: secret.key,
    createdAt: secret.createdAt.toISOString(),
    updatedAt: secret.updatedAt.toISOString()
  };
}

import { type EncryptionKeyMaterial } from './secret-encryption.types';

export abstract class SecretEncryptionKeyProvider {
  abstract getActiveKey(): EncryptionKeyMaterial;

  abstract getKeyByVersion(version: number): EncryptionKeyMaterial;
}

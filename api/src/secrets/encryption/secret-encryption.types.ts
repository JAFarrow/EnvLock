export interface SecretEncryptionContext {
  secretId: string;
  environmentId: string;
}

export interface EncryptedSecretPayload {
  encryptedValue: Buffer;
  initializationVector: Buffer;
  authenticationTag: Buffer;
  encryptionKeyVersion: number;
  encryptionFormatVersion: number;
}

export interface EncryptionKeyMaterial {
  version: number;
  key: Buffer;
}

import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { SecretEncryptionKeyProvider } from './secret-encryption-key.provider';
import {
  type EncryptedSecretPayload,
  type SecretEncryptionContext
} from './secret-encryption.types';

const algorithm = 'aes-256-gcm';
const authenticationTagLength = 16;
const encryptionFormatVersion = 1;
const initializationVectorLength = 12;
const decryptionErrorMessage = 'Unable to decrypt secret';

export class SecretDecryptionError extends Error {
  constructor() {
    super(decryptionErrorMessage);
  }
}

@Injectable()
export class SecretEncryptionService {
  constructor(private readonly keyProvider: SecretEncryptionKeyProvider) {}

  encrypt(plaintext: string, context: SecretEncryptionContext): EncryptedSecretPayload {
    const keyMaterial = this.keyProvider.getActiveKey();
    const initializationVector = randomBytes(initializationVectorLength);
    const cipher = createCipheriv(algorithm, keyMaterial.key, initializationVector, {
      authTagLength: authenticationTagLength
    });

    cipher.setAAD(createAuthenticatedData(context));

    const encryptedValue = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    return {
      encryptedValue,
      initializationVector,
      authenticationTag: cipher.getAuthTag(),
      encryptionKeyVersion: keyMaterial.version,
      encryptionFormatVersion
    };
  }

  decrypt(payload: EncryptedSecretPayload, context: SecretEncryptionContext): string {
    try {
      if (payload.encryptionFormatVersion !== encryptionFormatVersion) {
        throw new SecretDecryptionError();
      }

      const keyMaterial = this.keyProvider.getKeyByVersion(payload.encryptionKeyVersion);
      const decipher = createDecipheriv(algorithm, keyMaterial.key, payload.initializationVector, {
        authTagLength: authenticationTagLength
      });

      decipher.setAAD(createAuthenticatedData(context));
      decipher.setAuthTag(payload.authenticationTag);

      return Buffer.concat([decipher.update(payload.encryptedValue), decipher.final()]).toString(
        'utf8'
      );
    } catch {
      throw new SecretDecryptionError();
    }
  }
}

function createAuthenticatedData(context: SecretEncryptionContext): Buffer {
  return Buffer.from(`envlock:secret:v1:${context.secretId}:${context.environmentId}`, 'utf8');
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { type EnvironmentVariables } from '../../config/environment';
import { SecretEncryptionKeyProvider } from './secret-encryption-key.provider';
import { type EncryptionKeyMaterial } from './secret-encryption.types';

const secretEncryptionKeyBase64Pattern =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export class UnknownSecretEncryptionKeyVersionError extends Error {
  constructor() {
    super('Unknown secret encryption key version');
  }
}

@Injectable()
export class ConfigSecretEncryptionKeyProvider extends SecretEncryptionKeyProvider {
  private readonly keyMaterial: EncryptionKeyMaterial;

  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    super();

    const keyBase64 = configService.get('SECRET_ENCRYPTION_KEY_BASE64', { infer: true });
    const version = configService.get('SECRET_ENCRYPTION_KEY_VERSION', { infer: true });

    if (!isValidBase64(keyBase64)) {
      throw new Error('Invalid secret encryption key configuration');
    }

    const key = Buffer.from(keyBase64, 'base64');

    if (key.byteLength !== 32 || !Number.isInteger(version) || version <= 0) {
      throw new Error('Invalid secret encryption key configuration');
    }

    this.keyMaterial = { version, key };
  }

  getActiveKey(): EncryptionKeyMaterial {
    return this.copyKeyMaterial(this.keyMaterial);
  }

  getKeyByVersion(version: number): EncryptionKeyMaterial {
    if (version !== this.keyMaterial.version) {
      throw new UnknownSecretEncryptionKeyVersionError();
    }

    return this.copyKeyMaterial(this.keyMaterial);
  }

  private copyKeyMaterial(keyMaterial: EncryptionKeyMaterial): EncryptionKeyMaterial {
    return {
      version: keyMaterial.version,
      key: Buffer.from(keyMaterial.key)
    };
  }
}

function isValidBase64(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length % 4 === 0 &&
    secretEncryptionKeyBase64Pattern.test(value)
  );
}

import { type ConfigService } from '@nestjs/config';

import { type EnvironmentVariables } from '../../config/environment';
import { ConfigSecretEncryptionKeyProvider } from '../../secrets/encryption/config-secret-encryption-key.provider';
import {
  SecretDecryptionError,
  SecretEncryptionService
} from '../../secrets/encryption/secret-encryption.service';
import {
  type EncryptedSecretPayload,
  type SecretEncryptionContext
} from '../../secrets/encryption/secret-encryption.types';

type ConfigServiceMock = Pick<ConfigService<EnvironmentVariables, true>, 'get'>;

const secretEncryptionKeyBase64 = Buffer.alloc(32, 7).toString('base64');
const secretEncryptionKeyVersion = 3;
const plaintext = 'super-secret-api-token';
const context: SecretEncryptionContext = {
  secretId: '1f2e3d4c-5b6a-4789-9012-3456789abcde',
  environmentId: '9abc8def-7654-4321-9abc-def012345678'
};

function createConfigService(
  overrides: Partial<Record<keyof EnvironmentVariables, unknown>> = {}
): ConfigServiceMock {
  const values: Partial<Record<keyof EnvironmentVariables, unknown>> = {
    SECRET_ENCRYPTION_KEY_BASE64: secretEncryptionKeyBase64,
    SECRET_ENCRYPTION_KEY_VERSION: secretEncryptionKeyVersion,
    ...overrides
  };

  return {
    get: jest.fn((key: keyof EnvironmentVariables) => values[key])
  } as ConfigServiceMock;
}

function createService(
  configService: ConfigServiceMock = createConfigService()
): SecretEncryptionService {
  return new SecretEncryptionService(
    new ConfigSecretEncryptionKeyProvider(
      configService as ConfigService<EnvironmentVariables, true>
    )
  );
}

function clonePayload(
  payload: EncryptedSecretPayload,
  overrides: Partial<EncryptedSecretPayload> = {}
): EncryptedSecretPayload {
  return {
    encryptedValue: Buffer.from(payload.encryptedValue),
    initializationVector: Buffer.from(payload.initializationVector),
    authenticationTag: Buffer.from(payload.authenticationTag),
    encryptionKeyVersion: payload.encryptionKeyVersion,
    encryptionFormatVersion: payload.encryptionFormatVersion,
    ...overrides
  };
}

function changeFirstByte(value: Buffer): Buffer {
  const changedValue = Buffer.from(value);
  changedValue[0] = (changedValue[0] ?? 0) ^ 1;

  return changedValue;
}

describe('SecretEncryptionService', () => {
  it('encrypts and decrypts valid plaintext', () => {
    const service = createService();
    const payload = service.encrypt(plaintext, context);

    expect(service.decrypt(payload, context)).toBe(plaintext);
    expect(payload.encryptedValue.equals(Buffer.from(plaintext, 'utf8'))).toBe(false);
  });

  it('uses a new initialization vector and ciphertext for identical plaintext', () => {
    const service = createService();
    const firstPayload = service.encrypt(plaintext, context);
    const secondPayload = service.encrypt(plaintext, context);

    expect(firstPayload.initializationVector.equals(secondPayload.initializationVector)).toBe(
      false
    );
    expect(firstPayload.encryptedValue.equals(secondPayload.encryptedValue)).toBe(false);
  });

  it('returns required cryptographic metadata', () => {
    const payload = createService().encrypt(plaintext, context);

    expect(payload.initializationVector).toHaveLength(12);
    expect(payload.authenticationTag).toHaveLength(16);
    expect(payload.encryptionKeyVersion).toBe(secretEncryptionKeyVersion);
    expect(payload.encryptionFormatVersion).toBe(1);
  });

  it('rejects modified ciphertext', () => {
    const service = createService();
    const payload = service.encrypt(plaintext, context);

    expect(() =>
      service.decrypt(
        clonePayload(payload, { encryptedValue: changeFirstByte(payload.encryptedValue) }),
        context
      )
    ).toThrow(SecretDecryptionError);
  });

  it('rejects a modified authentication tag', () => {
    const service = createService();
    const payload = service.encrypt(plaintext, context);

    expect(() =>
      service.decrypt(
        clonePayload(payload, { authenticationTag: changeFirstByte(payload.authenticationTag) }),
        context
      )
    ).toThrow(SecretDecryptionError);
  });

  it('rejects a modified initialization vector', () => {
    const service = createService();
    const payload = service.encrypt(plaintext, context);

    expect(() =>
      service.decrypt(
        clonePayload(payload, {
          initializationVector: changeFirstByte(payload.initializationVector)
        }),
        context
      )
    ).toThrow(SecretDecryptionError);
  });

  it('rejects a different secret id', () => {
    const service = createService();
    const payload = service.encrypt(plaintext, context);

    expect(() =>
      service.decrypt(payload, {
        ...context,
        secretId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
      })
    ).toThrow(SecretDecryptionError);
  });

  it('rejects a different environment id', () => {
    const service = createService();
    const payload = service.encrypt(plaintext, context);

    expect(() =>
      service.decrypt(payload, {
        ...context,
        environmentId: 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
      })
    ).toThrow(SecretDecryptionError);
  });

  it('rejects an unknown key version', () => {
    const service = createService();
    const payload = service.encrypt(plaintext, context);

    expect(() =>
      service.decrypt(clonePayload(payload, { encryptionKeyVersion: 999 }), context)
    ).toThrow(SecretDecryptionError);
  });

  it('rejects an unsupported format version', () => {
    const service = createService();
    const payload = service.encrypt(plaintext, context);

    expect(() =>
      service.decrypt(clonePayload(payload, { encryptionFormatVersion: 2 }), context)
    ).toThrow(SecretDecryptionError);
  });

  it('fails provider startup for missing or malformed configuration', () => {
    expect(
      () =>
        new ConfigSecretEncryptionKeyProvider(
          createConfigService({
            SECRET_ENCRYPTION_KEY_BASE64: undefined
          }) as ConfigService<EnvironmentVariables, true>
        )
    ).toThrow('Invalid secret encryption key configuration');
    expect(
      () =>
        new ConfigSecretEncryptionKeyProvider(
          createConfigService({
            SECRET_ENCRYPTION_KEY_BASE64: 'not-base64!'
          }) as ConfigService<EnvironmentVariables, true>
        )
    ).toThrow('Invalid secret encryption key configuration');
    expect(
      () =>
        new ConfigSecretEncryptionKeyProvider(
          createConfigService({
            SECRET_ENCRYPTION_KEY_BASE64: Buffer.alloc(31, 1).toString('base64')
          }) as ConfigService<EnvironmentVariables, true>
        )
    ).toThrow('Invalid secret encryption key configuration');
    expect(
      () =>
        new ConfigSecretEncryptionKeyProvider(
          createConfigService({
            SECRET_ENCRYPTION_KEY_VERSION: 0
          }) as ConfigService<EnvironmentVariables, true>
        )
    ).toThrow('Invalid secret encryption key configuration');
  });

  it('does not include plaintext or key material in decryption errors', () => {
    const service = createService();
    const payload = service.encrypt(plaintext, context);

    try {
      service.decrypt(
        clonePayload(payload, { encryptedValue: changeFirstByte(payload.encryptedValue) }),
        context
      );
      throw new Error('Expected decryption to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(SecretDecryptionError);
      expect((error as Error).message).not.toContain(plaintext);
      expect((error as Error).message).not.toContain(secretEncryptionKeyBase64);
    }
  });
});

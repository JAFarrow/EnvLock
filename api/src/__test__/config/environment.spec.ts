import { validateEnvironment } from '../../config/environment';

const databaseUrl = 'postgres://envlock:envlock@localhost:5432/envlock';
const jwtSecret = 'test-jwt-secret';
const secretEncryptionKeyBase64 = Buffer.alloc(32, 1).toString('base64');

function validEnvironment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    SECRET_ENCRYPTION_KEY_BASE64: secretEncryptionKeyBase64,
    SECRET_ENCRYPTION_KEY_VERSION: '1',
    ...overrides
  };
}

describe('validateEnvironment', () => {
  it('applies default values', () => {
    expect(validateEnvironment(validEnvironment())).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_FORMAT: 'pretty',
      DATABASE_URL: databaseUrl,
      JWT_SECRET: jwtSecret,
      JWT_ACCESS_TOKEN_TTL_SECONDS: 3600,
      JWT_ACCESS_TOKEN_COOKIE_NAME: 'envlock_access_token',
      SECRET_ENCRYPTION_KEY_BASE64: secretEncryptionKeyBase64,
      SECRET_ENCRYPTION_KEY_VERSION: 1
    });
  });

  it('applies production logging defaults', () => {
    expect(
      validateEnvironment(
        validEnvironment({
          NODE_ENV: 'production'
        })
      )
    ).toMatchObject({
      NODE_ENV: 'production',
      LOG_FORMAT: 'json'
    });
  });

  it('coerces supported values', () => {
    expect(
      validateEnvironment(
        validEnvironment({
          NODE_ENV: 'test',
          PORT: '4000',
          LOG_FORMAT: 'json',
          JWT_ACCESS_TOKEN_TTL_SECONDS: '7200',
          JWT_ACCESS_TOKEN_COOKIE_NAME: 'custom_access_token',
          SECRET_ENCRYPTION_KEY_VERSION: '2'
        })
      )
    ).toMatchObject({
      NODE_ENV: 'test',
      PORT: 4000,
      LOG_FORMAT: 'json',
      DATABASE_URL: databaseUrl,
      JWT_SECRET: jwtSecret,
      JWT_ACCESS_TOKEN_TTL_SECONDS: 7200,
      JWT_ACCESS_TOKEN_COOKIE_NAME: 'custom_access_token',
      SECRET_ENCRYPTION_KEY_VERSION: 2
    });
  });

  it('allows unknown environment variables', () => {
    expect(validateEnvironment(validEnvironment({ CUSTOM_ENV: 'value' })).CUSTOM_ENV).toBe('value');
  });

  it('requires a Postgres database URL', () => {
    expect(() => validateEnvironment(validEnvironment({ DATABASE_URL: undefined }))).toThrow(
      'Invalid environment configuration'
    );
    expect(() =>
      validateEnvironment(validEnvironment({ DATABASE_URL: 'mysql://localhost:3306/envlock' }))
    ).toThrow('Invalid environment configuration');
  });

  it('requires a JWT secret', () => {
    expect(() => validateEnvironment(validEnvironment({ JWT_SECRET: undefined }))).toThrow(
      'Invalid environment configuration'
    );
    expect(() => validateEnvironment(validEnvironment({ JWT_SECRET: '' }))).toThrow(
      'Invalid environment configuration'
    );
  });

  it('requires a valid 32-byte Base64 secret encryption key', () => {
    expect(() =>
      validateEnvironment(validEnvironment({ SECRET_ENCRYPTION_KEY_BASE64: undefined }))
    ).toThrow('Invalid environment configuration');
    expect(() =>
      validateEnvironment(validEnvironment({ SECRET_ENCRYPTION_KEY_BASE64: 'not-base64!' }))
    ).toThrow('Invalid environment configuration');
    expect(() =>
      validateEnvironment({
        ...validEnvironment(),
        SECRET_ENCRYPTION_KEY_BASE64: Buffer.alloc(31, 1).toString('base64')
      })
    ).toThrow('Invalid environment configuration');
  });

  it('requires a positive integer secret encryption key version', () => {
    expect(() =>
      validateEnvironment(validEnvironment({ SECRET_ENCRYPTION_KEY_VERSION: undefined }))
    ).toThrow('Invalid environment configuration');
    expect(() =>
      validateEnvironment(validEnvironment({ SECRET_ENCRYPTION_KEY_VERSION: '0' }))
    ).toThrow('Invalid environment configuration');
    expect(() =>
      validateEnvironment(validEnvironment({ SECRET_ENCRYPTION_KEY_VERSION: '1.5' }))
    ).toThrow('Invalid environment configuration');
  });

  it('rejects invalid values', () => {
    expect(() => validateEnvironment(validEnvironment({ PORT: 'invalid' }))).toThrow(
      'Invalid environment configuration'
    );
    expect(() =>
      validateEnvironment(validEnvironment({ JWT_ACCESS_TOKEN_TTL_SECONDS: '0' }))
    ).toThrow('Invalid environment configuration');
    expect(() =>
      validateEnvironment(validEnvironment({ JWT_ACCESS_TOKEN_COOKIE_NAME: '' }))
    ).toThrow('Invalid environment configuration');
  });
});

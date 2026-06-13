import { validateEnvironment } from '../../config/environment';

const databaseUrl = 'postgres://envlock:envlock@localhost:5432/envlock';
const jwtSecret = 'test-jwt-secret';

describe('validateEnvironment', () => {
  it('applies default values', () => {
    expect(validateEnvironment({ DATABASE_URL: databaseUrl, JWT_SECRET: jwtSecret })).toMatchObject(
      {
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_FORMAT: 'pretty',
        DATABASE_URL: databaseUrl,
        JWT_SECRET: jwtSecret,
        JWT_ACCESS_TOKEN_TTL_SECONDS: 3600
      }
    );
  });

  it('applies production logging defaults', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: databaseUrl,
        JWT_SECRET: jwtSecret
      })
    ).toMatchObject({
      NODE_ENV: 'production',
      LOG_FORMAT: 'json'
    });
  });

  it('coerces supported values', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'test',
        PORT: '4000',
        LOG_FORMAT: 'json',
        DATABASE_URL: databaseUrl,
        JWT_SECRET: jwtSecret,
        JWT_ACCESS_TOKEN_TTL_SECONDS: '7200'
      })
    ).toMatchObject({
      NODE_ENV: 'test',
      PORT: 4000,
      LOG_FORMAT: 'json',
      DATABASE_URL: databaseUrl,
      JWT_SECRET: jwtSecret,
      JWT_ACCESS_TOKEN_TTL_SECONDS: 7200
    });
  });

  it('allows unknown environment variables', () => {
    expect(
      validateEnvironment({ CUSTOM_ENV: 'value', DATABASE_URL: databaseUrl, JWT_SECRET: jwtSecret })
        .CUSTOM_ENV
    ).toBe('value');
  });

  it('requires a Postgres database URL', () => {
    expect(() => validateEnvironment({ JWT_SECRET: jwtSecret })).toThrow(
      'Invalid environment configuration'
    );
    expect(() =>
      validateEnvironment({ DATABASE_URL: 'mysql://localhost:3306/envlock', JWT_SECRET: jwtSecret })
    ).toThrow('Invalid environment configuration');
  });

  it('requires a JWT secret', () => {
    expect(() => validateEnvironment({ DATABASE_URL: databaseUrl })).toThrow(
      'Invalid environment configuration'
    );
    expect(() => validateEnvironment({ DATABASE_URL: databaseUrl, JWT_SECRET: '' })).toThrow(
      'Invalid environment configuration'
    );
  });

  it('rejects invalid values', () => {
    expect(() =>
      validateEnvironment({ PORT: 'invalid', DATABASE_URL: databaseUrl, JWT_SECRET: jwtSecret })
    ).toThrow('Invalid environment configuration');
    expect(() =>
      validateEnvironment({
        DATABASE_URL: databaseUrl,
        JWT_SECRET: jwtSecret,
        JWT_ACCESS_TOKEN_TTL_SECONDS: '0'
      })
    ).toThrow('Invalid environment configuration');
  });
});

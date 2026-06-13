import { validateEnvironment } from '../../config/environment';

const databaseUrl = 'postgres://envlock:envlock@localhost:5432/envlock';

describe('validateEnvironment', () => {
  it('applies default values', () => {
    expect(validateEnvironment({ DATABASE_URL: databaseUrl })).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_FORMAT: 'pretty',
      DATABASE_URL: databaseUrl
    });
  });

  it('applies production logging defaults', () => {
    expect(
      validateEnvironment({ NODE_ENV: 'production', DATABASE_URL: databaseUrl })
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
        DATABASE_URL: databaseUrl
      })
    ).toMatchObject({
      NODE_ENV: 'test',
      PORT: 4000,
      LOG_FORMAT: 'json',
      DATABASE_URL: databaseUrl
    });
  });

  it('allows unknown environment variables', () => {
    expect(validateEnvironment({ CUSTOM_ENV: 'value', DATABASE_URL: databaseUrl }).CUSTOM_ENV).toBe(
      'value'
    );
  });

  it('requires a Postgres database URL', () => {
    expect(() => validateEnvironment({})).toThrow('Invalid environment configuration');
    expect(() => validateEnvironment({ DATABASE_URL: 'mysql://localhost:3306/envlock' })).toThrow(
      'Invalid environment configuration'
    );
  });

  it('rejects invalid values', () => {
    expect(() => validateEnvironment({ PORT: 'invalid', DATABASE_URL: databaseUrl })).toThrow(
      'Invalid environment configuration'
    );
  });
});

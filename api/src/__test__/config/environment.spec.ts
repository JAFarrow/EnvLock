import { validateEnvironment } from '../../config/environment';

describe('validateEnvironment', () => {
  it('applies default values', () => {
    expect(validateEnvironment({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_FORMAT: 'pretty'
    });
  });

  it('applies production logging defaults', () => {
    expect(validateEnvironment({ NODE_ENV: 'production' })).toMatchObject({
      NODE_ENV: 'production',
      LOG_FORMAT: 'json'
    });
  });

  it('coerces supported values', () => {
    expect(
      validateEnvironment({ NODE_ENV: 'test', PORT: '4000', LOG_FORMAT: 'json' })
    ).toMatchObject({
      NODE_ENV: 'test',
      PORT: 4000,
      LOG_FORMAT: 'json'
    });
  });

  it('allows unknown environment variables', () => {
    expect(validateEnvironment({ CUSTOM_ENV: 'value' }).CUSTOM_ENV).toBe('value');
  });

  it('rejects invalid values', () => {
    expect(() => validateEnvironment({ PORT: 'invalid' })).toThrow(
      'Invalid environment configuration'
    );
  });
});

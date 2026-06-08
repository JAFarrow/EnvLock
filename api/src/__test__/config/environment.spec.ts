import { validateEnvironment } from '../../config/environment';

describe('validateEnvironment', () => {
  it('applies default values', () => {
    expect(validateEnvironment({})).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000
    });
  });

  it('coerces supported values', () => {
    expect(validateEnvironment({ NODE_ENV: 'test', PORT: '4000' })).toMatchObject({
      NODE_ENV: 'test',
      PORT: 4000
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

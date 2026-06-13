import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtStrategy } from '../../auth/strategies/jwt.strategy';
import { EnvironmentVariables } from '../../config/environment';

type ConfigServiceMock = {
  get: jest.Mock<string, ['JWT_SECRET', { infer: true }]>;
};

describe('JwtStrategy', () => {
  let configService: ConfigServiceMock;

  beforeEach(() => {
    configService = {
      get: jest.fn<string, ['JWT_SECRET', { infer: true }]>(() => 'test-secret')
    };
  });

  it('returns the authenticated request user from the verified JWT payload', () => {
    const strategy = new JwtStrategy(
      configService as unknown as ConfigService<EnvironmentVariables, true>
    );

    expect(
      strategy.validate({
        sub: '9942365e-cb78-4f24-9f33-5b4a821759a4',
        email: 'user@example.com',
        status: 'active'
      })
    ).toEqual({ id: '9942365e-cb78-4f24-9f33-5b4a821759a4' });
  });

  it('rejects payloads without a subject', () => {
    const strategy = new JwtStrategy(
      configService as unknown as ConfigService<EnvironmentVariables, true>
    );

    expect(() => strategy.validate({ sub: '' })).toThrow(UnauthorizedException);
  });
});

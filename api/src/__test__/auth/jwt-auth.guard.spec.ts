import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Request } from 'express';

import { type AuthenticatedRequest } from '../../auth/contracts/authenticated-request';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EnvironmentVariables } from '../../config/environment';

const jwtService = new JwtService({ secret: 'test-secret' });
const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const cookieUserId = '0a8d4a1f-d93d-4a6d-9ec4-6c2d688f0c79';
const accessTokenCookieName = 'test_access_token';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    const configService = {
      get: jest.fn<string, ['JWT_ACCESS_TOKEN_COOKIE_NAME', { infer: true }]>(
        () => accessTokenCookieName
      )
    };

    guard = new JwtAuthGuard(
      jwtService,
      configService as unknown as ConfigService<EnvironmentVariables, true>
    );
  });

  it('authenticates valid bearer tokens and attaches the request user', async () => {
    const token = await jwtService.signAsync({ sub: userId });
    const { context, request } = createExecutionContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.user).toEqual({ id: userId });
  });

  it('authenticates valid access token cookies', async () => {
    const token = await jwtService.signAsync({ sub: userId });
    const { context, request } = createExecutionContext({
      cookie: `theme=dark; ${accessTokenCookieName}=${token}`
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.user).toEqual({ id: userId });
  });

  it('prefers bearer tokens over access token cookies', async () => {
    const bearerToken = await jwtService.signAsync({ sub: userId });
    const cookieToken = await jwtService.signAsync({ sub: cookieUserId });
    const { context, request } = createExecutionContext({
      authorization: `Bearer ${bearerToken}`,
      cookie: `${accessTokenCookieName}=${cookieToken}`
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.user).toEqual({ id: userId });
  });

  it('rejects missing or malformed tokens', async () => {
    await expect(guard.canActivate(createExecutionContext({}).context)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    await expect(
      guard.canActivate(createExecutionContext({ authorization: 'Bearer token extra' }).context)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(createExecutionContext({ cookie: `${accessTokenCookieName}=` }).context)
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid tokens and tokens without a subject', async () => {
    const tokenWithoutSubject = await jwtService.signAsync({ email: 'user@example.com' });

    await expect(
      guard.canActivate(createExecutionContext({ authorization: 'Bearer invalid-token' }).context)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      guard.canActivate(
        createExecutionContext({ authorization: `Bearer ${tokenWithoutSubject}` }).context
      )
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createExecutionContext(headers: Request['headers']): {
  context: ExecutionContext;
  request: AuthenticatedRequest;
} {
  const request = {
    headers
  } as AuthenticatedRequest;

  return {
    context: {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as ExecutionContext,
    request
  };
}

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Request } from 'express';

import { EnvironmentVariables } from '../../config/environment';
import { type AuthenticatedRequestUser } from '../contracts/authenticated-request';
import { type JwtPayload } from '../contracts/jwt-payload';

type JwtAuthenticatedRequest = Request & {
  user?: AuthenticatedRequestUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<JwtAuthenticatedRequest>();
    const cookieName = this.configService.get('JWT_ACCESS_TOKEN_COOKIE_NAME', { infer: true });
    const token =
      extractBearerToken(request.headers.authorization) ??
      extractJwtFromCookie(request, cookieName);

    if (token === null) {
      throw new UnauthorizedException('Invalid access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new UnauthorizedException('Invalid access token');
      }

      request.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  const [scheme, token, extra] = authorizationHeader?.split(' ') ?? [];

  if (scheme !== 'Bearer' || token === undefined || token.length === 0 || extra !== undefined) {
    return null;
  }

  return token;
}

function extractJwtFromCookie(request: Request, cookieName: string): string | null {
  const cookieHeader = request.headers.cookie;

  if (typeof cookieHeader !== 'string') {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();

    if (name === cookieName) {
      const value = cookie.slice(separatorIndex + 1).trim();

      return value.length > 0 ? value : null;
    }
  }

  return null;
}

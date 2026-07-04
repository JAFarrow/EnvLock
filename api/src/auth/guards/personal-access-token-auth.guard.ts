import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { type AuthenticatedPersonalAccessTokenRequest } from '../contracts/personal-access-token-request';
import { PersonalAccessTokenAuthService } from '../personal-access-token-auth.service';

@Injectable()
export class PersonalAccessTokenAuthGuard implements CanActivate {
  constructor(private readonly personalAccessTokenAuthService: PersonalAccessTokenAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedPersonalAccessTokenRequest>();
    const authenticatedToken = await this.personalAccessTokenAuthService.validate(
      request.headers.authorization,
      new Date()
    );

    if (authenticatedToken === null) {
      throw new UnauthorizedException('Invalid personal access token');
    }

    request.user = authenticatedToken;

    return true;
  }
}

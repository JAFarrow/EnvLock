import { Injectable } from '@nestjs/common';

import { type AuthenticatedPersonalAccessToken } from './contracts/personal-access-token-request';
import {
  hashPersonalAccessTokenSecret,
  personalAccessTokenPrefix
} from './personal-access-token-secret';
import { PersonalAccessTokenRepository } from '../personal-access-tokens/repositories/personal-access-token.repository';
import { ProjectMembershipsRepository } from '../projects/repositories/project-memberships.repository';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PersonalAccessTokenAuthService {
  constructor(
    private readonly personalAccessTokenRepository: PersonalAccessTokenRepository,
    private readonly projectMembershipsRepository: ProjectMembershipsRepository
  ) {}

  async validate(
    authorizationHeader: string | undefined,
    usedAt: Date = new Date()
  ): Promise<AuthenticatedPersonalAccessToken | null> {
    const rawToken = extractBearerToken(authorizationHeader);

    if (rawToken === null) {
      return null;
    }

    const parsedToken = parsePersonalAccessToken(rawToken);

    if (parsedToken === null) {
      return null;
    }

    const token = await this.personalAccessTokenRepository.findActiveByIdAndHash(
      parsedToken.tokenId,
      hashPersonalAccessTokenSecret(parsedToken.tokenSecret)
    );

    if (token === null) {
      return null;
    }

    const membership = await this.projectMembershipsRepository.findActiveProjectByProjectAndUser(
      token.projectId,
      token.userId
    );

    if (membership === null) {
      return null;
    }

    token.lastUsedAt = usedAt;
    await this.personalAccessTokenRepository.save(token);

    return {
      id: token.id,
      projectId: token.projectId,
      userId: token.userId
    };
  }
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  const [scheme, rawToken, extra] = authorizationHeader?.split(' ') ?? [];

  if (scheme !== 'Bearer' || rawToken === undefined || extra !== undefined) {
    return null;
  }

  return rawToken;
}

function parsePersonalAccessToken(
  rawToken: string
): { tokenId: string; tokenSecret: string } | null {
  if (!rawToken.startsWith(`${personalAccessTokenPrefix}_`)) {
    return null;
  }

  const tokenWithoutPrefix = rawToken.slice(`${personalAccessTokenPrefix}_`.length);
  const [tokenId, tokenSecret, extraTokenPart] = tokenWithoutPrefix.split('.');

  if (
    tokenId === undefined ||
    tokenId.length === 0 ||
    !uuidPattern.test(tokenId) ||
    tokenSecret === undefined ||
    tokenSecret.length === 0 ||
    extraTokenPart !== undefined
  ) {
    return null;
  }

  return { tokenId, tokenSecret };
}

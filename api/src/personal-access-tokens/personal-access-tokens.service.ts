import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';

import { AuditEventsService } from '../audit-events/audit-events.service';
import { ProjectRole } from '../projects/entities/project-role.enum';
import { ProjectAccessService } from '../projects/project-access.service';
import { type CreatePersonalAccessTokenDto } from './contracts/create-personal-access-token.dto';
import {
  type PersonalAccessTokenListResponseDto,
  type PersonalAccessTokenResponseDto,
  toPersonalAccessTokenListItemResponse,
  toPersonalAccessTokenResponse
} from './contracts/personal-access-token.response.dto';
import {
  personalAccessTokenPrefix,
  hashPersonalAccessTokenSecret
} from '../auth/personal-access-token-secret';
import { PersonalAccessTokenRepository } from './repositories/personal-access-token.repository';

const personalAccessTokenMaxLifetimeDays = 90;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

@Injectable()
export class PersonalAccessTokensService {
  constructor(
    private readonly projectAccessService: ProjectAccessService,
    private readonly personalAccessTokenRepository: PersonalAccessTokenRepository,
    private readonly auditEventsService?: AuditEventsService
  ) {}

  async list(userId: string, projectId: string): Promise<PersonalAccessTokenListResponseDto> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      userId,
      projectId
    );
    const canListAllTokens =
      membership.role === ProjectRole.OWNER || membership.role === ProjectRole.MAINTAINER;
    const tokens = canListAllTokens
      ? await this.personalAccessTokenRepository.findUnrevokedByProjectId(projectId)
      : await this.personalAccessTokenRepository.findUnrevokedByProjectAndUserId(projectId, userId);

    return {
      items: tokens.map(toPersonalAccessTokenListItemResponse)
    };
  }

  async create(
    userId: string,
    projectId: string,
    input: CreatePersonalAccessTokenDto
  ): Promise<PersonalAccessTokenResponseDto> {
    await this.projectAccessService.findAccessibleActiveMembership(userId, projectId);

    const expiresAt = this.parseAndValidateExpiration(input.expiresAt);
    const tokenId = randomUUID();
    const tokenSecret = randomBytes(32).toString('base64url');
    const rawToken = `${personalAccessTokenPrefix}_${tokenId}.${tokenSecret}`;
    const token = await this.personalAccessTokenRepository.create({
      id: tokenId,
      projectId,
      userId,
      name: input.name,
      tokenHash: hashPersonalAccessTokenSecret(tokenSecret),
      tokenLastFour: tokenSecret.slice(-4),
      expiresAt
    });

    await this.auditEventsService?.record({
      projectId,
      actorUserId: userId,
      action: 'pat.created',
      targetType: 'personal_access_token',
      targetId: token.id,
      details: {
        fields: ['name', 'expiresAt']
      }
    });

    return toPersonalAccessTokenResponse(token, rawToken);
  }

  async revoke(actorUserId: string, projectId: string, tokenId: string): Promise<void> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      actorUserId,
      projectId
    );
    const token = await this.personalAccessTokenRepository.findUnrevokedByProjectAndId(
      projectId,
      tokenId
    );

    if (token === null) {
      throw new NotFoundException('Personal access token not found');
    }

    const canRevokeAnyToken =
      membership.role === ProjectRole.OWNER || membership.role === ProjectRole.MAINTAINER;

    if (!canRevokeAnyToken && token.userId !== actorUserId) {
      throw new ForbiddenException('Developers can only revoke their own personal access tokens');
    }

    token.revokedAt = new Date();

    await this.personalAccessTokenRepository.save(token);

    await this.auditEventsService?.record({
      projectId,
      actorUserId,
      action: 'pat.revoked',
      targetType: 'personal_access_token',
      targetId: token.id
    });
  }

  private parseAndValidateExpiration(expiresAtInput: string): Date {
    const expiresAt = new Date(expiresAtInput);

    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('PAT expiration must be a valid date');
    }

    const now = new Date();

    if (expiresAt <= now) {
      throw new BadRequestException('PAT expiration must be in the future');
    }

    const maximumExpiresAt = new Date(
      now.getTime() + personalAccessTokenMaxLifetimeDays * millisecondsPerDay
    );

    if (expiresAt > maximumExpiresAt) {
      throw new BadRequestException('PAT expiration cannot exceed 90 days');
    }

    return expiresAt;
  }
}

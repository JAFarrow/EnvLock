import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { ProjectRole } from '../projects/entities/project-role.enum';
import { ProjectAccessService } from '../projects/project-access.service';
import { type CreateProjectPersonalAccessTokenDto } from './contracts/create-project-personal-access-token.dto';
import {
  type ProjectPersonalAccessTokenResponseDto,
  toProjectPersonalAccessTokenResponse
} from './contracts/project-personal-access-token.response.dto';
import { ProjectPersonalAccessTokenRepository } from './repositories/project-personal-access-token.repository';

const personalAccessTokenPrefix = 'envlock_pat';
const personalAccessTokenMaxLifetimeDays = 90;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

@Injectable()
export class ProjectPersonalAccessTokensService {
  constructor(
    private readonly projectAccessService: ProjectAccessService,
    private readonly personalAccessTokenRepository: ProjectPersonalAccessTokenRepository
  ) {}

  async create(
    userId: string,
    projectId: string,
    input: CreateProjectPersonalAccessTokenDto
  ): Promise<ProjectPersonalAccessTokenResponseDto> {
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
      tokenHash: hashTokenSecret(tokenSecret),
      tokenLastFour: tokenSecret.slice(-4),
      expiresAt
    });

    return toProjectPersonalAccessTokenResponse(token, rawToken);
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

function hashTokenSecret(tokenSecret: string): string {
  return createHash('sha256').update(tokenSecret, 'utf8').digest('hex');
}

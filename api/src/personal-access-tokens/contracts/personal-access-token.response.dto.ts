import { PersonalAccessTokenEntity } from '../entities/personal-access-token.entity';

export interface PersonalAccessTokenResponseDto {
  id: string;
  projectId: string;
  name: string;
  token: string;
  tokenType: 'Bearer';
  expiresAt: string;
  createdAt: string;
}

export interface PersonalAccessTokenListItemResponseDto {
  id: string;
  projectId: string;
  userId: string;
  userEmail: string;
  name: string;
  tokenLastFour: string;
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface PersonalAccessTokenListResponseDto {
  items: PersonalAccessTokenListItemResponseDto[];
}

export function toPersonalAccessTokenResponse(
  token: PersonalAccessTokenEntity,
  rawToken: string
): PersonalAccessTokenResponseDto {
  return {
    id: token.id,
    projectId: token.projectId,
    name: token.name,
    token: rawToken,
    tokenType: 'Bearer',
    expiresAt: token.expiresAt.toISOString(),
    createdAt: token.createdAt.toISOString()
  };
}

export function toPersonalAccessTokenListItemResponse(
  token: PersonalAccessTokenEntity
): PersonalAccessTokenListItemResponseDto {
  return {
    id: token.id,
    projectId: token.projectId,
    userId: token.userId,
    userEmail: token.user.email,
    name: token.name,
    tokenLastFour: token.tokenLastFour,
    expiresAt: token.expiresAt.toISOString(),
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    createdAt: token.createdAt.toISOString()
  };
}

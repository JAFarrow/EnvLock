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

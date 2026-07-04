import { ProjectPersonalAccessTokenEntity } from '../entities/project-personal-access-token.entity';

export interface ProjectPersonalAccessTokenResponseDto {
  id: string;
  projectId: string;
  name: string;
  token: string;
  tokenType: 'Bearer';
  expiresAt: string;
  createdAt: string;
}

export function toProjectPersonalAccessTokenResponse(
  token: ProjectPersonalAccessTokenEntity,
  rawToken: string
): ProjectPersonalAccessTokenResponseDto {
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

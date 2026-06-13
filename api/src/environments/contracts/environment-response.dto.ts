import { EnvironmentEntity } from '../entities/environment.entity';

export interface EnvironmentResponseDto {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentListResponseDto {
  items: EnvironmentResponseDto[];
}

export function toEnvironmentResponse(environment: EnvironmentEntity): EnvironmentResponseDto {
  return {
    id: environment.id,
    projectId: environment.projectId,
    name: environment.name,
    slug: environment.slug,
    description: environment.description,
    createdAt: environment.createdAt.toISOString(),
    updatedAt: environment.updatedAt.toISOString()
  };
}

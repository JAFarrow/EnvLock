import { ProjectRole } from '../entities/project-role.enum';
import { ProjectEntity } from '../entities/project.entity';

export interface ProjectResponseDto {
  id: string;
  name: string;
  description: string | null;
  repositoryUrl: string | null;
  role: ProjectRole;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListResponseDto {
  projects: ProjectResponseDto[];
}

export function toProjectResponse(project: ProjectEntity, role: ProjectRole): ProjectResponseDto {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    repositoryUrl: project.repositoryUrl,
    role,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

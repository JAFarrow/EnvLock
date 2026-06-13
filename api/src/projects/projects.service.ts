import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { type CreateProjectDto } from './contracts/create-project.dto';
import { ProjectMembershipsRepository } from './repositories/project-memberships.repository';
import { ProjectRole } from './entities/project-role.enum';
import {
  type ProjectListResponseDto,
  type ProjectResponseDto,
  toProjectResponse
} from './contracts/project-response.dto';
import { ProjectsRepository } from './repositories/projects.repository';
import { ProjectAccessService } from './project-access.service';
import { type UpdateProjectDto } from './contracts/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly projectsRepository: ProjectsRepository,
    private readonly projectMembershipsRepository: ProjectMembershipsRepository,
    private readonly projectAccessService: ProjectAccessService
  ) {}

  async createProject(userId: string, input: CreateProjectDto): Promise<ProjectResponseDto> {
    const project = await this.dataSource.transaction(async (manager) => {
      const savedProject = await this.projectsRepository.create(
        {
          name: input.name,
          description: input.description ?? null,
          repositoryUrl: input.repositoryUrl ?? null,
          createdByUserId: userId
        },
        manager
      );

      await this.projectMembershipsRepository.create(
        {
          projectId: savedProject.id,
          userId,
          role: ProjectRole.OWNER,
          addedByUserId: userId
        },
        manager
      );

      return savedProject;
    });

    return toProjectResponse(project, ProjectRole.OWNER);
  }

  async listProjects(userId: string): Promise<ProjectListResponseDto> {
    const memberships = await this.projectMembershipsRepository.findActiveProjectsByUserId(userId);

    return {
      projects: memberships.map((membership) =>
        toProjectResponse(membership.project, membership.role)
      )
    };
  }

  async getProject(userId: string, projectId: string): Promise<ProjectResponseDto> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      userId,
      projectId
    );

    return toProjectResponse(membership.project, membership.role);
  }

  async updateProject(
    userId: string,
    projectId: string,
    input: UpdateProjectDto
  ): Promise<ProjectResponseDto> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      userId,
      projectId
    );
    this.projectAccessService.assertOwner(membership);

    const project = membership.project;

    if (input.name !== undefined) {
      project.name = input.name;
    }

    if (input.description !== undefined) {
      project.description = input.description;
    }

    if (input.repositoryUrl !== undefined) {
      project.repositoryUrl = input.repositoryUrl;
    }

    const savedProject = await this.projectsRepository.save(project);

    return toProjectResponse(savedProject, membership.role);
  }

  async archiveProject(userId: string, projectId: string): Promise<void> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      userId,
      projectId
    );
    this.projectAccessService.assertOwner(membership);

    membership.project.archivedAt = new Date();
    await this.projectsRepository.save(membership.project);
  }
}

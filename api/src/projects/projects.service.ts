import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AuditEventsService } from '../audit-events/audit-events.service';
import { getDefinedFieldNames } from '../utils/get-defined-field-names';
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
    private readonly projectAccessService: ProjectAccessService,
    private readonly auditEventsService?: AuditEventsService
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

      await this.auditEventsService?.record(
        {
          projectId: savedProject.id,
          actorUserId: userId,
          action: 'project.created',
          targetType: 'project',
          targetId: savedProject.id,
          details: {
            fields: getDefinedFieldNames(input)
          }
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

    await this.auditEventsService?.record({
      projectId,
      actorUserId: userId,
      action: 'project.updated',
      targetType: 'project',
      targetId: projectId,
      details: {
        changedFields: getDefinedFieldNames(input)
      }
    });

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

    await this.auditEventsService?.record({
      projectId,
      actorUserId: userId,
      action: 'project.archived',
      targetType: 'project',
      targetId: projectId
    });
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AuditEventsService } from '../audit-events/audit-events.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { getDefinedFieldNames } from '../utils/get-defined-field-names';
import { type CreateEnvironmentDto } from './contracts/create-environment.dto';
import {
  type EnvironmentListResponseDto,
  type EnvironmentResponseDto,
  toEnvironmentResponse
} from './contracts/environment-response.dto';
import { type UpdateEnvironmentDto } from './contracts/update-environment.dto';
import { EnvironmentRepository } from './repositories/environment.repository';

@Injectable()
export class EnvironmentsService {
  constructor(
    private readonly environmentRepository: EnvironmentRepository,
    private readonly projectAccessService: ProjectAccessService,
    private readonly auditEventsService?: AuditEventsService
  ) {}

  async createEnvironment(
    userId: string,
    projectId: string,
    input: CreateEnvironmentDto
  ): Promise<EnvironmentResponseDto> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      userId,
      projectId
    );
    this.projectAccessService.assertEnvironmentManager(membership);
    await this.assertSlugAvailable(projectId, input.slug);

    const environment = await this.environmentRepository.create({
      projectId,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      createdByUserId: userId
    });

    await this.auditEventsService?.record({
      projectId,
      environmentId: environment.id,
      actorUserId: userId,
      action: 'environment.created',
      targetType: 'environment',
      targetId: environment.id,
      details: {
        environmentName: environment.name,
        fields: getDefinedFieldNames(input)
      }
    });

    return toEnvironmentResponse(environment);
  }

  async listEnvironments(userId: string, projectId: string): Promise<EnvironmentListResponseDto> {
    await this.projectAccessService.findAccessibleActiveMembership(userId, projectId);

    const environments = await this.environmentRepository.findActiveByProjectId(projectId);

    return {
      items: environments.map(toEnvironmentResponse)
    };
  }

  async getEnvironment(
    userId: string,
    projectId: string,
    environmentId: string
  ): Promise<EnvironmentResponseDto> {
    await this.projectAccessService.findAccessibleActiveMembership(userId, projectId);

    const environment = await this.environmentRepository.findActiveByProjectAndId(
      projectId,
      environmentId
    );

    if (environment === null) {
      throw new NotFoundException('Environment not found');
    }

    return toEnvironmentResponse(environment);
  }

  async updateEnvironment(
    userId: string,
    projectId: string,
    environmentId: string,
    input: UpdateEnvironmentDto
  ): Promise<EnvironmentResponseDto> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      userId,
      projectId
    );
    this.projectAccessService.assertEnvironmentManager(membership);

    const environment = await this.environmentRepository.findActiveByProjectAndId(
      projectId,
      environmentId
    );

    if (environment === null) {
      throw new NotFoundException('Environment not found');
    }

    if (input.slug !== undefined && input.slug !== environment.slug) {
      await this.assertSlugAvailable(projectId, input.slug);
      environment.slug = input.slug;
    }

    if (input.name !== undefined) {
      environment.name = input.name;
    }

    if (input.description !== undefined) {
      environment.description = input.description;
    }

    const savedEnvironment = await this.environmentRepository.save(environment);

    await this.auditEventsService?.record({
      projectId,
      environmentId,
      actorUserId: userId,
      action: 'environment.updated',
      targetType: 'environment',
      targetId: environmentId,
      details: {
        environmentName: savedEnvironment.name,
        changedFields: getDefinedFieldNames(input)
      }
    });

    return toEnvironmentResponse(savedEnvironment);
  }

  async archiveEnvironment(
    userId: string,
    projectId: string,
    environmentId: string
  ): Promise<void> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      userId,
      projectId
    );
    this.projectAccessService.assertEnvironmentManager(membership);

    const environment = await this.environmentRepository.findActiveByProjectAndId(
      projectId,
      environmentId
    );

    if (environment === null) {
      throw new NotFoundException('Environment not found');
    }

    environment.archivedAt = new Date();
    await this.environmentRepository.save(environment);

    await this.auditEventsService?.record({
      projectId,
      environmentId,
      actorUserId: userId,
      action: 'environment.archived',
      targetType: 'environment',
      targetId: environmentId,
      details: {
        environmentName: environment.name
      }
    });
  }

  private async assertSlugAvailable(projectId: string, slug: string): Promise<void> {
    const existingEnvironment = await this.environmentRepository.findActiveByProjectAndSlug(
      projectId,
      slug
    );

    if (existingEnvironment !== null) {
      throw new ConflictException('Environment slug already exists');
    }
  }
}

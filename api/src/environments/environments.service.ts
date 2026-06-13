import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { ProjectAccessService } from '../projects/project-access.service';
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
    private readonly projectAccessService: ProjectAccessService
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

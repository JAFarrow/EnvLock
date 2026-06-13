import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ProjectEntity } from '../entities/project.entity';

export interface CreateProjectRecord {
  name: string;
  createdByUserId: string;
  description?: string | null;
  repositoryUrl?: string | null;
}

@Injectable()
export class ProjectsRepository {
  private readonly logger = new Logger(ProjectsRepository.name);

  constructor(
    @InjectRepository(ProjectEntity) private readonly repository: Repository<ProjectEntity>
  ) {}

  async create(input: CreateProjectRecord, manager?: EntityManager): Promise<ProjectEntity> {
    this.logger.debug('Creating project record', {
      createdByUserId: input.createdByUserId,
      name: input.name
    });

    const repository = this.repositoryFor(manager);
    const project = repository.create({
      name: input.name,
      description: input.description ?? null,
      repositoryUrl: input.repositoryUrl ?? null,
      createdByUserId: input.createdByUserId,
      archivedAt: null
    });

    const savedProject = await repository.save(project);

    this.logger.log('Project record created', {
      createdByUserId: savedProject.createdByUserId,
      projectId: savedProject.id
    });

    return savedProject;
  }

  async save(project: ProjectEntity, manager?: EntityManager): Promise<ProjectEntity> {
    this.logger.debug('Saving project record', { projectId: project.id });

    const savedProject = await this.repositoryFor(manager).save(project);

    this.logger.log('Project record saved', { projectId: savedProject.id });

    return savedProject;
  }

  private repositoryFor(manager?: EntityManager): Repository<ProjectEntity> {
    return manager?.getRepository(ProjectEntity) ?? this.repository;
  }
}

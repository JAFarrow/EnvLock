import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProjectEntity } from './project.entity';

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

  async create(input: CreateProjectRecord): Promise<ProjectEntity> {
    this.logger.debug('Creating project record', {
      createdByUserId: input.createdByUserId,
      name: input.name
    });

    const project = this.repository.create({
      name: input.name,
      description: input.description ?? null,
      repositoryUrl: input.repositoryUrl ?? null,
      createdByUserId: input.createdByUserId,
      archivedAt: null
    });

    const savedProject = await this.repository.save(project);

    this.logger.log('Project record created', {
      createdByUserId: savedProject.createdByUserId,
      projectId: savedProject.id
    });

    return savedProject;
  }

  async findById(id: string): Promise<ProjectEntity | null> {
    this.logger.debug('Finding project by id', { projectId: id });

    const project = await this.repository.findOneBy({ id });

    this.logger.debug('Project lookup by id completed', {
      found: project !== null,
      projectId: id
    });

    return project;
  }

  async findByCreatedByUserId(createdByUserId: string): Promise<ProjectEntity[]> {
    this.logger.debug('Finding projects by creating user id', { createdByUserId });

    const projects = await this.repository.findBy({ createdByUserId });

    this.logger.debug('Project lookup by creating user id completed', {
      count: projects.length,
      createdByUserId
    });

    return projects;
  }
}

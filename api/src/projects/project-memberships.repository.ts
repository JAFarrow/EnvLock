import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProjectMembershipEntity } from './project-membership.entity';
import { ProjectRole } from './project-role.enum';

export interface CreateProjectMembershipRecord {
  projectId: string;
  userId: string;
  role: ProjectRole;
  addedByUserId?: string | null;
}

@Injectable()
export class ProjectMembershipsRepository {
  private readonly logger = new Logger(ProjectMembershipsRepository.name);

  constructor(
    @InjectRepository(ProjectMembershipEntity)
    private readonly repository: Repository<ProjectMembershipEntity>
  ) {}

  async create(input: CreateProjectMembershipRecord): Promise<ProjectMembershipEntity> {
    this.logger.debug('Creating project membership record', {
      projectId: input.projectId,
      role: input.role,
      userId: input.userId
    });

    const membership = this.repository.create({
      projectId: input.projectId,
      userId: input.userId,
      role: input.role,
      addedByUserId: input.addedByUserId ?? null
    });

    const savedMembership = await this.repository.save(membership);

    this.logger.log('Project membership record created', {
      membershipId: savedMembership.id,
      projectId: savedMembership.projectId,
      userId: savedMembership.userId
    });

    return savedMembership;
  }

  async findById(id: string): Promise<ProjectMembershipEntity | null> {
    this.logger.debug('Finding project membership by id', { membershipId: id });

    const membership = await this.repository.findOneBy({ id });

    this.logger.debug('Project membership lookup by id completed', {
      found: membership !== null,
      membershipId: id
    });

    return membership;
  }

  async findByProjectAndUser(
    projectId: string,
    userId: string
  ): Promise<ProjectMembershipEntity | null> {
    this.logger.debug('Finding project membership by project and user', { projectId, userId });

    const membership = await this.repository.findOneBy({ projectId, userId });

    this.logger.debug('Project membership lookup by project and user completed', {
      found: membership !== null,
      projectId,
      userId
    });

    return membership;
  }

  async findByProjectId(projectId: string): Promise<ProjectMembershipEntity[]> {
    this.logger.debug('Finding project memberships by project id', { projectId });

    const memberships = await this.repository.findBy({ projectId });

    this.logger.debug('Project membership lookup by project id completed', {
      count: memberships.length,
      projectId
    });

    return memberships;
  }

  async findByUserId(userId: string): Promise<ProjectMembershipEntity[]> {
    this.logger.debug('Finding project memberships by user id', { userId });

    const memberships = await this.repository.findBy({ userId });

    this.logger.debug('Project membership lookup by user id completed', {
      count: memberships.length,
      userId
    });

    return memberships;
  }
}

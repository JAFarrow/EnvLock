import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ProjectMembershipEntity } from '../entities/project-membership.entity';
import { ProjectRole } from '../entities/project-role.enum';

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

  async create(
    input: CreateProjectMembershipRecord,
    manager?: EntityManager
  ): Promise<ProjectMembershipEntity> {
    this.logger.debug('Creating project membership record', {
      projectId: input.projectId,
      role: input.role,
      userId: input.userId
    });

    const repository = this.repositoryFor(manager);
    const membership = repository.create({
      projectId: input.projectId,
      userId: input.userId,
      role: input.role,
      addedByUserId: input.addedByUserId ?? null
    });

    const savedMembership = await repository.save(membership);

    this.logger.log('Project membership record created', {
      membershipId: savedMembership.id,
      projectId: savedMembership.projectId,
      userId: savedMembership.userId
    });

    return savedMembership;
  }

  async findActiveProjectsByUserId(userId: string): Promise<ProjectMembershipEntity[]> {
    this.logger.debug('Finding active project memberships by user id', { userId });

    const memberships = await this.repository
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.project', 'project')
      .where('membership.userId = :userId', { userId })
      .andWhere('project.archivedAt IS NULL')
      .orderBy('project.updatedAt', 'DESC')
      .getMany();

    this.logger.debug('Active project membership lookup by user id completed', {
      count: memberships.length,
      userId
    });

    return memberships;
  }

  async findActiveProjectByProjectAndUser(
    projectId: string,
    userId: string
  ): Promise<ProjectMembershipEntity | null> {
    this.logger.debug('Finding active project membership by project and user', {
      projectId,
      userId
    });

    const membership = await this.repository
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.project', 'project')
      .where('membership.projectId = :projectId', { projectId })
      .andWhere('membership.userId = :userId', { userId })
      .andWhere('project.archivedAt IS NULL')
      .getOne();

    this.logger.debug('Active project membership lookup by project and user completed', {
      found: membership !== null,
      projectId,
      userId
    });

    return membership;
  }

  async findByProjectAndUser(
    projectId: string,
    userId: string,
    manager?: EntityManager
  ): Promise<ProjectMembershipEntity | null> {
    this.logger.debug('Finding project membership by project and user', {
      projectId,
      userId
    });

    const membership = await this.repositoryFor(manager)
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.user', 'user')
      .where('membership.projectId = :projectId', { projectId })
      .andWhere('membership.userId = :userId', { userId })
      .getOne();

    this.logger.debug('Project membership lookup by project and user completed', {
      found: membership !== null,
      projectId,
      userId
    });

    return membership;
  }

  async findByProjectWithUsers(
    projectId: string,
    manager?: EntityManager
  ): Promise<ProjectMembershipEntity[]> {
    this.logger.debug('Finding project memberships with users by project id', { projectId });

    const memberships = await this.repositoryFor(manager)
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.user', 'user')
      .where('membership.projectId = :projectId', { projectId })
      .orderBy(
        "CASE membership.role WHEN 'owner' THEN 1 WHEN 'maintainer' THEN 2 WHEN 'developer' THEN 3 ELSE 4 END",
        'ASC'
      )
      .addOrderBy('user.email', 'ASC')
      .getMany();

    this.logger.debug('Project memberships with users lookup completed', {
      count: memberships.length,
      projectId
    });

    return memberships;
  }

  async save(
    membership: ProjectMembershipEntity,
    manager?: EntityManager
  ): Promise<ProjectMembershipEntity> {
    return this.repositoryFor(manager).save(membership);
  }

  async remove(membership: ProjectMembershipEntity, manager?: EntityManager): Promise<void> {
    await this.repositoryFor(manager).remove(membership);
  }

  private repositoryFor(manager?: EntityManager): Repository<ProjectMembershipEntity> {
    return manager?.getRepository(ProjectMembershipEntity) ?? this.repository;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import {
  type AuditAction,
  type AuditEventDetails,
  type AuditTargetType
} from '../audit-event.types';
import { AuditEventEntity } from '../entities/audit-event.entity';

export interface CreateAuditEventRecord {
  projectId: string;
  environmentId?: string | null;
  actorUserId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  details?: AuditEventDetails;
}

@Injectable()
export class AuditEventsRepository {
  private readonly logger = new Logger(AuditEventsRepository.name);

  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly repository: Repository<AuditEventEntity>
  ) {}

  async create(input: CreateAuditEventRecord, manager?: EntityManager): Promise<AuditEventEntity> {
    this.logger.debug('Creating audit event', {
      action: input.action,
      environmentId: input.environmentId ?? null,
      projectId: input.projectId,
      targetId: input.targetId ?? null,
      targetType: input.targetType
    });

    const repository = this.repositoryFor(manager);
    const event = repository.create({
      projectId: input.projectId,
      environmentId: input.environmentId ?? null,
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      details: input.details ?? {}
    });
    const savedEvent = await repository.save(event);

    this.logger.log('Audit event created', {
      action: savedEvent.action,
      auditEventId: savedEvent.id,
      projectId: savedEvent.projectId
    });

    return savedEvent;
  }

  async findNewestByProject(projectId: string, limit: number): Promise<AuditEventEntity[]> {
    return this.repository.find({
      where: { projectId },
      relations: { actorUser: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit
    });
  }

  private repositoryFor(manager?: EntityManager): Repository<AuditEventEntity> {
    return manager?.getRepository(AuditEventEntity) ?? this.repository;
  }
}

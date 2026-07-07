import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import {
  type AuditEventListResponseDto,
  toAuditEventResponse
} from './contracts/audit-event-response.dto';
import {
  type CreateAuditEventRecord,
  AuditEventsRepository
} from './repositories/audit-events.repository';

const defaultAuditEventLimit = 50;

@Injectable()
export class AuditEventsService {
  constructor(private readonly auditEventsRepository: AuditEventsRepository) {}

  async record(input: CreateAuditEventRecord, manager?: EntityManager): Promise<void> {
    await this.auditEventsRepository.create(input, manager);
  }

  async listProjectEvents(projectId: string): Promise<AuditEventListResponseDto> {
    const events = await this.auditEventsRepository.findNewestByProject(
      projectId,
      defaultAuditEventLimit
    );

    return {
      items: events.map(toAuditEventResponse)
    };
  }
}

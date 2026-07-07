import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEventsService } from './audit-events.service';
import { AuditEventEntity } from './entities/audit-event.entity';
import { AuditEventsRepository } from './repositories/audit-events.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEventEntity])],
  providers: [AuditEventsService, AuditEventsRepository],
  exports: [AuditEventsService]
})
export class AuditEventsModule {}

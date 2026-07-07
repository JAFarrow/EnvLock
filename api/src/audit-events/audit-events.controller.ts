import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';

import { type AuthenticatedRequest } from '../auth/contracts/authenticated-request';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectRole } from '../projects/entities/project-role.enum';
import { ProjectAccessService } from '../projects/project-access.service';
import { AuditEventsService } from './audit-events.service';
import { type AuditEventListResponseDto } from './contracts/audit-event-response.dto';

@Controller('projects/:projectId/audit-events')
@UseGuards(JwtAuthGuard)
export class AuditEventsController {
  constructor(
    private readonly auditEventsService: AuditEventsService,
    private readonly projectAccessService: ProjectAccessService
  ) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string
  ): Promise<AuditEventListResponseDto> {
    const membership = await this.projectAccessService.findAccessibleActiveMembership(
      request.user.id,
      projectId
    );

    this.projectAccessService.assertOneOfRoles(membership, [
      ProjectRole.OWNER,
      ProjectRole.MAINTAINER
    ]);

    return this.auditEventsService.listProjectEvents(projectId);
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEventsController } from '../audit-events/audit-events.controller';
import { AuditEventsModule } from '../audit-events/audit-events.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ProjectMembershipEntity } from './entities/project-membership.entity';
import { ProjectMembershipsController } from './project-memberships.controller';
import { ProjectMembershipsRepository } from './repositories/project-memberships.repository';
import { ProjectMembershipsService } from './project-memberships.service';
import { ProjectEntity } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectAccessService } from './project-access.service';
import { ProjectsRepository } from './repositories/projects.repository';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    AuditEventsModule,
    AuthModule,
    UsersModule,
    TypeOrmModule.forFeature([ProjectEntity, ProjectMembershipEntity])
  ],
  controllers: [ProjectsController, ProjectMembershipsController, AuditEventsController],
  providers: [
    ProjectsService,
    ProjectMembershipsService,
    ProjectAccessService,
    ProjectsRepository,
    ProjectMembershipsRepository
  ],
  exports: [ProjectAccessService]
})
export class ProjectsModule {}

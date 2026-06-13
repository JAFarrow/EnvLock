import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ProjectMembershipEntity } from './entities/project-membership.entity';
import { ProjectMembershipsRepository } from './repositories/project-memberships.repository';
import { ProjectEntity } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './repositories/projects.repository';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([ProjectEntity, ProjectMembershipEntity])],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsRepository, ProjectMembershipsRepository]
})
export class ProjectsModule {}

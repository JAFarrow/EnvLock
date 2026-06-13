import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProjectMembershipEntity } from './project-membership.entity';
import { ProjectMembershipsRepository } from './project-memberships.repository';
import { ProjectEntity } from './project.entity';
import { ProjectsRepository } from './projects.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity, ProjectMembershipEntity])],
  providers: [ProjectsRepository, ProjectMembershipsRepository],
  exports: [ProjectsRepository, ProjectMembershipsRepository]
})
export class ProjectsModule {}

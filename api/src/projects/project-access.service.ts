import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { ProjectMembershipEntity } from './entities/project-membership.entity';
import { ProjectRole } from './entities/project-role.enum';
import { ProjectMembershipsRepository } from './repositories/project-memberships.repository';

@Injectable()
export class ProjectAccessService {
  constructor(private readonly projectMembershipsRepository: ProjectMembershipsRepository) {}

  async findAccessibleActiveMembership(
    userId: string,
    projectId: string
  ): Promise<ProjectMembershipEntity> {
    const membership = await this.projectMembershipsRepository.findActiveProjectByProjectAndUser(
      projectId,
      userId
    );

    if (membership === null) {
      throw new NotFoundException('Project not found');
    }

    return membership;
  }

  assertOwner(membership: ProjectMembershipEntity): void {
    if (membership.role !== ProjectRole.OWNER) {
      throw new ForbiddenException('Only project owners can perform this action');
    }
  }
}

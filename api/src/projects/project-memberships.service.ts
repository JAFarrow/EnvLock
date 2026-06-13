import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import {
  assignableProjectMemberRoles,
  type AddProjectMemberDto
} from './contracts/add-project-member.dto';
import { type ProjectMemberListResponseDto } from './contracts/project-member-list.response.dto';
import {
  type ProjectMemberResponseDto,
  toProjectMemberResponse
} from './contracts/project-member.response.dto';
import { type UpdateProjectMemberRoleDto } from './contracts/update-project-member-role.dto';
import { ProjectMembershipEntity } from './entities/project-membership.entity';
import { ProjectRole } from './entities/project-role.enum';
import { ProjectAccessService } from './project-access.service';
import { ProjectMembershipsRepository } from './repositories/project-memberships.repository';
import { UsersRepository } from '../users/repositories/users.repository';

@Injectable()
export class ProjectMembershipsService {
  constructor(
    private readonly projectAccessService: ProjectAccessService,
    private readonly projectMembershipsRepository: ProjectMembershipsRepository,
    private readonly usersRepository: UsersRepository
  ) {}

  async findAll(actorUserId: string, projectId: string): Promise<ProjectMemberListResponseDto> {
    await this.projectAccessService.findAccessibleActiveMembership(actorUserId, projectId);

    const memberships = await this.projectMembershipsRepository.findByProjectWithUsers(projectId);

    return {
      items: memberships.map(toProjectMemberResponse)
    };
  }

  async add(
    actorUserId: string,
    projectId: string,
    input: AddProjectMemberDto
  ): Promise<ProjectMemberResponseDto> {
    this.assertAssignableRole(input.role);
    await this.assertActorOwnsActiveProject(actorUserId, projectId);

    const targetUser = await this.usersRepository.findByEmail(input.email);

    if (targetUser === null) {
      throw new NotFoundException('User not found');
    }

    const existingMembership = await this.projectMembershipsRepository.findByProjectAndUser(
      projectId,
      targetUser.id
    );

    if (existingMembership !== null) {
      throw new ConflictException('User is already a project member');
    }

    const membership = await this.projectMembershipsRepository.create({
      projectId,
      userId: targetUser.id,
      role: input.role,
      addedByUserId: actorUserId
    });

    membership.user = targetUser;

    return toProjectMemberResponse(membership);
  }

  async updateRole(
    actorUserId: string,
    projectId: string,
    targetUserId: string,
    input: UpdateProjectMemberRoleDto
  ): Promise<ProjectMemberResponseDto> {
    this.assertAssignableRole(input.role);
    await this.assertActorOwnsActiveProject(actorUserId, projectId);

    const membership = await this.findTargetMembership(projectId, targetUserId);
    this.assertNonOwnerMembership(membership, 'Owner memberships cannot be modified');

    membership.role = input.role;

    const savedMembership = await this.projectMembershipsRepository.save(membership);

    return toProjectMemberResponse(savedMembership);
  }

  async remove(actorUserId: string, projectId: string, targetUserId: string): Promise<void> {
    await this.assertActorOwnsActiveProject(actorUserId, projectId);

    const membership = await this.findTargetMembership(projectId, targetUserId);
    this.assertNonOwnerMembership(membership, 'Owner memberships cannot be removed');

    await this.projectMembershipsRepository.remove(membership);
  }

  private async assertActorOwnsActiveProject(
    actorUserId: string,
    projectId: string
  ): Promise<void> {
    const actorMembership = await this.projectAccessService.findAccessibleActiveMembership(
      actorUserId,
      projectId
    );
    this.projectAccessService.assertOwner(actorMembership);
  }

  private async findTargetMembership(
    projectId: string,
    targetUserId: string
  ): Promise<ProjectMembershipEntity> {
    const membership = await this.projectMembershipsRepository.findByProjectAndUser(
      projectId,
      targetUserId
    );

    if (membership === null) {
      throw new NotFoundException('Project membership not found');
    }

    return membership;
  }

  private assertNonOwnerMembership(membership: ProjectMembershipEntity, message: string): void {
    if (membership.role === ProjectRole.OWNER) {
      throw new ConflictException(message);
    }
  }

  private assertAssignableRole(role: ProjectRole): void {
    if (
      !assignableProjectMemberRoles.includes(role as (typeof assignableProjectMemberRoles)[number])
    ) {
      throw new BadRequestException('Unsupported project member role');
    }
  }
}

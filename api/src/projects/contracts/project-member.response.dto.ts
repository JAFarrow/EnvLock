import { ProjectMembershipEntity } from '../entities/project-membership.entity';
import { ProjectRole } from '../entities/project-role.enum';

export interface ProjectMemberResponseDto {
  userId: string;
  email: string;
  role: ProjectRole;
  createdAt: string;
}

export function toProjectMemberResponse(
  membership: ProjectMembershipEntity
): ProjectMemberResponseDto {
  return {
    userId: membership.userId,
    email: membership.user.email,
    role: membership.role,
    createdAt: membership.createdAt.toISOString()
  };
}

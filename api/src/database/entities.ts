import { ProjectMembershipEntity } from '../projects/project-membership.entity';
import { ProjectEntity } from '../projects/project.entity';
import { User } from '../users/user.entity';

export const databaseEntities = [User, ProjectEntity, ProjectMembershipEntity];

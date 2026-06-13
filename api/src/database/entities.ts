import { ProjectMembershipEntity } from '../projects/entities/project-membership.entity';
import { ProjectEntity } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';

export const databaseEntities = [User, ProjectEntity, ProjectMembershipEntity];

import { EnvironmentEntity } from '../environments/entities/environment.entity';
import { ProjectPersonalAccessTokenEntity } from '../personal-access-tokens/entities/project-personal-access-token.entity';
import { ProjectMembershipEntity } from '../projects/entities/project-membership.entity';
import { ProjectEntity } from '../projects/entities/project.entity';
import { SecretEntity } from '../secrets/entities/secret.entity';
import { UserEntity } from '../users/entities/user.entity';

export const databaseEntities = [
  UserEntity,
  ProjectEntity,
  ProjectMembershipEntity,
  ProjectPersonalAccessTokenEntity,
  EnvironmentEntity,
  SecretEntity
];

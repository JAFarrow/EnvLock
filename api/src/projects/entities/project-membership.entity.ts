import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';
import { ProjectRole } from '../entities/project-role.enum';
import { ProjectEntity } from '../entities/project.entity';

@Entity({ name: 'project_memberships' })
@Unique('UQ_project_memberships_project_id_user_id', ['projectId', 'userId'])
@Check('CHK_project_memberships_role', `"role" IN ('owner', 'maintainer', 'developer')`)
@Index('idx_project_memberships_user_id', ['userId'])
@Index('idx_project_memberships_project_id', ['projectId'])
@Index('idx_project_memberships_project_role', ['projectId', 'role'])
export class ProjectMembershipEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  role!: ProjectRole;

  @Column({ name: 'added_by_user_id', type: 'uuid', nullable: true })
  addedByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => ProjectEntity, (project) => project.memberships, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'project_id' })
  project!: ProjectEntity;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'added_by_user_id' })
  addedByUser!: UserEntity | null;
}

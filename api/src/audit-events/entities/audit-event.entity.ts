import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';

import { ProjectEntity } from '../../projects/entities/project.entity';
import { UserEntity } from '../../users/entities/user.entity';
import {
  type AuditAction,
  type AuditEventDetails,
  type AuditTargetType
} from '../audit-event.types';

@Entity({ name: 'audit_events' })
@Index('idx_audit_events_project_created_at', ['projectId', 'createdAt'])
@Index('idx_audit_events_environment_created_at', ['environmentId', 'createdAt'])
@Index('idx_audit_events_actor_created_at', ['actorUserId', 'createdAt'])
@Index('idx_audit_events_target', ['targetType', 'targetId'])
export class AuditEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'environment_id', type: 'uuid', nullable: true })
  environmentId!: string | null;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId!: string;

  @Column({ type: 'varchar', length: 80 })
  action!: AuditAction;

  @Column({ name: 'target_type', type: 'varchar', length: 80 })
  targetType!: AuditTargetType;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId!: string | null;

  @Column({ type: 'jsonb' })
  details!: AuditEventDetails;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => ProjectEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: ProjectEntity;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser!: UserEntity | undefined;
}

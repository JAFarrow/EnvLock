import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

import { EnvironmentEntity } from '../../environments/entities/environment.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity({ name: 'secrets' })
@Check('chk_secrets_secret_key_format', `"secret_key" ~ '^[A-Z_][A-Z0-9_]*$'`)
@Check('chk_secrets_initialization_vector_length', 'octet_length("initialization_vector") = 12')
@Check('chk_secrets_authentication_tag_length', 'octet_length("authentication_tag") = 16')
@Check('chk_secrets_encryption_key_version_positive', '"encryption_key_version" > 0')
@Check('chk_secrets_encryption_format_version_positive', '"encryption_format_version" > 0')
@Index('idx_secrets_environment_id', ['environmentId'])
@Index('uq_secrets_environment_key_active', ['environmentId', 'key'], {
  unique: true,
  where: '"archived_at" IS NULL'
})
export class SecretEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'environment_id', type: 'uuid' })
  environmentId!: string;

  @Column({ name: 'secret_key', type: 'varchar', length: 255 })
  key!: string;

  @Column({ name: 'encrypted_value', type: 'bytea' })
  encryptedValue!: Buffer;

  @Column({ name: 'initialization_vector', type: 'bytea' })
  initializationVector!: Buffer;

  @Column({ name: 'authentication_tag', type: 'bytea' })
  authenticationTag!: Buffer;

  @Column({ name: 'encryption_key_version', type: 'integer' })
  encryptionKeyVersion!: number;

  @Column({ name: 'encryption_format_version', type: 'integer' })
  encryptionFormatVersion!: number;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Column({ name: 'updated_by_user_id', type: 'uuid' })
  updatedByUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @ManyToOne(() => EnvironmentEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'environment_id' })
  environment!: EnvironmentEntity;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser!: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedByUser!: UserEntity;
}

import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class InitialSchema2026070900000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "citext"');

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" citext NOT NULL,
        "password_hash" text NOT NULL,
        "status" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_users_status" CHECK ("status" IN ('active', 'disabled')),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "description" varchar(500),
        "repository_url" varchar(2048),
        "created_by_user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "archived_at" timestamptz,
        CONSTRAINT "FK_projects_created_by_user_id" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_projects_created_by_user_id" ON "projects" ("created_by_user_id")'
    );

    await queryRunner.query(`
      CREATE TABLE "project_memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" varchar(20) NOT NULL,
        "added_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_project_memberships_project_id_user_id" UNIQUE ("project_id", "user_id"),
        CONSTRAINT "CHK_project_memberships_role" CHECK ("role" IN ('owner', 'maintainer', 'developer')),
        CONSTRAINT "FK_project_memberships_project_id" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_memberships_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_project_memberships_added_by_user_id" FOREIGN KEY ("added_by_user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_project_memberships_user_id" ON "project_memberships" ("user_id")'
    );
    await queryRunner.query(
      'CREATE INDEX "idx_project_memberships_project_id" ON "project_memberships" ("project_id")'
    );
    await queryRunner.query(
      'CREATE INDEX "idx_project_memberships_project_role" ON "project_memberships" ("project_id", "role")'
    );

    await queryRunner.query(`
      CREATE TABLE "environments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "name" varchar(80) NOT NULL,
        "slug" varchar(80) NOT NULL,
        "description" varchar(500),
        "created_by_user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "archived_at" timestamptz,
        CONSTRAINT "FK_environments_project_id" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_environments_created_by_user_id" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_environments_project_id" ON "environments" ("project_id")'
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_environments_project_slug_active"
      ON "environments" ("project_id", "slug")
      WHERE "archived_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "personal_access_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "token_hash" char(64) NOT NULL,
        "token_last_four" char(4) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "last_used_at" timestamptz,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_personal_access_tokens_project_id" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_personal_access_tokens_user_id" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_personal_access_tokens_project_id" ON "personal_access_tokens" ("project_id")'
    );
    await queryRunner.query(
      'CREATE INDEX "idx_personal_access_tokens_user_id" ON "personal_access_tokens" ("user_id")'
    );
    await queryRunner.query(
      'CREATE INDEX "idx_personal_access_tokens_expires_at" ON "personal_access_tokens" ("expires_at")'
    );

    await queryRunner.query(`
      CREATE TABLE "secrets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "environment_id" uuid NOT NULL,
        "secret_key" varchar(255) NOT NULL,
        "encrypted_value" bytea NOT NULL,
        "initialization_vector" bytea NOT NULL,
        "authentication_tag" bytea NOT NULL,
        "encryption_key_version" integer NOT NULL,
        "encryption_format_version" integer NOT NULL,
        "created_by_user_id" uuid NOT NULL,
        "updated_by_user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "archived_at" timestamptz,
        CONSTRAINT "chk_secrets_secret_key_format" CHECK ("secret_key" ~ '^[A-Z_][A-Z0-9_]*$'),
        CONSTRAINT "chk_secrets_initialization_vector_length" CHECK (octet_length("initialization_vector") = 12),
        CONSTRAINT "chk_secrets_authentication_tag_length" CHECK (octet_length("authentication_tag") = 16),
        CONSTRAINT "chk_secrets_encryption_key_version_positive" CHECK ("encryption_key_version" > 0),
        CONSTRAINT "chk_secrets_encryption_format_version_positive" CHECK ("encryption_format_version" > 0),
        CONSTRAINT "FK_secrets_environment_id" FOREIGN KEY ("environment_id")
          REFERENCES "environments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_secrets_created_by_user_id" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_secrets_updated_by_user_id" FOREIGN KEY ("updated_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_secrets_environment_id" ON "secrets" ("environment_id")'
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_secrets_environment_key_active"
      ON "secrets" ("environment_id", "secret_key")
      WHERE "archived_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" uuid NOT NULL,
        "environment_id" uuid,
        "actor_user_id" uuid NOT NULL,
        "action" varchar(80) NOT NULL,
        "target_type" varchar(80) NOT NULL,
        "target_id" uuid,
        "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_audit_events_project_id" FOREIGN KEY ("project_id")
          REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_audit_events_actor_user_id" FOREIGN KEY ("actor_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_audit_events_project_created_at" ON "audit_events" ("project_id", "created_at")'
    );
    await queryRunner.query(
      'CREATE INDEX "idx_audit_events_environment_created_at" ON "audit_events" ("environment_id", "created_at")'
    );
    await queryRunner.query(
      'CREATE INDEX "idx_audit_events_actor_created_at" ON "audit_events" ("actor_user_id", "created_at")'
    );
    await queryRunner.query(
      'CREATE INDEX "idx_audit_events_target" ON "audit_events" ("target_type", "target_id")'
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "audit_events"');
    await queryRunner.query('DROP TABLE IF EXISTS "secrets"');
    await queryRunner.query('DROP TABLE IF EXISTS "personal_access_tokens"');
    await queryRunner.query('DROP TABLE IF EXISTS "environments"');
    await queryRunner.query('DROP TABLE IF EXISTS "project_memberships"');
    await queryRunner.query('DROP TABLE IF EXISTS "projects"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
    await queryRunner.query('DROP EXTENSION IF EXISTS "citext"');
    await queryRunner.query('DROP EXTENSION IF EXISTS "pgcrypto"');
  }
}

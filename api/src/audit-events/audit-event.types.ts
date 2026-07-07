export const auditActions = [
  'project.created',
  'project.updated',
  'project.archived',
  'environment.created',
  'environment.updated',
  'environment.archived',
  'project_member.added',
  'project_member.role_updated',
  'project_member.removed',
  'secret.created',
  'secret.updated',
  'secret.archived',
  'secret.values_read',
  'pat.created',
  'pat.revoked'
] as const;

export type AuditAction = (typeof auditActions)[number];

export const auditTargetTypes = [
  'project',
  'environment',
  'project_member',
  'secret',
  'personal_access_token'
] as const;

export type AuditTargetType = (typeof auditTargetTypes)[number];

export type AuditEventDetails = Record<string, unknown>;

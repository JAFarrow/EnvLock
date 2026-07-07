import { AuditEventEntity } from '../entities/audit-event.entity';
import {
  type AuditAction,
  type AuditEventDetails,
  type AuditTargetType
} from '../audit-event.types';

export interface AuditEventResponseDto {
  id: string;
  projectId: string;
  environmentId: string | null;
  actorUserId: string;
  actorEmail: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string | null;
  summary: string;
  details: AuditEventDetails;
  createdAt: string;
}

export interface AuditEventListResponseDto {
  items: AuditEventResponseDto[];
}

export function toAuditEventResponse(event: AuditEventEntity): AuditEventResponseDto {
  return {
    id: event.id,
    projectId: event.projectId,
    environmentId: event.environmentId,
    actorUserId: event.actorUserId,
    actorEmail: event.actorUser?.email ?? null,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    summary: getAuditEventSummary(event),
    details: event.details,
    createdAt: event.createdAt.toISOString()
  };
}

function getAuditEventSummary(event: AuditEventEntity): string {
  switch (event.action) {
    case 'project.created':
      return 'Created project';
    case 'project.updated':
      return 'Updated project';
    case 'project.archived':
      return 'Archived project';
    case 'environment.created':
      return 'Created environment';
    case 'environment.updated':
      return 'Updated environment';
    case 'environment.archived':
      return 'Archived environment';
    case 'project_member.added':
      return 'Added project member';
    case 'project_member.role_updated':
      return 'Updated project member role';
    case 'project_member.removed':
      return 'Removed project member';
    case 'secret.created':
      return `Created secret ${getDetailText(event.details, 'secretKey')}`.trim();
    case 'secret.updated':
      return `Updated secret ${getDetailText(event.details, 'secretKey')}`.trim();
    case 'secret.archived':
      return `Archived secret ${getDetailText(event.details, 'secretKey')}`.trim();
    case 'secret.values_read':
      return 'Read secret values through CLI';
    case 'pat.created':
      return 'Created personal access token';
    case 'pat.revoked':
      return 'Revoked personal access token';
  }
}

function getDetailText(details: AuditEventDetails, key: string): string {
  const value = details[key];

  return typeof value === 'string' && value.length > 0 ? value : '';
}

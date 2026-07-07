import { ForbiddenException } from '@nestjs/common';

import { type AuthenticatedRequest } from '../../auth/contracts/authenticated-request';
import { AuditEventsController } from '../../audit-events/audit-events.controller';
import { AuditEventsService } from '../../audit-events/audit-events.service';
import { type AuditEventListResponseDto } from '../../audit-events/contracts/audit-event-response.dto';
import { ProjectMembershipEntity } from '../../projects/entities/project-membership.entity';
import { ProjectRole } from '../../projects/entities/project-role.enum';
import { ProjectEntity } from '../../projects/entities/project.entity';
import { ProjectAccessService } from '../../projects/project-access.service';
import { ProjectMembershipsRepository } from '../../projects/repositories/project-memberships.repository';

type AuditEventsServiceMock = {
  listProjectEvents: jest.Mock<Promise<AuditEventListResponseDto>, [string]>;
};

type ProjectMembershipsRepositoryMock = {
  findActiveProjectByProjectAndUser: jest.Mock<
    Promise<ProjectMembershipEntity | null>,
    [string, string]
  >;
};

const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const now = new Date('2026-07-04T12:00:00.000Z');

function createRequest(): AuthenticatedRequest {
  return {
    user: { id: userId }
  } as AuthenticatedRequest;
}

function createMembership(role: ProjectRole): ProjectMembershipEntity {
  const project = Object.assign(new ProjectEntity(), {
    id: projectId,
    name: 'Payments API',
    description: null,
    repositoryUrl: null,
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    archivedAt: null
  });

  return Object.assign(new ProjectMembershipEntity(), {
    id: '77c14d50-d566-4a7e-b459-2c6cd1f64a60',
    projectId,
    userId,
    role,
    addedByUserId: userId,
    createdAt: now,
    updatedAt: now,
    project
  });
}

describe('AuditEventsController', () => {
  let controller: AuditEventsController;
  let auditEventsService: AuditEventsServiceMock;
  let projectMembershipsRepository: ProjectMembershipsRepositoryMock;

  beforeEach(() => {
    auditEventsService = {
      listProjectEvents: jest.fn<Promise<AuditEventListResponseDto>, [string]>(() =>
        Promise.resolve({ items: [] })
      )
    };
    projectMembershipsRepository = {
      findActiveProjectByProjectAndUser: jest.fn<
        Promise<ProjectMembershipEntity | null>,
        [string, string]
      >(() => Promise.resolve(createMembership(ProjectRole.OWNER)))
    };

    controller = new AuditEventsController(
      auditEventsService as unknown as AuditEventsService,
      new ProjectAccessService(
        projectMembershipsRepository as unknown as ProjectMembershipsRepository
      )
    );
  });

  it.each([ProjectRole.OWNER, ProjectRole.MAINTAINER])(
    'allows %s members to view audit events',
    async (role) => {
      projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
        createMembership(role)
      );

      await expect(controller.list(createRequest(), projectId)).resolves.toEqual({ items: [] });

      expect(auditEventsService.listProjectEvents).toHaveBeenCalledWith(projectId);
    }
  );

  it('blocks developers from viewing audit events', async () => {
    projectMembershipsRepository.findActiveProjectByProjectAndUser.mockResolvedValueOnce(
      createMembership(ProjectRole.DEVELOPER)
    );

    await expect(controller.list(createRequest(), projectId)).rejects.toBeInstanceOf(
      ForbiddenException
    );

    expect(auditEventsService.listProjectEvents).not.toHaveBeenCalled();
  });
});

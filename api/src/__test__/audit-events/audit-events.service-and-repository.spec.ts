import { Logger } from '@nestjs/common';
import { type EntityManager, type FindManyOptions, type Repository } from 'typeorm';

import { type AuditAction } from '../../audit-events/audit-event.types';
import { AuditEventsService } from '../../audit-events/audit-events.service';
import { toAuditEventResponse } from '../../audit-events/contracts/audit-event-response.dto';
import { AuditEventEntity } from '../../audit-events/entities/audit-event.entity';
import {
  type CreateAuditEventRecord,
  AuditEventsRepository
} from '../../audit-events/repositories/audit-events.repository';
import { UserEntity } from '../../users/entities/user.entity';

type TypeOrmAuditRepositoryMock = {
  create: jest.Mock<AuditEventEntity, [Partial<AuditEventEntity>]>;
  save: jest.Mock<Promise<AuditEventEntity>, [AuditEventEntity]>;
  find: jest.Mock<Promise<AuditEventEntity[]>, [FindManyOptions<AuditEventEntity>]>;
};

const projectId = 'd251ec7d-8e99-499c-a9c2-8dcbb847492d';
const userId = '9942365e-cb78-4f24-9f33-5b4a821759a4';
const eventId = '0560467e-9b1b-4527-a447-22b327970776';
const now = new Date('2026-07-04T12:00:00.000Z');

function createEvent(overrides: Partial<AuditEventEntity> = {}): AuditEventEntity {
  return Object.assign(new AuditEventEntity(), {
    id: eventId,
    projectId,
    environmentId: null,
    actorUserId: userId,
    action: 'project.created',
    targetType: 'project',
    targetId: projectId,
    details: {},
    createdAt: now,
    actorUser: undefined,
    ...overrides
  });
}

function createTypeOrmRepository(): TypeOrmAuditRepositoryMock {
  return {
    create: jest.fn<AuditEventEntity, [Partial<AuditEventEntity>]>((input) => createEvent(input)),
    save: jest.fn<Promise<AuditEventEntity>, [AuditEventEntity]>((event) => Promise.resolve(event)),
    find: jest.fn<Promise<AuditEventEntity[]>, [FindManyOptions<AuditEventEntity>]>(() =>
      Promise.resolve([])
    )
  };
}

describe('audit event response mapping', () => {
  const summaries: Array<[AuditAction, string, Record<string, unknown>]> = [
    ['project.created', 'Created project', {}],
    ['project.updated', 'Updated project', {}],
    ['project.archived', 'Archived project', {}],
    ['environment.created', 'Created environment', {}],
    ['environment.updated', 'Updated environment', {}],
    ['environment.archived', 'Archived environment', {}],
    ['project_member.added', 'Added project member', {}],
    ['project_member.role_updated', 'Updated project member role', {}],
    ['project_member.removed', 'Removed project member', {}],
    ['secret.created', 'Created secret DATABASE_URL', { secretKey: 'DATABASE_URL' }],
    ['secret.updated', 'Updated secret', { secretKey: '' }],
    ['secret.archived', 'Archived secret', { secretKey: 42 }],
    ['secret.values_read', 'Read secret values through CLI', {}],
    ['pat.created', 'Created personal access token', {}],
    ['pat.revoked', 'Revoked personal access token', {}]
  ];

  it.each(summaries)('maps %s to its public summary', (action, summary, details) => {
    const response = toAuditEventResponse(createEvent({ action, details }));

    expect(response).toMatchObject({
      action,
      actorEmail: null,
      createdAt: now.toISOString(),
      details,
      summary
    });
  });

  it('includes the actor email when the actor relation is loaded', () => {
    const actorUser = Object.assign(new UserEntity(), { email: 'owner@example.com' });

    expect(toAuditEventResponse(createEvent({ actorUser })).actorEmail).toBe('owner@example.com');
  });
});

describe('AuditEventsRepository', () => {
  let typeOrmRepository: TypeOrmAuditRepositoryMock;
  let repository: AuditEventsRepository;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    typeOrmRepository = createTypeOrmRepository();
    repository = new AuditEventsRepository(
      typeOrmRepository as unknown as Repository<AuditEventEntity>
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates events with defaults through the injected repository', async () => {
    const input: CreateAuditEventRecord = {
      projectId,
      actorUserId: userId,
      action: 'project.created',
      targetType: 'project'
    };

    await expect(repository.create(input)).resolves.toMatchObject({
      environmentId: null,
      targetId: null,
      details: {}
    });
    expect(typeOrmRepository.create).toHaveBeenCalledWith({
      ...input,
      environmentId: null,
      targetId: null,
      details: {}
    });
  });

  it('uses a transaction repository and preserves optional event fields', async () => {
    const managerRepository = createTypeOrmRepository();
    const getRepository = jest.fn(
      () => managerRepository as unknown as Repository<AuditEventEntity>
    );
    const manager = { getRepository } as unknown as EntityManager;
    const input: CreateAuditEventRecord = {
      projectId,
      environmentId: '852c0a19-ee9b-405a-b51a-fc6c47346c14',
      actorUserId: userId,
      action: 'secret.created',
      targetType: 'secret',
      targetId: '5ca92a87-a385-4cf6-973d-4f3b3fa3324c',
      details: { secretKey: 'DATABASE_URL' }
    };

    await repository.create(input, manager);

    expect(getRepository).toHaveBeenCalledWith(AuditEventEntity);
    expect(managerRepository.create).toHaveBeenCalledWith(input);
    expect(typeOrmRepository.create).not.toHaveBeenCalled();
  });

  it('lists project events newest first with actors and a caller-supplied limit', async () => {
    await repository.findNewestByProject(projectId, 25);

    expect(typeOrmRepository.find).toHaveBeenCalledWith({
      where: { projectId },
      relations: { actorUser: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 25
    });
  });
});

describe('AuditEventsService', () => {
  it('forwards event creation with its transaction manager', async () => {
    const repository = {
      create: jest.fn(() => Promise.resolve(createEvent())),
      findNewestByProject: jest.fn()
    };
    const service = new AuditEventsService(repository as unknown as AuditEventsRepository);
    const manager = {} as EntityManager;
    const input: CreateAuditEventRecord = {
      projectId,
      actorUserId: userId,
      action: 'project.created',
      targetType: 'project'
    };

    await expect(service.record(input, manager)).resolves.toBeUndefined();
    expect(repository.create).toHaveBeenCalledWith(input, manager);
  });

  it('lists and maps the newest 50 project events', async () => {
    const event = createEvent();
    const repository = {
      create: jest.fn(),
      findNewestByProject: jest.fn(() => Promise.resolve([event]))
    };
    const service = new AuditEventsService(repository as unknown as AuditEventsRepository);

    await expect(service.listProjectEvents(projectId)).resolves.toEqual({
      items: [expect.objectContaining({ id: eventId, summary: 'Created project' })]
    });
    expect(repository.findNewestByProject).toHaveBeenCalledWith(projectId, 50);
  });
});

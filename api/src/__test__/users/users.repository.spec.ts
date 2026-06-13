import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { type Repository } from 'typeorm';

import { UserEntity } from '../../users/entities/user.entity';
import { UsersRepository } from '../../users/repositories/users.repository';

type TypeOrmUserRepositoryMock = {
  create: jest.Mock<UserEntity, [Partial<UserEntity>]>;
  save: jest.Mock<Promise<UserEntity>, [UserEntity]>;
  findOneBy: jest.Mock<Promise<UserEntity | null>, [Partial<UserEntity>]>;
};

function createUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return Object.assign(new UserEntity(), {
    id: 'f2e93f1e-52d7-4ba0-aa67-5d3719e6b0f4',
    email: 'user@example.com',
    passwordHash: 'hashed-password',
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides
  });
}

describe('UsersRepository', () => {
  let usersRepository: UsersRepository;
  let typeOrmRepository: TypeOrmUserRepositoryMock;
  let debugSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(async () => {
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    typeOrmRepository = {
      create: jest.fn<UserEntity, [Partial<UserEntity>]>((input) => createUser(input)),
      save: jest.fn<Promise<UserEntity>, [UserEntity]>((user) => Promise.resolve(user)),
      findOneBy: jest.fn<Promise<UserEntity | null>, [Partial<UserEntity>]>(() => Promise.resolve(null))
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: typeOrmRepository satisfies Partial<Repository<UserEntity>>
        }
      ]
    }).compile();

    usersRepository = module.get(UsersRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates users with a pending status by default', async () => {
    await expect(
      usersRepository.create({ email: 'new@example.com', passwordHash: 'hashed-password' })
    ).resolves.toMatchObject({
      email: 'new@example.com',
      passwordHash: 'hashed-password',
      status: 'pending'
    });

    expect(typeOrmRepository.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      passwordHash: 'hashed-password',
      status: 'pending'
    });
    expect(typeOrmRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', status: 'pending' })
    );
    expect(debugSpy).toHaveBeenCalledWith('Creating user record', {
      email: 'new@example.com',
      status: 'pending'
    });
    expect(logSpy).toHaveBeenCalledWith('User record created', {
      userId: 'f2e93f1e-52d7-4ba0-aa67-5d3719e6b0f4',
      email: 'new@example.com',
      status: 'pending'
    });
  });

  it('preserves explicit user status when creating users', async () => {
    await usersRepository.create({
      email: 'active@example.com',
      passwordHash: 'hashed-password',
      status: 'active'
    });

    expect(typeOrmRepository.create).toHaveBeenCalledWith({
      email: 'active@example.com',
      passwordHash: 'hashed-password',
      status: 'active'
    });
  });

  it('finds users by email', async () => {
    const user = createUser({ email: 'found@example.com' });
    typeOrmRepository.findOneBy.mockResolvedValueOnce(user);

    await expect(usersRepository.findByEmail('found@example.com')).resolves.toBe(user);

    expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({ email: 'found@example.com' });
    expect(debugSpy).toHaveBeenCalledWith('User lookup by email completed', {
      email: 'found@example.com',
      found: true,
      userId: user.id
    });
  });
});

import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { type Repository } from 'typeorm';

import { User } from '../../users/user.entity';
import { UsersRepository } from '../../users/users.repository';

type TypeOrmUserRepositoryMock = {
  create: jest.Mock<User, [Partial<User>]>;
  save: jest.Mock<Promise<User>, [User]>;
  findOneBy: jest.Mock<Promise<User | null>, [Partial<User>]>;
};

function createUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
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

  beforeEach(async () => {
    typeOrmRepository = {
      create: jest.fn<User, [Partial<User>]>((input) => createUser(input)),
      save: jest.fn<Promise<User>, [User]>((user) => Promise.resolve(user)),
      findOneBy: jest.fn<Promise<User | null>, [Partial<User>]>(() => Promise.resolve(null))
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        {
          provide: getRepositoryToken(User),
          useValue: typeOrmRepository satisfies Partial<Repository<User>>
        }
      ]
    }).compile();

    usersRepository = module.get(UsersRepository);
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
  });

  it('finds users by id', async () => {
    const user = createUser({ id: '84007988-2b77-4878-b3c0-4127f19ce217' });
    typeOrmRepository.findOneBy.mockResolvedValueOnce(user);

    await expect(usersRepository.findById('84007988-2b77-4878-b3c0-4127f19ce217')).resolves.toBe(
      user
    );

    expect(typeOrmRepository.findOneBy).toHaveBeenCalledWith({
      id: '84007988-2b77-4878-b3c0-4127f19ce217'
    });
  });
});

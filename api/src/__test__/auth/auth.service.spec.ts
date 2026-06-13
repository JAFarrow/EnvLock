import { ConflictException } from '@nestjs/common';

import { AuthService } from '../../auth/auth.service';
import { User } from '../../users/user.entity';
import { type CreateUserRecord, UsersRepository } from '../../users/users.repository';

type UsersRepositoryMock = {
  findByEmail: jest.Mock<Promise<User | null>, [string]>;
  create: jest.Mock<Promise<User>, [CreateUserRecord]>;
};

type PasswordHasherMock = {
  hash: jest.Mock<Promise<string>, [string]>;
};

function createUser(overrides: Partial<User> = {}): User {
  return Object.assign(new User(), {
    id: '9942365e-cb78-4f24-9f33-5b4a821759a4',
    email: 'user@example.com',
    passwordHash: 'hashed-password',
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides
  });
}

describe('AuthService', () => {
  let authService: AuthService;
  let usersRepository: UsersRepositoryMock;
  let passwordHasher: PasswordHasherMock;

  beforeEach(() => {
    usersRepository = {
      findByEmail: jest.fn<Promise<User | null>, [string]>(() => Promise.resolve(null)),
      create: jest.fn<Promise<User>, [CreateUserRecord]>((input) =>
        Promise.resolve(createUser({ ...input, id: '9942365e-cb78-4f24-9f33-5b4a821759a4' }))
      )
    };
    passwordHasher = {
      hash: jest.fn<Promise<string>, [string]>(() => Promise.resolve('hashed-password'))
    };

    authService = new AuthService(usersRepository as unknown as UsersRepository, passwordHasher);
  });

  it('registers a pending user with a hashed password', async () => {
    const result = await authService.register({
      email: 'new@example.com',
      password: 'long-password'
    });

    expect(usersRepository.findByEmail).toHaveBeenCalledWith('new@example.com');
    expect(passwordHasher.hash).toHaveBeenCalledWith('long-password');
    expect(usersRepository.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      passwordHash: 'hashed-password',
      status: 'pending'
    });
    expect(result).toEqual({
      id: '9942365e-cb78-4f24-9f33-5b4a821759a4',
      email: 'new@example.com',
      status: 'pending',
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate registrations before hashing passwords', async () => {
    usersRepository.findByEmail.mockResolvedValueOnce(createUser({ email: 'taken@example.com' }));

    await expect(
      authService.register({ email: 'taken@example.com', password: 'long-password' })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(usersRepository.create).not.toHaveBeenCalled();
  });

  it('leaves repository errors for exception filters', async () => {
    const error = new Error('duplicate key');
    usersRepository.create.mockRejectedValueOnce(error);

    await expect(
      authService.register({ email: 'race@example.com', password: 'long-password' })
    ).rejects.toBe(error);
  });

  it('rethrows unexpected repository errors', async () => {
    const error = new Error('database unavailable');
    usersRepository.create.mockRejectedValueOnce(error);

    await expect(
      authService.register({ email: 'new@example.com', password: 'long-password' })
    ).rejects.toBe(error);
  });
});

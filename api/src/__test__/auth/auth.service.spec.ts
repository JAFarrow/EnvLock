import {
  ConflictException,
  ForbiddenException,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AuthService } from '../../auth/auth.service';
import { EnvironmentVariables } from '../../config/environment';
import { UserEntity } from '../../users/entities/user.entity';
import { type CreateUserRecord, UsersRepository } from '../../users/repositories/users.repository';

type UsersRepositoryMock = {
  findByEmail: jest.Mock<Promise<UserEntity | null>, [string]>;
  create: jest.Mock<Promise<UserEntity>, [CreateUserRecord]>;
};

type PasswordHasherMock = {
  hash: jest.Mock<Promise<string>, [string]>;
  verify: jest.Mock<Promise<boolean>, [string, string]>;
};

type JwtServiceMock = {
  signAsync: jest.Mock<Promise<string>, [Record<string, unknown>]>;
};

type ConfigServiceMock = {
  get: jest.Mock<number, ['JWT_ACCESS_TOKEN_TTL_SECONDS', { infer: true }]>;
};

function createUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return Object.assign(new UserEntity(), {
    id: '9942365e-cb78-4f24-9f33-5b4a821759a4',
    email: 'user@example.com',
    passwordHash: 'hashed-password',
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides
  });
}

describe('AuthService', () => {
  let authService: AuthService;
  let usersRepository: UsersRepositoryMock;
  let passwordHasher: PasswordHasherMock;
  let jwtService: JwtServiceMock;
  let configService: ConfigServiceMock;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    usersRepository = {
      findByEmail: jest.fn<Promise<UserEntity | null>, [string]>(() => Promise.resolve(null)),
      create: jest.fn<Promise<UserEntity>, [CreateUserRecord]>((input) =>
        Promise.resolve(createUser({ ...input, id: '9942365e-cb78-4f24-9f33-5b4a821759a4' }))
      )
    };
    passwordHasher = {
      hash: jest.fn<Promise<string>, [string]>(() => Promise.resolve('hashed-password')),
      verify: jest.fn<Promise<boolean>, [string, string]>(() => Promise.resolve(true))
    };
    jwtService = {
      signAsync: jest.fn<Promise<string>, [Record<string, unknown>]>(() =>
        Promise.resolve('access-token')
      )
    };
    configService = {
      get: jest.fn<number, ['JWT_ACCESS_TOKEN_TTL_SECONDS', { infer: true }]>(() => 3600)
    };

    authService = new AuthService(
      usersRepository as unknown as UsersRepository,
      passwordHasher,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService<EnvironmentVariables, true>
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers an active user with a hashed password', async () => {
    const result = await authService.register({
      email: 'new@example.com',
      password: 'long-password'
    });

    expect(usersRepository.findByEmail).toHaveBeenCalledWith('new@example.com');
    expect(passwordHasher.hash).toHaveBeenCalledWith('long-password');
    expect(usersRepository.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      passwordHash: 'hashed-password',
      status: 'active'
    });
    expect(result).toEqual({
      id: '9942365e-cb78-4f24-9f33-5b4a821759a4',
      email: 'new@example.com',
      status: 'active',
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

  it('logs active users in with a bearer token', async () => {
    const user = createUser({ email: 'active@example.com', status: 'active' });
    usersRepository.findByEmail.mockResolvedValueOnce(user);

    await expect(
      authService.login({ email: 'active@example.com', password: 'long-password' })
    ).resolves.toEqual({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: user.id,
        email: 'active@example.com',
        status: 'active'
      }
    });

    expect(usersRepository.findByEmail).toHaveBeenCalledWith('active@example.com');
    expect(passwordHasher.verify).toHaveBeenCalledWith('hashed-password', 'long-password');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      email: 'active@example.com',
      status: 'active'
    });
    expect(configService.get).toHaveBeenCalledWith('JWT_ACCESS_TOKEN_TTL_SECONDS', { infer: true });
  });

  it('does not expose password hashes in login responses', async () => {
    usersRepository.findByEmail.mockResolvedValueOnce(createUser());

    const result = await authService.login({
      email: 'user@example.com',
      password: 'long-password'
    });

    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects login attempts for unknown emails', async () => {
    usersRepository.findByEmail.mockResolvedValueOnce(null);

    await expect(
      authService.login({ email: 'missing@example.com', password: 'long-password' })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(passwordHasher.verify).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects login attempts with invalid passwords', async () => {
    usersRepository.findByEmail.mockResolvedValueOnce(createUser());
    passwordHasher.verify.mockResolvedValueOnce(false);

    await expect(
      authService.login({ email: 'user@example.com', password: 'wrong-password' })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects disabled users', async () => {
    usersRepository.findByEmail.mockResolvedValueOnce(createUser({ status: 'disabled' }));

    await expect(
      authService.login({ email: 'user@example.com', password: 'long-password' })
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});

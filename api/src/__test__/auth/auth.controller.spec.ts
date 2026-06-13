import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from '../../auth/auth.controller';
import { AuthService, type LoginResult, type RegisteredUser } from '../../auth/auth.service';
import { type LoginUserInput } from '../../auth/contracts/login-user.schema';
import { type RegisterUserInput } from '../../auth/contracts/register-user.schema';

type AuthServiceMock = {
  register: jest.Mock<Promise<RegisteredUser>, [RegisterUserInput]>;
  login: jest.Mock<Promise<LoginResult>, [LoginUserInput]>;
};

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthServiceMock;
  const registeredUser: RegisteredUser = {
    id: '9942365e-cb78-4f24-9f33-5b4a821759a4',
    email: 'user@example.com',
    status: 'pending',
    createdAt: new Date('2026-01-01T00:00:00.000Z')
  };
  const loginResult: LoginResult = {
    accessToken: 'access-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: {
      id: '9942365e-cb78-4f24-9f33-5b4a821759a4',
      email: 'user@example.com',
      status: 'pending'
    }
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn<Promise<RegisteredUser>, [RegisterUserInput]>(() =>
        Promise.resolve(registeredUser)
      ),
      login: jest.fn<Promise<LoginResult>, [LoginUserInput]>(() => Promise.resolve(loginResult))
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService
        }
      ]
    }).compile();

    authController = module.get(AuthController);
  });

  it('registers users through the auth service', async () => {
    await expect(
      authController.register({ email: 'user@example.com', password: 'long-password' })
    ).resolves.toBe(registeredUser);

    expect(authService.register).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'long-password'
    });
  });

  it('logs users in through the auth service', async () => {
    await expect(
      authController.login({ email: 'user@example.com', password: 'long-password' })
    ).resolves.toBe(loginResult);

    expect(authService.login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'long-password'
    });
  });

});

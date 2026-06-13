import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from '../../auth/auth.controller';
import { AuthService, type RegisteredUser } from '../../auth/auth.service';
import { type RegisterUserInput } from '../../auth/register-user.schema';

type AuthServiceMock = {
  register: jest.Mock<Promise<RegisteredUser>, [RegisterUserInput]>;
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

  beforeEach(async () => {
    authService = {
      register: jest.fn<Promise<RegisteredUser>, [RegisterUserInput]>(() =>
        Promise.resolve(registeredUser)
      )
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
      authController.register({ email: ' User@Example.COM ', password: 'long-password' })
    ).resolves.toBe(registeredUser);

    expect(authService.register).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'long-password'
    });
  });

  it('rejects invalid email input', () => {
    expect(() =>
      authController.register({ email: 'not-an-email', password: 'long-password' })
    ).toThrow(BadRequestException);

    expect(authService.register).not.toHaveBeenCalled();
  });

  it('rejects short passwords', () => {
    expect(() =>
      authController.register({ email: 'user@example.com', password: 'too-short' })
    ).toThrow(BadRequestException);

    expect(authService.register).not.toHaveBeenCalled();
  });
});

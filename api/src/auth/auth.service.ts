import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { EnvironmentVariables } from '../config/environment';
import { type UserStatus } from '../users/user.entity';
import { UsersRepository } from '../users/users.repository';
import { type LoginUserInput } from './login-user.schema';
import { PasswordHasher } from './password-hasher';
import { type RegisterUserInput } from './register-user.schema';

export interface RegisteredUser {
  id: string;
  email: string;
  status: UserStatus;
  createdAt: Date;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthenticatedUser;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  status: UserStatus;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>
  ) {}

  async register(input: RegisterUserInput): Promise<RegisteredUser> {
    this.logger.debug('Registration attempt received', { email: input.email });

    const existingUser = await this.usersRepository.findByEmail(input.email);

    if (existingUser !== null) {
      this.logger.warn('Registration rejected: email already exists', {
        email: input.email,
        existingUserId: existingUser.id,
        existingUserStatus: existingUser.status
      });
      throw new ConflictException('A user with that email already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = await this.usersRepository.create({
      email: input.email,
      passwordHash,
      status: 'pending'
    });

    this.logger.log('User registered', {
      userId: user.id,
      email: user.email,
      status: user.status
    });

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt
    };
  }

  async login(input: LoginUserInput): Promise<LoginResult> {
    this.logger.debug('Login attempt received', { email: input.email });

    const user = await this.usersRepository.findByEmail(input.email);

    if (user === null) {
      this.logger.warn('Login rejected: user not found', { email: input.email });
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await this.passwordHasher.verify(user.passwordHash, input.password);

    if (!passwordMatches) {
      this.logger.warn('Login rejected: invalid password', {
        userId: user.id,
        email: user.email,
        status: user.status
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'disabled') {
      this.logger.warn('Login rejected: account disabled', {
        userId: user.id,
        email: user.email
      });
      throw new ForbiddenException('User account is disabled');
    }

    const expiresIn = this.configService.get('JWT_ACCESS_TOKEN_TTL_SECONDS', { infer: true });
    const tokenUser = {
      id: user.id,
      email: user.email,
      status: user.status
    };
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      status: user.status
    });

    this.logger.log('User logged in', {
      userId: user.id,
      email: user.email,
      status: user.status,
      expiresIn
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: tokenUser
    };
  }
}

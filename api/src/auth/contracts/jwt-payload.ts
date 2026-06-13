import { type UserStatus } from '../../users/entities/user.entity';

export interface JwtPayload {
  sub: string;
  email?: string;
  status?: UserStatus;
}

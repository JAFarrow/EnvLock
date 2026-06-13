import { type Request } from 'express';

export interface AuthenticatedRequestUser {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedRequestUser;
}

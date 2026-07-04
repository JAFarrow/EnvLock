import { type Request } from 'express';

export interface AuthenticatedPersonalAccessToken {
  id: string;
  projectId: string;
  userId: string;
}

export interface AuthenticatedPersonalAccessTokenRequest extends Request {
  user: AuthenticatedPersonalAccessToken;
}

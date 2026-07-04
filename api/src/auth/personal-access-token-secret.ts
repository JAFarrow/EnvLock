import { createHash } from 'node:crypto';

export const personalAccessTokenPrefix = 'envlock_pat';

export function hashPersonalAccessTokenSecret(tokenSecret: string): string {
  return createHash('sha256').update(tokenSecret, 'utf8').digest('hex');
}

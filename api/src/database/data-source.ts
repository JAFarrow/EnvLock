import 'reflect-metadata';

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DataSource } from 'typeorm';

import { validateEnvironment } from '../config/environment';
import { databaseEntities } from './entities';
import { InitialSchema2026070900000 } from './migrations/2026070900000-InitialSchema';

const apiEnvironmentFilePath = join(__dirname, '..', '..', '.env');

loadApiEnvironmentFile();

const environment = validateEnvironment(process.env);

export const apiDataSource = new DataSource({
  type: 'postgres',
  url: environment.DATABASE_URL,
  entities: databaseEntities,
  migrations: [InitialSchema2026070900000],
  synchronize: false
});

function loadApiEnvironmentFile(): void {
  if (!existsSync(apiEnvironmentFilePath)) {
    return;
  }

  for (const rawLine of readFileSync(apiEnvironmentFilePath, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (key.length === 0 || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = parseEnvironmentValue(line.slice(separatorIndex + 1).trim());
  }
}

function parseEnvironmentValue(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll('\\n', '\n');
  }

  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}

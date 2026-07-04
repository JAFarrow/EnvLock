import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type HealthStatus = 'ok' | 'error';

export type DependencyHealth = {
  status: HealthStatus;
};

export type HealthResponse = {
  status: HealthStatus;
  service: string;
  dependencies: {
    database: DependencyHealth;
  };
};

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async getHealth(): Promise<HealthResponse> {
    const dependencies = {
      database: await this.checkDatabase()
    };
    const status = Object.values(dependencies).every((dependency) => dependency.status === 'ok')
      ? 'ok'
      : 'error';

    return {
      status,
      service: 'envlock-api',
      dependencies
    };
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    try {
      await this.dataSource.query('SELECT 1');

      return { status: 'ok' };
    } catch {
      return { status: 'error' };
    }
  }
}

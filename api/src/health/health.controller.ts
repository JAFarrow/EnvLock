import { Controller, Get, HttpStatus, Res } from '@nestjs/common';

import { HealthService, type HealthResponse } from './health.service';

type StatusResponse = {
  status: (code: number) => void;
};

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth(@Res({ passthrough: true }) response: StatusResponse): Promise<HealthResponse> {
    const health = await this.healthService.getHealth();

    if (health.status === 'error') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return health;
  }
}

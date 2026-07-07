import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';

import { type AuthenticatedPersonalAccessTokenRequest } from '../auth/contracts/personal-access-token-request';
import { PersonalAccessTokenAuthGuard } from '../auth/guards/personal-access-token-auth.guard';
import { environmentSlugSchema } from '../environments/contracts/create-environment.dto';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { type CliSecretKeysResponseDto } from './contracts/cli-secret-keys.response.dto';
import { type CliSecretValuesResponseDto } from './contracts/cli-secret-values.response.dto';
import { SecretsService } from './secrets.service';

@Controller('cli/secrets')
@UseGuards(PersonalAccessTokenAuthGuard)
export class CliSecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  @Get('keys')
  @Header('Cache-Control', 'no-store')
  findKeys(
    @Req() request: AuthenticatedPersonalAccessTokenRequest,
    @Query(
      'environmentSlug',
      new ZodValidationPipe(environmentSlugSchema, 'Invalid environment slug')
    )
    environmentSlug: string
  ): Promise<CliSecretKeysResponseDto> {
    return this.secretsService.findCliKeys(request.user, environmentSlug);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  findValues(
    @Req() request: AuthenticatedPersonalAccessTokenRequest,
    @Query(
      'environmentSlug',
      new ZodValidationPipe(environmentSlugSchema, 'Invalid environment slug')
    )
    environmentSlug: string
  ): Promise<CliSecretValuesResponseDto> {
    return this.secretsService.findCliValues(request.user, environmentSlug);
  }
}

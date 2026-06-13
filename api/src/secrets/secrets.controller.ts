import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';

import { type AuthenticatedRequest } from '../auth/contracts/authenticated-request';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { createSecretSchema, type CreateSecretDto } from './contracts/create-secret.dto';
import { updateSecretSchema, type UpdateSecretDto } from './contracts/update-secret.dto';
import { type SecretListResponseDto } from './contracts/secret-list.response.dto';
import { type SecretResponseDto } from './contracts/secret.response.dto';
import { SecretsService } from './secrets.service';

@Controller('projects/:projectId/environments/:environmentId/secrets')
@UseGuards(JwtAuthGuard)
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('environmentId', new ParseUUIDPipe()) environmentId: string,
    @Body(new ZodValidationPipe(createSecretSchema, 'Invalid create secret request'))
    input: CreateSecretDto
  ): Promise<SecretResponseDto> {
    return this.secretsService.create(request.user.id, projectId, environmentId, input);
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('environmentId', new ParseUUIDPipe()) environmentId: string
  ): Promise<SecretListResponseDto> {
    return this.secretsService.findAll(request.user.id, projectId, environmentId);
  }

  @Patch(':secretId')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('environmentId', new ParseUUIDPipe()) environmentId: string,
    @Param('secretId', new ParseUUIDPipe()) secretId: string,
    @Body(new ZodValidationPipe(updateSecretSchema, 'Invalid update secret request'))
    input: UpdateSecretDto
  ): Promise<SecretResponseDto> {
    return this.secretsService.update(request.user.id, projectId, environmentId, secretId, input);
  }

  @Delete(':secretId')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('environmentId', new ParseUUIDPipe()) environmentId: string,
    @Param('secretId', new ParseUUIDPipe()) secretId: string
  ): Promise<void> {
    return this.secretsService.archive(request.user.id, projectId, environmentId, secretId);
  }
}

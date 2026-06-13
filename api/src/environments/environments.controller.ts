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
import {
  createEnvironmentSchema,
  type CreateEnvironmentDto
} from './contracts/create-environment.dto';
import {
  type EnvironmentListResponseDto,
  type EnvironmentResponseDto
} from './contracts/environment-response.dto';
import { updateEnvironmentSchema } from './contracts/update-environment.dto';
import { type UpdateEnvironmentDto } from './contracts/update-environment.dto';
import { EnvironmentsService } from './environments.service';

@Controller('projects/:projectId/environments')
@UseGuards(JwtAuthGuard)
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Post()
  createEnvironment(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(createEnvironmentSchema, 'Invalid create environment request'))
    input: CreateEnvironmentDto
  ): Promise<EnvironmentResponseDto> {
    return this.environmentsService.createEnvironment(request.user.id, projectId, input);
  }

  @Get()
  listEnvironments(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string
  ): Promise<EnvironmentListResponseDto> {
    return this.environmentsService.listEnvironments(request.user.id, projectId);
  }

  @Get(':environmentId')
  getEnvironment(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('environmentId', new ParseUUIDPipe()) environmentId: string
  ): Promise<EnvironmentResponseDto> {
    return this.environmentsService.getEnvironment(request.user.id, projectId, environmentId);
  }

  @Patch(':environmentId')
  updateEnvironment(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('environmentId', new ParseUUIDPipe()) environmentId: string,
    @Body(new ZodValidationPipe(updateEnvironmentSchema, 'Invalid update environment request'))
    input: UpdateEnvironmentDto
  ): Promise<EnvironmentResponseDto> {
    return this.environmentsService.updateEnvironment(
      request.user.id,
      projectId,
      environmentId,
      input
    );
  }

  @Delete(':environmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  archiveEnvironment(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('environmentId', new ParseUUIDPipe()) environmentId: string
  ): Promise<void> {
    return this.environmentsService.archiveEnvironment(request.user.id, projectId, environmentId);
  }
}

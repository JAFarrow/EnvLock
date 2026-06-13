import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';

import { type AuthenticatedRequest } from '../auth/contracts/authenticated-request';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { createEnvironmentSchema } from './contracts/create-environment.dto';
import {
  type EnvironmentListResponseDto,
  type EnvironmentResponseDto
} from './contracts/environment-response.dto';
import { updateEnvironmentSchema } from './contracts/update-environment.dto';
import { EnvironmentsService } from './environments.service';

@Controller('projects/:projectId/environments')
@UseGuards(JwtAuthGuard)
export class EnvironmentsController {
  private readonly logger = new Logger(EnvironmentsController.name);

  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Post()
  createEnvironment(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() body: unknown
  ): Promise<EnvironmentResponseDto> {
    const input = this.parseBody(
      createEnvironmentSchema,
      body,
      'Invalid create environment request'
    );

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
    @Body() body: unknown
  ): Promise<EnvironmentResponseDto> {
    const input = this.parseBody(
      updateEnvironmentSchema,
      body,
      'Invalid update environment request'
    );

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

  private parseBody<T>(schema: ZodType<T>, body: unknown, message: string): T {
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = this.formatZodErrors(result.error);

      this.logger.warn('Environment request validation failed', {
        fields: errors.map((error) => error.path),
        issueCount: errors.length
      });

      throw new BadRequestException({
        message,
        errors
      });
    }

    return result.data;
  }

  private formatZodErrors(error: ZodError): { path: string; message: string }[] {
    return error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
  }
}

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
import { createProjectSchema } from './contracts/create-project.dto';
import {
  type ProjectListResponseDto,
  type ProjectResponseDto
} from './contracts/project-response.dto';
import { ProjectsService } from './projects.service';
import { updateProjectSchema } from './contracts/update-project.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  createProject(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown
  ): Promise<ProjectResponseDto> {
    const input = this.parseBody(createProjectSchema, body, 'Invalid create project request');

    return this.projectsService.createProject(request.user.id, input);
  }

  @Get()
  listProjects(@Req() request: AuthenticatedRequest): Promise<ProjectListResponseDto> {
    return this.projectsService.listProjects(request.user.id);
  }

  @Get(':projectId')
  getProject(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string
  ): Promise<ProjectResponseDto> {
    return this.projectsService.getProject(request.user.id, projectId);
  }

  @Patch(':projectId')
  updateProject(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() body: unknown
  ): Promise<ProjectResponseDto> {
    const input = this.parseBody(updateProjectSchema, body, 'Invalid update project request');

    return this.projectsService.updateProject(request.user.id, projectId, input);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  archiveProject(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string
  ): Promise<void> {
    return this.projectsService.archiveProject(request.user.id, projectId);
  }

  private parseBody<T>(schema: ZodType<T>, body: unknown, message: string): T {
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = this.formatZodErrors(result.error);

      this.logger.warn('Project request validation failed', {
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

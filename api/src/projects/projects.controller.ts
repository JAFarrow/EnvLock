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
import { createProjectSchema, type CreateProjectDto } from './contracts/create-project.dto';
import {
  type ProjectListResponseDto,
  type ProjectResponseDto
} from './contracts/project-response.dto';
import { ProjectsService } from './projects.service';
import { updateProjectSchema, type UpdateProjectDto } from './contracts/update-project.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  createProject(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createProjectSchema, 'Invalid create project request'))
    input: CreateProjectDto
  ): Promise<ProjectResponseDto> {
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
    @Body(new ZodValidationPipe(updateProjectSchema, 'Invalid update project request'))
    input: UpdateProjectDto
  ): Promise<ProjectResponseDto> {
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
}

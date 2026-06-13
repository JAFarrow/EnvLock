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
  addProjectMemberSchema,
  type AddProjectMemberDto
} from './contracts/add-project-member.dto';
import { type ProjectMemberListResponseDto } from './contracts/project-member-list.response.dto';
import { type ProjectMemberResponseDto } from './contracts/project-member.response.dto';
import {
  updateProjectMemberRoleSchema,
  type UpdateProjectMemberRoleDto
} from './contracts/update-project-member-role.dto';
import { ProjectMembershipsService } from './project-memberships.service';

@Controller('projects/:projectId/members')
@UseGuards(JwtAuthGuard)
export class ProjectMembershipsController {
  constructor(private readonly projectMembershipsService: ProjectMembershipsService) {}

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string
  ): Promise<ProjectMemberListResponseDto> {
    return this.projectMembershipsService.findAll(request.user.id, projectId);
  }

  @Post()
  add(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(addProjectMemberSchema, 'Invalid add project member request'))
    input: AddProjectMemberDto
  ): Promise<ProjectMemberResponseDto> {
    return this.projectMembershipsService.add(request.user.id, projectId, input);
  }

  @Patch(':userId')
  updateRole(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body(
      new ZodValidationPipe(
        updateProjectMemberRoleSchema,
        'Invalid update project member role request'
      )
    )
    input: UpdateProjectMemberRoleDto
  ): Promise<ProjectMemberResponseDto> {
    return this.projectMembershipsService.updateRole(request.user.id, projectId, userId, input);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string
  ): Promise<void> {
    return this.projectMembershipsService.remove(request.user.id, projectId, userId);
  }
}

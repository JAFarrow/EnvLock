import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';

import { type AuthenticatedRequest } from '../auth/contracts/authenticated-request';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import {
  createProjectPersonalAccessTokenSchema,
  type CreateProjectPersonalAccessTokenDto
} from './contracts/create-project-personal-access-token.dto';
import { type ProjectPersonalAccessTokenResponseDto } from './contracts/project-personal-access-token.response.dto';
import { ProjectPersonalAccessTokensService } from './project-personal-access-tokens.service';

@Controller('projects/:projectId/pats')
@UseGuards(JwtAuthGuard)
export class ProjectPersonalAccessTokensController {
  constructor(private readonly personalAccessTokensService: ProjectPersonalAccessTokensService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body(
      new ZodValidationPipe(
        createProjectPersonalAccessTokenSchema,
        'Invalid create personal access token request'
      )
    )
    input: CreateProjectPersonalAccessTokenDto
  ): Promise<ProjectPersonalAccessTokenResponseDto> {
    return this.personalAccessTokensService.create(request.user.id, projectId, input);
  }

  @Delete(':tokenId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('tokenId', new ParseUUIDPipe()) tokenId: string
  ): Promise<void> {
    return this.personalAccessTokensService.revoke(request.user.id, projectId, tokenId);
  }
}

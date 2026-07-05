import {
  Body,
  Controller,
  Delete,
  Get,
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
  createPersonalAccessTokenSchema,
  type CreatePersonalAccessTokenDto
} from './contracts/create-personal-access-token.dto';
import {
  type PersonalAccessTokenListResponseDto,
  type PersonalAccessTokenResponseDto
} from './contracts/personal-access-token.response.dto';
import { PersonalAccessTokensService } from './personal-access-tokens.service';

@Controller('projects/:projectId/pats')
@UseGuards(JwtAuthGuard)
export class PersonalAccessTokensController {
  constructor(private readonly personalAccessTokensService: PersonalAccessTokensService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string
  ): Promise<PersonalAccessTokenListResponseDto> {
    return this.personalAccessTokensService.list(request.user.id, projectId);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body(
      new ZodValidationPipe(
        createPersonalAccessTokenSchema,
        'Invalid create personal access token request'
      )
    )
    input: CreatePersonalAccessTokenDto
  ): Promise<PersonalAccessTokenResponseDto> {
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

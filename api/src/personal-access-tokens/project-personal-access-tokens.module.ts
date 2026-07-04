import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectPersonalAccessTokenEntity } from './entities/project-personal-access-token.entity';
import { ProjectPersonalAccessTokensController } from './project-personal-access-tokens.controller';
import { ProjectPersonalAccessTokensService } from './project-personal-access-tokens.service';
import { ProjectPersonalAccessTokenRepository } from './repositories/project-personal-access-token.repository';

@Module({
  imports: [
    AuthModule,
    ProjectsModule,
    TypeOrmModule.forFeature([ProjectPersonalAccessTokenEntity])
  ],
  controllers: [ProjectPersonalAccessTokensController],
  providers: [ProjectPersonalAccessTokensService, ProjectPersonalAccessTokenRepository]
})
export class ProjectPersonalAccessTokensModule {}

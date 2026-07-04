import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { PersonalAccessTokenEntity } from './entities/personal-access-token.entity';
import { PersonalAccessTokensController } from './personal-access-tokens.controller';
import { PersonalAccessTokensService } from './personal-access-tokens.service';
import { PersonalAccessTokenRepository } from './repositories/personal-access-token.repository';

@Module({
  imports: [AuthModule, ProjectsModule, TypeOrmModule.forFeature([PersonalAccessTokenEntity])],
  controllers: [PersonalAccessTokensController],
  providers: [PersonalAccessTokensService, PersonalAccessTokenRepository]
})
export class PersonalAccessTokensModule {}

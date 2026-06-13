import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { EnvironmentsController } from './environments.controller';
import { EnvironmentsService } from './environments.service';
import { EnvironmentEntity } from './entities/environment.entity';
import { EnvironmentRepository } from './repositories/environment.repository';

@Module({
  imports: [AuthModule, ProjectsModule, TypeOrmModule.forFeature([EnvironmentEntity])],
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService, EnvironmentRepository],
  exports: [EnvironmentRepository]
})
export class EnvironmentsModule {}

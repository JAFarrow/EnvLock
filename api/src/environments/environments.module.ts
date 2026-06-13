import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EnvironmentEntity } from './entities/environment.entity';
import { EnvironmentRepository } from './repositories/environment.repository';

@Module({
  imports: [TypeOrmModule.forFeature([EnvironmentEntity])],
  providers: [EnvironmentRepository],
  exports: [EnvironmentRepository]
})
export class EnvironmentsModule {}

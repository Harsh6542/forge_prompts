import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiModule } from '../../shared/ai/ai.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { Grievance } from './grievance.entity.js';
import { GrievanceTriageService } from './grievance.agent.js';
import { GrievanceController } from './grievance.controller.js';

@Module({
  imports: [AiModule, AuthModule, SequelizeModule.forFeature([Grievance])],
  controllers: [GrievanceController],
  providers: [GrievanceTriageService],
  exports: [GrievanceTriageService],
})
export class GrievanceModule {}

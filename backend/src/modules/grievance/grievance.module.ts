import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiModule } from '../../shared/ai/ai.module.js';
import { Grievance } from './grievance.entity.js';
import { GrievanceTriageService } from './grievance.agent.js';
import { GrievanceController } from './grievance.controller.js';

@Module({
  imports: [AiModule, SequelizeModule.forFeature([Grievance])],
  controllers: [GrievanceController],
  providers: [GrievanceTriageService],
  exports: [GrievanceTriageService],
})
export class GrievanceModule {}

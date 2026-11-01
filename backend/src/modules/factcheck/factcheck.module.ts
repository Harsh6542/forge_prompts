import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiModule } from '../../shared/ai/ai.module.js';
import { FactCheck } from './factcheck.entity.js';
import { FactCheckAgentService } from './factcheck.agent.js';
import { FactCheckController } from './factcheck.controller.js';

@Module({
  imports: [AiModule, SequelizeModule.forFeature([FactCheck])],
  controllers: [FactCheckController],
  providers: [FactCheckAgentService],
  exports: [FactCheckAgentService],
})
export class FactCheckModule {}

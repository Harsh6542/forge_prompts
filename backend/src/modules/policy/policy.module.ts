import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiModule } from '../../shared/ai/ai.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { PolicyChunk } from './policy-chunk.entity.js';
import { PolicyAgentService } from './policy.agent.js';
import { PolicyController } from './policy.controller.js';
import { PolicyIngestService } from './policy-ingest.service.js';

@Module({
  imports: [AiModule, AuthModule, SequelizeModule.forFeature([PolicyChunk])],
  controllers: [PolicyController],
  providers: [PolicyAgentService, PolicyIngestService],
  exports: [PolicyAgentService, PolicyIngestService],
})
export class PolicyModule {}

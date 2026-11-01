import { Module } from '@nestjs/common';
import { AiModule } from '../../shared/ai/ai.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { AgentGateway } from './agent.gateway.js';
import { BrowserAgentService } from './browser.agent.js';

@Module({
  imports: [AiModule, AuthModule],
  providers: [BrowserAgentService, AgentGateway],
  exports: [BrowserAgentService],
})
export class ServiceAgentModule {}

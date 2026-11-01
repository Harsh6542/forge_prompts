import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { InputPipelineController } from './input-pipeline.controller.js';
import { InputPipelineService } from './input-pipeline.service.js';

@Module({
  imports: [AiModule],
  controllers: [InputPipelineController],
  providers: [InputPipelineService],
  exports: [InputPipelineService],
})
export class InputPipelineModule {}

import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service.js';
import { MistralAiService } from './mistral.service.js';
import { SarvamService } from './sarvam.service.js';

@Module({
  providers: [SarvamService, MistralAiService, CloudinaryService],
  exports: [SarvamService, MistralAiService, CloudinaryService],
})
export class AiModule {}

import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { InputPipelineService } from './input-pipeline.service.js';
import type { UnifiedCitizenInputContext } from './types.js';

function classifyMime(mime: string | undefined): 'audio' | 'image' | 'video' | null {
  if (!mime) return null;
  const m = mime.split(';')[0].trim().toLowerCase();
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (/^image\/(jpe?g|png|webp|heic|heif|avif)$/i.test(m)) return 'image';
  return null;
}

@ApiTags('input')
@Controller('input')
@UseGuards(ThrottlerGuard)
export class InputPipelineController {
  private readonly logger = new Logger(InputPipelineController.name);

  constructor(private readonly pipeline: InputPipelineService) {}

  @ApiOperation({ summary: 'Auto-detect input type, normalize to English' })
  @Post('auto')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async auto(
    @UploadedFile() file?: Express.Multer.File,
    @Body('text') text?: string,
    @Body('language') language?: string,
  ): Promise<UnifiedCitizenInputContext> {
    const target = language?.trim() || undefined;

    const run = (inputType: string, fn: () => Promise<UnifiedCitizenInputContext>) =>
      fn().catch((err: unknown) => {
        if (err instanceof HttpException) throw err;
        this.logger.error(`${inputType} pipeline error`, err as Error);
        throw new HttpException(
          `Input pipeline failed on ${inputType}: ${(err as Error)?.message ?? 'unknown'}`,
          HttpStatus.BAD_REQUEST,
        );
      });

    if (file?.buffer?.length) {
      const kind = classifyMime(file.mimetype);
      switch (kind) {
        case 'audio':
          return run('audio', () => this.pipeline.runAudioPipeline(file.buffer, file.mimetype, target));
        case 'image':
          return run('image', () => this.pipeline.runImagePipeline(file.buffer, target));
        case 'video':
          return run('video', () => this.pipeline.runVideoPipeline(file.buffer, target));
        default:
          throw new HttpException(
            `Unsupported file type '${file.mimetype}' — accept: audio/*, image/*, video/*`,
            HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          );
      }
    }

    const rawText = (text ?? '').trim();
    if (!rawText) {
      throw new HttpException(
        "Provide either a multipart file field 'file' or a 'text' field",
        HttpStatus.BAD_REQUEST,
      );
    }
    return run('text', () => this.pipeline.runTextPipeline(rawText, target));
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { GrievanceTriageService } from './grievance.agent.js';
import { GrievanceSubmitDto } from './grievance.dto.js';
import { Grievance } from './grievance.entity.js';

@ApiTags('grievance')
@Controller('grievance')
@UseGuards(ThrottlerGuard)
export class GrievanceController {
  constructor(private readonly triage: GrievanceTriageService) {}

  @ApiOperation({ summary: 'Submit grievance — AI severity triage + department routing' })
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('media', 3, {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async submit(
    @Body() dto: GrievanceSubmitDto,
    @UploadedFiles() media?: Express.Multer.File[],
  ) {
    return this.triage.triageSubmit({
      dto,
      mediaFiles: (media ?? []).filter((f) => f.mimetype.startsWith('image/')),
      reportedById: null,
    });
  }

  @ApiOperation({ summary: 'Track grievance by tracking ID' })
  @Get('track/:trackingId')
  track(@Param('trackingId') trackingId: string): Promise<Grievance> {
    return this.triage.findByTrackingId(trackingId);
  }
}

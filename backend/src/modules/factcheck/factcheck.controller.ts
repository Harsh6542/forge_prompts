import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { FactCheckAgentService } from './factcheck.agent.js';
import { FactCheckRequestDto } from './factcheck.dto.js';

@ApiTags('factcheck')
@Controller('factcheck')
@UseGuards(ThrottlerGuard)
export class FactCheckController {
  constructor(private readonly agent: FactCheckAgentService) {}

  @ApiOperation({ summary: 'Verify a viral claim (SSE pipeline: claims → evidence → forensics → verdict)' })
  @Post('verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verify(@Body() dto: FactCheckRequestDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const event of this.agent.runFactCheck(dto)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.stage === 'complete' || event.stage === 'error') break;
      }
    } catch {
      res.write(
        `data: ${JSON.stringify({ stage: 'error', message: 'Stream interrupted', code: 'STREAM_ERROR' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }
}

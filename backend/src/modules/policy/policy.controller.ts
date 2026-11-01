import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthGuard } from '../../guards/auth.guard.js';
import { RoleGuard } from '../../guards/role.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { PolicyAgentService } from './policy.agent.js';
import { PolicyIngestDto, PolicyQueryDto } from './policy.dto.js';
import { PolicyIngestService } from './policy-ingest.service.js';

@ApiTags('policy')
@Controller('policy')
@UseGuards(ThrottlerGuard)
export class PolicyController {
  constructor(
    private readonly agent: PolicyAgentService,
    private readonly policyIngest: PolicyIngestService,
  ) {}

  @ApiOperation({ summary: 'RAG answer stream (SSE) — 6-stage pipeline' })
  @Post('query')
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async query(@Body() dto: PolicyQueryDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const event of this.agent.runPolicyQuery(dto)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.stage === 'complete') break;
      }
    } catch {
      res.write(
        `data: ${JSON.stringify({ stage: 'error', message: 'Stream interrupted', code: 'STREAM_ERROR' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  @ApiOperation({ summary: 'Knowledge-base browser — distinct schemes with chunk counts' })
  @Get('schemes')
  schemes() {
    return this.policyIngest.listSchemes();
  }

  @ApiOperation({ summary: 'Ingest policy documents (chunk + embed); superadmin only' })
  @Post('ingest')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles('superadmin')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  ingest(@Body() dto: PolicyIngestDto) {
    return this.policyIngest.ingestDocuments(dto.documents);
  }
}

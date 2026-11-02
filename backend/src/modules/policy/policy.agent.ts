import { HttpException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Sequelize } from 'sequelize';
import { QueryTypes } from 'sequelize';
import { InjectConnection } from '@nestjs/sequelize';
import { CloudinaryService } from '../../shared/ai/cloudinary.service.js';
import { MistralAiService } from '../../shared/ai/mistral.service.js';
import { SarvamService } from '../../shared/ai/sarvam.service.js';
import { detectLanguageFromUnicode } from '../../shared/input-pipeline/language.util.js';
import type { RetrievedPolicySource } from './policy.events.js';
import { PolicyQueryDto } from './policy.dto.js';
import { PolicyChunk } from './policy-chunk.entity.js';

export type PolicyAgentEvent =
  | { stage: 'detecting_language'; message: string }
  | { stage: 'searching'; message: string }
  | { stage: 'found_sources'; count: number; sources: RetrievedPolicySource[] }
  | { stage: 'generating'; message: string }
  | { stage: 'streaming_token'; token: string }
  | { stage: 'translating'; message: string }
  | { stage: 'translated'; text: string }
  | { stage: 'generating_voice'; message: string }
  | { stage: 'voice_ready'; audioUrl: string }
  | { stage: 'complete'; answer: string; sources: RetrievedPolicySource[]; audioUrl?: string }
  | { stage: 'error'; message: string; code: string };

export const POLICY_SYSTEM_PROMPT = `You are JanSetu, an expert advisor on Indian government schemes, welfare programs,
and citizen rights. You serve ordinary Indian citizens — farmers, daily wage workers,
students, small business owners — who need clear, actionable information.

RULES:
- Always use simple, conversational language. No legal jargon.
- Never make up information. If not in context, say so clearly.
- Always cite the scheme name and its official portal.
- Be specific: give exact rupee amounts, eligibility criteria, deadlines.

RESPONSE FORMAT (use these exact emoji headers):
📋 **WHAT IS IT**: [1-2 sentence plain-language summary]
✅ **WHO IS ELIGIBLE**: [bullet list of eligibility criteria]
💰 **KEY BENEFITS**: [specific amounts, services, entitlements]
📝 **HOW TO APPLY**: [numbered step-by-step process]
⚠️ **IMPORTANT DEADLINES**: [dates if applicable, else omit section]
📞 **GET HELP**: [helpline numbers and official website URLs]

CONTEXT FROM OFFICIAL SOURCES:
{retrievedContextString}

If a question has no relevant context, respond:
"I don't have verified information about this specific topic. Please visit the official
MyScheme portal (myscheme.gov.in) or call the citizen helpline at 1800-11-2345."`;

const FALLBACK_ANSWER =
  "I don't have verified information about this specific topic. Please visit the official MyScheme portal (myscheme.gov.in) or call the citizen helpline at 1800-11-2345.";

interface CandidateChunk {
  chunkId: number;
  schemeName: string;
  sourceUrl: string;
  content: string;
  hybridScore: number;
}

@Injectable()
export class PolicyAgentService {
  private readonly logger = new Logger(PolicyAgentService.name);

  constructor(
    private readonly mistral: MistralAiService,
    private readonly sarvam: SarvamService,
    private readonly cloudinary: CloudinaryService,
    @InjectConnection() private readonly sequelize: Sequelize,
  ) {}

  async *runPolicyQuery(dto: PolicyQueryDto): AsyncGenerator<PolicyAgentEvent> {
    try {
      yield { stage: 'detecting_language', message: 'Detecting query language…' };
      const detected = detectLanguageFromUnicode(dto.query);
      let queryEn = dto.query;
      if (detected.code !== 'en') {
        queryEn = await this.sarvam.translateToEnglish(dto.query, detected.code);
      }

      yield { stage: 'searching', message: 'Searching the policy knowledge base…' };
      const top = await this.hybridRetrieve(queryEn, dto);

      if (top.length === 0) {
        yield {
          stage: 'complete',
          answer: FALLBACK_ANSWER,
          sources: [],
        };
        return;
      }

      const sources: RetrievedPolicySource[] = top.map((c) => ({
        title: c.schemeName,
        schemeName: c.schemeName,
        portalUrl: c.sourceUrl,
        category: 'scheme',
        relevanceScore: Number(c.hybridScore.toFixed(4)),
      }));

      yield { stage: 'found_sources', count: top.length, sources };

      yield { stage: 'generating', message: 'Drafting a citizen-friendly answer…' };
      const contextString = top
        .map((c, i) => `[${i + 1}] ${c.schemeName}\nSource: ${c.sourceUrl}\n${c.content}`)
        .join('\n---\n');
      const systemPrompt = POLICY_SYSTEM_PROMPT.replace(
        '{retrievedContextString}',
        contextString,
      );

      let answer = '';
      for await (const token of this.mistral.streamChatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: queryEn },
      ])) {
        answer += token;
        yield { stage: 'streaming_token', token };
      }

      if (!answer.trim()) {
        answer = FALLBACK_ANSWER;
        yield { stage: 'streaming_token', token: answer };
      }

      const targetLang = (dto.language ?? detected.code).split('-')[0];
      let finalAnswer = answer;
      let audioUrl: string | undefined;
      if (targetLang !== 'en') {
        yield { stage: 'translating', message: `Translating answer to '${targetLang}'…` };
        finalAnswer = await this.sarvam.translateText(answer, 'en', targetLang);
        yield { stage: 'translated', text: finalAnswer };
      }

      if (String(dto.generateVoice) === 'true' && finalAnswer.trim()) {
        yield { stage: 'generating_voice', message: `Synthesizing voice ('meera')…` };
        try {
          const wav = await this.sarvam.synthesizeSpeech(finalAnswer, targetLang);
          const upload = await this.cloudinary.uploadAudioBuffer(wav, 'policy-voice');
          if (upload.url) {
            audioUrl = upload.url;
            yield { stage: 'voice_ready', audioUrl };
          }
        } catch (err) {
          this.logger.warn(`TTS failed silently: ${(err as Error).message}`);
        }
      }

      yield { stage: 'complete', answer: finalAnswer, sources, ...(audioUrl ? { audioUrl } : {}) };
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        yield {
          stage: 'error',
          message: String(err.getResponse?.() ?? err.message),
          code: String(err.getStatus()),
        };
        return;
      }
      this.logger.error(
        `Policy query failed: ${(err as Error).message} | cause: ${
          (err as { cause?: { code?: string; message?: string } })?.cause?.code ?? 'unknown'
        } ${(err as { cause?: { message?: string } })?.cause?.message ?? ''}`,
        (err as Error).stack,
      );
      yield {
        stage: 'error',
        message: (err as Error)?.message ?? 'Policy agent failure',
        code: 'POLICY_AGENT_ERROR',
      };
    }
  }

  private async hybridRetrieve(queryEn: string, dto: PolicyQueryDto): Promise<CandidateChunk[]> {
    const [dense, sparse] = await Promise.all([
      this.denseRetrieve(queryEn, dto),
      this.sparseRetrieve(queryEn),
    ]);

    const merged = new Map<number, CandidateChunk>();
    for (const d of dense) merged.set(d.chunkId, d);
    for (const s of sparse) {
      const existing = merged.get(s.chunkId);
      if (existing) existing.hybridScore = Math.max(existing.hybridScore, s.hybridScore);
      else merged.set(s.chunkId, s);
    }
    return [...merged.values()].sort((a, b) => b.hybridScore - a.hybridScore).slice(0, 5);
  }

  private async denseRetrieve(queryEn: string, dto: PolicyQueryDto): Promise<CandidateChunk[]> {
    const where: Record<string, unknown> = {};
    if (dto.category) where['category'] = dto.category;
    if (dto.state) where['state'] = dto.state;

    const candidates = await PolicyChunk.findAll({
      where,
      limit: 200,
      attributes: ['id', 'schemeName', 'sourceUrl', 'content', 'embedding'],
    });
    if (candidates.length === 0) return [];

    const qvec = await this.mistral.generateEmbedding(queryEn);
    const results: CandidateChunk[] = [];
    for (const c of candidates) {
      const emb = c.get('embedding') as number[] | null;
      if (!emb?.length) continue;
      const sim = cosine(qvec, emb);
      if (sim >= 0.65) {
        results.push({
          chunkId: c.get('id') as number,
          schemeName: c.get('schemeName') as string,
          sourceUrl: c.get('sourceUrl') as string,
          content: c.get('content') as string,
          hybridScore: sim * 0.6,
        });
      }
    }
    return results;
  }

  private async sparseRetrieve(queryEn: string): Promise<CandidateChunk[]> {
    const words = queryEn
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 12)
      .join(' ');
    if (!words) return [];

    const rows = (await this.sequelize.query(
      `SELECT id, schemeName, sourceUrl, content,
              MATCH(content) AGAINST (:words IN NATURAL LANGUAGE MODE) AS score
       FROM policy_chunks
       WHERE MATCH(content) AGAINST (:words IN NATURAL LANGUAGE MODE)
       ORDER BY score DESC
       LIMIT 8`,
      { replacements: { words }, type: QueryTypes.SELECT },
    )) as unknown as Array<Record<string, unknown>>;

    const maxScore = Math.max(...rows.map((r) => Number(r['score'] ?? 0)), 0.0001);
    return rows.map((r) => ({
      chunkId: Number(r['id']),
      schemeName: String(r['schemeName']),
      sourceUrl: String(r['sourceUrl']),
      content: String(r['content']),
      hybridScore: (Number(r['score'] ?? 0) / maxScore) * 0.4,
    }));
  }
}

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

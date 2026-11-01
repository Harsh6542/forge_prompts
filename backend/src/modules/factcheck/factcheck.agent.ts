import { Logger } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { fetchWithRetry } from '../../shared/ai/fetch.util.js';
import { MistralAiService } from '../../shared/ai/mistral.service.js';
import { parseModelJson } from '../../shared/input-pipeline/util.js';
import { FactCheck, type FactCheckVerdict } from './factcheck.entity.js';
import type { FactCheckRequestDto } from './factcheck.dto.js';

export type FactCheckEvent =
  | { stage: 'extracting'; message: string }
  | {
      stage: 'claims_found';
      claims: string[];
      claimType: string;
      namedEntities: string[];
      datesMentioned: string[];
      statisticsOrNumbers: string[];
      redFlags: string[];
    }
  | { stage: 'searching'; message: string }
  | {
      stage: 'evidence_found';
      sourceTitle: string;
      sourceUrl: string;
      excerpt: string;
      credibilityScore: number;
      creditContext: string;
    }
  | { stage: 'forensics_running'; message: string }
  | { stage: 'forensics_done'; deepfakeScore: number; findings: string[]; overallAssessment: string }
  | { stage: 'synthesizing'; message: string }
  | {
      stage: 'complete';
      reportId: number;
      verdict: FactCheckVerdict;
      confidence: number;
      reasoning: string;
      evidence: VerificationEvidence[];
      deepfakeScore: number | null;
      recommendation: string;
    }
  | { stage: 'error'; message: string; code: string };

export interface VerificationEvidence {
  sourceTitle: string;
  sourceUrl: string;
  excerpt: string;
  credibilityScore: number;
  publishedDate: string | null;
}

export const FACTCHECK_CLAIM_EXTRACTION_PROMPT = `You are a professional fact-checker specializing in Indian news and civic information.
Analyze the following content and extract verifiable factual claims.

Content: "{content}"

Return ONLY valid JSON:
{
  "claims": ["<specific verifiable claim 1>", "<claim 2>", "<claim 3>"],
  "claimType": "political | health | disaster | financial | social | other",
  "namedEntities": ["<person/org/place names>"],
  "datesMentioned": ["<any dates in content>"],
  "statisticsOrNumbers": ["<any numbers, amounts, percentages>"],
  "sourceAttributions": ["<any sources cited in content>"],
  "redFlags": ["<any suspicious elements>"]
}

Focus on extracting claims that can be verified against official records.
Maximum 3 most important claims.`;

export const FACTCHECK_IMAGE_FORENSICS_PROMPT = `You are a digital forensics expert analyzing an image for signs of manipulation or misinformation.

Carefully examine this image and return ONLY valid JSON:
{
  "manipulationScore": <integer 0-100>,
  "findings": [
    "<specific observation about potential manipulation>",
    "<another finding>"
  ],
  "lightingConsistency": "consistent | inconsistent | uncertain",
  "shadowConsistency": "consistent | inconsistent | uncertain",
  "edgeArtifacts": <true|false>,
  "metadataClues": "<any visible creation tool, watermark, or platform overlay>",
  "contextMismatch": "<description of any date/location/event inconsistency, or null>",
  "overallAssessment": "authentic | likely_authentic | uncertain | likely_manipulated | definitely_manipulated",
  "forensicsReason": "<2-sentence explanation of your assessment>"
}

Manipulation score guide:
0-20: Authentic, no signs of editing
21-40: Minor edits possible (color correction, crop)
41-60: Moderate manipulation signs
61-80: Significant manipulation detected
81-100: Clear fabrication or heavy manipulation`;

export const FACTCHECK_VERDICT_PROMPT = `You are a senior fact-checker rendering a final verdict on a viral claim.

ORIGINAL CLAIM:
{content}

WEB EVIDENCE FOUND:
{evidenceJson}

{imageForgeryLine}

Based on the evidence quality, source credibility, and consistency, determine:

Return ONLY valid JSON:
{
  "verdict": "TRUE | FALSE | MISLEADING | UNVERIFIED | SATIRE",
  "confidence": <float 0.0-1.0>,
  "reasoning": "<2-3 sentence plain-language explanation for Indian citizens>",
  "keyEvidencePoint": "<single most important piece of evidence>",
  "earliestKnownSource": "<first reliable source or 'Unknown'>",
  "citizenRecommendation": "<what should a citizen do with this information?>"
}

Verdict definitions:
- TRUE: Claim is accurate and well-supported by credible sources
- FALSE: Claim is demonstrably wrong with clear counter-evidence
- MISLEADING: Claim has truth elements but presents them deceptively
- UNVERIFIED: Insufficient evidence to confirm or deny
- SATIRE: Content is satirical/parody, not intended as news`;

// Credibility tiers per spec: .gov.in/.nic.in → 1.0 · PIB → 0.95 · fact-check orgs → 0.8 · major news → 0.75 · blogs → 0.4
const GOV_SUFFIXES = ['.gov.in', '.nic.in'];
const FACTCHECK_SITES = ['altnews.in', 'boomlive.in', 'factchecker.in', 'factly.in', 'vishvasnews.com', 'thefactcrest.com'];
const MAJOR_NEWS_SITES = [
  'timesofindia.indiatimes.com', 'indianexpress.com', 'thehindu.com', 'hindustantimes.com',
  'ndtv.com', 'indiatoday.in', 'reuters.com', 'bbc.com', 'firstpost.com', 'news18.com',
  'moneycontrol.com', 'economictimes.indiatimes.com', 'livemint.com', 'deccanherald.com',
  'theprint.in', 'scroll.in', 'newindianexpress.com', 'tribuneindia.com',
];

interface SerpOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
}

@Injectable()
export class FactCheckAgentService {
  private readonly logger = new Logger(FactCheckAgentService.name);

  constructor(private readonly mistral: MistralAiService) {}

  private get serpApiKey(): string {
    return process.env.SERPAPI_KEY ?? '';
  }

  async *runFactCheck(dto: FactCheckRequestDto): AsyncGenerator<FactCheckEvent> {
    try {
      // Stage 1: claim extraction
      yield { stage: 'extracting', message: 'Extracting verifiable claims…' };
      const extractionPrompt = FACTCHECK_CLAIM_EXTRACTION_PROMPT.replace('{content}', dto.content);
      let extraction = {
        claims: [dto.content.slice(0, 400)],
        claimType: dto.claimType ?? 'other',
        namedEntities: [] as string[],
        datesMentioned: [] as string[],
        statisticsOrNumbers: [] as string[],
        sourceAttributions: [] as string[],
        redFlags: [] as string[],
      };
      try {
        const raw = await this.mistral.generateChatCompletion([{ role: 'user', content: extractionPrompt }]);
        extraction = { ...extraction, ...parseModelJson<Partial<typeof extraction>>(raw) };
      } catch (err) {
        this.logger.warn(`Claim extraction fallback: ${(err as Error).message}`);
      }
      if (dto.claimType) extraction.claimType = dto.claimType;
      const claims = (extraction.claims ?? []).filter(Boolean).slice(0, 3);
      yield {
        stage: 'claims_found',
        claims,
        claimType: extraction.claimType ?? 'other',
        namedEntities: extraction.namedEntities ?? [],
        datesMentioned: extraction.datesMentioned ?? [],
        statisticsOrNumbers: extraction.statisticsOrNumbers ?? [],
        redFlags: extraction.redFlags ?? [],
      };

      // Stage 2: web evidence search (skipped gracefully without SERPAPI_KEY)
      yield {
        stage: 'searching',
        message: this.serpApiKey
          ? 'Searching the web for corroborating evidence…'
          : 'Web search unavailable (SERPAPI_KEY not configured) — relying on forensics and reasoning only',
      };
      const evidence: VerificationEvidence[] = [];
      const seenUrls = new Set<string>();
      for (const claim of claims) {
        const results = await this.searchEvidenceForClaim(claim);
        for (const result of results) {
          if (!result.link || seenUrls.has(result.link) || evidence.length >= 10) continue;
          seenUrls.add(result.link);
          const item: VerificationEvidence = {
            sourceTitle: result.title ?? 'Untitled source',
            sourceUrl: result.link,
            excerpt: (result.snippet ?? '').slice(0, 300),
            credibilityScore: credibilityFor(result.link),
            publishedDate: result.date ?? null,
          };
          evidence.push(item);
          yield {
            stage: 'evidence_found',
            sourceTitle: item.sourceTitle,
            sourceUrl: item.sourceUrl,
            excerpt: item.excerpt,
            credibilityScore: item.credibilityScore,
            creditContext: credibilityLabel(item.sourceUrl, item.credibilityScore),
          };
        }
      }

      // Stage 3: image forensics (conditional)
      let deepfakeScore: number | null = null;
      let forensicsFindings: string[] = [];
      let overallAssessment = '';
      if (dto.mediaUrl) {
        yield { stage: 'forensics_running', message: 'Running image forensics…' };
        try {
          const forensics = await this.runImageForensics(dto.mediaUrl);
          deepfakeScore = Math.min(1, Math.max(0, Number(forensics.manipulationScore ?? 0) / 100));
          forensicsFindings = forensics.findings ?? [];
          overallAssessment = forensics.overallAssessment ?? 'uncertain';
          yield {
            stage: 'forensics_done',
            deepfakeScore,
            findings: forensicsFindings,
            overallAssessment,
          };
        } catch (err) {
          this.logger.warn(`Forensics skipped: ${(err as Error).message}`);
        }
      }

      // Stage 4: verdict synthesis
      yield { stage: 'synthesizing', message: 'Synthesizing final verdict…' };
      const imageForgeryLine =
        deepfakeScore !== null
          ? `IMAGE FORENSICS: manipulation score ${Math.round(deepfakeScore * 100)}/100 (${overallAssessment}); findings: ${forensicsFindings.join('; ')}`
          : 'IMAGE FORENSICS: no image attached to this claim.';
      const verdictPrompt = FACTCHECK_VERDICT_PROMPT.replace('{content}', dto.content)
        .replace('{evidenceJson}', JSON.stringify(evidence, null, 2))
        .replace('{imageForgeryLine}', imageForgeryLine);
      let verdict: FactCheckVerdict = 'UNVERIFIED';
      let confidence = evidence.length === 0 ? 0.2 : 0.45;
      let reasoning =
        evidence.length === 0
          ? 'No web evidence could be retrieved to confirm or refute this claim, and no decision could be made from the available material.'
          : 'The synthesis model could not be parsed; defaulting to UNVERIFIED pending manual review.';
      let recommendation = 'Wait for verification from official sources before sharing this further.';
      try {
        const raw = await this.mistral.generateChatCompletion([{ role: 'user', content: verdictPrompt }], {
          temperature: 0.1,
        });
        const parsed = parseModelJson<{
          verdict?: string;
          confidence?: number;
          reasoning?: string;
          citizenRecommendation?: string;
        }>(raw);
        if (parsed.verdict && ['TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIED', 'SATIRE'].includes(parsed.verdict.toUpperCase())) {
          verdict = parsed.verdict.toUpperCase() as FactCheckVerdict;
        }
        if (typeof parsed.confidence === 'number') {
          confidence = Math.min(1, Math.max(0, parsed.confidence));
        } else if (evidence.length === 0) {
          confidence = 0.2;
        }
        reasoning = parsed.reasoning ?? reasoning;
        recommendation = parsed.citizenRecommendation ?? recommendation;
      } catch (err) {
        this.logger.warn(`Verdict synthesis fallback: ${(err as Error).message}`);
      }

      // Stage 5: persist + complete
      const report = await FactCheck.create({
        content: dto.content,
        mediaUrl: dto.mediaUrl ?? null,
        claimType: extraction.claimType ?? 'other',
        claims,
        namedEntities: extraction.namedEntities ?? [],
        redFlags: extraction.redFlags ?? [],
        verdict,
        confidence,
        reasoning,
        evidence,
        deepfakeScore,
      } as Record<string, unknown>);

      const completeEvent: FactCheckEvent = {
        stage: 'complete',
        reportId: report.get('id') as number,
        verdict,
        confidence,
        reasoning,
        evidence,
        deepfakeScore,
        recommendation,
      };
      yield completeEvent;
    } catch (err) {
      this.logger.error(`Fact-check failed: ${(err as Error).message}`, (err as Error).stack);
      yield {
        stage: 'error',
        message: (err as Error)?.message ?? 'Fact-check pipeline failure',
        code: 'FACTCHECK_ERROR',
      };
    }
  }

  private async searchEvidenceForClaim(claim: string): Promise<SerpOrganicResult[]> {
    if (!this.serpApiKey) return [];
    const siteQuery = `(site:altnews.in OR site:boomlive.in OR site:factchecker.in OR site:pib.gov.in) ${claim}`;
    const [general, siteScoped] = await Promise.all([
      this.serpSearch(claim),
      this.serpSearch(siteQuery).catch(() => [] as SerpOrganicResult[]),
    ]);
    return [...siteScoped, ...general].slice(0, 5);
  }

  private async serpSearch(query: string): Promise<SerpOrganicResult[]> {
    try {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=5&gl=in&hl=en&api_key=${this.serpApiKey}`;
      const res = await fetchWithRetry(url, { retries: 1 });
      if (!res.ok) {
        this.logger.warn(`SerpAPI ${res.status} for query: ${query.slice(0, 60)}`);
        return [];
      }
      const json = (await res.json()) as { organic_results?: SerpOrganicResult[] };
      return json.organic_results ?? [];
    } catch (err) {
      this.logger.warn(`SerpAPI failed: ${(err as Error).message}`);
      return [];
    }
  }

  private async runImageForensics(mediaUrl: string) {
    let buffer: Buffer | undefined;
    let mimeType: string | undefined;
    try {
      const res = await fetchWithRetry(mediaUrl, { retries: 1 });
      if (res.ok) {
        buffer = Buffer.from(await res.arrayBuffer());
        mimeType = res.headers.get('content-type')?.split(';')[0];
        if (buffer.length > 6 * 1024 * 1024) buffer = undefined; // keep request small
      }
    } catch {
      buffer = undefined;
    }
    const image = buffer ? { buffer, mimeType } : { url: mediaUrl };
    return this.mistral.analyzeImageFreeform<{
      manipulationScore?: number;
      findings?: string[];
      overallAssessment?: string;
    }>(FACTCHECK_IMAGE_FORENSICS_PROMPT, image);
  }
}

function credibilityFor(url: string): number {
  const lower = url.toLowerCase();
  if (GOV_SUFFIXES.some((s) => lower.includes(s))) return lower.includes('pib.gov.in') ? 0.95 : 1.0;
  if (FACTCHECK_SITES.some((s) => lower.includes(s))) return 0.8;
  if (MAJOR_NEWS_SITES.some((s) => lower.includes(s))) return 0.75;
  return 0.4;
}

function credibilityLabel(url: string, score: number): string {
  if (score >= 0.95) return 'Official government source';
  if (score >= 0.8) return 'Dedicated fact-checking organisation';
  if (score >= 0.75) return 'Major news outlet';
  return 'Low-credibility blog / unranked site';
}

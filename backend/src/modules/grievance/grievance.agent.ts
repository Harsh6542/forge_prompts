import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { preprocessImage } from '../../shared/input-pipeline/media.util.js';
import { parseModelJson, randomSuffix } from '../../shared/input-pipeline/util.js';
import { CloudinaryService } from '../../shared/ai/cloudinary.service.js';
import { MistralAiService } from '../../shared/ai/mistral.service.js';
import { Grievance, type GrievanceCategory, type GrievancePriority } from './grievance.entity.js';
import type { GrievanceSubmitDto } from './grievance.dto.js';

export interface ImageForensicsResult {
  issueType: string;
  severityScore: number;
  severityReason: string;
  estimatedAreaAffected: string;
  safetyRisk: string;
  immediateActionRequired: boolean;
  observations: string[];
}

export interface TextSeverityResult {
  severityScore: number;
  urgency: string;
  keyIssues: string[];
  suggestedCategory: string;
}

export interface GrievanceTriageResult {
  grievance: Grievance;
  generatedTrackingId: string;
  grievancePriority: GrievancePriority;
  assignedDepartment: string;
  estimatedResolutionSla: string;
  aiImageForensicsAnalysis: ImageForensicsResult | null;
}

export const GRIEVANCE_IMAGE_FORENSICS_PROMPT = `Analyze this civic infrastructure photograph submitted by an Indian citizen as a public grievance.
Examine the image carefully and return ONLY a valid JSON object with this exact structure:

{
  "issueType": "one of: pothole|road_damage|flood|waterlogging|garbage|open_drain|pollution|broken_streetlight|damaged_bridge|water_leak|other",
  "severityScore": <integer 1-10>,
  "severityReason": "<one sentence explaining the score>",
  "estimatedAreaAffected": "small (< 10sqm) | medium (10-100sqm) | large (> 100sqm)",
  "safetyRisk": "none | low | moderate | high | critical",
  "immediateActionRequired": <true|false>,
  "observations": ["<observation 1>", "<observation 2>", "<observation 3>"]
}

Scoring guide:
1-3: Minor aesthetic issue, no safety risk
4-5: Functional impact, low safety risk (e.g. small pothole)
6-7: Significant disruption, moderate safety risk (e.g. large pothole, waterlogging)
8-9: Serious infrastructure failure, high safety risk
10: Life-threatening emergency (e.g. bridge collapse, severe flooding)`;

const GRIEVANCE_TEXT_SEVERITY_PROMPT = `Analyze this civic grievance description submitted by a citizen.
Return ONLY valid JSON:

{
  "severityScore": <integer 1-10>,
  "urgency": "immediate | urgent | normal | low",
  "keyIssues": ["<key issue 1>", "<key issue 2>"],
  "suggestedCategory": "<most appropriate category from: road|water|garbage|electricity|pollution|flood|other>"
}

Grievance description: "{grievanceDescription}"
Category reported by citizen: "{submittedCategory}"
Location: "{grievanceLocation}"`;

export const DEPARTMENT_ROUTING_BY_CATEGORY: Record<GrievanceCategory, string> = {
  road: 'Public Works Department (PWD)',
  water: 'Municipal Water Supply / Jal Board',
  garbage: 'Municipal Sanitation Department',
  electricity: 'State Electricity Distribution Company (DISCOM)',
  pollution: 'State Pollution Control Board',
  flood: 'State Disaster Management Authority (SDMA)',
  other: 'Municipal Corporation Grievance Cell',
};

export const GRIEVANCE_SEVERITY_SLA_MAP: Record<GrievancePriority, string> = {
  CRITICAL: '24 hours (emergency response team)',
  HIGH: '72 hours',
  MEDIUM: '7 days',
  LOW: '15 days',
};

@Injectable()
export class GrievanceTriageService {
  private readonly logger = new Logger(GrievanceTriageService.name);

  constructor(
    private readonly mistral: MistralAiService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async triageSubmit(input: {
    dto: GrievanceSubmitDto;
    mediaFiles: Express.Multer.File[];
    reportedById: number | null;
  }): Promise<GrievanceTriageResult> {
    const { dto, mediaFiles } = input;

    // Stage 1: media upload (normalize via sharp first)
    const mediaUrls: string[] = [];
    for (const file of mediaFiles.slice(0, 3)) {
      try {
        const { jpegBuffer } = await preprocessImage(file.buffer);
        const upload = await this.cloudinary.uploadBuffer(jpegBuffer, 'grievance-media');
        if (upload.url) mediaUrls.push(upload.url);
      } catch (err) {
        this.logger.warn(`Media upload skipped: ${(err as Error).message}`);
      }
    }

    // Stage 2: image forensics (conditional, first image)
    let forensics: ImageForensicsResult | null = null;
    let imageSeverity = 5; // neutral default when no image
    if (mediaUrls.length > 0) {
      try {
        forensics = await this.mistral.analyzeImageFreeform<ImageForensicsResult>(
          GRIEVANCE_IMAGE_FORENSICS_PROMPT,
          { url: mediaUrls[0] },
        );
        const parsed = Number(forensics.severityScore);
        if (parsed >= 1 && parsed <= 10) imageSeverity = parsed;
      } catch (err) {
        this.logger.warn(`Image forensics skipped: ${(err as Error).message}`);
      }
    }

    // Stage 3: text severity analysis
    let textSeverity: TextSeverityResult = {
      severityScore: 5,
      urgency: 'normal',
      keyIssues: [],
      suggestedCategory: dto.category,
    };
    try {
      const prompt = GRIEVANCE_TEXT_SEVERITY_PROMPT.replace(
        '{grievanceDescription}',
        dto.description,
      )
        .replace('{submittedCategory}', dto.category)
        .replace('{grievanceLocation}', dto.location);
      const raw = await this.mistral.generateChatCompletion([{ role: 'user', content: prompt }]);
      const parsed = parseModelJson<Partial<TextSeverityResult>>(raw);
      textSeverity = {
        severityScore: clamp1to10(parsed.severityScore ?? 5),
        urgency: parsed.urgency ?? 'normal',
        keyIssues: Array.isArray(parsed.keyIssues) ? parsed.keyIssues.slice(0, 5) : [],
        suggestedCategory: parsed.suggestedCategory ?? dto.category,
      };
    } catch (err) {
      this.logger.warn(`Text severity fallback used: ${(err as Error).message}`);
    }

    // Stage 4: combined scoring — image weighted higher when present
    const hasImage = mediaUrls.length > 0 && forensics !== null;
    const finalSeverity = hasImage
      ? imageSeverity * 0.6 + textSeverity.severityScore * 0.4
      : textSeverity.severityScore * 0.8 + imageSeverity * 0.2; // mostly text-driven
    const priority = mapPriority(finalSeverity);

    // Stage 5: routing + SLA + tracking id
    const assignedDepartment = DEPARTMENT_ROUTING_BY_CATEGORY[dto.category];
    const sla = GRIEVANCE_SEVERITY_SLA_MAP[priority];
    const trackingId = generateTrackingId(dto.state);

    // Stage 6: persist
    const grievance = await Grievance.create({
      trackingId,
      title: dto.title?.trim() || null,
      description: dto.description,
      category: dto.category,
      location: dto.location,
      state: dto.state?.trim() || null,
      language: dto.language ?? 'en',
      reportedById: input.reportedById ?? null,
      mediaUrls,
      finalSeverityScore: Math.round(finalSeverity * 10) / 10,
      priority,
      assignedDepartment,
      estimatedResolutionSla: sla,
      status: 'OPEN',
      aiAnalysis: {
        imageForensics: forensics,
        textSeverity,
        scoringModel: hasImage ? 'image 60% + text 40%' : 'text 80% + neutral image 20%',
      } as Record<string, unknown>,
    });

    // Stage 7: return contract
    return {
      grievance,
      generatedTrackingId: trackingId,
      grievancePriority: priority,
      assignedDepartment,
      estimatedResolutionSla: sla,
      aiImageForensicsAnalysis: forensics,
    };
  }

  async findByTrackingId(trackingId: string): Promise<Grievance> {
    const g = await Grievance.findOne({ where: { trackingId: trackingId.trim().toUpperCase() } });
    if (!g) throw new NotFoundException(`No grievance found for tracking ID '${trackingId}'`);
    return g;
  }
}

function clamp1to10(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 5;
  return Math.min(10, Math.max(1, Math.round(v)));
}

function mapPriority(score: number): GrievancePriority {
  if (score >= 8) return 'CRITICAL';
  if (score >= 6) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  return 'LOW';
}

// CP-{STATE}-{YEAR}-{RANDOM6}:  MH-2026-8F3KQ1; stateless → IN
export function generateTrackingId(state?: string | null): string {
  const stateCode = (state ?? 'IN')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3) || 'IN';
  return `CP-${stateCode}-${new Date().getFullYear()}-${randomSuffix(6)}`;
}

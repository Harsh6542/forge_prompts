import { HttpException, Injectable, Logger } from '@nestjs/common';
import { CloudinaryService } from '../ai/cloudinary.service.js';
import { MistralAiService } from '../ai/mistral.service.js';
import { SarvamService } from '../ai/sarvam.service.js';
import { detectLanguageFromUnicode } from './language.util.js';
import { preprocessImage } from './media.util.js';
import type { UnifiedCitizenInputContext } from './types.js';
import { extractAudioTrack, extractKeyFrames, probeVideo } from './video.util.js';

const PIXTRAL_OCR_PROMPT = `Perform two tasks on this image submitted by an Indian citizen.
Return ONLY JSON:
{
  "extractedOcrText": "<all visible text, empty string if none>",
  "sceneDescription": "<2-3 sentence description of what is shown>",
  "detectedTextLanguage": "<ISO code of extracted text, or 'none'>",
  "imageContentType": "document | civic_issue | news_screenshot | social_media | other",
  "keyEntitiesVisible": ["<entity 1>", "<entity 2>"]
}`;

@Injectable()
export class InputPipelineService {
  private readonly logger = new Logger(InputPipelineService.name);

  constructor(
    private readonly sarvam: SarvamService,
    private readonly mistral: MistralAiService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async runTextPipeline(
    text: string,
    requestedTarget?: string,
  ): Promise<UnifiedCitizenInputContext> {
    const detected = detectLanguageFromUnicode(text);
    let normalized = text;
    let translated = false;
    if (detected.code !== 'en' && text.trim()) {
      normalized = await this.sarvam.translateToEnglish(text, detected.code);
      translated = true;
    }
    return {
      normalizedEnglishText: normalized,
      originalInputType: 'text',
      detectedSourceLanguage: detected.code,
      translationWasApplied: translated,
      uploadedMediaCloudinaryUrl: null,
      extractedAudioTranscript: null,
      extractedVisualDescription: null,
      extractedVideoFrameUrls: [],
      sttTranscriptionConfidenceScore: null,
      targetResponseLanguageCode: requestedTarget ?? detected.code,
    };
  }

  async runAudioPipeline(
    buffer: Buffer,
    mimeType: string,
    requestedTarget?: string,
  ): Promise<UnifiedCitizenInputContext> {
    const upload = await this.cloudinary.uploadBuffer(buffer, 'audio', 'raw', mimeType);

    const stt = await this.sarvam.transcribeAudio(buffer, mimeType);
    const iso = stt.languageCode.split('-')[0];
    let normalized = stt.transcript;
    let translated = false;
    if (iso !== 'en' && normalized.trim()) {
      normalized = await this.sarvam.translateToEnglish(normalized, iso);
      translated = true;
    }
    return {
      normalizedEnglishText: normalized,
      originalInputType: 'audio',
      detectedSourceLanguage: iso,
      translationWasApplied: translated,
      uploadedMediaCloudinaryUrl: upload.url,
      extractedAudioTranscript: stt.transcript,
      extractedVisualDescription: null,
      extractedVideoFrameUrls: [],
      sttTranscriptionConfidenceScore: stt.confidence,
      targetResponseLanguageCode: requestedTarget ?? iso,
    };
  }

  async runImagePipeline(
    buffer: Buffer,
    requestedTarget?: string,
  ): Promise<UnifiedCitizenInputContext> {
    const pre = await preprocessImage(buffer);
    const upload = await this.cloudinary.uploadBuffer(
      pre.jpegBuffer, 'images', 'image', pre.mimeType,
    );

    const analysis = await this.mistral.analyzeImageWithPrompt(
      upload.url, PIXTRAL_OCR_PROMPT, pre.jpegBuffer, pre.mimeType,
    );

    const textLang =
      analysis.detectedTextLanguage && analysis.detectedTextLanguage !== 'none'
        ? analysis.detectedTextLanguage
        : null;

    let mergedText = analysis.sceneDescription ?? '';
    if (analysis.extractedOcrText?.trim()) {
      mergedText = `${analysis.sceneDescription}\nText found in image: ${analysis.extractedOcrText}`;
    }

    let normalized = mergedText;
    let translated = false;
    if (textLang && textLang !== 'en') {
      const ocrEn = await this.sarvam.translateToEnglish(
        analysis.extractedOcrText, textLang,
      );
      normalized = ocrEn.trim()
        ? `${analysis.sceneDescription}\nText found in image: ${ocrEn}`
        : analysis.sceneDescription;
      translated = true;
    }

    return {
      normalizedEnglishText: normalized,
      originalInputType: 'image',
      detectedSourceLanguage: textLang ?? 'en',
      translationWasApplied: translated,
      uploadedMediaCloudinaryUrl: upload.url,
      extractedAudioTranscript: null,
      extractedVisualDescription: analysis.sceneDescription ?? null,
      extractedVideoFrameUrls: [],
      sttTranscriptionConfidenceScore: null,
      targetResponseLanguageCode: requestedTarget ?? textLang ?? 'en',
    };
  }

  async runVideoPipeline(
    buffer: Buffer,
    requestedTarget?: string,
  ): Promise<UnifiedCitizenInputContext> {
    const meta = await probeVideo(buffer);
    if (meta.durationSeconds > 300) {
      throw new HttpException('Video longer than 5 minutes is not accepted', 413);
    }

    const [frameInfo, stt] = await Promise.all([
      this.analyzeFrames(buffer, meta.durationSeconds).catch((err) => {
        this.logger.warn(`Frame branch failed: ${err?.status !== undefined ? err.status + ' ' + err.message : err?.message ?? err}`);
        return { frameUrls: [] as string[], visualText: [] as string[], videoUploadUrl: null as string | null };
      }),
      this.transcribeAudioTrack(buffer).catch((err) => {
        this.logger.warn(`Audio branch failed: ${err?.status !== undefined ? err.status + ' ' + err.message : err?.message ?? err}`);
        return null;
      }),
    ]);

    const mergedParts: string[] = [];
    let visualDescription: string | null = null;
    if (frameInfo.visualText.length) {
      visualDescription = frameInfo.visualText.join('\n');
      mergedParts.push(visualDescription);
    }
    if (stt?.transcript?.trim()) mergedParts.push(stt.transcript);
    if (mergedParts.length === 0) {
      if (!frameInfo.frameUrls.length && !stt) {
        throw new HttpException('Video could not be analyzed (frames + audio both failed)', 422);
      }
      mergedParts.push('(no readable content detected in video)');
    }

    const merged = mergedParts.join('\n\n');
    const iso = detectLanguageFromUnicode(merged).code;
    let normalized = merged;
    let translated = false;
    if (iso !== 'en') {
      normalized = await this.sarvam.translateToEnglish(merged, iso);
      translated = true;
    }

    return {
      normalizedEnglishText: normalized,
      originalInputType: 'video',
      detectedSourceLanguage: iso,
      translationWasApplied: translated,
      uploadedMediaCloudinaryUrl: frameInfo.videoUploadUrl,
      extractedAudioTranscript: stt?.transcript ?? null,
      extractedVisualDescription: visualDescription,
      extractedVideoFrameUrls: frameInfo.frameUrls,
      sttTranscriptionConfidenceScore: stt?.confidence ?? null,
      targetResponseLanguageCode: requestedTarget ?? iso,
    };
  }

  private async analyzeFrames(buffer: Buffer, duration: number) {
    const videoUpload = await this.cloudinary.uploadBuffer(buffer, 'videos', 'video');
    const frames = await extractKeyFrames(buffer, duration);

    const [frameUrls, visualText] = await Promise.all([
      this.uploadFrames(frames),
      Promise.all(frames.map(async (f, i) => {
        const res = await this.mistral.analyzeImageWithPrompt(null, PIXTRAL_OCR_PROMPT, f, 'image/jpeg');
        return `[frame ${i + 1}] ${res.sceneDescription}${res.extractedOcrText?.trim() ? ` — text: ${res.extractedOcrText}` : ''}`;
      })),
    ]);

    return {
      frameUrls,
      visualText,
      videoUploadUrl: videoUpload.url,
    };
  }

  private async uploadFrames(frames: Buffer[]): Promise<string[]> {
    const uploads = await Promise.all(
      frames.map((f) => this.cloudinary.uploadBuffer(f, 'video-frames', 'image')),
    );
    return uploads.map((u) => u.url).filter((u): u is string => Boolean(u));
  }

  private async transcribeAudioTrack(buffer: Buffer) {
    const audio = await extractAudioTrack(buffer);
    const stt = await this.sarvam.transcribeAudio(audio, 'audio/wav');
    return {
      transcript: stt.transcript,
      confidence: stt.confidence,
      videoUploadUrl: null as string | null,
    };
  }
}

export type { UnifiedCitizenInputContext };

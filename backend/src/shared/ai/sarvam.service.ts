import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { fetchWithRetry } from './fetch.util.js';
import type { SarvamTranscription } from '../input-pipeline/types.js';
import { toSarvamCode } from '../input-pipeline/language.util.js';

const SARVAM_BASE = 'https://api.sarvam.ai';

@Injectable()
export class SarvamService {
  private readonly logger = new Logger(SarvamService.name);

  private get apiKey(): string {
    return process.env.SARVAM_API_KEY ?? '';
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private assertReady(): void {
    if (!this.isConfigured()) {
      throw new HttpException(
        'SARVAM_API_KEY missing — cannot transcribe or translate',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async transcribeAudio(
    buffer: Buffer,
    mimeType: string,
    sourceIso?: string,
  ): Promise<SarvamTranscription> {
    this.assertReady();

    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    form.append('file', blob, 'audio.' + (mimeType.split('/')[1]?.split(';')[0] ?? 'bin'));
    form.append('model', 'saaras:v3');
    if (sourceIso) {
      form.append('language_code', toSarvamCode(sourceIso));
    }

    const res = await fetchWithRetry(`${SARVAM_BASE}/speech-to-text`, {
      method: 'POST',
      headers: { 'api-subscription-key': this.apiKey },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Sarvam STT ${res.status}: ${detail.slice(0, 300)}`);
      throw new HttpException(`Sarvam speech-to-text failed (${res.status})`, HttpStatus.BAD_GATEWAY);
    }

    const json = (await res.json()) as Record<string, unknown>;
    return {
      transcript: (json['transcript'] as string) ?? '',
      languageCode: (json['language_code'] as string) ?? sourceIso ?? 'en',
      confidence:
        typeof json['confidence'] === 'number'
          ? (json['confidence'] as number)
          : null,
    };
  }

  async translateText(text: string, sourceIso: string, targetIso: string): Promise<string> {
    this.assertReady();
    if (!text.trim()) return '';

    // mayura:v1 rejects inputs > 1000 chars — translate in sentence-boundary slices
    const parts = splitBySentence(text, 900);
    const translated: string[] = [];
    for (const part of parts) {
      const res = await fetchWithRetry(`${SARVAM_BASE}/translate`, {
        method: 'POST',
        headers: {
          'api-subscription-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: part,
          source_language_code: toSarvamCode(sourceIso),
          target_language_code: toSarvamCode(targetIso),
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        this.logger.error(`Sarvam translate ${res.status}: ${detail.slice(0, 300)}`);
        throw new HttpException(`Sarvam translation failed (${res.status})`, HttpStatus.BAD_GATEWAY);
      }

      const json = (await res.json()) as Record<string, unknown>;
      translated.push((json['translated_text'] as string) ?? '');
    }
    return translated.join(' ');
  }

  async translateToEnglish(text: string, sourceIso: string): Promise<string> {
    if (sourceIso === 'en' || !text.trim()) return text;
    return this.translateText(text, sourceIso, 'en');
  }

  async synthesizeSpeech(text: string, langIso: string): Promise<Buffer> {
    this.assertReady();
    // bulbul:v1 caps per-request text length — synthesize sliced segments and stitch PCM
    const parts = splitBySentence(text, 450);
    const buffers: Buffer[] = [];
    for (const part of parts) {
      const res = await fetchWithRetry(`${SARVAM_BASE}/text-to-speech`, {
        method: 'POST',
        headers: {
          'api-subscription-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: [part],
          target_language_code: toSarvamCode(langIso),
          speaker: 'priya',
          model: 'bulbul:v3',
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        this.logger.error(`Sarvam TTS ${res.status}: ${detail.slice(0, 300)}`);
        throw new HttpException(`Sarvam TTS failed (${res.status})`, HttpStatus.BAD_GATEWAY);
      }
      const json = (await res.json()) as Record<string, unknown>;
      const audios = json['audios'] as string[] | undefined;
      const b64 = Array.isArray(audios) ? audios[0] : (json['audio'] as string | undefined);
      if (!b64) throw new HttpException('Sarvam TTS returned no audio', HttpStatus.BAD_GATEWAY);
      buffers.push(Buffer.from(b64, 'base64'));
    }
    return concatWav(buffers);
  }
}

function splitBySentence(text: string, maxLen: number): string[] {
  const clean = text.trim();
  if (clean.length <= maxLen) return [clean];
  const sentences = clean.match(/[^.।!?\n]+[.।!?\n]*/g) ?? [clean];
  const parts: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current.length + s.length > maxLen && current) {
      parts.push(current.trim());
      current = s;
    } else if (s.length > maxLen) {
      if (current.trim()) parts.push(current.trim());
      for (let i = 0; i < s.length; i += maxLen) parts.push(s.slice(i, i + maxLen));
      current = '';
    } else {
      current += s;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length ? parts : [clean.slice(0, maxLen)];
}

function concatWav(buffers: Buffer[]): Buffer {
  if (buffers.length <= 1) return buffers[0] ?? Buffer.alloc(0);
  const first = buffers[0];
  const pcmParts: Buffer[] = [];
  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i];
    if (i === 0) {
      pcmParts.push(buf);
      continue;
    }
    const idx = buf.indexOf('data', 12, 'ascii');
    const pcmStart = idx >= 0 ? idx + 8 : 44; // skip 'data' marker + size
    pcmParts.push(buf.subarray(pcmStart));
  }
  return Buffer.concat(pcmParts);
}

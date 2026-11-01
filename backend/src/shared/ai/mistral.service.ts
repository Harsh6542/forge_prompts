import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { parseModelJson } from '../input-pipeline/util.js';
import { fetchWithRetry } from './fetch.util.js';

const MISTRAL_BASE = 'https://api.mistral.ai/v1';
const MODEL_CHAT = 'pixtral-12b-2409';
const TEXT_MODEL_PRIMARY = 'mistral-small-latest';

export interface PixtralImageAnalysis {
  extractedOcrText: string;
  sceneDescription: string;
  detectedTextLanguage: string;
  imageContentType: string;
  keyEntitiesVisible: string[];
}

@Injectable()
export class MistralAiService {
  private readonly logger = new Logger(MistralAiService.name);

  private get apiKey(): string {
    return process.env.MISTRAL_API_KEY ?? '';
  }

  private modelFor(name: string): string {
    return name === 'embed' ? 'mistral-embed' : MODEL_CHAT;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const [vec] = await this.generateEmbeddingBatch([text]);
    return vec;
  }

  async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
    this.assertReady();
    const res = await fetchWithRetry(`${MISTRAL_BASE}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'mistral-embed', input: texts }),
    });
    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Mistral embeddings ${res.status}: ${detail.slice(0, 300)}`);
      throw new HttpException(`Embedding failed (${res.status})`, HttpStatus.BAD_GATEWAY);
    }
    const json = (await res.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return json.data.map((d) => d.embedding);
  }

  async *streamChatCompletion(
    messages: Array<{ role: string; content: string }>,
    opts: { temperature?: number; maxTokens?: number; model?: string } = {},
  ): AsyncGenerator<string> {
    this.assertReady();
    const res = await fetchWithRetry(`${MISTRAL_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model ?? MODEL_CHAT,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1500,
        stream: true,
        messages,
      }),
    });
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Mistral stream ${res.status}: ${detail.slice(0, 300)}`);
      throw new HttpException(`Streaming failed (${res.status})`, HttpStatus.BAD_GATEWAY);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let leftover = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      leftover += decoder.decode(value, { stream: true });
      const lines = leftover.split('\n');
      leftover = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const chunk = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const token = chunk.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {
          continue;
        }
      }
    }
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private assertReady(): void {
    if (!this.isConfigured()) {
      throw new HttpException(
        'MISTRAL_API_KEY missing — vision analysis unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async analyzeImageWithPrompt(
    imageUrl: string | null,
    prompt: string,
    imageBuffer?: Buffer,
    mimeType?: string,
  ): Promise<PixtralImageAnalysis> {
    this.assertReady();

    const imageUrlContent = imageBuffer
      ? {
          type: 'image_url',
          image_url: `data:${mimeType ?? 'image/jpeg'};base64,${imageBuffer.toString('base64')}`,
        }
      : { type: 'image_url', image_url: imageUrl };

    const res = await fetchWithRetry(`${MISTRAL_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_CHAT,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }, imageUrlContent],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Pixtral ${res.status}: ${detail.slice(0, 300)}`);
      throw new HttpException(`Pixtral vision failed (${res.status})`, HttpStatus.BAD_GATEWAY);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const choices = json['choices'] as Array<{ message?: { content?: string } }> | undefined;
    const content = choices?.[0]?.message?.content ?? '';
    return parseModelJson<PixtralImageAnalysis>(content);
  }

  // Prompt-agnostic Pixtral call returning whatever JSON shape the prompt demands
  async analyzeImageFreeform<T>(
    prompt: string,
    image: { buffer?: Buffer; mimeType?: string; url?: string },
  ): Promise<T> {
    this.assertReady();

    const imageUrlContent = image.buffer
      ? {
          type: 'image_url',
          image_url: `data:${image.mimeType ?? 'image/jpeg'};base64,${image.buffer.toString('base64')}`,
        }
      : { type: 'image_url', image_url: image.url ?? '' };

    const res = await fetchWithRetry(`${MISTRAL_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_CHAT,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }, imageUrlContent],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Pixtral freeform ${res.status}: ${detail.slice(0, 300)}`);
      throw new HttpException(`Pixtral vision failed (${res.status})`, HttpStatus.BAD_GATEWAY);
    }

    const json = (await res.json()) as Record<string, unknown>;
    const choices = json['choices'] as Array<{ message?: { content?: string } }> | undefined;
    const content = choices?.[0]?.message?.content ?? '';
    return parseModelJson<T>(content);
  }

  async generateChatCompletion(
    messages: Array<{ role: string; content: string }>,
    opts: { temperature?: number; maxTokens?: number; model?: string } = {},
  ): Promise<string> {
    const primary = opts.model ?? TEXT_MODEL_PRIMARY;
    try {
      return await this.chatCompletionOne(messages, primary, opts);
    } catch (err) {
      // free tier blocks large models and rate-limits small — degrade to pixtral chat
      if ((err as Error).message.includes(String(primary))) {
        this.logger.warn(`Chat model '${primary}' unavailable — falling back to pixtral-12b-2409`);
        return this.chatCompletionOne(messages, 'pixtral-12b-2409', opts);
      }
      throw err;
    }
  }

  private async chatCompletionOne(
    messages: Array<{ role: string; content: string }>,
    model: string,
    opts: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    this.assertReady();
    const res = await fetchWithRetry(`${MISTRAL_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1000,
        messages,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      this.logger.error(`Mistral chat ${res.status}: ${detail.slice(0, 300)}`);
      throw new HttpException(
        `${model} completion failed (${res.status})`,
        res.status === 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY,
      );
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? '';
  }
}

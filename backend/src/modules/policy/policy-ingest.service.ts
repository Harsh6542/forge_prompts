import { Injectable, Logger } from '@nestjs/common';
import { MistralAiService } from '../../shared/ai/mistral.service.js';
import { chunkPolicyDocument, contentKeyFor } from './chunking.util.js';
import { PolicyDocumentDto } from './policy.dto.js';
import { PolicyChunk } from './policy-chunk.entity.js';

@Injectable()
export class PolicyIngestService {
  private readonly logger = new Logger(PolicyIngestService.name);

  constructor(private readonly mistral: MistralAiService) {}

  async ingestDocuments(documents: PolicyDocumentDto[]): Promise<{
    documentsIngested: number;
    chunksCreated: number;
  }> {
    const prepared: Array<{
      instance: PolicyChunk;
      text: string;
    }> = [];

    for (const doc of documents) {
      const chunks = chunkPolicyDocument(doc.content);
      chunks.forEach((content, index) => {
        const instance = PolicyChunk.build({
          schemeName: doc.schemeName,
          category: doc.category,
          state: doc.state ?? null,
          sourceUrl: doc.sourceUrl,
          chunkIndex: index,
          content,
          embedding: [],
          contentKey: contentKeyFor(doc.schemeName, index),
        });
        prepared.push({ instance, text: content });
      });
    }

    for (let i = 0; i < prepared.length; i += 16) {
      const slice = prepared.slice(i, i + 16);
      const vectors = await this.mistral.generateEmbeddingBatch(slice.map((s) => s.text));
      slice.forEach((s, j) => s.instance.set('embedding', vectors[j]));
    }

    let created = 0;
    for (const { instance } of prepared) {
      await PolicyChunk.upsert(instance.get());
      created++;
    }

    this.logger.log(`Ingested ${documents.length} docs → ${created} chunks`);
    return { documentsIngested: documents.length, chunksCreated: created };
  }

  async listSchemes(): Promise<
    Array<{ schemeName: string; category: string; state: string | null; sourceUrl: string; chunkCount: number }>
  > {
    const rows = await PolicyChunk.findAll({
      attributes: ['schemeName', 'category', 'state', 'sourceUrl'],
    });
    const grouped = new Map<string, { schemeName: string; category: string; state: string | null; sourceUrl: string; chunkCount: number }>();
    for (const r of rows) {
      const key = String(r.get('schemeName'));
      const entry = grouped.get(key) ?? {
        schemeName: key,
        category: String(r.get('category')),
        state: (r.get('state') as string | null) ?? null,
        sourceUrl: String(r.get('sourceUrl')),
        chunkCount: 0,
      };
      entry.chunkCount++;
      grouped.set(key, entry);
    }
    return [...grouped.values()].sort((a, b) => a.schemeName.localeCompare(b.schemeName));
  }
}

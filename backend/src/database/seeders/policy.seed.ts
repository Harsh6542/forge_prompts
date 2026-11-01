import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';
import { PolicyIngestService } from '../../modules/policy/policy-ingest.service.js';
import { POLICY_SEED_DOCUMENTS } from './policy-seed-data.js';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const ingest = app.get(PolicyIngestService);
    const result = await ingest.ingestDocuments(POLICY_SEED_DOCUMENTS);
    console.log(
      `✅ Policy KB seeded: ${result.documentsIngested} documents → ${result.chunksCreated} chunks embedded`,
    );
    const schemes = await ingest.listSchemes();
    console.log('📚 Knowledge base contents:');
    for (const s of schemes) {
      console.log(`   • ${s.schemeName} (${s.chunkCount} chunks) — ${s.sourceUrl}`);
    }
  } finally {
    await app.close();
  }
}

await seed().catch((err) => {
  console.error('❌ Seeding failed:', err?.message ?? err);
  process.exit(1);
});

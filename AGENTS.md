# 🤖 CivicPulse AI — Agents Context & Prompt Log

> This document defines every AI agent in the system: its purpose, workflow graph,
> system prompts, input/output contracts, and evolution log.
>
> **Update this file every time you:**
> - Modify an agent's system prompt
> - Add or remove a workflow node/stage
> - Change the model used by an agent
> - Add a new agent to the system
> - Fix a prompt that was producing bad output

---

## Agent Inventory

| Agent | File | Model | Type | Transport |
|-------|------|-------|------|-----------|
| [Multimodal Input Pipeline](#0-multimodal-input--translation-pipeline) | `shared/input-pipeline/` | `pixtral-12b-2409` + Sarvam AI | Pre-processing | REST |
| [Policy RAG Agent](#1-policy-rag-agent) | `modules/policy/policy.agent.ts` | `mistral-large-latest` | Streaming RAG | SSE |
| [Grievance Triage Agent](#2-grievance-triage-agent) | `modules/grievance/grievance.agent.ts` | `pixtral-12b-2409` + `mistral-large-latest` | Multimodal Pipeline | REST |
| [Browser Service Agent](#3-browser-service-agent) | `modules/service-agent/browser.agent.ts` | `mistral-large-latest` | Agentic Loop | WebSocket |
| [Fact-Check Agent](#4-fact-check-agent) | `modules/factcheck/factcheck.agent.ts` | `pixtral-12b-2409` + `mistral-large-latest` | Streaming Pipeline | SSE |

---

## 0. Multimodal Input & Translation Pipeline

**Folder**: `backend/src/shared/input-pipeline/`  
**Trigger**: `POST /input/auto` (auto-detects type from MIME)  
**Output**: `UnifiedCitizenInputContext` → feeds Supervisor Orchestrator

### Purpose
Every citizen input — regardless of format — is normalised to clean English text before reaching any agent. This decouples the agents from input modality entirely.

### Supported Input Types & Node Counts

| Input Type | Accepted Formats | Key Models | Nodes |
|------------|-----------------|-----------|-------|
| **Text** | Plain string (any language) | Sarvam Translate | 3 |
| **Audio** | mp3, wav, webm, ogg, m4a | Sarvam STT `saarika:v1` + Translate | 6 |
| **Image** | jpg, png, webp, heic | `pixtral-12b-2409` (OCR+vision) + Sarvam Translate | 6 |
| **Video** | mp4, webm, mov (≤ 5 min) | `pixtral-12b-2409` × frames + Sarvam STT + Translate | 11 |

### All Pipelines Produce This

```typescript
interface UnifiedCitizenInputContext {
  normalizedEnglishText: string          // always English after pipeline
  originalInputType: 'text' | 'audio' | 'image' | 'video'
  detectedSourceLanguage: string         // 'hi' | 'ta' | 'en' | ...
  translationWasApplied: boolean
  uploadedMediaCloudinaryUrl: string | null
  extractedAudioTranscript: string | null
  extractedVisualDescription: string | null
  extractedVideoFrameUrls: string[]
  sttTranscriptionConfidenceScore: number | null
  targetResponseLanguageCode: string     // answer this lang back to user
}
```

### Text Pipeline (3 nodes)
```
detectTextLanguageFromUnicode
  → [conditional] translateTextToEnglishWithSarvam
  → buildTextInputUnifiedContext
```

### Audio Pipeline (6 nodes)
```
validateAndNormalizeAudioFormat
  → uploadAudioToCloudinaryStorage
  → transcribeAudioWithSarvamSTT          ← saarika:v1
  → detectTranscriptLanguageFromUnicode
  → [conditional] translateAudioTranscriptToEnglish
  → buildAudioInputUnifiedContext
```

### Image Pipeline (6 nodes)
```
validateAndPreprocessImage                ← sharp: resize, HEIC→JPEG
  → uploadImageToCloudinaryStorage
  → extractTextAndContextFromImageWithPixtral  ← pixtral-12b-2409 (OCR + scene)
  → detectExtractedTextLanguage
  → [conditional] translateImageExtractedTextToEnglish
  → buildImageInputUnifiedContext
```

### Video Pipeline (11 nodes — parallel branches)
```
validateAndProbeVideoMetadata             ← ffprobe (duration, fps, resolution)
  → uploadOriginalVideoToCloudinary
  ├── extractKeyFramesFromVideo           ← fluent-ffmpeg (1 frame / 10s, max 6)
  │     → uploadExtractedFramesToCloudinary
  │     → analyzeKeyFramesWithPixtral    ← pixtral-12b-2409 per frame
  └── extractAndStripAudioTrackFromVideo  ← fluent-ffmpeg (WAV, mono, 16kHz)
        → transcribeVideoAudioWithSarvamSTT ← saarika:v1
  → mergeVisualDescriptionsAndAudioTranscript   ← frames + transcript
  → detectMergedContentLanguage
  → [conditional] translateMergedVideoContentToEnglish
  → buildVideoInputUnifiedContext
```

> ⚡ Video: `extractKeyFramesFromVideo` and `extractAndStripAudioTrackFromVideo` run in **parallel** via `Promise.all()` to halve latency.

### Pixtral Image Prompt (OCR + Scene)
```
Perform two tasks on this image submitted by an Indian citizen.
Return ONLY JSON:
{
  "extractedOcrText": "<all visible text, empty string if none>",
  "sceneDescription": "<2-3 sentence description of what is shown>",
  "detectedTextLanguage": "<ISO code of extracted text, or 'none'>",
  "imageContentType": "document | civic_issue | news_screenshot | social_media | other",
  "keyEntitiesVisible": ["<entity 1>", "<entity 2>"]
}
```

### Known Issues & Fixes

| Issue | Root Cause | Fix Applied |
|-------|-----------|------------|
| HEIC images failing upload | Browser doesn't convert HEIC | Added sharp HEIC→JPEG conversion in `validateAndPreprocessImage` |
| Sarvam STT timeout on long audio | Audio > 10 min hits API limit | Added duration check — reject > 5 min, warn at > 2 min |
| Video frame extraction on Windows | ffmpeg binary path issue | Use `@ffmpeg-installer/ffmpeg` npm package for cross-platform binary |
| Sarvam STT 400 on every request | Sarvam deprecated model `saarika:v1` | Switched to `saaras:v3` in `SarvamService.transcribeAudio` (2026-10-31) |
| ffprobe not found for video probing | `@ffmpeg-installer/ffmpeg` ships no ffprobe binary | Added `ffprobe-static` package; resolve binary via `require('ffprobe-static').path` |
| Pixtral JSON parse failure | Raw newline inside JSON string literal | `parseModelJson` repair pass converts raw control chars to spaces before retry |

---

## 1. Policy RAG Agent

**File**: `backend/src/modules/policy/policy.agent.ts`  
**Trigger**: `POST /policy/query`  
**Output**: Server-Sent Events stream

### Purpose
Answers citizen questions about Indian government schemes, welfare programs, and civic rights using a RAG pipeline over the policy knowledge base. Supports 11 Indian languages with voice output.

### Workflow Graph

```
[START]
   │
   ▼
[Stage 1: Language Detection]
   Detect input language (Unicode range heuristic + Mistral fallback)
   If non-English → translate query to English for RAG retrieval
   │
   ▼
[Stage 2: RAG Retrieval]
   Embed English query → mistral-embed (1024-dim)
   Load candidate PolicyChunks from MySQL (filter by category/state if provided)
   Compute cosine similarity in JS
   Also run MySQL FULLTEXT search (BM25)
   Merge & deduplicate results → top 5 chunks
   │
   ▼
[Stage 3: Answer Generation — STREAMING]
   Build system prompt (see below)
   Call mistral-large-latest with stream=true
   Yield each token as SSE event { stage: 'streaming_token', token }
   │
   ▼
[Stage 4: Translation — CONDITIONAL]
   If target language != 'en':
     Translate full answer via Sarvam AI translate API
     Yield { stage: 'translated', text: translatedAnswer }
   │
   ▼
[Stage 5: Text-to-Speech — CONDITIONAL]
   If generateVoice == true:
     Call Sarvam AI TTS (bulbul:v1, speaker: meera)
     Decode base64 WAV → upload to Cloudinary → get URL
     Yield { stage: 'voice_ready', audioUrl }
   │
   ▼
[Stage 6: Complete]
   Yield { stage: 'complete', answer, sources[], audioUrl? }
   [END]
```

### System Prompt (Current Version: v2)

```
You are CivicPulse AI, an expert advisor on Indian government schemes, welfare programs,
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
MyScheme portal (myscheme.gov.in) or call the citizen helpline at 1800-11-2345."
```

**Prompt Version History:**
- `v1` (2026-10-31): Initial prompt. Missing formatting structure.
- `v2` (2026-10-31): Added emoji section headers, fallback message, specific instructions.

### Input Contract

```typescript
interface PolicyQueryDto {
  query: string                    // Citizen's question (any language)
  language: string                 // Target response language code (e.g., 'hi', 'ta', 'en')
  generateVoice: boolean           // Whether to generate Sarvam TTS audio
  category?: string                // Optional filter: 'scheme' | 'law' | 'policy'
  state?: string                   // Optional filter: state name for state-specific schemes
}
```

### Output Contract (SSE Events)

```typescript
type PolicyAgentEvent =
  | { stage: 'detecting_language'; message: string }
  | { stage: 'searching'; message: string }
  | { stage: 'found_sources'; count: number; sources: string[] }
  | { stage: 'generating'; message: string }
  | { stage: 'streaming_token'; token: string }
  | { stage: 'translating'; message: string }
  | { stage: 'translated'; text: string }
  | { stage: 'generating_voice'; message: string }
  | { stage: 'voice_ready'; audioUrl: string }
  | { stage: 'complete'; answer: string; sources: RetrievedPolicySource[]; audioUrl?: string }
  | { stage: 'error'; message: string; code: string }
```

### RAG Configuration

| Parameter | Value | Reason |
|-----------|-------|--------|
| Embedding model | `mistral-embed` | 1024-dim, multilingual |
| Retrieval k | 5 | Enough context without exceeding token limits |
| Chunk size | 700 chars | Fits 2-3 chunks in 4k context window comfortably |
| Chunk overlap | 150 chars | Prevents answer fragmentation at chunk boundaries |
| Similarity threshold | 0.65 | Filters irrelevant results |
| Hybrid search weight | 60% dense + 40% sparse | Dense favored for semantic understanding |

### Known Issues & Fixes

| Issue | Root Cause | Fix Applied |
|-------|-----------|------------|
| Hindi queries returning English chunks | Query not translated before embedding | Added translation step before embed call |
| Long policy answers getting cut off | mistral-large max_tokens too low | Increased to 1500 tokens |
| Voice generation failing silently | Sarvam TTS base64 decode error | Added try-catch with null fallback |
| Sarvam translate 400 on streaming answers | `mayura:v1` rejects input > 1000 chars; streamed answers run ~1500 | `splitBySentence` slices at sentence boundaries ≤ 900 chars, translated sequentially, joined |
| Sarvam TTS 400 (speaker `meera` rejected) | `bulbul:v1`/`v2` deprecated by Sarvam | Switched to `bulbul:v3` + speaker `priya`; text sliced ≤ 450 chars per request, WAV PCM payloads stitched (`concatWav`) |
| Intermittent `fetch failed` in long-running server | Undici stale pooled sockets after network blips | `fetchWithRetry` wrapper (retries transient codes) + global undici Agent `keepAliveTimeout: 1s` |
| Voice URL served as `application/octet-stream` | Cloudinary `raw` resource type doesn't sniff audio | `uploadAudioBuffer` — data-URI upload with `resource_type: video` → proper `audio/wav` |

---

## 2. Grievance Triage Agent

**File**: `backend/src/modules/grievance/grievance.agent.ts`  
**Trigger**: `POST /grievance/submit`  
**Output**: REST JSON response (synchronous pipeline)

### Purpose
Processes submitted civic grievances: analyzes media with vision AI, assigns a severity score, routes to the correct government department, and generates a tracking ID.

### Workflow Graph

```
[START: GrievanceSubmitDto + uploaded media files]
   │
   ▼
[Stage 1: Media Upload]
   Upload files to Cloudinary → collect cloudinary URLs
   │
   ▼
[Stage 2: Image Analysis — CONDITIONAL]
   If mediaUrls.length > 0:
     Call pixtral-12b-2409 with first image + forensics prompt
     Parse structured JSON response
     Extract: issueType, severityScore (1-10), safetyRisk, immediateActionRequired
   │
   ▼
[Stage 3: Text Severity Analysis]
   Call mistral-large-latest with description + category
   Parse structured JSON response
   Extract: severityScore (1-10), urgency, keyIssues[]
   │
   ▼
[Stage 4: Combined Severity Scoring]
   finalSeverityScore = (imageSeverity × 0.6) + (textSeverity × 0.4)
   Map to GrievancePriority enum:
     8–10 → CRITICAL | 6–7 → HIGH | 4–5 → MEDIUM | 1–3 → LOW
   │
   ▼
[Stage 5: Department Routing]
   Look up DEPARTMENT_ROUTING_BY_CATEGORY constant
   Assign SLA from GRIEVANCE_SEVERITY_SLA_MAP
   Generate tracking ID: CP-{STATE}-{YEAR}-{RANDOM6}
   │
   ▼
[Stage 6: Persist to MySQL]
   Create Grievance entity with all fields + aiAnalysis JSON blob
   │
   ▼
[Stage 7: Return GrievanceTriageResult]
   [END]
```

### Image Analysis Prompt (pixtral-12b-2409)

```
Analyze this civic infrastructure photograph submitted by an Indian citizen as a public grievance.
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
10: Life-threatening emergency (e.g. bridge collapse, severe flooding)
```

### Text Severity Prompt (mistral-large-latest)

```
Analyze this civic grievance description submitted by a citizen.
Return ONLY valid JSON:

{
  "severityScore": <integer 1-10>,
  "urgency": "immediate | urgent | normal | low",
  "keyIssues": ["<key issue 1>", "<key issue 2>"],
  "suggestedCategory": "<most appropriate category from: road|water|garbage|electricity|pollution|flood|other>"
}

Grievance description: "{grievanceDescription}"
Category reported by citizen: "{submittedCategory}"
Location: "{grievanceLocation}"
```

### Output Contract

```typescript
interface GrievanceTriageResult {
  grievance: GrievanceEntity
  generatedTrackingId: string
  grievancePriority: GrievancePriority
  assignedDepartment: string
  estimatedResolutionSla: string
  aiImageForensicsAnalysis: ImageForensicsResult | null
}
```

### Known Issues & Fixes

| Issue | Root Cause | Fix Applied |
|-------|-----------|------------|
| pixtral returning non-JSON | Markdown code fences in response | Added JSON.parse after stripping ```json wrappers |
| Severity always HIGH for text-only | No image → imageSeverity defaulted to 10 | Changed default imageSeverity to 5 when no image |
| Text-severity call 403 (`tier_not_allowed`) | API key tier blocks `mistral-large-latest` chat | `generateChatCompletion` runs `mistral-small-latest` first, auto-falls back to `pixtral-12b-2409` on tier/rate errors |
| Text-only reports underrated vs spec formula | Spec formula (image 5 × 0.6 + text × 0.4) caps a sev-9 report at ~5.6 | No-image scoring reweighted: text 80% + neutral image 20% (documented in `aiAnalysis.scoringModel`) |

---

## 3. Browser Service Agent

**File**: `backend/src/modules/service-agent/browser.agent.ts`  
**Trigger**: WebSocket event `start_task` on `/agent` namespace  
**Output**: WebSocket stream of `AgentStep` events

### Purpose
Autonomous Playwright agent that navigates Indian government service portals on behalf of citizens, fills application forms using their profile data, and returns tracking/reference numbers. Runs in **DEMO MODE** for hackathon (simulates navigation without real form submission).

### Workflow Graph

```
[START: AgentTaskDto { serviceType, citizenProfile }]
   │
   ▼
[Init Playwright Chromium browser (headless)]
   │
   ▼
[Navigate to service portal URL]
   Emit: { type: 'navigating', url, message }
   │
   ▼
[Load portal, take screenshot]
   Upload screenshot to Cloudinary
   Emit: { type: 'loaded', screenshotUrl, message }
   │
   ▼
[Analyze page with Mistral]
   Extract page text (innerText, max 3000 chars)
   Call mistral-large-latest with page context + citizen profile
   Get: { action, target, value, message }
   Emit: { type: 'ai_decision', message }
   │
   ▼
[Demo Mode: Simulate form-filling steps]  ← DEMO MODE ACTIVE
   Emit timed sequence of fill steps with citizen profile data
   Emit: CAPTCHA step (if configured) → wait for 'captcha_solved' event
   Emit: completion step with reference number
   │
   ▼
[Emit: task_done with tracking number]
   Close browser
   [END]
```

### Mistral Page Analysis Prompt

```
You are an intelligent web navigation assistant helping an Indian citizen access government services.

Task: Help the citizen apply for {serviceType} on {portalName}

Citizen Profile:
{JSON.stringify(citizenProfile, null, 2)}

Current Page Content (truncated):
{pageTextContent}

Based on the page content and citizen's task, what should be done next?
Return ONLY valid JSON:
{
  "action": "click | fill | navigate | scroll | wait | complete | error",
  "target": "<describe the UI element to interact with>",
  "value": "<value to enter if action is fill, else null>",
  "message": "<human-readable description of this step for the citizen>",
  "confidence": <0.0-1.0>
}

If you cannot determine the next action, set action to "error" and explain in message.
```

### AgentStep Event Contract

```typescript
interface AgentStep {
  id: number
  taskId: string
  timestamp: string
  type: AgentStepType
  status: 'running' | 'success' | 'failed' | 'waiting'
  message: string
  url?: string
  screenshotUrl?: string
  fieldName?: string
  fieldValue?: string
  trackingNumber?: string
}

type AgentStepType =
  | 'navigating'
  | 'loaded'
  | 'ai_decision'
  | 'filling'
  | 'clicking'
  | 'scrolling'
  | 'screenshot'
  | 'captcha_detected'
  | 'captcha_solved'
  | 'reviewing'
  | 'completed'
  | 'error'
```

### Supported Services

| serviceType | Portal URL | Demo Reference Format |
|-------------|-----------|----------------------|
| `scholarship` | scholarships.gov.in | `NSP-2026-{RANDOM6}` |
| `pan_card` | onlineservices.nsdl.com | `PAN-DEMO-{RANDOM6}` |
| `passport` | passportindia.gov.in | `PASS-2026-{RANDOM6}` |
| `ration_card` | nfsa.gov.in | `RC-DEMO-{RANDOM6}` |
| `driving_license` | sarathi.parivahan.gov.in | `DL-2026-{RANDOM6}` |
| `income_certificate` | State portal | `IC-DEMO-{RANDOM6}` |

### Demo Mode Behavior
> ⚠️ In demo mode (`DEMO_MODE=true`), the agent simulates portal navigation rather than
> making real form submissions. This protects citizens' data and avoids unintended actions.
> Each step is delayed by 1.5–2.5s to simulate realistic navigation speed.

### Socket Event Names (implementation notes)
- Client → server: `start_task` (AgentTaskDto) · `captcha_solved` `{ taskId }`
- Server → client: `connected` (greeting with demoMode flag) · `agent_step` (AgentStep) · `task_done` (AgentTaskDoneEvent `{ taskId, trackingNumber, url?, error? }`)
- Transport: connect with default transports (long-polling upgrade) — websocket-only handshakes can fail.
- If a live gov portal is unreachable from the agent environment, the loop continues on a local demo placeholder page so the full script (screenshots, AI decision, fills, CAPTCHA, reference number) still runs.
- Sensitive fields (Aadhaar, bank account) are masked in `fieldValue` inside step events.

---

## 4. Fact-Check Agent

**File**: `backend/src/modules/factcheck/factcheck.agent.ts`  
**Trigger**: `POST /factcheck/verify`  
**Output**: Server-Sent Events stream

### Purpose
Verifies viral claims and news by combining web evidence retrieval (SerpAPI), Mistral vision forensics for images, and a final verdict synthesized by `mistral-large-latest`. Specializes in Indian civic news and government-related misinformation.

### Workflow Graph

```
[START: FactCheckRequestDto { content, mediaUrl?, claimType }]
   │
   ▼
[Stage 1: Claim Extraction]
   Call mistral-large-latest to extract discrete factual claims
   Identify: named entities, dates, numbers, source attributions
   Classify claim type: political | health | disaster | financial | social
   Emit: { stage: 'claims_found', claims[] }
   │
   ▼
[Stage 2: Web Evidence Search]
   For each claim (max 3):
     Call SerpAPI with claim text
     Also search: altnews.in, boomlive.in, factchecker.in, pib.gov.in
   Assign credibility scores to sources:
     .gov.in / .nic.in → 1.0 | PIB → 0.95 | major news → 0.75 | blogs → 0.4
   Emit: { stage: 'evidence_found', sourceTitle }
   │
   ▼
[Stage 3: Image Forensics — CONDITIONAL]
   If mediaUrl provided:
     Download image, call pixtral-12b-2409 with forensics prompt
     Extract: manipulationScore, findings[], overallAssessment
     deepfakeScore = manipulationScore / 100
     Emit: { stage: 'forensics_done', deepfakeScore, findings[] }
   │
   ▼
[Stage 4: Verdict Synthesis]
   Call mistral-large-latest with: claims + evidence + forensicsScore
   Determine verdict: TRUE | FALSE | MISLEADING | UNVERIFIED | SATIRE
   Compute confidence (0.0–1.0)
   Emit: { stage: 'synthesizing' }
   │
   ▼
[Stage 5: Persist & Return]
   Save FactCheck entity to MySQL
   Emit: { stage: 'complete', verdict, confidence, reasoning, evidence[], deepfakeScore? }
   [END]
```

### Claim Extraction Prompt

```
You are a professional fact-checker specializing in Indian news and civic information.
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
Maximum 3 most important claims.
```

### Image Forensics Prompt (pixtral-12b-2409)

```
You are a digital forensics expert analyzing an image for signs of manipulation or misinformation.

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
81-100: Clear fabrication or heavy manipulation
```

### Verdict Synthesis Prompt

```
You are a senior fact-checker rendering a final verdict on a viral claim.

ORIGINAL CLAIM:
{content}

WEB EVIDENCE FOUND:
{JSON.stringify(topEvidenceItems, null, 2)}

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
- SATIRE: Content is satirical/parody, not intended as news
```

### Verdict Output Contract

```typescript
interface FactCheckCompleteEvent {
  stage: 'complete'
  reportId: number
  verdict: FactCheckVerdict
  confidence: number            // 0.0 – 1.0
  reasoning: string
  evidence: VerificationEvidence[]
  deepfakeScore: number | null  // 0.0 – 1.0, null if no image
  recommendation: string
}

type FactCheckVerdict = 'TRUE' | 'FALSE' | 'MISLEADING' | 'UNVERIFIED' | 'SATIRE'

interface VerificationEvidence {
  sourceTitle: string
  sourceUrl: string
  excerpt: string
  credibilityScore: number      // 0.0 – 1.0
  publishedDate: string | null
}
```

### Known Issues & Fixes

| Issue | Root Cause | Fix Applied |
|-------|-----------|------------|
| No web evidence available | `SERPAPI_KEY` unset in `.env` | Degrade implemented: Stage 2 skipped (search event notes it), verdict defaults `UNVERIFIED` @ 0.2; adding the key re-enables evidence with no code change |
| serpapi rate limits / hiccup | 429s and throttled shared keys | `serpSearch` returns `[]` on non-200 with a logger warning; per-claim site search wrapped in catch |
| Verdict model tier | Documented `mistral-large-latest` blocked by key tier (403) | Shared `generateChatCompletion` fallback chain (`mistral-small-latest` → `pixtral-12b-2409`) used for synthesis + extraction |

### Degrade Behavior: SERPAPI_KEY absent
> With `SERPAPI_KEY` unset, Stage 2 is skipped (the `searching` SSE event says so) and the verdict defaults to
> `UNVERIFIED` @ confidence 0.2 with citizen guidance. Claim extraction and image forensics still run, so
> the pipeline stays useful; setting the key re-enables web evidence automatically.

---

## Shared AI Services

### MistralAiService (`shared/ai/mistral.service.ts`)

Centralized wrapper for all Mistral API calls.

| Method | Model Used | Purpose |
|--------|-----------|---------|
| `generateChatCompletion(messages, opts?)` | `mistral-small-latest` → fallback `pixtral-12b-2409` | Single non-streaming response |
| `streamChatCompletion(messages, opts?)` | `pixtral-12b-2409` | Token-by-token AsyncGenerator |
| `analyzeImageWithPrompt(imageUrl, prompt)` | `pixtral-12b-2409` | OCR-style vision analysis (fixed `PixtralImageAnalysis` shape) |
| `analyzeImageFreeform<T>(prompt, image)` | `pixtral-12b-2409` | Prompt-agnostic vision JSON (grievance forensics, fact-check forensics) |
| `generateEmbedding(text)` / `generateEmbeddingBatch(texts[])` | `mistral-embed` | 1024-dim embeddings (Policy RAG) |
| `translateWithMistral(text, targetLang)` | (not implemented) | Sarvam covers translation; see below |

### SarvamVoiceService (`shared/ai/voice.service.ts`)

| Method | Sarvam Endpoint | Purpose |
|--------|----------------|---------|
| `transcribeAudio(audioBuffer, langCode)` | `/speech-to-text` | STT (`saaras:v3`) |
| `translateText(text, sourceLang, targetLang)` | `/translate` | Text translation (mayura:v1, sentence-sliced ≤ 900 chars) |
| `translateToEnglish(text, sourceLang)` | `/translate` | Pre-RAG translation |
| `synthesizeSpeech(text, langCode)` | `/text-to-speech` | TTS (`bulbul:v3`, speaker `priya`; slices ≤ 450 chars, WAV PCM stitched) |
| `detectInputLanguage(text)` | (local heuristic + Mistral fallback) | Language detection |

All outbound provider calls go through `fetchWithRetry` (`shared/ai/fetch.util.ts`) — retries transient network errors (ECONNRESET, ECONNREFUSED, ETIMEDOUT, EPIPE, EAI_AGAIN, UND_ERR_SOCKET); `main.ts` sets a global undici agent with `keepAliveTimeout: 1s` to evict dead pooled sockets.

---

## Prompt Engineering Guidelines

1. **Always request JSON output explicitly** — say "Return ONLY valid JSON" to prevent markdown wrapping.
2. **Always strip code fences** — parse response after removing ` ```json ` and ` ``` ` wrappers.
3. **Provide examples in prompts** for structured outputs — reduces hallucination.
4. **Keep context window in mind** — mistral-large-latest has 128k context; use max 3000 chars of page content for browser agent.
5. **Temperature settings**:
   - Policy Q&A: `temperature: 0.3` (factual, consistent)
   - Verdict synthesis: `temperature: 0.1` (decisive, minimal variation)
   - Image forensics: `temperature: 0.2` (analytical)
   - Browser agent decisions: `temperature: 0.4` (some flexibility for navigation)

---

## Agent Update Log

| Date | Agent | Change | Prompt Version |
|------|-------|--------|----------------|
| 2026-10-31 | Policy RAG Agent | Initial implementation | v1 |
| 2026-10-31 | Policy RAG Agent | Added emoji headers, fallback message | v2 |
| 2026-10-31 | Grievance Triage Agent | Initial implementation | v1 |
| 2026-10-31 | Browser Service Agent | Initial demo-mode implementation | v1 |
| 2026-10-31 | Fact-Check Agent | Initial implementation | v1 |
| 2026-10-31 | Multimodal Input Pipeline | Added text/audio/image/video pipelines with translation | v1 |
| 2026-10-31 | Multimodal Input Pipeline | Implemented pipeline in NestJS; STT model → `saaras:v3` (Sarvam deprecation); added `ffprobe-static`; JSON repair for Pixtral output | v2 |
| 2026-11-01 | Policy RAG Agent | Full module shipped: entity/ingest/SSE agent/controller; KB seeded via shared `PolicyIngestService` (8 docs → 22 chunks); end-to-end live-tested (EN+HI queries, streaming, translation, voice) | v2 |
| 2026-11-01 | Shared AI services | TTS → `bulbul:v3` + `priya`; chunked translate (≤900) & TTS (≤450); `fetchWithRetry` + short keep-alive; Cloudinary `uploadAudioBuffer` (audio/wav) | v2 |
| 2026-11-01 | Grievance Triage Agent | Full module shipped: entity + multipart `/grievance/submit` + `/grievance/track/:id`; live-tested text-only (CRITICAL/24h) and image forensics (pothole sev 8 → CRITICAL); Pixtral freeform + chat fallback chain added | v1 |
| 2026-11-01 | Shared AI services | `generateChatCompletion` added: `mistral-small-latest` primary, auto-fallback `pixtral-12b-2409` (key tier blocks `mistral-large-latest` — 403 `tier_not_allowed`); generic `analyzeImageFreeform<T>` for non-OCR vision prompts | v2 |
| 2026-11-01 | Browser Service Agent | Live-tested: socket.io `/agent` gateway + Playwright demo loop on scholarships.gov.in — real navigation, Cloudinary screenshots, Mistral page decision (PM YASASVI path), masked fills, CAPTCHA handshake → `NSP-2026-EMYE8P` | v1 |
| 2026-11-01 | Fact-Check Agent | Full module shipped: SSE `/factcheck/verify` (claims → SerpAPI evidence → Pixtral forensics → verdict → MySQL); live-tested offline degrade (scam text → FALSE 0.95) and image forensics (authentic 0.1 → UNVERIFIED 0.2) | v1 |

---

> **Rule**: Every time you change a system prompt, bump the version number and add a row to
> the Agent Update Log above. Include the date, which agent, what changed, and the new version.
>
> **Rule**: If an agent starts producing bad output, add a row to the "Known Issues & Fixes"
> table in that agent's section — even if you haven't fixed it yet.


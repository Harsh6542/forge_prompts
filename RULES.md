# 📐 CivicPulse AI — Code Architecture & Style Rules

> These rules are **non-negotiable** across all contributors. Every file, variable, function,
> and module must follow this guide. When in doubt, **be explicit over clever**.

---

## 1. File Naming Conventions

### 🟦 Backend — NestJS
Follow NestJS official convention: `kebab-case.type.ts`

| File Type | Pattern | Example |
|-----------|---------|---------|
| Module | `<feature>.module.ts` | `grievance.module.ts` |
| Controller | `<feature>.controller.ts` | `grievance.controller.ts` |
| Service | `<feature>.service.ts` | `grievance.service.ts` |
| Agent (agentic logic) | `<feature>.agent.ts` | `policy.agent.ts` |
| Gateway (WebSocket) | `<feature>.gateway.ts` | `agent.gateway.ts` |
| Entity (Sequelize) | `<feature>.entity.ts` | `policy-chunk.entity.ts` |
| DTO | `<action>-<feature>.dto.ts` | `create-grievance.dto.ts`, `submit-query.dto.ts` |
| Guard | `<name>.guard.ts` | `jwt-auth.guard.ts` |
| Filter | `<name>.filter.ts` | `http-exception.filter.ts` |
| Pipe | `<name>.pipe.ts` | `parse-tracking-id.pipe.ts` |
| Interceptor | `<name>.interceptor.ts` | `transform-response.interceptor.ts` |
| Strategy (Passport) | `<name>.strategy.ts` | `jwt.strategy.ts` |
| Interface | `<name>.interface.ts` | `agent-step.interface.ts` |
| Constants | `<scope>.constants.ts` | `department-routing.constants.ts` |
| Config | `<name>.config.ts` | `database.config.ts` |
| Types | `<name>.types.ts` | `sarvam-api.types.ts` |
| Seed | `<scope>.seed.ts` | `policy-schemes.seed.ts` |
| Test (unit) | `<feature>.service.spec.ts` | `grievance.service.spec.ts` |
| Test (e2e) | `<feature>.e2e-spec.ts` | `policy.e2e-spec.ts` |

> ❌ Never: `service.ts`, `helper.ts`, `utils.ts` (too generic)  
> ✅ Always: `mistral-chat.service.ts`, `severity-scoring.helper.ts`

### 🟨 Frontend — React + Vite
All files use **kebab-case** except React components which use **PascalCase** (filename matches export name).

| File Type | Pattern | Example |
|-----------|---------|---------|
| Page component | `PascalCase.tsx` | `PolicyExplainer.tsx` |
| Feature component | `PascalCase.tsx` | `AgentTerminal.tsx` |
| Hook | `use-kebab-case.ts` | `use-sse-stream.ts`, `use-voice-recorder.ts` |
| Store (Zustand) | `kebab-case.store.ts` | `auth.store.ts`, `grievance.store.ts` |
| API layer | `kebab-case.api.ts` | `policy.api.ts`, `fact-check.api.ts` |
| Types | `kebab-case.types.ts` | `agent-step.types.ts` |
| Constants | `kebab-case.constants.ts` | `language-options.constants.ts` |
| Utils | `kebab-case.utils.ts` | `severity-color.utils.ts`, `date-format.utils.ts` |
| Config | `kebab-case.config.ts` | `axios.config.ts` |

> ❌ Never: `Utils.tsx`, `Helper.tsx`, `Common.tsx`  
> ❌ Never mix: `policyExplainer.tsx`, `policy_explainer.tsx`

---

## 2. Variable & Constant Naming

### ✅ Core Rule: **Names must describe their domain, not their type**

```typescript
// ❌ Generic — banned
const data = await fetchData()
const result = processResult(input)
const list = getList()
const temp = calculateTemp()
const val = response.data
const obj = new Thing()
const res = await axios.get(...)
const arr = items.filter(...)
const flag = true
const num = 5
const str = 'hello'

// ✅ Domain-specific — required
const grievanceReport = await fetchGrievanceById(trackingId)
const mistralChatResponse = await processPolicyQuery(userInput)
const activeGrievanceList = await getGrievancesByStatus('IN_PROGRESS')
const localBodyTemperature = calculateAverageTemp(sensorReadings)
const policyChunkEmbedding = response.data.embedding
const newPolicyChunkRecord = new PolicyChunk()
const sarvamTtsResponse = await axios.post(SARVAM_TTS_ENDPOINT, ttsPayload)
const highSeverityGrievances = allGrievances.filter(g => g.severity === 'CRITICAL')
const isGrievanceResolved = true
const maxRetryAttempts = 5
const departmentAssignedName = 'Public Works Department'
```

### 📦 Naming by Category

#### Variables
```typescript
// IDs and tracking
const grievanceTrackingId = 'CP-MH-2024-XJ7K92'
const agentTaskUuid = uuidv4()
const policyChunkDatabaseId = chunk.id

// API responses
const mistralChatCompletionResponse = await mistralClient.chat(...)
const sarvamTranslationResult = await voiceService.translateText(...)
const serpApiSearchResults = await searchEvidence(claimText)

// Counts / scores
const cosineSimilarityScore = computeCosineSimilarity(embeddingA, embeddingB)
const imageForgeryProbability = forensicsAnalysis.manipulationScore / 100
const grievanceSeverityScore = Math.round(imageSeverityWeight * 0.6 + textSeverityWeight * 0.4)

// Collections
const retrievedPolicyChunks = await retrieverService.retrieve(queryText)
const userSubmittedMediaUrls = uploadedFiles.map(f => f.cloudinaryUrl)
const departmentRoutingMap = new Map<string, string>()
```

#### Functions
```typescript
// Services
async function embedPolicyChunkText(rawChunkText: string): Promise<number[]>
async function translateToTargetLanguage(sourceText: string, targetLangCode: string): Promise<string>
async function computeGrievanceSeverityScore(imageAnalysis: ImageForensicsResult, textAnalysis: TextSeverityResult): Promise<number>
async function routeGrievanceToDepartment(grievanceCategory: string, stateCode: string): Promise<string>
async function uploadMediaToCloudinary(fileBuffer: Buffer, folderPath: string): Promise<string>

// Agent workflows
async function* runPolicyRagWorkflow(policyQuery: PolicyQueryDto): AsyncGenerator<PolicyAgentEvent>
async function* streamFactVerificationPipeline(factCheckRequest: FactCheckRequestDto): AsyncGenerator<FactCheckEvent>

// Helpers
function computeCosineSimilarity(embeddingVectorA: number[], embeddingVectorB: number[]): number
function formatRetrievedChunksAsContext(retrievedChunks: RetrievedPolicyChunk[]): string
function generateGrievanceTrackingId(stateCode: string): string
function mapGrievanceCategoryToDepartment(grievanceCategory: GrievanceCategory): string
```

#### Constants (SCREAMING_SNAKE_CASE, always descriptive)
```typescript
// ❌ Bad
const MAX = 5
const URL = 'https://...'
const KEY = process.env.KEY
const LANGS = ['hi', 'ta']

// ✅ Good
const MAX_RAG_RETRIEVAL_CHUNKS = 5
const SARVAM_TTS_API_ENDPOINT = 'https://api.sarvam.ai/text-to-speech'
const MISTRAL_EMBEDDING_MODEL_NAME = 'mistral-embed'
const SUPPORTED_INDIAN_LANGUAGE_CODES = ['hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or', 'en'] as const
const GRIEVANCE_SEVERITY_SLA_MAP: Record<GrievancePriority, string> = {
  CRITICAL: '24 hours',
  HIGH: '72 hours',
  MEDIUM: '7 days',
  LOW: '30 days',
}
const DEPARTMENT_ROUTING_BY_CATEGORY: Record<GrievanceCategory, string> = {
  road: 'Public Works Department (PWD)',
  water: 'Jal Board / Water Authority',
  garbage: 'Municipal Corporation',
  electricity: 'State DISCOM',
  pollution: 'State Pollution Control Board',
}
```

#### Types & Interfaces (PascalCase, always prefixed by domain)
```typescript
// ❌ Bad
interface Data {}
type Result = {}
interface Props {}

// ✅ Good
interface PolicyAgentStreamEvent {
  stage: PolicyAgentStage
  message: string
  token?: string
  audioUrl?: string
  retrievedSources?: RetrievedPolicySource[]
}

interface GrievanceTriageResult {
  assignedDepartment: string
  grievancePriority: GrievancePriority
  estimatedResolutionDate: Date
  aiImageForensicsAnalysis: ImageForensicsResult | null
  generatedTrackingId: string
}

type GrievancePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
type GrievanceCategory = 'road' | 'water' | 'garbage' | 'electricity' | 'pollution' | 'flood' | 'other'
type SupportedLanguageCode = 'hi' | 'ta' | 'te' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu' | 'pa' | 'or' | 'en'
type MistralChatModel = 'mistral-large-latest' | 'mistral-small-latest' | 'pixtral-12b-2409'
type PolicyAgentStage = 'detecting_language' | 'searching' | 'generating' | 'translating' | 'generating_voice' | 'complete'
```

---

## 3. NestJS Architecture Rules

### Module Structure
```
Every feature MUST follow this exact structure:
modules/
  <feature>/
    <feature>.module.ts        # Imports, providers, exports
    <feature>.controller.ts    # HTTP layer only — no business logic
    <feature>.service.ts       # Business logic, DB access
    <feature>.agent.ts         # Agentic workflow (if applicable)
    <feature>.gateway.ts       # WebSocket (if applicable)
    dto/
      create-<feature>.dto.ts
      update-<feature>.dto.ts
      query-<feature>.dto.ts
```

### Controller Rules
```typescript
// ✅ Controllers ONLY handle:
// - Route definition
// - DTO validation (via pipes)
// - Calling one service method
// - Returning the result

@Controller('grievance')
@UseGuards(JwtAuthGuard)
export class GrievanceController {
  constructor(private readonly grievanceService: GrievanceService) {}

  @Post('submit')
  @UseInterceptors(FilesInterceptor('mediaFiles', 5))
  async submitGrievanceReport(
    @Body() createGrievanceDto: CreateGrievanceDto,
    @UploadedFiles() uploadedMediaFiles: Express.Multer.File[],
    @GetAuthenticatedUser() authenticatedUser: AuthenticatedUserPayload,
  ): Promise<GrievanceSubmissionResponse> {
    return this.grievanceService.submitGrievanceWithMediaUpload(
      createGrievanceDto,
      uploadedMediaFiles,
      authenticatedUser.userId,
    )
  }
}

// ❌ Never put business logic, DB calls, or API calls in controllers
```

### Service Rules
```typescript
// ✅ Services handle business logic
// ❌ Never make HTTP calls from controllers
// ❌ Never access the DB from controllers  
// ❌ Never call one service from a controller to call another — compose in service layer
```

### Dependency Injection
```typescript
// ✅ Always inject by interface when possible
// ✅ Always use constructor injection (never property injection)
constructor(
  @InjectModel(PolicyChunk)
  private readonly policyChunkRepository: typeof PolicyChunk,
  private readonly mistralAiService: MistralAiService,
  private readonly sarvamVoiceService: SarvamVoiceService,
  private readonly ragRetrieverService: RagRetrieverService,
) {}
```

---

## 4. React Component Rules

### Component Structure (strict order)
```typescript
// 1. Imports (external → internal → types)
// 2. Type definitions local to this file
// 3. Constants local to this component
// 4. Component function (named export, not default where possible)
// 5. Sub-components (if small enough to colocate)

// ❌ Bad
export default function Component({ data, handler, flag }: any) { ... }

// ✅ Good
interface PolicyChatMessageProps {
  chatMessage: PolicyChatMessage
  isStreamingActive: boolean
  onVoicePlaybackRequest: (audioUrl: string) => void
}

export function PolicyChatMessage({
  chatMessage,
  isStreamingActive,
  onVoicePlaybackRequest,
}: PolicyChatMessageProps) { ... }
```

### Hook Rules
```typescript
// ❌ Bad
function useData() { ... }
function useFetch() { ... }

// ✅ Good — hooks describe what they manage
function usePolicySseStream(queryEndpoint: string) { ... }
function useGrievanceMediaUpload(maxFileCount: number) { ... }
function useAgentWebSocketConnection(agentNamespace: string) { ... }
function useVoiceRecorder(silenceTimeoutMs: number) { ... }
```

---

## 5. Framer Motion Rules

### Always name animation variants
```typescript
// ❌ Bad (inline, unnamed)
<motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 20 }} />

// ✅ Good (named, reusable variants)
const CARD_ENTRANCE_ANIMATION_VARIANTS = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
}

<motion.div
  variants={CARD_ENTRANCE_ANIMATION_VARIANTS}
  initial="hidden"
  animate="visible"
/>
```

---

## 6. Database / Sequelize Rules

### Entity Rules
```typescript
// ✅ Always explicit column types, never rely on inference
@Column({ type: DataType.TEXT, allowNull: false })
grievanceDescription: string

@Column({ type: DataType.JSON, allowNull: true })
mistralImageForensicsResult: ImageForensicsResult | null

@Column({ type: DataType.DECIMAL(4, 3), allowNull: true })
imageForgeryProbabilityScore: number | null

// ❌ Never use raw SQL strings in service layer — always use Sequelize methods
// ❌ Never skip allowNull — always be explicit
```

### Query Rules
```typescript
// ❌ Bad
const data = await Grievance.findAll({ where: { status: 'SUBMITTED' } })

// ✅ Good — use typed where clauses
const pendingGrievances = await this.grievanceRepository.findAll({
  where: {
    grievanceStatus: GrievanceStatus.SUBMITTED,
    severityPriority: { [Op.in]: ['CRITICAL', 'HIGH'] },
  },
  order: [['createdAt', 'DESC']],
  limit: 50,
})
```

---

## 7. Error Handling Rules

```typescript
// ✅ Backend — always throw NestJS exceptions (never raw Error)
throw new NotFoundException(`Grievance with tracking ID ${grievanceTrackingId} not found`)
throw new BadRequestException(`Unsupported language code: ${requestedLanguageCode}`)
throw new ServiceUnavailableException('Mistral API is temporarily unavailable')

// ✅ Frontend — always handle API errors in API layer, not components
// api/policy.api.ts
export async function submitPolicyQuery(queryPayload: PolicyQueryPayload): Promise<PolicyQueryResponse> {
  try {
    const { data } = await axiosInstance.post<PolicyQueryResponse>('/policy/query', queryPayload)
    return data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new CivicPulseApiError(error.response?.data?.message ?? 'Policy query failed', error.response?.status)
    }
    throw error
  }
}
```

---

## 8. Comments & Documentation

```typescript
// ✅ Comment the WHY, not the WHAT
// ❌ Bad
// Loop through items
for (const chunk of retrievedPolicyChunks) { ... }

// ✅ Good
// Cosine similarity is computed in JS rather than MySQL because MySQL 8.0
// lacks native vector distance functions — this runs fast enough for k<=100 chunks
for (const policyChunk of candidatePolicyChunks) { ... }

// ✅ Every public service method gets JSDoc
/**
 * Retrieves the top-k most relevant policy chunks for a given citizen query.
 * Uses hybrid retrieval: dense (Mistral embeddings cosine similarity) + 
 * sparse (MySQL FULLTEXT BM25). Results are merged and deduplicated.
 *
 * @param citizenQueryText - Raw query string (any language, auto-detected)
 * @param retrievalOptions - Optional filters: category, state, maxResults
 * @returns Ranked list of policy chunks with similarity scores
 */
async retrieveRelevantPolicyChunks(
  citizenQueryText: string,
  retrievalOptions: PolicyRetrievalOptions = {},
): Promise<RetrievedPolicyChunk[]>
```

---

> Last updated: 2026-10-31
> Maintainer: CivicPulse AI Team


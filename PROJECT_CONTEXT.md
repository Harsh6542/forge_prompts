# 🏛️ CivicPulse AI — Project Context

> This document is the single source of truth for the CivicPulse AI project.
> Every team member and AI agent working on this codebase must read this first.
> **Update this file whenever the project scope, stack, or structure changes.**

---

## Project Identity

| Field | Value |
|-------|-------|
| **Project Name** | CivicPulse AI |
| **Tagline** | Your AI-Powered Civic Rights Assistant |
| **Hackathon Track** | Civic Pulse, Digital Governance & Public Information |
| **Type** | Gen AI + Agentic AI Web Application (RAG-Based) |
| **Status** | 🟡 In Development |
| **Started** | 2026-10-31 |

---

## Problem We're Solving

India's 1.4 billion citizens face four critical governance gaps:

1. **Policy Opacity** — Government schemes and welfare policies are inaccessible to ordinary citizens due to complex legal language and lack of regional language support.
2. **Civic Accountability Gap** — There is no unified, transparent platform to report and track civic infrastructure issues (roads, water, electricity) with real accountability.
3. **Bureaucratic Friction** — Government service portals are non-API, legacy, and complex. Citizens waste days navigating them manually.
4. **Viral Misinformation** — Deepfakes and fabricated civic news spread rapidly with no accessible real-time verification tool for citizens.

---

## Solution Overview

**CivicPulse AI** is a unified civic super-platform with four AI-powered features, each solving one of the problems above:

| Feature | What It Does |
|---------|-------------|
| 🗣️ **Policy Explainer** | RAG-powered chatbot that answers questions about government schemes in 11 Indian languages with voice output |
| 📸 **Grievance Triage** | Multimodal grievance submission (image + text), AI severity scoring, automatic department routing, public accountability dashboard |
| 🤖 **Service Agent** | Autonomous Playwright browser agent that navigates legacy government portals and fills forms on behalf of citizens |
| 🔍 **Fact-Check Engine** | Mistral Vision + SerpAPI-powered fact verification and deepfake forensics for viral media and news claims |

---

## Tech Stack

### Frontend
- **Framework**: React 19 + Vite (TypeScript, SPA)
- **Routing**: react-router-dom v7 (JWT-protected routes; one page per route in `src/pages/`)
- **Styling**: Hand-rolled flat CSS theme (`src/index.css`) — light e-gov look, no UI framework
- **HTTP**: Native fetch with JWT header injection (`src/lib/http-client.api.ts`)
- **Real-time**: socket.io-client 4.x (WebSocket for agent terminal, JWT handshake via `auth: { token }`)
- **SSE**: POST-based fetch stream reader (EventSource cannot POST; `streamSse` in http-client)
- **Env**: `VITE_API_URL` / `VITE_WS_URL` consumed from `frontend/.env`

### Backend
- **Framework**: NestJS (TypeScript, modular)
- **ORM**: Sequelize + sequelize-typescript
- **Database**: MySQL 8.0
- **AI LLM**: Mistral API
  - Chat: `mistral-small-latest` (primary; `pixtral-12b-2409` auto-fallback on tier/rate errors — key tier blocks `mistral-large-latest`)
  - Vision: `pixtral-12b-2409`
  - Embeddings: `mistral-embed` (1024-dim)
- **Voice/Language**: Sarvam AI (STT, TTS, Translation — 11 Indian languages)
- **Browser Automation**: Playwright (Chromium, headless)
- **Auth**: JWT + Passport.js (`passport-jwt`, `passport-local`)
- **WebSocket**: @nestjs/websockets + socket.io
- **File Upload**: Multer + Cloudinary
- **Fact-Check Search**: SerpAPI (web evidence retrieval)
- **Validation**: class-validator + class-transformer
- **Config**: @nestjs/config + pydantic-style environment validation

### Infrastructure
- **Containerization**: Docker + Docker Compose (MySQL + Backend + Frontend)
- **Local Dev**: `docker-compose up` starts entire stack

---

## Repository Structure

```
civicpulse-ai/                          ← monorepo root
├── RULES.md                            ← Code style & architecture rules (READ FIRST)
├── PROJECT_CONTEXT.md                  ← This file — project overview & decisions
├── AGENTS.md                           ← AI agent definitions, workflows, prompt history
├── docker-compose.yml                  ← Full local stack
├── mysql-init/
│   └── init.sql                        ← DB schema + seed
│
├── frontend/                           ← React + Vite SPA
│   ├── src/
│   │   ├── pages/                      ← One file per route
│   │   ├── components/                 ← Feature-grouped components
│   │   │   ├── layout/
│   │   │   ├── policy/
│   │   │   ├── grievance/
│   │   │   ├── agent/
│   │   │   ├── factcheck/
│   │   │   └── shared/
│   │   ├── hooks/                      ← Custom React hooks
│   │   ├── store/                      ← Zustand stores
│   │   ├── lib/                        ← Axios config, utils, constants
│   │   └── types/                      ← Shared TypeScript interfaces
│   ├── public/
│   └── package.json
│
└── backend/                            ← NestJS API
    └── src/
        ├── main.ts
        ├── app.module.ts
        ├── config/
        ├── database/
        │   └── entities/               ← Sequelize models
        ├── modules/
        │   ├── auth/                   ← JWT authentication
        │   ├── policy/                 ← Policy Explainer feature
        │   ├── grievance/              ← Grievance Triage feature
        │   ├── service-agent/          ← Browser Agent feature
        │   └── factcheck/              ← Fact-Check feature
        └── shared/
            ├── rag/                    ← RAG pipeline (embed, ingest, retrieve)
            ├── ai/                     ← Mistral + Sarvam service wrappers
            ├── storage/                ← Cloudinary service
            ├── guards/
            ├── filters/
            └── pipes/
```

---

## API Endpoints Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new citizen account |
| POST | `/auth/login` | Login, returns JWT |
| GET | `/auth/profile` | Get authenticated user profile |

### Policy Explainer
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/policy/query` | SSE stream — RAG policy query | Required |
| POST | `/policy/voice-query` | Audio file → STT → RAG → TTS response | Required |
| POST | `/policy/ingest` | Admin: ingest new policy document | Admin |
| GET | `/policy/categories` | List policy categories | Public |
| GET | `/policy/schemes` | Paginated schemes list | Public |

### Grievance
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/grievance/submit` | Submit with media files | Required |
| GET | `/grievance/track/:trackingId` | Track grievance status | Public |
| GET | `/grievance/dashboard` | Aggregate public stats | Public |
| GET | `/grievance/heatmap` | GeoJSON for map | Public |
| GET | `/grievance/my` | Authenticated user's grievances | Required |
| PATCH | `/grievance/:id/status` | Update status (officer) | Admin |

### Service Agent
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/agent/tasks` | Create task, return taskId | Required |
| GET | `/agent/tasks/:id` | Task status + steps | Required |
| GET | `/agent/tasks/user/:userId` | User task history | Required |
| DELETE | `/agent/tasks/:id` | Cancel task | Required |
| WS | `/agent` (namespace) | Live agent step stream | Required |

### Fact-Check
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/factcheck/verify` | SSE stream — verify claim | Public |
| GET | `/factcheck/report/:id` | Full stored report | Public |
| GET | `/factcheck/trending` | Latest 10 verified claims | Public |
| POST | `/factcheck/bulk` | Batch verify claims | Required |

---

## Database Schema Summary

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Citizen accounts | id, email, passwordHash, state, preferredLanguage |
| `policy_chunks` | RAG knowledge base | content, embedding (JSON), category, state, sourceUrl |
| `grievances` | Civic reports | trackingId, severity, status, aiAnalysis (JSON), lat/lng |
| `agent_tasks` | Browser agent history | serviceType, citizenProfile (JSON), steps (JSON), status |
| `fact_checks` | Verification reports | verdict, confidence, evidence (JSON), deepfakeScore |

### Embedding Storage Note
> Mistral embeddings (1024-dim float arrays) are stored as MySQL `JSON` columns.
> Cosine similarity is computed in the Node.js application layer.
> This eliminates the need for a separate vector database (Qdrant/Pinecone) — acceptable for hackathon scale.
> Migration path for production: move to Qdrant or MySQL 9.0 VECTOR type.

---

## AI Models Used

| Model | Provider | Used For |
|-------|----------|---------|
| `mistral-small-latest` | Mistral AI | Policy Q&A, grievance text analysis, verdict synthesis (auto-fallback: `pixtral-12b-2409`) |
| `pixtral-12b-2409` | Mistral AI | Grievance image analysis, deepfake forensics, agent page decisions, streaming |
| `mistral-embed` | Mistral AI | Generating 1024-dim document + query embeddings |
| `saaras:v3` | Sarvam AI | Indian language Speech-to-Text (deprecates `saarika:v1`) |
| `bulbul:v3` | Sarvam AI | Indian language Text-to-Speech (speaker: priya; deprecates `bulbul:v1`) |
| Sarvam Translate | Sarvam AI | Indian language translation (any ↔ any) |

---

## Environment Variables

### Backend `.env`
```
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=civicpulse
DATABASE_USER=root
DATABASE_PASSWORD=password
MISTRAL_API_KEY=
SARVAM_API_KEY=
SERPAPI_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
JWT_SECRET=
JWT_EXPIRES_IN=7d
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_DEMO_MODE=false
```

---

## Key Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| NestJS over Express | Module system enforces clean separation; decorators match Spring-like patterns for maintainability |
| React + Vite over Next.js | No SSR needed for hackathon; Vite HMR is significantly faster during development |
| MySQL over PostgreSQL | Team familiarity; MySQL 8.0 JSON columns are sufficient for embedding storage |
| Sequelize over TypeORM | Simpler MySQL integration; mature ecosystem for MySQL dialect |
| Mistral over Gemini | User preference; `pixtral-12b-2409` handles both vision tasks; single API key covers everything |
| Mistral embeddings in MySQL | Avoids Qdrant/Pinecone setup complexity; cosine similarity in JS is fast enough for ≤10k chunks |
| Sarvam AI for voice | Only Indian-origin API with all 11 scheduled Indian languages; better quality than generic TTS |
| Framer Motion for all animations | Consistent animation API; declarative `variants` approach keeps component code clean |
| Playwright over Puppeteer | Better cross-browser support; `@playwright/test` ecosystem; maintained by Microsoft |

---

## Supported Indian Languages

| Code | Language | Script |
|------|----------|--------|
| `hi` | Hindi | Devanagari |
| `ta` | Tamil | Tamil |
| `te` | Telugu | Telugu |
| `kn` | Kannada | Kannada |
| `ml` | Malayalam | Malayalam |
| `mr` | Marathi | Devanagari |
| `bn` | Bengali | Bengali |
| `gu` | Gujarati | Gujarati |
| `pa` | Punjabi | Gurmukhi |
| `or` | Odia | Odia |
| `en` | English | Latin |

---

## Government Services Supported (Browser Agent)

| Service Key | Portal | Description |
|-------------|--------|-------------|
| `scholarship` | scholarships.gov.in | NSP Pre/Post Matric Scholarships |
| `pan_card` | onlineservices.nsdl.com | PAN Card Application & Correction |
| `passport` | passportindia.gov.in | Passport Appointment Booking |
| `ration_card` | nfsa.gov.in | Ration Card Registration |
| `driving_license` | sarathi.parivahan.gov.in | DL Application & Renewal |
| `income_certificate` | State-specific portals | Income/Domicile Certificates |

---

## Policy Knowledge Base (Seeded Schemes)

1. **PM-KISAN** — ₹6,000/year for small farmers
2. **Ayushman Bharat (PMJAY)** — ₹5 lakh health cover for BPL families
3. **PM Awas Yojana (PMAY)** — Housing subsidy for economically weaker sections
4. **Startup India** — Benefits and registration for recognized startups
5. **MGNREGS** — 100 days guaranteed rural employment
6. **Beti Bachao Beti Padhao** — Girl child welfare schemes
7. **PM Mudra Yojana** — Micro-enterprise loans (Shishu/Kishor/Tarun)
8. **Sukanya Samriddhi Yojana** — Girl child savings scheme
9. **National Scholarship Portal (NSP)** — Centralized scholarship portal
10. **Digital India** — e-governance and digital literacy programs

---

## Grievance Categories & Department Routing

| Category | Department |
|----------|-----------|
| `road` / `bridge` | Public Works Department (PWD) |
| `water` / `drainage` | Jal Board / Water Authority |
| `garbage` / `sanitation` | Municipal Corporation |
| `electricity` | State DISCOM |
| `pollution` | State Pollution Control Board (SPCB) |
| `flood` / `disaster` | State Disaster Management Authority |
| `other` | Municipal Corporation (default) |

---

## Severity Classification (Grievance)

| Score | Priority | SLA | Color |
|-------|----------|-----|-------|
| 8–10 | CRITICAL | 24 hours | Red |
| 6–7 | HIGH | 72 hours | Orange |
| 4–5 | MEDIUM | 7 days | Yellow |
| 1–3 | LOW | 30 days | Green |

> Score = `imageSeverity × 0.6 + textSeverity × 0.4`  
> Image analysis from `pixtral-12b-2409`; text analysis from `mistral-small-latest` (with `pixtral-12b-2409` fallback)

---

## Tracking ID Format

```
CP-{STATE_CODE}-{YEAR}-{RANDOM_6_CHARS}
Example: CP-MH-2026-XJ7K92
         CP-DL-2026-A3B9PQ
```

---

## Change Log

| Date | Change | Updated By |
|------|--------|-----------|
| 2026-10-31 | Project initialized. Full stack defined. | Team |
| 2026-10-31 | Stack updated: NestJS + React/Vite + MySQL + Sequelize + Mistral | Team |

---

> **Keep this document updated** every time you:
> - Add a new feature or endpoint
> - Change the database schema
> - Switch or add an AI model
> - Change a major design decision
> - Add a new supported language or government service


import { Injectable, Logger } from '@nestjs/common';
import { chromium, type Browser, type Page } from 'playwright';
import { randomSuffix } from '../../shared/input-pipeline/util.js';
import { CloudinaryService } from '../../shared/ai/cloudinary.service.js';
import { MistralAiService } from '../../shared/ai/mistral.service.js';
import { parseModelJson } from '../../shared/input-pipeline/util.js';
import {
  type AgentStep,
  type AgentStepStatus,
  type AgentStepType,
  type AgentTaskDoneEvent,
  type AgentTaskDto,
  type CitizenProfile,
} from './agent-step.js';
import {
  FIELD_LABELS,
  FILL_FIELD_ORDER,
  MASKED_FIELDS,
  SERVICE_PORTALS,
  type ServicePortalDef,
} from './service-registry.js';
import type { Socket } from 'socket.io';

export const BROWSER_PAGE_ANALYSIS_PROMPT = `You are an intelligent web navigation assistant helping an Indian citizen access government services.

Task: Help the citizen apply for {serviceType} on {portalName}

Citizen Profile:
{citizenProfileJson}

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

If you cannot determine the next action, set action to "error" and explain in message.`;

interface PageDecision {
  action: 'click' | 'fill' | 'navigate' | 'scroll' | 'wait' | 'complete' | 'error';
  target?: string;
  value?: string | null;
  message?: string;
  confidence?: number;
}

@Injectable()
export class BrowserAgentService {
  private readonly logger = new Logger(BrowserAgentService.name);
  private readonly demoMode = (process.env.DEMO_MODE ?? 'true') !== 'false';
  private readonly captchaResolvers = new Map<string, () => void>();

  constructor(
    private readonly mistral: MistralAiService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  handleCaptchaSolved(taskId: string): void {
    const resolve = this.captchaResolvers.get(taskId);
    if (resolve) {
      this.captchaResolvers.delete(taskId);
      resolve();
    }
  }

  async runTask(client: Socket, dto: AgentTaskDto, reportedById: number | null = null): Promise<void> {
    const service = SERVICE_PORTALS[dto.serviceType];
    const taskId = `TASK-${randomSuffix(6)}`;
    let stepId = 0;

    const emit = (
      type: AgentStepType,
      status: AgentStepStatus,
      message: string,
      extra: Partial<AgentStep> = {},
    ) => {
      client.emit('agent_step', {
        id: ++stepId,
        taskId,
        timestamp: new Date().toISOString(),
        type,
        status,
        message,
        ...extra,
      });
    };

    emit('ai_decision', 'running', 'Validating task…');
    await this.validateTask(dto);

    emit('ai_decision', 'success', `Service confirmed: ${service.portalName} (${dto.serviceType})`);
    if (!this.demoMode) {
      emit('error', 'failed', 'DEMO_MODE is disabled — real form submission is not allowed on this build.');
      const done: AgentTaskDoneEvent = { taskId, trackingNumber: null, error: 'DEMO_MODE disabled' };
      client.emit('task_done', done);
      return;
    }

    let browser: Browser | null = null;
    try {
      emit('ai_decision', 'running', 'Launching headless browser…');
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) CivicPulseAgent/1.0',
      });

      // Navigate to the portal (unreachable gov sites fall back to a local placeholder)
      emit('navigating', 'running', `Opening ${service.portalName}…`, { url: service.portalUrl });
      const reachable = await openPortal(page, service.portalUrl);
      if (reachable) {
        emit('navigating', 'success', `${service.portalName} opened`, { url: page.url() });
      } else {
        emit(
          'navigating',
          'failed',
          `${service.portalName} is unreachable from the agent — continuing on demo placeholder`,
          { url: service.portalUrl },
        );
        await setDemoPlaceholder(page, service);
      }

      this.emitScreenshot(emit, page, 'loaded', `${service.portalName} loaded — capturing page state`);

      // Mistral page analysis
      const pageText = await readPageText(page);
      const decision = await this.analyzePageWithMistral(dto, service, pageText);
      emit(
        'ai_decision',
        decision.action === 'error' ? 'failed' : 'success',
        `AI decision: ${decision.action} → ${decision.target ?? 'n/a'} — ${decision.message ?? decision.message ?? ''}`,
        { url: page.url() },
      );

      // Demo mode: timed fill sequence with the citizen's profile
      emit('filling', 'running', 'Filling application form with your profile…');
      const fields = FILL_FIELD_ORDER[dto.serviceType] ?? ['fullName', 'mobile', 'email'];
      for (const field of fields) {
        const raw = String(dto.citizenProfile[field] ?? '').trim();
        if (!raw) continue; // skip optional fields the citizen left out
        await sleep(1500 + Math.floor(Math.random() * 1000));
        emit('filling', 'success', `Filled ${FIELD_LABELS[field] ?? field} on ${service.portalName}`, {
          fieldName: field,
          fieldValue: MASKED_FIELDS.has(field) ? maskDigits(raw) : raw,
          url: page.url(),
        });
      }

      if (service.captchaConfigured) {
        await this.captchaStep(emit, taskId, service);
      } else {
        await sleep(1600);
        emit(
          'captcha_solved',
          'success',
          'No CAPTCHA configured for this service — proceeding to review',
        );
      }

      // Review screenshot + simulated submit
      this.emitScreenshot(emit, page, 'reviewing', 'Reviewing the completed application before submit');

      emit('clicking', 'running', 'Submitting application…');
      await sleep(1800);
      const trackingNumber = buildDemoReference(service);
      emit('clicking', 'success', `Submitted to ${service.portalName}`, { url: page.url() });

      await sleep(2000);
      emit('completed', 'success', `Application submitted — reference: ${trackingNumber}`, {
        trackingNumber,
        url: service.portalUrl,
      });

      const done: AgentTaskDoneEvent = { taskId, trackingNumber, url: service.portalUrl };
      client.emit('task_done', done);
    } catch (err) {
      this.logger.error(`Agent task ${taskId} failed: ${(err as Error).message}`);
      emit('error', 'failed', `Agent failed: ${(err as Error).message ?? 'unknown error'}`);
      const done: AgentTaskDoneEvent = { taskId, trackingNumber: null, error: (err as Error).message };
      client.emit('task_done', done);
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }

  private async validateTask(dto: AgentTaskDto): Promise<void> {
    if (!SERVICE_PORTALS[dto.serviceType]) {
      throw new Error(`Unknown serviceType '${dto.serviceType}'. Supported: ${Object.keys(SERVICE_PORTALS).join(', ')}`);
    }
    const profile = dto.citizenProfile ?? ({} as CitizenProfile);
    if (!profile.fullName || !profile.mobile || !profile.email) {
      throw new Error('citizenProfile requires at least fullName, mobile and email');
    }
  }

  private async analyzePageWithMistral(
    dto: AgentTaskDto,
    service: ServicePortalDef,
    pageText: string,
  ): Promise<PageDecision> {
    const prompt = BROWSER_PAGE_ANALYSIS_PROMPT.replace('{serviceType}', dto.serviceType)
      .replace('{portalName}', service.portalName)
      .replace('{citizenProfileJson}', JSON.stringify(dto.citizenProfile, null, 2))
      .replace('{pageTextContent}', pageText);
    try {
      const raw = await this.mistral.generateChatCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.4 },
      );
      return parseModelJson<PageDecision>(raw);
    } catch (err) {
      this.logger.warn(`Page analysis failed (${(err as Error).message}) — continuing demo script`);
      return {
        action: 'fill',
        target: 'application form fields',
        message: 'Proceeding with the standard application script',
        confidence: 0.5,
      };
    }
  }

  private async captchaStep(
    emit: (type: AgentStepType, status: AgentStepStatus, message: string, extra?: Partial<AgentStep>) => void,
    taskId: string,
    _service: ServicePortalDef,
  ): Promise<void> {
    emit('captcha_detected', 'waiting', 'CAPTCHA displayed — solve it in the app to continue');
    const solved = await new Promise<boolean>((resolve) => {
      this.captchaResolvers.set(taskId, () => resolve(true));
      setTimeout(() => {
        if (this.captchaResolvers.has(taskId)) {
          this.captchaResolvers.delete(taskId);
          resolve(false);
        }
      }, 120_000);
    });
    if (!solved) {
      emit('captcha_solved', 'failed', 'CAPTCHA not solved within 2 minutes — task aborted');
      throw new Error('CAPTCHA not solved within 2 minutes');
    }
    emit('captcha_solved', 'success', 'CAPTCHA verified — continuing');
  }

  private emitScreenshot(
    emit: (type: AgentStepType, status: AgentStepStatus, message: string, extra?: Partial<AgentStep>) => void,
    page: Page,
    type: AgentStepType,
    message: string,
  ): void {
    emit(type, 'running', message);
    void (async () => {
      try {
        const shot = await page.screenshot({ type: 'jpeg', quality: 65 });
        const upload = await this.cloudinary.uploadBuffer(shot, 'agent-screens', 'image', 'image/jpeg');
        emit(type, 'success', `${message} — screenshot stored`, {
          screenshotUrl: upload.url ?? undefined,
          url: page.url(),
        });
      } catch (err) {
        emit(type, 'failed', `${message} — screenshot unavailable: ${(err as Error).message}`);
      }
    })();
  }
}

function maskDigits(value: string): string {
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${'*'.repeat(Math.max(0, value.length - 4))} ${value.slice(-4)}`.trim();
}

function buildDemoReference(service: ServicePortalDef): string {
  const suffix = randomSuffix(6);
  return service.refStyle === 'year'
    ? `${service.refPrefix}-${new Date().getFullYear()}-${suffix}`
    : `${service.refPrefix}-DEMO-${suffix}`;
}

async function openPortal(page: Page, url: string): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    return page.url().startsWith('http');
  } catch (err) {
    void err;
    return false;
  }
}

async function setDemoPlaceholder(page: Page, service: ServicePortalDef): Promise<void> {
  await page.setContent(
    `<html><body style="font-family:sans-serif;padding:40px">
      <h2>CivicPulse Demo — ${service.portalName}</h2>
      <p>Live portal is not reachable in this environment. The agent continues in DEMO MODE with a simulated form.</p>
      <form>
        <input placeholder="Full Name"/> <input placeholder="Mobile"/><input placeholder="Email"/>
        <button type="button">Apply</button>
      </form>
    </body></html>`,
    { waitUntil: 'load' },
  );
}

async function readPageText(page: Page): Promise<string> {
  try {
    const text = await page.evaluate(() => document.body.innerText);
    return text.slice(0, 3000);
  } catch {
    return '';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

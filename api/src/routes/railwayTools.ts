// ============================================================
// NEW FILE: api/src/routes/railwayTools.ts
//
// Express routes for the 3 Railway DevTools:
//   POST /api/railway/validate   — Config Validator (1 credit)
//   POST /api/railway/calculate  — Cost Calculator (1 credit)
//   POST /api/railway/migrate    — DB Migration Assistant (1 credit)
//
// Prerequisites:
//   npm install @anthropic-ai/sdk   (in api/ directory)
//   Add ANTHROPIC_API_KEY to your .env
// ============================================================

import { Router, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types/express';
import { env } from '../config/env';

const router = Router();

function getAnthropicClient() {
  return new Anthropic({ apiKey: env.anthropicApiKey });
}

async function deductCredit(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  // Pro users: unlimited
  if (user.plan === 'PRO') return true;
  // Free/credit users: must have credits
  if (user.credits <= 0) return false;
  await prisma.user.update({
    where: { id: userId },
    data: { credits: { decrement: 1 } },
  });
  return true;
}

// ─── Shared Claude caller ─────────────────────────────────────────────────────

async function callClaude(system: string, userPrompt: string, maxTokens = 2048): Promise<string> {
  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const block = message.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
  return block.text.trim();
}

function parseJson(raw: string) {
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONFIG VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

type ConfigFormat = 'railway-json' | 'railway-toml' | 'dockerfile' | 'nixpacks' | 'railpack' | 'procfile' | 'unknown';

function detectFormat(config: string, hint?: string): ConfigFormat {
  const validFormats: ConfigFormat[] = ['railway-json', 'railway-toml', 'dockerfile', 'nixpacks', 'railpack', 'procfile'];
  if (hint && validFormats.includes(hint as ConfigFormat)) return hint as ConfigFormat;
  const trimmed = config.trim();
  const firstLine = trimmed.split('\n')[0].trim().toUpperCase();
  if (firstLine.startsWith('FROM ') || firstLine === 'FROM') return 'dockerfile';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.['$schema']?.includes('railpack') || (parsed?.steps !== undefined && parsed?.deploy !== undefined)) return 'railpack';
    } catch { /* not valid JSON */ }
    return 'railway-json';
  }
  const lines = trimmed.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (lines.length > 0 && lines.every((l) => /^[a-zA-Z_][a-zA-Z0-9_]*:\s*.+/.test(l.trim()))) return 'procfile';
  if (trimmed.includes('[phases]') || trimmed.includes('[phases.') || trimmed.includes('[start]')) return 'nixpacks';
  if (trimmed.includes('[[services]]') || trimmed.includes('startCommand') || trimmed.includes('healthcheckPath')) return 'railway-toml';
  return 'unknown';
}

const BASE_RESPONSE_FORMAT = `
RESPONSE FORMAT — return ONLY valid JSON, no markdown:
{
  "issues": [{ "severity": "critical"|"warning"|"info", "category": "PORT"|"ENV_VARS"|"BUILD"|"NETWORKING"|"DATABASE"|"HEALTHCHECK"|"PROCESS"|"SECURITY"|"GENERAL", "title": "...", "description": "...", "fix": "..." }],
  "summary": "One-sentence overall assessment",
  "configFormat": "railway-json"|"railway-toml"|"dockerfile"|"nixpacks"|"railpack"|"procfile"|"unknown",
  "score": 0-100
}
Return ONLY the JSON object.`;

const FORMAT_PROMPTS: Record<string, string> = {
  'railway-json': `You are an expert Railway.io deployment engineer analyzing a railway.json file. Find PORT misconfigs (Railway injects PORT — hardcoded ports fail), invalid builders, bad healthcheckPaths, invalid restartPolicyType, missing startCommands, duplicate service names.` + BASE_RESPONSE_FORMAT,
  'railway-toml': `You are an expert Railway.io deployment engineer analyzing a railway.toml file. Find PORT issues, missing startCommand, invalid builders, bad healthcheckPaths, TOML syntax errors, [[services]] vs [services] confusion.` + BASE_RESPONSE_FORMAT,
  'dockerfile': `You are a Docker and Railway.io expert. Railway injects PORT — services MUST listen on $PORT. Find: hardcoded ports in CMD/EXPOSE, missing CMD/ENTRYPOINT, latest tags, root user, hardcoded secrets, apt-get without update.` + BASE_RESPONSE_FORMAT,
  'nixpacks': `You are a Nixpacks and Railway.io expert analyzing a nixpacks.toml. Find: missing [start] cmd, invalid providers, wrong phase commands, hardcoded ports instead of $PORT, invalid nixpkgs.` + BASE_RESPONSE_FORMAT,
  'railpack': `You are a Railpack expert. Find: missing/hardcoded port in deploy.startCommand, invalid step structure, undefined step references, invalid providers, bad healthcheckPath.` + BASE_RESPONSE_FORMAT,
  'procfile': `You are a Railway.io expert analyzing a Procfile. Find: missing web process, hardcoded ports instead of $PORT, invalid process names, worker processes without proper commands.` + BASE_RESPONSE_FORMAT,
  'unknown': `You are a Railway.io expert. Identify the config format and find deployment issues. Focus on PORT configuration, build commands, and Railway-specific requirements.` + BASE_RESPONSE_FORMAT,
};

router.post('/validate', requireAuth, async (req: AuthRequest, res: Response) => {
  const { config, formatHint } = req.body;

  if (!config || typeof config !== 'string' || config.trim().length === 0) {
    res.status(400).json({ error: 'Missing or empty config.' });
    return;
  }
  if (config.length > 20000) {
    res.status(413).json({ error: 'Config too large (max 20,000 characters).' });
    return;
  }

  const canProceed = await deductCredit(req.userId!);
  if (!canProceed) {
    res.status(402).json({ error: 'No credits remaining. Please purchase more credits.' });
    return;
  }

  try {
    const configFormat = detectFormat(config, formatHint);
    const system = FORMAT_PROMPTS[configFormat] ?? FORMAT_PROMPTS['unknown'];
    const userPrompt = `Analyze this Railway config and return a JSON validation report:\n\`\`\`\n${config}\n\`\`\`\nReturn ONLY the JSON object.`;

    const raw = await callClaude(system, userPrompt);
    const data = parseJson(raw);

    if (!Array.isArray(data.issues) || typeof data.summary !== 'string') {
      throw new Error('Invalid response structure');
    }

    res.json({
      issues: data.issues,
      summary: data.summary,
      configFormat: data.configFormat ?? configFormat,
      score: Math.min(100, Math.max(0, Math.round(data.score ?? 50))),
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[railway/validate] error:', err);
    res.status(502).json({ error: 'Failed to analyze config. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. COST CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────

const CALCULATE_SYSTEM = `You are an expert Railway.io infrastructure cost analyst.

Railway.io pricing (2024):
COMPUTE: $0.000463/vCPU/min, $0.000231/GB RAM/min. Hobby: $5/mo credit. Pro: $20/mo credit.
DATABASES: PostgreSQL/MySQL ~$5–20/mo, Redis ~$3–15/mo, MongoDB ~$5–25/mo. Storage: $0.25/GB beyond included.
NETWORKING: Inbound free. Outbound: $0.10/GB (first 100GB free on Pro).
BUILDS: 500 min/mo free. Beyond: $0.005/min.

RESPONSE FORMAT — return ONLY valid JSON:
{
  "lineItems": [{ "label": "...", "monthlyCost": 0.00, "breakdown": "show the math" }],
  "totalMonthly": 0.00,
  "totalAnnual": 0.00,
  "optimizationTips": [{ "title": "...", "description": "...", "estimatedSaving": "$X–Y/month" }],
  "summary": "One sentence cost assessment"
}
Return ONLY the JSON — no markdown.`;

router.post('/calculate', requireAuth, async (req: AuthRequest, res: Response) => {
  const { services, databases, egressGb, buildMinutes } = req.body;

  if (!Array.isArray(services) || !Array.isArray(databases)) {
    res.status(400).json({ error: 'Missing services or databases arrays.' });
    return;
  }

  const canProceed = await deductCredit(req.userId!);
  if (!canProceed) {
    res.status(402).json({ error: 'No credits remaining. Please purchase more credits.' });
    return;
  }

  try {
    const input = { services, databases, egressGb: egressGb ?? 1, buildMinutes: buildMinutes ?? 60 };
    const userPrompt = `Calculate the estimated monthly Railway.io cost for this infrastructure:\n${JSON.stringify(input, null, 2)}\nReturn ONLY the JSON cost report.`;

    const raw = await callClaude(CALCULATE_SYSTEM, userPrompt);
    const data = parseJson(raw);

    if (!Array.isArray(data.lineItems) || typeof data.totalMonthly !== 'number') {
      throw new Error('Invalid response structure');
    }

    res.json({
      lineItems: data.lineItems,
      totalMonthly: Math.max(0, data.totalMonthly),
      totalAnnual: data.totalAnnual ?? data.totalMonthly * 12,
      optimizationTips: data.optimizationTips ?? [],
      summary: data.summary ?? '',
      calculatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[railway/calculate] error:', err);
    res.status(502).json({ error: 'Failed to calculate costs. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DB MIGRATION ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATE_SYSTEM = `You are an expert database engineer specializing in Railway.io migrations.

Railway CLI commands: railway login, railway link, railway add --plugin postgresql, railway variables, railway run <cmd>

RESPONSE FORMAT — return ONLY valid JSON:
{
  "overview": "2–3 sentence summary",
  "estimatedDowntime": "e.g. '5–15 minutes' or 'Zero downtime possible'",
  "steps": [
    { "stepNumber": 1, "title": "...", "description": "...", "commands": ["railway add --plugin postgresql"], "warnings": [] }
  ],
  "rollbackPlan": "How to roll back if something goes wrong",
  "additionalNotes": ["Extra Railway-specific tips"]
}

RULES: 5–12 steps. Include actual Railway CLI commands. Include pg_dump/export commands. Always update DATABASE_URL step. Include verification step. Return ONLY the JSON.`;

router.post('/migrate', requireAuth, async (req: AuthRequest, res: Response) => {
  const { engine, currentHost, sizeEstimate, notes } = req.body;

  if (!engine || !currentHost) {
    res.status(400).json({ error: 'Missing required fields: engine, currentHost.' });
    return;
  }

  const canProceed = await deductCredit(req.userId!);
  if (!canProceed) {
    res.status(402).json({ error: 'No credits remaining. Please purchase more credits.' });
    return;
  }

  try {
    const userPrompt = `Generate a Railway.io database migration guide for:
- Database engine: ${engine}
- Currently hosted on: ${currentHost}
- Database size: ${sizeEstimate || 'unknown'}
- Special requirements: ${notes?.trim() || 'none'}

Return ONLY the JSON migration guide.`;

    const raw = await callClaude(MIGRATE_SYSTEM, userPrompt, 3000);
    const data = parseJson(raw);

    if (!Array.isArray(data.steps) || typeof data.overview !== 'string') {
      throw new Error('Invalid response structure');
    }

    res.json({
      overview: data.overview,
      estimatedDowntime: data.estimatedDowntime ?? 'Unknown',
      steps: data.steps,
      rollbackPlan: data.rollbackPlan ?? '',
      additionalNotes: data.additionalNotes ?? [],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[railway/migrate] error:', err);
    res.status(502).json({ error: 'Failed to generate migration guide. Please try again.' });
  }
});

export default router;

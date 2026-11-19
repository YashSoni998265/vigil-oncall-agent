import { NextRequest, NextResponse, after } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runTool } from '@/lib/server/tools';
import { runEffects } from '@/lib/server/engine';
import { SANDBOX_ID } from '@/lib/server/store';

// Agora's Conversational AI Engine calls these endpoints when the LLM uses a tool.
// The shared secret and the visitor's sandbox id arrive as headers (template variables).

// The approval check may wait a few seconds for captions; keep the function alive past Vercel's default.
export const maxDuration = 30;

function authorized(request: NextRequest): boolean {
  const secret = process.env.TOOL_SECRET ?? '';
  const given = request.headers.get('x-tool-secret') ?? '';
  if (secret.length < 16 || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

async function handle(request: NextRequest, tool: string, args: Record<string, unknown>) {
  if (!authorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sandbox = request.headers.get('x-sandbox') ?? '';
  if (!SANDBOX_ID.test(sandbox)) return NextResponse.json({ error: 'missing or invalid x-sandbox header' }, { status: 400 });
  const startedAt = Date.now();
  const outcome = await runTool(tool, sandbox, args);
  console.log(`[tool] ${tool} -> ${outcome.status} in ${Date.now() - startedAt}ms`, JSON.stringify(args).slice(0, 300));
  if (outcome.effects.length) after(() => runEffects(outcome.effects));
  return NextResponse.json(outcome.body, { status: outcome.status });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  return handle(request, tool, {});
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  let args: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
  } catch {
    args = {};
  }
  return handle(request, tool, args);
}

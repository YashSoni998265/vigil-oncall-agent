import { NextRequest, NextResponse } from 'next/server';
import { Agent, AresSTT, ExpiresIn, MurfTTS, OpenAI } from 'agora-agents';
import { DEFAULT_AGENT_UID } from '@/lib/agora';
import { SANDBOX_ID, readSandbox } from '@/lib/server/store';
import { buildGreeting, buildInstructions } from '@/lib/server/prompt';
import { buildAgentTools } from '@/lib/server/agent-tools';
import { createAgoraClient } from '@/lib/server/agora';
import { canStartCall, isOwner, markAgentStarted } from '@/lib/server/engine';

// Starts Vigil in the engineer's channel:
// Agora ARES speech recognition (en-IN) → GPT-4.1 mini (Agora-managed) with 13 tools
// → Murf Falcon text-to-speech (voice "Anusha", en-IN). The agent takes instructions from
// the on-call engineer; a paged teammate can join the same channel and hear the call.

const MURF_VOICE_ID = process.env.MURF_VOICE_ID ?? 'Anusha';
const MURF_LOCALE = 'en-IN';
const MURF_WS_URL = 'wss://global.api.murf.ai/v1/speech/stream-input';
const agentUid = String(DEFAULT_AGENT_UID);

// Words ARES should expect in this domain (names, services, actions).
const KEYWORDS = [
  'Vigil', 'Thali', 'rollback', 'roll back', 'feature flag', 'coupon', 'coupon engine', 'payments', 'checkout',
  'PayNova', 'Cashly', 'UPI', 'failover', 'fail over', 'orders database', 'merchant weekly report', 'status page',
  'postmortem', 'Arjun', 'Neha', 'Kabir', 'Sana', 'Priya', 'incident', 'runbook',
];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { sandbox_id?: string; channel_name?: string; requester_id?: string };
    const id = String(body.sandbox_id ?? '');
    const channel = String(body.channel_name ?? '');
    const requester = String(body.requester_id ?? '');
    if (!SANDBOX_ID.test(id) || !channel || !/^\d{4,10}$/.test(requester)) {
      return NextResponse.json({ error: 'sandbox_id, channel_name and requester_id are required' }, { status: 400 });
    }
    const sb = await readSandbox(id);
    if (!sb) return NextResponse.json({ error: 'sandbox not found' }, { status: 404 });
    if (sb.call?.status !== 'active' || !channel.startsWith(`vigil-${id}-`)) {
      return NextResponse.json({ error: 'Answer the call first.' }, { status: 409 });
    }
    const owner = isOwner(request.headers.get('x-owner-key'));
    const gate = await canStartCall(sb, owner);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const murfApiKey = process.env.MURF_API_KEY;
    if (!murfApiKey) return NextResponse.json({ error: 'MURF_API_KEY is not configured' }, { status: 500 });

    // Tools need a public HTTPS URL that Agora's cloud can reach.
    const baseUrl = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') ?? '';
    const toolSecret = process.env.TOOL_SECRET ?? '';
    const toolsEnabled = baseUrl.startsWith('https://') && toolSecret.length >= 16;
    if (!toolsEnabled) {
      // An agent without tools could only talk about fixes, never make them. Refuse clearly.
      console.error('[invite-agent] PUBLIC_BASE_URL (https) and TOOL_SECRET (16+ chars) are required.');
      return NextResponse.json({ error: 'Vigil is not fully configured on this server (tools are unreachable). Please try again later.' }, { status: 503 });
    }

    const greeting = buildGreeting(sb, Date.now());
    const instructions = buildInstructions(sb);

    const agent = new Agent({
      client: createAgoraClient(),
      instructions,
      greeting,
      failureMessage: 'Sorry, I lost that for a second. Could you say it again?',
      maxHistory: 40,
      turnDetection: {
        language: 'en-IN',
        config: {
          speech_threshold: 0.5,
          start_of_speech: { mode: 'vad', vad_config: { interrupt_duration_ms: 220, prefix_padding_ms: 300 } },
          end_of_speech: { mode: 'vad', vad_config: { silence_duration_ms: 560 } },
        },
      },
      // Short spoken fillers while a tool runs, so there is never dead air.
      fillerWords: {
        enable: true,
        trigger: { mode: 'fixed_time', fixed_time_config: { response_wait_ms: 1600 } },
        content: { mode: 'static', static_config: { phrases: ['One moment.', 'Checking now.', 'On it.', 'Looking at that.'], selection_rule: 'shuffle' } },
      },
      advancedFeatures: { enable_rtm: true, enable_tools: toolsEnabled },
      parameters: { data_channel: 'rtm', enable_error_message: true, enable_metrics: true },
    })
      .withStt(new AresSTT({ keywords: KEYWORDS }))
      .withLlm(
        new OpenAI({
          model: (process.env.AGENT_LLM_MODEL as 'gpt-4.1-mini' | 'gpt-4o-mini' | undefined) ?? 'gpt-4.1-mini',
          greetingMessage: greeting,
          failureMessage: 'Sorry, I lost that for a second. Could you say it again?',
          maxHistory: 30,
          templateVariables: toolsEnabled ? { tool_secret: toolSecret, sandbox: id } : undefined,
          tools: toolsEnabled ? buildAgentTools(baseUrl) : undefined,
          params: { max_tokens: 300, temperature: 0.3 },
        }),
      )
      .withTts(
        new MurfTTS({
          key: murfApiKey,
          voiceId: MURF_VOICE_ID,
          locale: MURF_LOCALE,
          model: 'FALCON',
          baseUrl: MURF_WS_URL,
          sampleRate: 24000,
        }),
      )
      .withTools(toolsEnabled);

    // One voice in command: the agent takes instructions from the on-call engineer only
    // (Agora subscribes the agent to one user). A paged teammate joins the same channel,
    // hears everyone, and Vigil briefs them when they arrive.
    const session = agent.createSession({
      channel,
      agentUid,
      remoteUids: [requester],
      idleTimeout: 30,
      expiresIn: ExpiresIn.hours(1),
      debug: false,
    });

    const agentId = await session.start();
    await markAgentStarted(id, { agentId, channel, engineerUid: requester }, owner);
    return NextResponse.json({ agent_id: agentId, create_ts: Math.floor(Date.now() / 1000), state: 'RUNNING' });
  } catch (error) {
    console.error('Error starting Vigil:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to start the call' }, { status: 500 });
  }
}

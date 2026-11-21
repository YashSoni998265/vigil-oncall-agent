import { NextRequest, NextResponse } from 'next/server';
import { Agent, AresSTT, ExpiresIn, MurfTTS, OpenAI, type TurnDetectionLanguage } from 'agora-agents';
import { DEFAULT_AGENT_UID } from '@/lib/agora';
import { SANDBOX_ID, readSandbox } from '@/lib/server/store';
import { buildGreeting, buildInstructions } from '@/lib/server/prompt';
import { bilingualInstructions, buildGreetingHi, hindiModeInstructions } from '@/lib/server/greeting-hi';
import { resumeContext, resumeGreeting } from '@/lib/server/resume';
import { buildAgentTools, buildMcpServer } from '@/lib/server/agent-tools';
import { createAgoraClient } from '@/lib/server/agora';
import { canStartCall, isOwner, markAgentStarted } from '@/lib/server/engine';

// Starting an agent is a few seconds of Agora API calls; never let Vercel's default limit cut it short.
export const maxDuration = 30;

// Starts Vigil in the engineer's channel:
// Agora ARES speech recognition (English and Hindi together) → GPT-4.1 mini (Agora-managed) with 13 tools
// → Murf Falcon 2.1 text-to-speech (voice "Anisha", en-IN). The agent takes instructions from
// the on-call engineer; a paged teammate can join the same channel and hear the call.

// Anisha is the organizers' recommended Indian-English voice; she also speaks Hindi, Hinglish
// and seven more Indian languages on Falcon 2.1.
const MURF_VOICE_ID = process.env.MURF_VOICE_ID ?? 'Anisha';
const MURF_LOCALE = 'en-IN';
const MURF_WS_URL = 'wss://global.api.murf.ai/v1/speech/stream-input';
const agentUid = String(DEFAULT_AGENT_UID);

// Words ARES should expect in this domain (names, services, actions).
const KEYWORDS = [
  'Vigil', 'Thali', 'rollback', 'roll back', 'feature flag', 'coupon', 'coupon engine', 'payments', 'checkout',
  'PayNova', 'Cashly', 'UPI', 'failover', 'fail over', 'orders database', 'merchant weekly report', 'status page',
  'postmortem', 'Arjun', 'Neha', 'Kabir', 'Sana', 'Priya', 'incident', 'runbook',
  // Hinglish an engineer may use under stress. Recognition hears English and Hindi together by default.
  'bhai', 'kya', 'dikkat', 'haan', 'theek hai', 'kar do', 'band kar do', 'nahi', 'mat karo', 'ruko', 'jaldi',
];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { sandbox_id?: string; channel_name?: string; requester_id?: string; reconnect?: boolean; resume?: boolean };
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
    // A voice reconnect (the call screen heard no voice, and the silent agent was just stopped) is
    // the same call with a fresh agent: allowed only in that state, and never counted as a new call.
    const reconnect = body.reconnect === true;
    if (reconnect) {
      if (sb.call.agentId || !(sb.call.voiceRestarts ?? 0) || (sb.call.channel && sb.call.channel !== channel)) {
        return NextResponse.json({ error: 'Nothing to reconnect.' }, { status: 409 });
      }
    } else {
      const gate = await canStartCall(sb, owner);
      if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

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
    // How Agora reaches the same 13 tools: HTTPS tools (default) or MCP (/api/mcp).
    // AGENT_TOOLS=mcp-owner uses MCP only on the owner's own calls, so it can be tried without touching visitors.
    const toolsMode = process.env.AGENT_TOOLS ?? 'rest';
    const viaMcp = toolsMode === 'mcp' || (toolsMode === 'mcp-owner' && owner);

    // One call hears English, Hindi and Hinglish, because Indian engineers mix the two: ARES's Global ASR
    // pipeline takes several languages as one comma-separated string, so English arrives in English letters
    // and Hindi in Devanagari. ASR_LANGUAGE overrides it without a code change (en-IN: English only;
    // hi-IN: Hindi, which also hears English but writes it in Devanagari).
    const asrLanguage = process.env.ASR_LANGUAGE?.trim() || 'en-US,hi-IN';
    // हिंदी (chosen in the console) only changes how Vigil talks: a Hinglish greeting (English when there is
    // no Hinglish one for this moment) and Hinglish-first answers. Otherwise English first, answering in kind.
    const hindi = sb.language === 'hi';
    // A mid-call voice reconnect (Vigil had been heard, then her voice stalled): say she is back instead of
    // greeting from the top, and carry the conversation so far.
    const resume = reconnect && body.resume === true;
    const greeting = resume ? resumeGreeting(sb) : ((hindi ? buildGreetingHi(sb, Date.now()) : null) ?? buildGreeting(sb, Date.now()));
    const languageRule = hindi ? hindiModeInstructions(sb.engineer) : asrLanguage.includes('hi-IN') ? bilingualInstructions(sb.engineer) : '';
    const instructions = [buildInstructions(sb), languageRule, resume ? resumeContext(sb) : ''].filter(Boolean).join('\n\n');

    const agent = new Agent({
      client: createAgoraClient(),
      instructions,
      greeting,
      failureMessage: 'Sorry, I lost that for a second. Could you say it again?',
      maxHistory: 40,
      turnDetection: {
        // ARES speech recognition: English and Hindi together (the SDK's type lists single tags only).
        language: asrLanguage as TurnDetectionLanguage,
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
          templateVariables: toolsEnabled && !viaMcp ? { tool_secret: toolSecret, sandbox: id } : undefined,
          tools: toolsEnabled && !viaMcp ? buildAgentTools(baseUrl) : undefined,
          mcpServers: toolsEnabled && viaMcp ? [buildMcpServer(baseUrl, toolSecret, id)] : undefined,
          params: { max_tokens: 300, temperature: 0.3 },
        }),
      )
      .withTts(
        new MurfTTS({
          key: murfApiKey,
          voiceId: MURF_VOICE_ID,
          locale: MURF_LOCALE,
          // Murf's current streaming model ('FALCON' is an older alias for the same model).
          model: 'falcon-2.1',
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
    await markAgentStarted(id, { agentId, channel, engineerUid: requester, toolsVia: viaMcp ? 'mcp' : 'rest' }, owner, reconnect);
    return NextResponse.json({ agent_id: agentId, create_ts: Math.floor(Date.now() / 1000), state: 'RUNNING' });
  } catch (error) {
    console.error('Error starting Vigil:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to start the call' }, { status: 500 });
  }
}

import 'server-only';
import { AgoraClient, Area, generateConvoAIToken } from 'agora-agents';
import { DEFAULT_AGENT_UID } from '@/lib/agora';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function agoraAppId(): string {
  return requireEnv('NEXT_PUBLIC_AGORA_APP_ID');
}

/** Asia-Pacific region: closest to users in India. */
export function createAgoraClient(): AgoraClient {
  return new AgoraClient({
    area: Area.AP,
    appId: requireEnv('NEXT_PUBLIC_AGORA_APP_ID'),
    appCertificate: requireEnv('NEXT_AGORA_APP_CERTIFICATE'),
  });
}

/**
 * Per-request auth for raw agent APIs (speak, think, history).
 * The SDK adds this automatically only inside an AgentSession; calls made later
 * from other requests (Rahul approving, Rahul joining) must send it themselves,
 * otherwise Agora answers 401 "Invalid authentication type".
 */
function convoAIAuth(channel: string) {
  const token = generateConvoAIToken({
    appId: requireEnv('NEXT_PUBLIC_AGORA_APP_ID'),
    appCertificate: requireEnv('NEXT_AGORA_APP_CERTIFICATE'),
    channelName: channel,
    uid: DEFAULT_AGENT_UID,
  });
  return { headers: { Authorization: `agora token=${token}` } };
}

/**
 * Give the live agent new information mid-call (for example "Rahul approved the refill").
 * The LLM turns it into a natural reply in the parent's language.
 */
export async function agentThink(agentId: string, channel: string, text: string): Promise<void> {
  const client = createAgoraClient();
  await client.agentManagement.agentThink(
    {
      appid: agoraAppId(),
      agentId,
      text,
      on_listening_action: 'inject',
      on_thinking_action: 'append',
      on_speaking_action: 'append',
      interruptable: true,
    },
    convoAIAuth(channel),
  );
}

/** Make the agent say an exact sentence (spoken by Murf like every other reply). */
export async function agentSpeak(agentId: string, channel: string, text: string, interrupt = false): Promise<void> {
  const client = createAgoraClient();
  await client.agents.speak(
    {
      appid: agoraAppId(),
      agentId,
      text,
      priority: interrupt ? 'INTERRUPT' : 'APPEND',
      interruptable: false,
    },
    convoAIAuth(channel),
  );
}

export async function agentHistory(agentId: string, channel: string) {
  const client = createAgoraClient();
  return client.agents.getHistory({ appid: agoraAppId(), agentId }, convoAIAuth(channel));
}

export async function stopAgent(agentId: string): Promise<void> {
  const client = createAgoraClient();
  try {
    await client.stopAgent(agentId);
  } catch (error) {
    // Already stopped (idle timeout or the parent hung up) is fine.
    console.warn('stopAgent:', error instanceof Error ? error.message : error);
  }
}

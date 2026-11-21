import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The voice safety net: when the call screen hears no voice from Vigil, the server stops the silent
// agent and the screen invites a fresh one into the same call. Runs the real engine against the JSON
// file store in a temporary folder: no Redis, no Agora, no network. Effects are returned, never run.

process.env.VIGIL_DATA_DIR = mkdtempSync(path.join(tmpdir(), 'vigil-voice-'));

type Engine = typeof import('../../lib/server/engine');
type Store = typeof import('../../lib/server/store');
const unwrap = <T>(m: T): T => ((m as { default?: T }).default ?? m) as T;

async function liveCall() {
  const engine = unwrap<Engine>(await import('../../lib/server/engine'));
  const store = unwrap<Store>(await import('../../lib/server/store'));
  const sb = await engine.newSandbox('Priya');
  const at = new Date().toISOString();
  await store.mutateSandbox(sb.id, (d) => {
    d.callsUsed = 1;
    d.call = {
      status: 'active',
      kind: 'page',
      attempt: 1,
      ringAt: null,
      retryAt: null,
      agentId: 'agent-silent',
      channel: `vigil-${sb.id}-test`,
      engineerUid: '7729830',
      startedAt: at,
      lastSeenAt: at,
      endedAt: null,
      endReason: null,
      teammatePaged: null,
      teammateJoinedAt: null,
      teammateAnnounced: false,
    };
  });
  return { engine, store, id: sb.id };
}

test('a silent agent is stopped and the swap is logged; at most three swaps a call', async () => {
  const { engine, store, id } = await liveCall();

  let r = await engine.restartVoice(id);
  assert.equal(r.ok, true);
  assert.equal(r.effects.length, 1, 'stops the silent agent');
  let d = await store.readSandbox(id);
  assert.equal(d?.call?.agentId, null);
  assert.equal(d?.call?.voiceRestarts, 1);
  assert.ok(d?.actions.some((a) => a.title === 'Reconnecting Vigil’s voice'));

  // The fresh agent joins: same call, so it is not counted as a new call.
  await engine.markAgentStarted(id, { agentId: 'agent-fresh', channel: `vigil-${id}-test`, engineerUid: '7729830', toolsVia: 'rest' }, false, true);
  d = await store.readSandbox(id);
  assert.equal(d?.call?.agentId, 'agent-fresh');
  assert.equal(d?.callsUsed, 1);
  assert.ok(d?.actions.some((a) => a.title === 'Vigil rejoined the call'));

  r = await engine.restartVoice(id);
  assert.equal(r.ok, true, 'second swap allowed');
  // A stall later in the call (Vigil's voice stopped mid-sentence) gets the same fix: a third swap.
  r = await engine.restartVoice(id);
  assert.equal(r.ok, true, 'third swap allowed');
  r = await engine.restartVoice(id);
  assert.equal(r.ok, false, 'a fourth swap is refused');
  assert.equal(r.effects.length, 0);
});

test('no swap on a call that is not live', async () => {
  const { engine, store, id } = await liveCall();
  await store.mutateSandbox(id, (d) => {
    if (d.call) d.call.status = 'ended';
  });
  const r = await engine.restartVoice(id);
  assert.equal(r.ok, false);
});

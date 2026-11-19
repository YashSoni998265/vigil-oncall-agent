'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC, {
  AgoraRTCProvider,
  RemoteUser,
  useClientEvent,
  useJoin,
  useLocalMicrophoneTrack,
  usePublish,
  useRemoteUsers,
  useRTCClient,
  type IAgoraRTCClient,
} from 'agora-rtc-react';
import type { RTMClient } from 'agora-rtm';
import {
  AgoraVoiceAI,
  AgoraVoiceAIEvents,
  AgentState,
  ChatMessagePriority,
  ChatMessageType,
  TranscriptHelperMode,
  type AgentTranscription,
  type TranscriptHelperItem,
  type UserTranscription,
} from 'agora-agent-client-toolkit';
import { AgentVisualizer } from 'agora-agent-uikit';
import QRCode from 'qrcode';
import { Keyboard, Mic, MicOff, PhoneOff, Send, UserPlus } from 'lucide-react';
import { DEFAULT_AGENT_UID, TEAMMATE_UID } from '@/lib/agora';
import { mapAgentVisualizerState, normalizeTranscript } from '@/lib/conversation';
import { postJSON } from '@/lib/use-sandbox';
import type { Sandbox } from '@/lib/types';
import { LogoMark } from '@/components/brand/Logo';

export interface CallSession {
  appId: string;
  channel: string;
  uid: string;
  token: string;
  agentId: string;
}

interface Props {
  session: CallSession;
  rtmClient: RTMClient;
  sandbox: Sandbox;
  hints: string[];
  maxSeconds: number;
  onEnd: (reason: 'hangup' | 'time_limit') => void;
}

const MONITOR_MARK = '⟦monitor⟧';

export default function CallView(props: Props) {
  const [client] = useState<IAgoraRTCClient>(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  return (
    <AgoraRTCProvider client={client}>
      <CallInner {...props} />
    </AgoraRTCProvider>
  );
}

type Line = { key: string; who: 'agent' | 'engineer' | 'teammate'; text: string; typed?: boolean; pending?: boolean };

function CallInner({ session, rtmClient, sandbox, hints, maxSeconds, onEnd }: Props) {
  const client = useRTCClient();
  const remoteUsers = useRemoteUsers();
  const agentUid = String(DEFAULT_AGENT_UID);

  // StrictMode guard: join and create tracks only once.
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      if (!cancelled) setIsReady(true);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
      setIsReady(false);
    };
  }, []);

  const { isConnected: joined } = useJoin(
    { appid: session.appId, channel: session.channel, token: session.token, uid: parseInt(session.uid, 10) },
    isReady,
  );
  const { localMicrophoneTrack, error: micError } = useLocalMicrophoneTrack(isReady);
  usePublish([localMicrophoneTrack]);

  const [micOn, setMicOn] = useState(true);
  const [connectionState, setConnectionState] = useState('CONNECTING');
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [raw, setRaw] = useState<TranscriptHelperItem<Partial<UserTranscription | AgentTranscription>>[]>([]);
  const [typedLines, setTypedLines] = useState<Line[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const aiRef = useRef<AgoraVoiceAI | null>(null);

  useClientEvent(client, 'connection-state-change', (state) => setConnectionState(state));

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (seconds >= maxSeconds) onEnd('time_limit');
  }, [seconds, maxSeconds, onEnd]);

  // Transcripts and agent state arrive over RTM via the Agora voice AI toolkit.
  useEffect(() => {
    if (!isReady || !joined) return;
    let cancelled = false;
    (async () => {
      try {
        const ai = await AgoraVoiceAI.init({ rtcEngine: client, rtmEngine: rtmClient, renderMode: TranscriptHelperMode.TEXT, enableLog: false });
        if (cancelled) {
          try {
            if (AgoraVoiceAI.getInstance() === ai) {
              ai.unsubscribe();
              ai.destroy();
            }
          } catch {}
          return;
        }
        aiRef.current = ai;
        ai.on(AgoraVoiceAIEvents.TRANSCRIPT_UPDATED, (items) => setRaw([...items]));
        ai.on(AgoraVoiceAIEvents.AGENT_STATE_CHANGED, (_, event) => setAgentState(event.state));
        ai.subscribeMessage(session.channel);
      } catch (error) {
        if (!cancelled) console.error('[AgoraVoiceAI] init failed:', error);
      }
    })();
    return () => {
      cancelled = true;
      aiRef.current = null;
      try {
        const ai = AgoraVoiceAI.getInstance();
        if (ai) {
          ai.unsubscribe();
          ai.destroy();
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, joined]);

  const transcript = useMemo(() => normalizeTranscript(raw, String(client.uid)), [raw, client.uid]);

  // Who said what: the agent, the engineer (this browser) or the paged teammate.
  const spoken: Line[] = useMemo(
    () =>
      transcript
        .filter((item) => typeof item.text === 'string' && item.text.trim() && !String(item.text).includes(MONITOR_MARK))
        .map((item, i) => ({
          key: `${item.turn_id ?? i}-${item.uid}`,
          who: String(item.uid) === agentUid ? 'agent' : Number(item.uid) === TEAMMATE_UID ? 'teammate' : 'engineer',
          text: String(item.text).trim(),
        })),
    [transcript, agentUid],
  );
  const lines: Line[] = useMemo(() => {
    const spokenTexts = new Set(spoken.filter((l) => l.who === 'engineer').map((l) => l.text.toLowerCase()));
    return [...spoken, ...typedLines.filter((t) => !spokenTexts.has(t.text.toLowerCase()))].slice(-10);
  }, [spoken, typedLines]);

  // Share captions with the server (the approval check reads them). A steady tick sends the latest
  // lines within ~0.75 s of any change, one request at a time; a lost or failed request is retried on
  // the next tick, so a spoken "yes" is never dropped by a network blip.
  const captionsJson = useMemo(() => JSON.stringify(spoken.slice(-10).map((l) => ({ who: l.who, text: l.text }))), [spoken]);
  const latestCaptions = useRef('[]');
  const lastSent = useRef('');
  const captionsInFlight = useRef(false);
  useEffect(() => {
    latestCaptions.current = captionsJson;
  }, [captionsJson]);
  useEffect(() => {
    const id = setInterval(() => {
      const json = latestCaptions.current;
      if (captionsInFlight.current || json === lastSent.current || json === '[]') return;
      captionsInFlight.current = true;
      postJSON('/api/sandbox', { id: sandbox.id, action: 'captions', lines: JSON.parse(json) }, 4000)
        .then((r) => {
          if (r.ok) lastSent.current = json;
        })
        .catch(() => {})
        .finally(() => {
          captionsInFlight.current = false;
        });
    }, 750);
    return () => clearInterval(id);
  }, [sandbox.id]);

  // Heartbeat: the server ends the call if this screen goes away.
  useEffect(() => {
    const id = setInterval(() => void postJSON('/api/sandbox', { id: sandbox.id, action: 'heartbeat' }, 8000).catch(() => {}), 10_000);
    return () => clearInterval(id);
  }, [sandbox.id]);

  const sendText = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || sending) return;
      setSending(true);
      setTypedLines((prev) => [...prev, { key: `typed-${Date.now()}`, who: 'engineer', text: clean, typed: true }]);
      setDraft('');
      try {
        await postJSON('/api/sandbox', { id: sandbox.id, action: 'typed', text: clean });
        const ai = aiRef.current ?? AgoraVoiceAI.getInstance();
        await ai?.sendText(agentUid, {
          messageType: ChatMessageType.TEXT,
          priority: ChatMessagePriority.INTERRUPTED,
          responseInterruptable: true,
          text: clean,
        });
      } catch (error) {
        console.error('[typed] send failed', error);
      } finally {
        setSending(false);
      }
    },
    [sending, sandbox.id, agentUid],
  );

  const toggleMic = useCallback(async () => {
    if (!localMicrophoneTrack) return;
    await localMicrophoneTrack.setEnabled(!micOn);
    setMicOn(!micOn);
  }, [localMicrophoneTrack, micOn]);

  const agentPresent = remoteUsers.some((u) => String(u.uid) === agentUid);
  const teammateUser = remoteUsers.find((u) => Number(u.uid) === TEAMMATE_UID);
  const visualizerState = mapAgentVisualizerState(agentState, agentPresent, connectionState);
  const status = !agentPresent ? 'Connecting to Vigil…' : agentState === 'speaking' ? 'Speaking' : agentState === 'thinking' ? 'Thinking' : 'Listening';
  const remaining = maxSeconds - seconds;
  const mm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

  // Teammate paging: show a QR code that opens the join page on any phone.
  const paged = sandbox.call?.teammatePaged ?? null;
  const [qr, setQr] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState('');
  useEffect(() => {
    if (!paged) return;
    const url = `${window.location.origin}/join?s=${sandbox.id}`;
    setJoinUrl(url);
    QRCode.toDataURL(url, { margin: 1, width: 168, color: { dark: '#F5F5F7', light: '#00000000' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [paged, sandbox.id]);

  const end = useRef<HTMLDivElement>(null);
  const lastText = lines[lines.length - 1]?.text;
  useEffect(() => {
    const box = end.current?.parentElement;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
  }, [lines.length, lastText]);

  return (
    <div className="flex h-full flex-col" data-testid="call-view">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5">
        <span className={`relative flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 ring-1 ring-brand/30 ${agentState === 'speaking' ? 'shadow-[0_0_24px_rgb(var(--brand)/0.45)]' : ''}`}>
          <LogoMark size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">Vigil</p>
          <p className="text-[12px] text-dim" data-testid="call-status" data-agent-state={agentState ?? ''}>
            {status} · <span className="tabular">{mm(seconds)}</span>
            {remaining <= 60 && <span className="ml-1 text-warn">· ends in {remaining}s</span>}
          </p>
        </div>
        <div className="h-10 w-16 overflow-hidden opacity-90" aria-hidden>
          <AgentVisualizer state={visualizerState} size="sm" />
        </div>
      </div>

      {micError && (
        <p className="mx-5 mt-3 rounded-xl bg-warn/10 px-3 py-2 text-[12px] text-warn">
          Microphone unavailable. You can still type to Vigil below.
        </p>
      )}

      {/* Teammate */}
      {paged && (
        <div className={`mx-5 mt-3 rounded-2xl border p-3 ${teammateUser ? 'border-good/30 bg-good/[0.07]' : 'border-sky/30 bg-sky/[0.06]'}`} data-testid="teammate-card">
          {teammateUser ? (
            <p className="flex items-center gap-2 text-[13px] font-medium text-good" data-testid="teammate-joined">
              <UserPlus className="h-4 w-4" aria-hidden /> {paged.name} joined the call
            </p>
          ) : (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a generated data-URL QR code */}
              {qr && <img src={qr} alt={`QR code to join the call as ${paged.name}`} className="h-[84px] w-[84px] shrink-0 rounded-lg bg-white/5 p-1" />}
              <div className="min-w-0 text-[12.5px] leading-relaxed">
                <p className="font-semibold text-ink">Paging {paged.name}…</p>
                <p className="text-dim">Scan with any phone, or open the link, to join this call as {paged.name.split(' ')[0]}.</p>
                <a href={joinUrl} target="_blank" rel="noreferrer" className="mt-0.5 block truncate font-mono text-[11px] text-sky hover:underline">
                  {joinUrl.replace(/^https?:\/\//, '')}
                </a>
              </div>
            </div>
          )}
          {teammateUser && (
            <div className="hidden">
              <RemoteUser user={teammateUser} playAudio playVideo={false} />
            </div>
          )}
        </div>
      )}

      {/* Transcript */}
      <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 pb-2 scroll-quiet" aria-live="polite" data-testid="transcript">
        {lines.length === 0 && <p className="pt-6 text-center text-[13px] text-faint">{agentPresent ? 'Vigil is about to speak…' : 'Connecting securely over Agora…'}</p>}
        {lines.map((l) => (
          <div key={l.key} className={`flex ${l.who === 'agent' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                l.who === 'agent' ? 'rounded-tl-md bg-raised text-ink' : l.who === 'teammate' ? 'rounded-tr-md bg-sky/15 text-ink' : 'rounded-tr-md bg-brand/20 text-ink'
              }`}
              data-testid={l.who === 'agent' ? 'agent-line' : 'user-line'}
            >
              {l.who !== 'agent' && (
                <span className="mb-0.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-dim">
                  {l.typed && <Keyboard className="h-3 w-3" aria-hidden />}
                  {l.who === 'teammate' ? paged?.name.split(' ')[0] ?? 'Teammate' : 'You'}
                </span>
              )}
              {l.text}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      {/* Suggested lines (tap to send as text) */}
      <div className="flex gap-1.5 overflow-x-auto px-5 pb-2 scroll-quiet" aria-label="Suggested replies">
        {hints.map((h) => (
          <button
            key={h}
            onClick={() => sendText(h.replace(/^"|"$/g, ''))}
            className="shrink-0 rounded-full border border-line/10 bg-raised/60 px-3 py-1.5 text-[12px] text-dim transition hover:border-brand/40 hover:text-ink"
          >
            {h.replace(/^"|"$/g, '')}
          </button>
        ))}
      </div>

      {/* Type instead of speaking */}
      <form
        className="mx-5 mb-3 flex items-center gap-2 rounded-2xl border border-line/10 bg-canvas/60 p-1.5 pl-3 focus-within:border-brand/50"
        onSubmit={(e) => {
          e.preventDefault();
          void sendText(draft);
        }}
      >
        <Keyboard className="h-4 w-4 shrink-0 text-faint" aria-hidden />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type to Vigil (or just speak)"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-ink placeholder:text-faint focus:outline-none"
          aria-label="Type a reply to Vigil"
          data-testid="type-input"
        />
        <button type="submit" disabled={!draft.trim() || sending} className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white transition disabled:opacity-30" aria-label="Send">
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>

      {/* Controls */}
      <div className="flex items-center gap-3 border-t border-line/10 px-5 py-4">
        <button
          onClick={toggleMic}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${micOn ? 'bg-raised text-ink hover:bg-raised/70' : 'bg-warn text-canvas'}`}
          aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button
          onClick={() => onEnd('hangup')}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-bad text-[15px] font-semibold text-white shadow-lg shadow-bad/20 transition hover:brightness-110"
          data-testid="end-call"
        >
          <PhoneOff className="h-5 w-5" /> End call
        </button>
      </div>

      {/* Vigil's voice */}
      {remoteUsers
        .filter((u) => String(u.uid) === agentUid)
        .map((u) => (
          <div key={String(u.uid)} className="hidden">
            <RemoteUser user={u} playAudio playVideo={false} />
          </div>
        ))}
    </div>
  );
}

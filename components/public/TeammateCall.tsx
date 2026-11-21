'use client';

import { useEffect, useState } from 'react';
import AgoraRTC, { AgoraRTCProvider, RemoteUser, useJoin, useLocalMicrophoneTrack, usePublish, useRemoteUsers, type IAgoraRTCClient } from 'agora-rtc-react';
import { Loader2, Mic, MicOff, PhoneOff, Send } from 'lucide-react';
import type { Join } from './TeammateJoin';

// The teammate's side of the live incident call: everyone's audio out (listen-only until they tap to talk:
// on an iPhone an open microphone moves the sound to the earpiece), Vigil's words as text, and questions for Vigil. Agora's engine listens to one person (the on-call engineer), so a
// teammate, for example a manager without a laptop, asks by tapping or typing here; Vigil answers
// out loud for everyone. Teammates can ask anything, but only the on-call engineer approves changes.

export default function TeammateCall({ join, id, engineer, onLeave }: { join: Join; id: string; engineer: string; onLeave: () => void }) {
  const [client] = useState<IAgoraRTCClient>(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  return (
    <AgoraRTCProvider client={client}>
      <OnCall join={join} id={id} engineer={engineer} onLeave={onLeave} />
    </AgoraRTCProvider>
  );
}

function OnCall({ join, id, engineer, onLeave }: { join: Join; id: string; engineer: string; onLeave: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setReady(false);
    };
  }, []);
  const { isConnected } = useJoin({ appid: join.appId, channel: join.channel, token: join.token, uid: parseInt(join.uid, 10) }, ready);
  // Listen-only until the teammate taps to talk: with no microphone open, an iPhone plays the call on the
  // loudspeaker instead of the earpiece. Vigil hears only the on-call engineer anyway.
  const [talk, setTalk] = useState(false);
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(ready && talk);
  usePublish([localMicrophoneTrack]);
  const remote = useRemoteUsers();
  const [micOn, setMicOn] = useState(false);
  // Browsers (iPhone Safari above all) may block call audio that did not start with a tap: offer one.
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    AgoraRTC.onAutoplayFailed = () => setBlocked(true);
    return () => {
      AgoraRTC.onAutoplayFailed = undefined;
    };
  }, []);
  const playAll = () => {
    for (const u of remote) {
      try {
        u.audioTrack?.play();
      } catch {}
    }
    setBlocked(false);
  };
  const [announced, setAnnounced] = useState(false);
  // Questions unlock once the server has recorded the join (it refuses questions before that).
  const [joinedAck, setJoinedAck] = useState(false);

  useEffect(() => {
    if (isConnected && !announced) {
      setAnnounced(true);
      void fetch('/api/sandbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'teammate_joined' }) })
        .catch(() => {})
        .finally(() => setJoinedAck(true));
    }
  }, [isConnected, announced, id]);

  return (
    <div data-testid="teammate-oncall">
      <p className="mt-5 text-[22px] font-semibold tracking-tight text-ink">{isConnected ? 'You’re on the call' : 'Joining…'}</p>
      <p className="mt-2 text-[14px] text-dim">As {join.name}. Vigil will brief you in a moment.</p>
      <p className="mt-4 text-[12px] text-faint">{remote.length} other{remote.length === 1 ? '' : 's'} on the call</p>
      {blocked ? (
        <button onClick={playAll} className="mt-4 w-full rounded-full bg-brand px-4 py-3 text-[15px] font-semibold text-white" data-testid="tap-to-hear">
          Tap to hear the call
        </button>
      ) : (
        <button onClick={playAll} className="mt-3 text-[12.5px] text-dim underline underline-offset-4" data-testid="cant-hear">
          Can’t hear Vigil? Tap here
        </button>
      )}
      {remote.map((u) => (
        <div key={String(u.uid)} className="hidden">
          <RemoteUser user={u} playAudio playVideo={false} />
        </div>
      ))}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={async () => {
            playAll();
            if (!talk) {
              setTalk(true);
              setMicOn(true);
              return;
            }
            await localMicrophoneTrack?.setEnabled(!micOn);
            setMicOn(!micOn);
          }}
          className={`flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-4 ${micOn ? 'bg-raised text-ink' : 'bg-raised/60 text-dim'}`}
          aria-label={micOn ? 'Mute' : 'Talk'}
          data-testid="teammate-mic"
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          <span className="text-[13px]">{micOn ? 'Mute' : 'Talk'}</span>
        </button>
        <button onClick={onLeave} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-bad font-semibold text-white">
          <PhoneOff className="h-5 w-5" /> Leave
        </button>
      </div>
      <p className="mt-2 text-[12px] text-faint">{micOn ? 'Your microphone is on.' : 'Listening on speaker. Tap Talk to speak.'}</p>
      <CallText id={id} engineer={engineer} />
      <AskVigil id={id} engineer={engineer} enabled={isConnected && joinedAck} />
    </div>
  );
}

// What is being said on the call, as text: the teammate can always read Vigil's answers, even when the
// phone's sound is off. Polls the same live view the console uses.
function CallText({ id, engineer }: { id: string; engineer: string }) {
  const [lines, setLines] = useState<{ at: string; who: string; text: string }[]>([]);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/sandbox?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
        const data = (await res.json()) as { transcript?: { at: string; who: string; text: string }[] };
        if (!stop && Array.isArray(data.transcript)) setLines(data.transcript.slice(-5));
      } catch {}
    };
    void load();
    const t = setInterval(() => void load(), 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id]);
  if (lines.length === 0) return null;
  return (
    <section className="mt-6 border-t border-line/10 pt-5 text-left" data-testid="call-text" aria-live="polite" aria-label="What is being said on the call">
      <p className="text-[14px] font-semibold text-ink">On the call</p>
      <ul className="mt-2 space-y-2">
        {lines.map((l) => (
          <li key={`${l.at}-${l.who}`} className="text-[13px] leading-snug">
            <span className={`font-semibold ${l.who === 'agent' ? 'text-brand' : 'text-dim'}`}>{l.who === 'agent' ? 'Vigil' : l.who === 'teammate' ? 'You' : engineer}</span>
            <span className="text-ink"> · {l.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Questions a manager or senior teammate asks most on an incident call.
const QUESTIONS = ['What’s the customer impact so far?', 'When will it be fixed?', 'What’s the risk of this fix?', 'Should we tell customers now?', 'Why did this happen?'];

function AskVigil({ id, engineer, enabled }: { id: string; engineer: string; enabled: boolean }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState<{ key: number; text: string }[]>([]);

  const ask = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending || !enabled) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'teammate_ask', text: clean }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Vigil could not take the question. Try again.');
        return;
      }
      setAsked((prev) => [...prev, { key: Date.now(), text: clean }].slice(-3));
      setDraft('');
    } catch {
      setError('Could not reach Vigil. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mt-6 border-t border-line/10 pt-5 text-left" data-testid="ask-vigil" aria-labelledby="ask-vigil-title">
      <p id="ask-vigil-title" className="text-[14px] font-semibold text-ink">
        Ask Vigil
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-dim">Vigil answers out loud for everyone on the call. Only {engineer} can approve changes.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void ask(q)}
            disabled={!enabled || sending}
            className="rounded-full border border-line/15 bg-raised/60 px-3 py-1.5 text-[12.5px] text-ink transition hover:border-brand/50 disabled:opacity-40"
            data-testid="ask-chip"
          >
            {q}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={300}
          enterKeyHint="send"
          placeholder="Type, or use your keyboard’s mic"
          aria-label="Your question for Vigil"
          disabled={!enabled}
          className="min-w-0 flex-1 rounded-xl border border-line/15 bg-canvas px-3 py-2.5 text-[14px] text-ink placeholder:text-faint focus:border-brand/60 focus:outline-none disabled:opacity-50"
          data-testid="ask-input"
        />
        <button
          type="submit"
          disabled={!enabled || sending || !draft.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:brightness-110 disabled:opacity-40"
          aria-label="Ask Vigil"
          data-testid="ask-send"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-[12.5px] text-bad" role="alert">
          {error}
        </p>
      )}
      {!enabled && !error && <p className="mt-2 text-[12px] text-faint">Questions open once you’re connected.</p>}
      {asked.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="Questions you asked">
          {asked.map((a) => (
            <li key={a.key} className="text-[12.5px] leading-snug text-dim">
              <span className="font-medium text-good">Sent</span> · {a.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

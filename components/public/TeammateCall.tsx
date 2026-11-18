'use client';

import { useEffect, useState } from 'react';
import AgoraRTC, { AgoraRTCProvider, RemoteUser, useJoin, useLocalMicrophoneTrack, usePublish, useRemoteUsers, type IAgoraRTCClient } from 'agora-rtc-react';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import type { Join } from './TeammateJoin';

// The teammate's side of the live incident call: microphone in, everyone else's audio out.

export default function TeammateCall({ join, id, onLeave }: { join: Join; id: string; onLeave: () => void }) {
  const [client] = useState<IAgoraRTCClient>(() => AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }));
  return (
    <AgoraRTCProvider client={client}>
      <OnCall join={join} id={id} onLeave={onLeave} />
    </AgoraRTCProvider>
  );
}

function OnCall({ join, id, onLeave }: { join: Join; id: string; onLeave: () => void }) {
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
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(ready);
  usePublish([localMicrophoneTrack]);
  const remote = useRemoteUsers();
  const [micOn, setMicOn] = useState(true);
  const [announced, setAnnounced] = useState(false);

  useEffect(() => {
    if (isConnected && !announced) {
      setAnnounced(true);
      void fetch('/api/sandbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'teammate_joined' }) });
    }
  }, [isConnected, announced, id]);

  return (
    <div data-testid="teammate-oncall">
      <p className="mt-5 text-[22px] font-semibold tracking-tight text-ink">{isConnected ? 'You’re on the call' : 'Joining…'}</p>
      <p className="mt-2 text-[14px] text-dim">As {join.name}. Vigil will brief you in a moment.</p>
      <p className="mt-4 text-[12px] text-faint">{remote.length} other{remote.length === 1 ? '' : 's'} on the call</p>
      {remote.map((u) => (
        <div key={String(u.uid)} className="hidden">
          <RemoteUser user={u} playAudio playVideo={false} />
        </div>
      ))}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={async () => {
            await localMicrophoneTrack?.setEnabled(!micOn);
            setMicOn(!micOn);
          }}
          className={`flex h-12 w-12 items-center justify-center rounded-full ${micOn ? 'bg-raised text-ink' : 'bg-warn text-canvas'}`}
          aria-label={micOn ? 'Mute' : 'Unmute'}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>
        <button onClick={onLeave} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-bad font-semibold text-white">
          <PhoneOff className="h-5 w-5" /> Leave
        </button>
      </div>
    </div>
  );
}

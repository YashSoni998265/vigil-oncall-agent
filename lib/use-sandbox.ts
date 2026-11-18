'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SandboxView } from './types';

const STORAGE_KEY = 'vigil.sandbox';
const OWNER_STORAGE_KEY = 'vigil.owner';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export function ownerHeaders(): Record<string, string> {
  const key = safeGet(OWNER_STORAGE_KEY);
  return key ? { 'x-owner-key': key } : {};
}

export async function postJSON<T = Record<string, unknown>>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...ownerHeaders() },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/** The visitor's sandbox id: from ?s= (shared links), then localStorage, else a new one. */
export function useSandboxId(): { id: string | null; error: string | null; fresh: () => Promise<void> } {
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async () => {
    setError(null);
    const r = await postJSON<{ id?: string; error?: string }>('/api/sandbox', { action: 'create' });
    if (r.ok && r.data.id) {
      safeSet(STORAGE_KEY, r.data.id);
      setId(r.data.id);
    } else {
      setError(r.data.error ?? 'Could not create your sandbox.');
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const owner = url.searchParams.get('owner');
    if (owner) {
      safeSet(OWNER_STORAGE_KEY, owner);
      url.searchParams.delete('owner');
      window.history.replaceState(null, '', url.toString());
    }
    const fromUrl = url.searchParams.get('s');
    const candidate = fromUrl && /^[a-z0-9]{10}$/.test(fromUrl) ? fromUrl : safeGet(STORAGE_KEY);
    (async () => {
      if (candidate) {
        const res = await fetch(`/api/sandbox?id=${candidate}`, { cache: 'no-store' }).catch(() => null);
        if (res?.ok) {
          safeSet(STORAGE_KEY, candidate);
          setId(candidate);
          return;
        }
      }
      await create();
    })();
  }, [create]);

  return { id, error, fresh: create };
}

/** Live sandbox state. Fast while an incident or call is live, slow when idle, paused when hidden. */
export function useSandbox(id: string | null) {
  const [view, setView] = useState<SandboxView | null>(null);
  const [offline, setOffline] = useState(false);
  const offset = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const viewRef = useRef<SandboxView | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/sandbox?id=${id}`, { cache: 'no-store', headers: ownerHeaders() });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as SandboxView;
      offset.current = data.now - Date.now();
      viewRef.current = data;
      if (alive.current) {
        setView(data);
        setOffline(false);
      }
    } catch {
      if (alive.current) setOffline(true);
    }
  }, [id]);

  useEffect(() => {
    alive.current = true;
    if (!id) return;
    const schedule = () => {
      const v = viewRef.current;
      const hot =
        Boolean(v?.sandbox.call && ['investigating', 'ringing', 'active', 'missed'].includes(v.sandbox.call.status)) ||
        Boolean(v?.sandbox.incident && v.sandbox.incident.status !== 'resolved');
      const delay = hot ? 1000 : 4000;
      timer.current = setTimeout(async () => {
        if (document.visibilityState === 'visible') await load();
        if (alive.current) schedule();
      }, delay);
    };
    load().then(schedule);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, load]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return { view, offline, refresh: load, serverNow };
}

/** A ticking clock (ms, server-aligned) for live charts and counters. */
export function useNow(serverNow: () => number, intervalMs = 1000): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [serverNow, intervalMs]);
  return now;
}

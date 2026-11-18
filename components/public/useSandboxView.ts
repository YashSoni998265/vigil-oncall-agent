'use client';

import { useEffect, useState } from 'react';
import type { SandboxView } from '@/lib/types';

/** Read-only view of a sandbox for public pages (status page, postmortem, join). */
export function useSandboxView(id: string, intervalMs = 5000) {
  const [view, setView] = useState<SandboxView | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!/^[a-z0-9]{10}$/.test(id)) {
      setMissing(true);
      return;
    }
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== 'visible' && view) return;
      const res = await fetch(`/api/sandbox?id=${id}`, { cache: 'no-store' }).catch(() => null);
      if (!alive) return;
      if (res?.status === 404 || res?.status === 400) setMissing(true);
      else if (res?.ok) setView((await res.json()) as SandboxView);
    };
    void load();
    const t = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, intervalMs]);
  return { view, missing };
}

import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Sandbox } from '@/lib/types';

// Storage for visitor sandboxes.
// - Local development: JSON files in .data/sandboxes (git-ignored).
// - Deployed (Vercel): Upstash Redis over REST. Accepts the names Upstash itself uses
//   (UPSTASH_REDIS_REST_URL/TOKEN) and the ones the Vercel integration injects (KV_REST_API_URL/TOKEN).
// Writes are serialized per sandbox: in-process queue + a short Redis lock across instances.

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const useRedis = Boolean(redisUrl && redisToken);
const DATA_DIR = process.env.VIGIL_DATA_DIR ?? path.join(process.cwd(), '.data');
const SANDBOX_TTL_SECONDS = 60 * 60 * 24;

if (process.env.VERCEL && !useRedis) {
  // Serverless instances don't share a disk: without Redis, visitors would see their data jump around.
  console.error('[store] Running on Vercel without Upstash Redis. Set UPSTASH_REDIS_REST_URL/TOKEN (or connect Upstash in Vercel Storage).');
}

export const SANDBOX_ID = /^[a-z0-9]{10}$/;

async function redis<T = unknown>(command: (string | number)[]): Promise<T> {
  const res = await fetch(redisUrl!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Redis ${command[0]} failed: ${res.status}`);
  const json = (await res.json()) as { result: T; error?: string };
  if (json.error) throw new Error(`Redis ${command[0]}: ${json.error}`);
  return json.result;
}

function fileFor(id: string): string {
  return path.join(DATA_DIR, 'sandboxes', `${id}.json`);
}

export async function readSandbox(id: string): Promise<Sandbox | null> {
  if (!SANDBOX_ID.test(id)) return null;
  try {
    const raw = useRedis ? await redis<string | null>(['GET', `vigil:sb:${id}`]) : await fs.readFile(fileFor(id), 'utf8');
    return raw ? (JSON.parse(raw) as Sandbox) : null;
  } catch {
    return null;
  }
}

async function writeSandbox(sb: Sandbox): Promise<void> {
  const value = JSON.stringify(sb);
  if (useRedis) {
    await redis(['SET', `vigil:sb:${sb.id}`, value, 'EX', SANDBOX_TTL_SECONDS]);
    return;
  }
  await fs.mkdir(path.dirname(fileFor(sb.id)), { recursive: true });
  const tmp = `${fileFor(sb.id)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, value, 'utf8');
  await fs.rename(tmp, fileFor(sb.id));
}

export async function createSandboxRecord(sb: Sandbox): Promise<void> {
  await writeSandbox(sb);
}

async function withRedisLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  if (!useRedis) return fn();
  const key = `vigil:lock:${id}`;
  const token = Math.random().toString(36).slice(2);
  for (let i = 0; i < 40; i++) {
    const got = await redis<string | null>(['SET', key, token, 'NX', 'PX', 5000]);
    if (got === 'OK') {
      try {
        return await fn();
      } finally {
        await redis(['EVAL', "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, key, token]).catch(() => {});
      }
    }
    await new Promise((r) => setTimeout(r, 60 + Math.random() * 60));
  }
  throw new Error('Sandbox is busy, try again.');
}

const queues = new Map<string, Promise<unknown>>();

/** Read-modify-write one sandbox, serialized so concurrent tool calls never overwrite each other. */
export function mutateSandbox<T>(id: string, fn: (sb: Sandbox) => T | Promise<T>): Promise<T> {
  const previous = queues.get(id) ?? Promise.resolve();
  const run = previous.then(() =>
    withRedisLock(id, async () => {
      const sb = await readSandbox(id);
      if (!sb) throw new Error('Sandbox not found');
      const result = await fn(sb);
      sb.version += 1;
      sb.updatedAt = new Date().toISOString();
      sb.actions = sb.actions.slice(-120);
      sb.channel = sb.channel.slice(-80);
      sb.transcript = sb.transcript.slice(-160);
      await writeSandbox(sb);
      return result;
    }),
  );
  queues.set(
    id,
    run.catch(() => undefined),
  );
  return run;
}

// --- Daily call counter (protects Agora minutes and Murf credits on a public link) ---

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function readDailyCalls(): Promise<number> {
  if (useRedis) return Number((await redis<string | null>(['GET', `vigil:calls:${today()}`])) ?? 0);
  try {
    const raw = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'counters.json'), 'utf8')) as Record<string, number>;
    return raw[today()] ?? 0;
  } catch {
    return 0;
  }
}

export async function incrementDailyCalls(): Promise<number> {
  if (useRedis) {
    const key = `vigil:calls:${today()}`;
    const n = await redis<number>(['INCR', key]);
    if (n === 1) await redis(['EXPIRE', key, 60 * 60 * 48]).catch(() => {});
    return n;
  }
  const file = path.join(DATA_DIR, 'counters.json');
  let raw: Record<string, number> = {};
  try {
    raw = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  raw[today()] = (raw[today()] ?? 0) + 1;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(raw), 'utf8');
  return raw[today()];
}

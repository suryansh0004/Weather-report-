/**
 * Module 3 — Low-bandwidth / offline-first edge repository.
 *
 * The repository is the only thing the UI talks to. It decides whether a read
 * is served from the edge cache or from the network, performs delta
 * synchronisation on reconnect, and records transfer statistics so the demo can
 * show what a 2G user actually pays for.
 *
 * Storage driver note: on a real device the driver is SQLite (Flutter: Hive /
 * sqflite; React Native: expo-sqlite) so the last-known bulletin survives a
 * cold start. This preview runs inside a sandboxed iframe where localStorage,
 * IndexedDB and cookies are all blocked, so the in-memory driver is used
 * instead. The interface is identical — swap `driver` and nothing else changes.
 */
import type { DistrictOption, HomePayload, Nowcast, SyncReport } from './types';

const RAW_BASE = '__PORT_8000__';
export const API: string = RAW_BASE.startsWith('__') ? 'http://localhost:8000' : RAW_BASE;
const V1 = `${API}/api/v1`;

/* ── storage driver ───────────────────────────────────────────────────── */

export interface CacheRecord {
  key: string;
  payload: HomePayload;
  etags: Record<string, string>;
  fetchedAt: number;
  gzipBytes: number;
}

export interface EdgeDriver {
  name: string;
  read(key: string): CacheRecord | undefined;
  write(rec: CacheRecord): void;
  keys(): string[];
  clear(): void;
}

const memoryDriver = (): EdgeDriver => {
  const table = new Map<string, CacheRecord>();
  return {
    name: 'in-memory (sandbox) · SQLite/Hive on device',
    read: (k) => table.get(k),
    write: (r) => void table.set(r.key, r),
    keys: () => [...table.keys()],
    clear: () => table.clear(),
  };
};

export const driver: EdgeDriver = memoryDriver();

/* ── transfer log (visible in the Sync screen) ─────────────────────────── */

export interface TransferEntry {
  at: number;
  kind: 'full' | 'delta' | 'cache' | 'nowcast';
  bytes: number;
  ms: number;
  note: string;
}

export const transferLog: TransferEntry[] = [];
const logTransfer = (e: TransferEntry) => {
  transferLog.unshift(e);
  if (transferLog.length > 25) transferLog.pop();
};

/* ── network profile simulation ────────────────────────────────────────── */

export type NetProfile = '4g' | '2g' | 'offline';
/** Effective downlink used to simulate an edge link, in bytes/second. */
const THROUGHPUT: Record<NetProfile, number> = { '4g': 2_000_000, '2g': 14_000, offline: 0 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttle(profile: NetProfile, bytes: number) {
  if (profile === '4g') return;
  const seconds = bytes / THROUGHPUT[profile];
  await sleep(Math.min(4000, seconds * 1000));
}

/* ── request helpers ──────────────────────────────────────────────────── */

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<{ data: T; ms: number }> {
  const t0 = performance.now();
  const res = await fetch(`${V1}${path}`, { signal, headers: { 'Accept-Encoding': 'gzip' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = (await res.json()) as T;
  return { data, ms: Math.round(performance.now() - t0) };
}

export interface HomeQuery {
  lat: number;
  lon: number;
  persona: string;
  lang: string;
}

const keyOf = (q: HomeQuery) => `${q.lat.toFixed(3)},${q.lon.toFixed(3)}|${q.persona}|${q.lang}`;

export interface HomeResult {
  payload: HomePayload;
  source: 'network-full' | 'network-delta' | 'cache';
  stale: boolean;
  fetchedAt: number;
  ageMinutes: number;
  bytes: number;
  ms: number;
  sync?: SyncReport;
}

/**
 * Reads the homepage bulletin.
 *  - offline            → last-known cached record (stale)
 *  - cached + online    → delta sync, only changed blocks cross the wire
 *  - cold + online      → one gzipped full fetch
 */
export async function readHomepage(q: HomeQuery, profile: NetProfile): Promise<HomeResult> {
  const key = keyOf(q);
  const cached = driver.read(key);
  const now = Date.now();

  if (profile === 'offline') {
    if (!cached) throw new Error('offline-no-cache');
    logTransfer({ at: now, kind: 'cache', bytes: 0, ms: 0, note: 'Offline read from edge cache' });
    return {
      payload: cached.payload,
      source: 'cache',
      stale: true,
      fetchedAt: cached.fetchedAt,
      ageMinutes: Math.round((now - cached.fetchedAt) / 60000),
      bytes: 0,
      ms: 0,
    };
  }

  if (cached) {
    const t0 = performance.now();
    const res = await fetch(`${V1}/system/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...q, blocks: cached.etags }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const sync = (await res.json()) as SyncReport & { delta: Partial<HomePayload> };
    const bytes = sync.transfer.delta_gzip_bytes;
    await throttle(profile, bytes);
    const ms = Math.round(performance.now() - t0);

    const merged: HomePayload = {
      ...cached.payload,
      ...(sync.delta as Partial<HomePayload>),
      issued_at: sync.server_time,
    };
    const rec: CacheRecord = { key, payload: merged, etags: sync.etags, fetchedAt: Date.now(), gzipBytes: bytes };
    driver.write(rec);
    logTransfer({
      at: rec.fetchedAt,
      kind: 'delta',
      bytes,
      ms,
      note: `${sync.changed_blocks.length} block(s) changed, ${sync.unchanged.length} reused · ${sync.transfer.saving_pct}% saved`,
    });
    return {
      payload: merged,
      source: 'network-delta',
      stale: false,
      fetchedAt: rec.fetchedAt,
      ageMinutes: 0,
      bytes,
      ms,
      sync,
    };
  }

  const t0 = performance.now();
  const { data } = await getJSON<HomePayload>(
    `/weather/homepage?lat=${q.lat}&lon=${q.lon}&persona=${q.persona}&lang=${q.lang}`,
  );
  const bytes = await gzipEstimate(q);
  await throttle(profile, bytes);
  const ms = Math.round(performance.now() - t0);
  const etags = await fetchEtags(q);
  const rec: CacheRecord = { key, payload: data, etags, fetchedAt: Date.now(), gzipBytes: bytes };
  driver.write(rec);
  logTransfer({ at: rec.fetchedAt, kind: 'full', bytes, ms, note: 'Cold start — full gzipped payload' });
  return { payload: data, source: 'network-full', stale: false, fetchedAt: rec.fetchedAt, ageMinutes: 0, bytes, ms };
}

/** The server reports the true gzipped size of the payload it just built. */
async function gzipEstimate(q: HomeQuery): Promise<number> {
  try {
    const { data } = await getJSON<{ total_gzip_bytes: number }>(
      `/system/payload-report?lat=${q.lat}&lon=${q.lon}&persona=${q.persona}&lang=${q.lang}`,
    );
    return data.total_gzip_bytes;
  } catch {
    return 5000;
  }
}

async function fetchEtags(q: HomeQuery): Promise<Record<string, string>> {
  const res = await fetch(`${V1}/system/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...q, blocks: {} }),
  });
  const data = (await res.json()) as SyncReport;
  return data.etags;
}

export async function fetchNowcast(lat: number, lon: number, profile: NetProfile): Promise<Nowcast> {
  const { data, ms } = await getJSON<{ nowcast: Nowcast }>(`/weather/nowcast?lat=${lat}&lon=${lon}`);
  await throttle(profile, 1200);
  logTransfer({ at: Date.now(), kind: 'nowcast', bytes: 1200, ms, note: 'Radar nowcast refresh (60 s TTL)' });
  return data.nowcast;
}

export async function fetchDistricts(): Promise<DistrictOption[]> {
  const { data } = await getJSON<{ districts: DistrictOption[] }>('/system/districts');
  return data.districts;
}

export async function fetchAgromet(district: string) {
  const { data } = await getJSON<any>(`/advisories/agromet?district=${encodeURIComponent(district)}`);
  return data;
}

export async function fetchPayloadReport(q: HomeQuery) {
  const { data } = await getJSON<any>(
    `/system/payload-report?lat=${q.lat}&lon=${q.lon}&persona=${q.persona}&lang=${q.lang}`,
  );
  return data;
}

export async function fetchHealth() {
  const { data } = await getJSON<any>('/system/health');
  return data;
}

export async function fetchEmergencyFeed() {
  const { data } = await getJSON<any>('/alerts/emergency');
  return data;
}

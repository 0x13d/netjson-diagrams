// Loader for the official PlantUML TeaVM runtime, vendored under
// /plantuml-runtime/ — see that directory's README.md for the provenance pin.
//
// Three loaders live here:
//   1. fetch + ReadableStream with byte-level progress reporting.
//   2. Parallel download of all three files (their network fetches don't
//      depend on each other; only the *execution* order matters).
//   3. IndexedDB cache keyed by the pinned upstream version, so the 28 MB
//      one-time cost lasts exactly that — one time per browser profile per
//      pin bump.
//
// API surface: `loadPlantuml(onProgress?)` returns the TeaVM `render`
// function from plantuml.js. `clearCache()` evicts the IDB store (useful
// when bumping the pin manually). `progressSummary(progress)` returns the
// aggregate { totalReceived, totalSize, percent }.

type PlantumlRender = (lines: string[], targetElementId: string, opts?: object) => void;

// Bump this in lockstep with apps/web/public/plantuml-runtime/README.md.
// On mismatch with the IDB-stored version, the cache is evicted before any
// fetch (so a pin bump doesn't get its first user trapped on a stale blob).
const PINNED_VERSION = '1.2026.4';

interface FileSpec {
  /** Human-facing name shown in the loading overlay. */
  name: string;
  /** Filename under `apps/web/public/plantuml-runtime/`. Resolved against
   *  the current document so the URL works for any deploy base (root in dev,
   *  `/netjson/` on the production Netlify mount, etc.). */
  filename: string;
  /** Approximate size in bytes — used for progress when Content-Length is
   *  missing (some dev servers don't set it). */
  approxBytes: number;
}

const FILES: FileSpec[] = [
  { name: 'viz-global.js', filename: 'viz-global.js', approxBytes: 1_445_427 },
  { name: 'tupadr3.min.js', filename: 'tupadr3.min.js', approxBytes: 20_227_530 },
  { name: 'c4.min.js', filename: 'c4.min.js', approxBytes: 170_863 },
  { name: 'plantuml.js', filename: 'plantuml.js', approxBytes: 7_402_464 },
];

/**
 * Resolve a runtime asset against the document's effective base URL.
 *
 * The web app is built with `vite build --base=./` so all asset references
 * are relative to the document. The runtime loader can't use absolute paths
 * (a `/plantuml-runtime/…` URL works in dev where the app is at the site
 * root, but 404s in production where the app is mounted at `/netjson/`).
 *
 * `import.meta.env.BASE_URL` is Vite's configured base (`./` for this
 * build) — concatenating it with the document base URL gives us an
 * absolute URL that `fetch()` can use anywhere.
 */
function runtimeUrl(filename: string): string {
  const base = import.meta.env.BASE_URL || './';
  return new URL(`${base}plantuml-runtime/${filename}`, document.baseURI).href;
}

export type FileSource = 'pending' | 'cache' | 'fetching' | 'done' | 'error';

export interface FileProgress {
  name: string;
  size: number;
  received: number;
  source: FileSource;
}

export interface LoadProgress {
  files: FileProgress[];
  totalSize: number;
  totalReceived: number;
  /** True once all files have been transferred (cache or network); the
   *  brief execute phase that follows is fast and intentionally not
   *  surfaced as another progress event. */
  transferComplete: boolean;
}

export function progressSummary(p: LoadProgress) {
  const percent = p.totalSize > 0 ? Math.min(100, (p.totalReceived / p.totalSize) * 100) : 0;
  return { percent, totalReceived: p.totalReceived, totalSize: p.totalSize };
}

let cached: Promise<PlantumlRender> | null = null;

export function loadPlantuml(onProgress?: (p: LoadProgress) => void): Promise<PlantumlRender> {
  if (cached) return cached;

  cached = (async () => {
    const progress: LoadProgress = {
      files: FILES.map((f) => ({
        name: f.name,
        size: f.approxBytes,
        received: 0,
        source: 'pending',
      })),
      totalSize: FILES.reduce((acc, f) => acc + f.approxBytes, 0),
      totalReceived: 0,
      transferComplete: false,
    };
    const emit = () => onProgress?.({ ...progress, files: progress.files.map((f) => ({ ...f })) });
    emit();

    await evictMismatchedCache();

    // Kick off all three downloads in parallel. They're independent fetches
    // — execution order is enforced afterwards.
    const blobs = await Promise.all(
      FILES.map((spec, idx) =>
        fetchOrCached(spec, (received, size, source) => {
          const file = progress.files[idx];
          // First report from a file gives us the true size if the server
          // sent Content-Length. Adjust the aggregate accordingly.
          if (size !== file.size) {
            progress.totalSize += size - file.size;
            file.size = size;
          }
          progress.totalReceived += received - file.received;
          file.received = received;
          file.source = source;
          emit();
        }),
      ),
    );

    progress.transferComplete = true;
    emit();

    // Now execute. Order matters: viz first (sets globals), then the stdlib
    // packages — tupadr3 (populates window.PLANTUML_STDLIB.tupadr3, sprite
    // icons) and c4 (populates window.PLANTUML_STDLIB.C4, the C4-PlantUML
    // macros that NetworkGraph diagrams `!include <C4/C4_Container>`) — then
    // plantuml last.
    const vizUrl = URL.createObjectURL(blobs[0]);
    const tupadr3Url = URL.createObjectURL(blobs[1]);
    const c4Url = URL.createObjectURL(blobs[2]);
    const plantumlUrl = URL.createObjectURL(blobs[3]);

    try {
      await injectScript(vizUrl);
      await injectScript(tupadr3Url);
      await injectScript(c4Url);

      // PlantUML's TeaVM core looks up window.__pl_script_state['<name>.min.js']
      // before lazy-fetching a stdlib catalog from the document root. We
      // already shipped these, so mark them loaded under their expected keys
      // to suppress the redundant shadow fetch.
      markPreloaded('tupadr3.min.js');
      markPreloaded('c4.min.js');

      const mod = (await import(/* @vite-ignore */ plantumlUrl)) as { render: PlantumlRender };
      if (typeof mod.render !== 'function') {
        throw new Error('PlantUML runtime loaded but `render` export missing');
      }
      return mod.render;
    } finally {
      // Object URLs leak the underlying blob until revoked. Scripts have
      // already been parsed at this point so the URLs aren't needed anymore.
      URL.revokeObjectURL(vizUrl);
      URL.revokeObjectURL(tupadr3Url);
      URL.revokeObjectURL(c4Url);
      URL.revokeObjectURL(plantumlUrl);
    }
  })().catch((e) => {
    cached = null;
    throw e;
  });

  return cached;
}

// ── network + cache ─────────────────────────────────────────────────────────

type ProgressCallback = (received: number, size: number, source: FileSource) => void;

async function fetchOrCached(spec: FileSpec, onProgress: ProgressCallback): Promise<Blob> {
  // Cache key is the bare filename — independent of the deploy base, so a
  // user who hits the site at /netjson/ doesn't have to re-download after
  // visiting (hypothetically) /preview/netjson/ or a different mount path.
  const cachedBlob = await idbGet(spec.filename);
  if (cachedBlob) {
    onProgress(cachedBlob.size, cachedBlob.size, 'cache');
    return cachedBlob;
  }
  return fetchWithProgress(spec, onProgress);
}

async function fetchWithProgress(spec: FileSpec, onProgress: ProgressCallback): Promise<Blob> {
  const url = runtimeUrl(spec.filename);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${spec.name}`);
  const lengthHeader = res.headers.get('Content-Length');
  const size = lengthHeader ? Number(lengthHeader) : spec.approxBytes;
  onProgress(0, size, 'fetching');

  if (!res.body) {
    // No streaming — just take the whole blob in one go.
    const blob = await res.blob();
    onProgress(blob.size, blob.size, 'done');
    void idbSet(spec.filename, blob);
    return blob;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress(received, Math.max(size, received), 'fetching');
    }
  }

  // Uint8Array['buffer'] is typed as ArrayBufferLike (might be SharedArrayBuffer);
  // fetch streams always give us regular ArrayBuffers, but TS can't prove that.
  const blob = new Blob(chunks as BlobPart[], { type: 'application/javascript' });
  onProgress(blob.size, blob.size, 'done');
  void idbSet(spec.filename, blob);
  return blob;
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.addEventListener('load', () => resolve(), { once: true });
    s.addEventListener('error', () => reject(new Error(`Script failed: ${src}`)), { once: true });
    document.head.appendChild(s);
  });
}

function markPreloaded(scriptKey: string): void {
  type ScriptState = {
    [k: string]: { state: 'loaded' | 'loading' | 'error'; ok: Array<() => void>; err: Array<(e: string) => void> };
  };
  const w = window as unknown as { __pl_script_state?: ScriptState };
  w.__pl_script_state = w.__pl_script_state || {};
  w.__pl_script_state[scriptKey] = { state: 'loaded', ok: [], err: [] };
}

// ── IndexedDB cache ─────────────────────────────────────────────────────────
//
// One database, one object store keyed by URL. Each record carries the
// pinned upstream version it was fetched against; on mismatch we evict
// before fetching so the next user doesn't inherit stale blobs from a
// previous pin.

const DB_NAME = 'netjson-diagrams-runtime';
const STORE = 'files';
const DB_VERSION = 1;

interface CacheRecord {
  url: string;
  version: string;
  blob: Blob;
  storedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null); // Fail-soft: cache is an optimisation, not a correctness boundary.
  });
  return dbPromise;
}

async function idbGet(url: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(url);
    req.onsuccess = () => {
      const rec = req.result as CacheRecord | undefined;
      if (!rec) return resolve(null);
      if (rec.version !== PINNED_VERSION) return resolve(null);
      resolve(rec.blob);
    };
    req.onerror = () => resolve(null);
  });
}

async function idbSet(url: string, blob: Blob): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    const rec: CacheRecord = { url, version: PINNED_VERSION, blob, storedAt: Date.now() };
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve(); // Fail-soft on quota / disk-full / etc.
  });
}

async function evictMismatchedCache(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const rec = cursor.value as CacheRecord;
      if (rec.version !== PINNED_VERSION) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Manual cache eviction — exposed for debugging / dev tools. */
export async function clearCache(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  cached = null;
}

#!/usr/bin/env node
// Fetches the PlantUML TeaVM bundle from a pinned GitHub release, verifies the
// SHA-256 of each file we extract, and drops the three required artifacts into
// apps/web/public/plantuml-runtime/.
//
// Re-run after a pin bump (release tag + hashes near the top of this file).
// See `apps/web/public/plantuml-runtime/README.md` for the full provenance.

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, createReadStream, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DEST = join(REPO_ROOT, 'apps', 'web', 'public', 'plantuml-runtime');

// ── Pinned upstream version ─────────────────────────────────────────────────
const VERSION = '1.2026.4';
const ZIP_URL = `https://github.com/plantuml/plantuml/releases/download/v${VERSION}/js-plantuml-${VERSION}.zip`;
const ZIP_SHA256 = '3f4977f2ea9e0fd9d39c5a0f4ae5a91ded3909d98f5fced2086817d5364de8aa';

const FILES = [
  {
    name: 'plantuml.js',
    sha256: '6cd219fff5364cda385d0d6113d963f3b1386a42170fdc35970772f8364b05d5',
  },
  {
    name: 'viz-global.js',
    sha256: 'ef2cd8a08b5cf8b65e3634131052b41870ff30bb6fb23e23a87fd09d44666cba',
  },
  {
    name: 'tupadr3.min.js',
    sha256: '750a4e9479d81686ceb72486b9192104aa92a7e6789a9e3bc1a002997343f565',
  },
  {
    name: 'c4.min.js',
    sha256: 'dc6ab447655157b3ec3a25debbf1798022b0934aef2df69b391dbc7f0d57886f',
  },
];

// ── helpers ─────────────────────────────────────────────────────────────────

function sha256File(path) {
  return new Promise((res, rej) => {
    const h = createHash('sha256');
    createReadStream(path).on('data', (b) => h.update(b)).on('end', () => res(h.digest('hex'))).on('error', rej);
  });
}

async function download(url, dest) {
  console.log(`Downloading ${url}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(dest, buf);
  console.log(`  -> ${dest} (${buf.length} bytes)`);
}

function unzip(zipPath, destDir) {
  // System `unzip` is available on macOS + every Linux distro we'd run CI on.
  const r = spawnSync('unzip', ['-q', '-o', zipPath, '-d', destDir]);
  if (r.status !== 0) {
    throw new Error(`unzip failed: ${r.stderr?.toString() ?? '(no stderr)'}`);
  }
}

// ── main ────────────────────────────────────────────────────────────────────

const workDir = mkdtempSync(join(tmpdir(), 'plantuml-runtime-'));
const zipPath = join(workDir, `js-plantuml-${VERSION}.zip`);

try {
  await download(ZIP_URL, zipPath);

  const zipHash = await sha256File(zipPath);
  if (zipHash !== ZIP_SHA256) {
    throw new Error(`zip SHA-256 mismatch — got ${zipHash}, expected ${ZIP_SHA256}`);
  }
  console.log(`OK zip SHA-256 ${zipHash}`);

  unzip(zipPath, workDir);

  mkdirSync(DEST, { recursive: true });

  for (const f of FILES) {
    const src = join(workDir, f.name);
    const dst = join(DEST, f.name);
    copyFileSync(src, dst);
    const got = await sha256File(dst);
    if (got !== f.sha256) {
      throw new Error(`${f.name} SHA-256 mismatch — got ${got}, expected ${f.sha256}`);
    }
    console.log(`OK ${f.name} -> ${dst}`);
  }

  console.log(`\nVendored PlantUML TeaVM runtime v${VERSION} to ${DEST}`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

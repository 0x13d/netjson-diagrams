# CLAUDE.md

Operational notes for future Claude sessions on `netjson-diagrams`. This is the
**meta** doc — how to work in this repo. For the **conversion contract**, see
[SPEC.md](./SPEC.md); for **release history**, see [CHANGELOG.md](./CHANGELOG.md);
for **user docs**, see [README.md](./README.md).

## Read order on a cold start

1. This file (CLAUDE.md) — operational orientation
2. [SPEC.md](./SPEC.md) — what the code actually has to do
3. [CHANGELOG.md](./CHANGELOG.md) — recent direction-of-travel
4. The file(s) the user is asking about — only after the above

If the user mentions a specific bug or feature, jump to the relevant module
(see the layout below), but skim SPEC.md first if the change touches behavior.

## What this project is

A Rust core (compiled to native + WASM) that converts NetJSON documents
(NetworkGraph, DeviceConfiguration, DeviceMonitoring, NetworkRoutes,
NetworkCollection) into PlantUML deployment/component diagrams with sprite
icons. The core is wrapped by a CLI binary, an npm package, a web demo, and a
VS Code extension. [SPEC.md](./SPEC.md) is authoritative for the conversion
contract; this file covers everything else.

This project is the **sibling pattern** to `elsa-to-mermaid` — same workspace
shape, same release plumbing, same spec/diagram/paper editor idea (with the
*paper* tab being new here, replacing what was the *spec* tab in elsa).

## Repository layout

```text
crates/netjson_diagrams/       # Rust core lib (cdylib + rlib)
  src/ir.rs                    # Pure data: NetJsonIR enum + per-variant structs
  src/detect.rs                # Top-level `type` → IR variant detection
  src/normalize.rs             # JSON → IR for each variant
  src/label.rs                 # Node-role + interface-kind classification
  src/sprites.rs               # plantuml-icon-font-sprites catalog
  src/render.rs                # IR → PlantUML string
  src/paper.rs                 # IR → Markdown paper
  src/wasm.rs                  # #[cfg(feature = "wasm")] surface
  src/lib.rs                   # Public API: convert(), ConvertOptions, DirectionOpt
  tests/                       # Integration + snapshot tests
crates/netjson_diagrams_cli/   # CLI binary, clap-based
packages/netjson-diagrams/     # npm package (WASM-backed JS API)
  src/core.ts                  # Shared TS logic + LabelResolver post-processor
  src/index.ts                 # Bundler entry (imports from ../wasm)
  src/index.node.ts            # Node entry (imports from ../wasm-node)
  scripts/smoke.mjs            # Node smoke test runner
packages/netjson-diagrams-cli/ # npm wrapper for the native CLI binary
apps/web/                      # Vite + React + Tailwind demo app
apps/vscode-extension/         # VS Code extension (preview-to-the-side for *.netjson / *.json)
scripts/                       # Release & build tooling
  trust-report.sh              # Vendored supply-chain trust report
.github/workflows/             # ci.yml, release.yml
tests/fixtures/                # Canonical NetJSON fixtures (one per type)
```

## Build commands

```bash
make test            # cargo test --workspace
make cli             # cargo build --release -p netjson-diagrams-cli
make wasm            # WASM build for bundlers   → packages/netjson-diagrams/wasm/
make wasm-node       # WASM build for Node       → packages/netjson-diagrams/wasm-node/
make all             # wasm + wasm-node + cli

# Publish artifacts into /dist/netjson (release stage)
make dist            # gathers cli + wasm + npm tarball + web build into /dist/netjson

# npm package
cd packages/netjson-diagrams && npx tsc                  # compile TS
cd packages/netjson-diagrams && node scripts/smoke.mjs   # Node smoke

# Web app
cd apps/web && npm install && npm run dev

# VS Code extension (requires `make wasm-node` first so dist/wasm/ can be populated)
cd apps/vscode-extension && npm install && npm run build      # → dist/extension.js + dist/webview.js
cd apps/vscode-extension && npm run package                   # → netjson-diagrams-X.Y.Z.vsix
```

`wasm-pack` is **not** in the build path. Install once with
`cargo install wasm-bindgen-cli --version 0.2.121`.

## Where to make a change

Decision list for "I need to change X":

- **Add a new node-role classification** —
  [`label.rs::classify_role`](crates/netjson_diagrams/src/label.rs) + sprite
  mapping in [`sprites.rs`](crates/netjson_diagrams/src/sprites.rs) + a unit test
- **Add a new interface kind** —
  [`label.rs::classify_interface_kind`](crates/netjson_diagrams/src/label.rs) +
  sprite mapping + tests
- **Change PlantUML output for a NetJSON type** —
  [`render.rs::render_<variant>`](crates/netjson_diagrams/src/render.rs) and
  update snapshot tests
- **Change the paper output for a NetJSON type** —
  [`paper.rs::render_<variant>`](crates/netjson_diagrams/src/paper.rs)
- **Add a new sprite source / vendored sprite pack** —
  [`sprites.rs`](crates/netjson_diagrams/src/sprites.rs); pin the upstream
  commit in the include URL
- **Change CLI argument shape** —
  [`crates/netjson_diagrams_cli/src/main.rs`](crates/netjson_diagrams_cli/src/main.rs)
- **Change web app aesthetic / interaction** —
  `apps/web/src/components/` (mirrors elsa-to-mermaid's: Hero, Convert,
  HowItWorks, Header, Footer, Logo)
- **Change VS Code extension preview UI** —
  `apps/vscode-extension/src/webview/app.ts` + `src/preview.ts::renderHtml`

## Pipeline summary

```text
JSON string → detect (5 NetJSON types) → normalize → NetJsonIR → render → PlantUML string
                                                              ↘ paper  → Markdown
```

All stages are pure, independently testable, and depend only on `serde_json`.
Full details (types, rules, edge cases) live in [SPEC.md](./SPEC.md).

## Versioning rules

Semantic versioning per [semver.org](https://semver.org/spec/v2.0.0.html). The
Rust core crate, CLI crate, `netjson-diagrams` npm package, `netjson-diagrams-cli`
npm wrapper (plus its five platform subpackages), **and the VS Code extension**
version in **lockstep** — one number covers them all. Bump together, release
together. The web app at `apps/web` rolls separately and is not versioned.

Bump rules mirror `elsa-to-mermaid`:

- **MAJOR** — break a public API (Rust pub items, CLI flag semantics,
  `netjsonToPlantuml` signature, exports map shape) **or** change PlantUML output
  for an unchanged input (consumers diff our output).
- **MINOR** — backwards-compatible additions (new `pub` fn, new CLI flag,
  new optional `ConvertOptions` field, new role / interface-kind mapping that
  doesn't reclassify existing inputs).
- **PATCH** — bug fixes only, no surface change.

### Pre-1.0 caveat

We start at `0.1.0`. Under semver §4, anything goes pre-1.0 — but we still
follow the intent: **MINOR for new features**, **PATCH for fixes**, even though
breaking changes are technically allowed at MINOR. When we hit `1.0.0`, the
contract hardens.

## PlantUML rendering — special notes

- The **library never emits the PlantUML server URL**. Sprite `!include`
  directives are inert text — resolution happens at PlantUML compile time, not
  at our library boundary. This keeps the library offline.
- The **web app** ships the official PlantUML TeaVM browser bundle, vendored
  from PlantUML's GitHub Releases at a pinned tag and SHA-256-verified.
  Run `make web-runtime` (or `node scripts/fetch-plantuml-runtime.mjs`) before
  `cd apps/web && npm run dev|build`. The 28 MB of runtime files live under
  `apps/web/public/plantuml-runtime/`, are gitignored, and have full
  provenance in that directory's README.md. The `Diagram` component
  (`apps/web/src/components/Diagram.tsx`) lazy-loads the bundle on first
  Diagram-tab activation. No traffic to `plantuml.com`, `kroki.io`, or the
  leaningtech CDN at render time.
- **Bumping the PlantUML runtime pin** is in three places: the release tag +
  zip SHA-256 + per-file SHA-256s at the top of `scripts/fetch-plantuml-runtime.mjs`,
  the version + hashes in `apps/web/public/plantuml-runtime/README.md`, and a
  spot-check of each fixture's render in the dev server.
- The **VS Code extension** does **not** ship a renderer in v0.1.0 — its Diagram
  view shows PlantUML text only. The webview is intentionally small (`apps/vscode-extension/src/webview/app.ts`,
  no TeaVM bundle). Adding render parity is a Phase 6.1 follow-up.
- The **CLI** emits PlantUML *text* only. Users render with their own
  `plantuml.jar`. Documented in the README.

## Pre-flight before any non-trivial change

```bash
make test                                                  # cargo workspace tests
node packages/netjson-diagrams/scripts/smoke.mjs           # Node smoke
```

If touching the web app or extension, also:

```bash
(cd apps/web && npm run build)
(cd apps/vscode-extension && npm run build)
```

Snapshot tests in `crates/netjson_diagrams/tests/` are the *output contract*.
A change that breaks one is a conversation with the user (maybe MAJOR), not a
free update.

## Things to be careful about

- The Rust core has no dependencies beyond `serde` and `serde_json`. Adding more
  needs a real reason — keep the WASM footprint small.
- `plant_id` in `render.rs` replaces every non-`[a-zA-Z0-9_]` character with `_`
  and prepends `n_` if the result starts with a digit. PlantUML ids cannot
  start with a digit. The same sanitization is applied on both ends of every
  connection so renames match.
- Label content is double-quoted in PlantUML. `"` is escaped to `\"`,
  backslashes are doubled. Single quotes are left alone.
- Sprite `!include` URLs are pinned to a specific upstream commit. Don't bump
  the pin without snapshot-test review — sprite shape changes upstream cascade
  into visual regressions.
- The `NetworkCollection` renderer emits **multiple** `@startuml`/`@enduml`
  blocks per document. PlantUML and `plantuml-wasm` both handle this natively.
  Don't try to merge them into a single block — the children may use
  incompatible diagram kinds (deployment vs component).
- **Don't `Read` a file you just edited to confirm.** The harness errors loudly
  if Write/Edit silently dropped a change.
- **Hooks may block writes** — the security hook flags `innerHTML` even when
  content is sanitized. Use `DOMParser` + `replaceChildren` like the
  elsa-to-mermaid pattern.

## Common workflows

### Adding a new node role

1. Add the variant to `NodeRole` in `ir.rs`.
2. Touch `label.rs::classify_role` — add the pattern.
3. Add the sprite mapping in `sprites.rs`.
4. Add a unit test in `label::tests`.
5. Run `make test`.
6. CHANGELOG entry under `[Unreleased] · Added` — MINOR bump.

### Adding a new NetJSON type

This is a structural change. Touches:

1. Detection: new branch in `detect.rs`.
2. IR: new variant on `NetJsonIR` + struct.
3. Normalize: new `normalize_<type>` in `normalize.rs`.
4. Render: new `render_<type>` in `render.rs`.
5. Paper: new `paper_<type>` in `paper.rs`.
6. Fixture: `tests/fixtures/<type>_<scenario>.json`.
7. Snapshot tests.
8. SPEC.md update.
9. CHANGELOG entry — MAJOR or MINOR depending on whether other variants change.

### Reproducing a production-only bug

```bash
# Web app
cd apps/web && npx vite build --base=./ && \
  cp -r dist /tmp/netjson-prod && \
  cd /tmp && python3 -m http.server 8765 &
# Navigate to http://localhost:8765/netjson-prod/
```

The `plantuml-wasm` boot path is the most likely source of build-only bugs
(top-level await + Vite + WASM is finicky — same shape as the d3-color trap
elsa hit). Verify in a production build, not dev mode.

## Trust report

`scripts/trust-report.sh` is vendored from `/Users/ariugwu/Projects/_shared/trust-report/`.
Run `make trust-report` to regenerate `reports/trust/summary.md`. The summary is
the only artifact committed; raw evidence files are gitignored under
`reports/trust/`.

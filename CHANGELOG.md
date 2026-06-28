# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The Rust crate, CLI, and npm package are versioned together — a single version
covers all three. The web app at `apps/web` is not versioned (rolling deploy).

## [Unreleased]

### Changed

- **NetworkGraph now renders as a [C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML)
  Container diagram** instead of a sprite deployment diagram (`render_graph` in `render.rs`). Nodes →
  `Container`/`ContainerDb`/`ContainerQueue` (by `role`), grouped into a `System_Boundary` per the
  node's `domain` property (“sections”); links → `Rel` with the `cost_text` label and the `protocol`
  property as the technology. Included offline via `!include <C4/C4_Container>` (PlantUML stdlib).
  - **Breaking output change** for unchanged `NetworkGraph` input — consumers who diff our PlantUML will
    see C4 syntax. Snapshots `network_graph_mesh` and `network_collection_mixed` regenerated; pre-1.0 so
    a MINOR bump per our intent, but flagged here as output-breaking. SPEC.md#networkgraph updated.
  - The other four NetJSON types are unchanged (still sprite/component diagrams).

### Added

- **PIV issuance C4 example.** `tests/fixtures/network_graph_piv_issuance.json` (FIPS 201-3 issuance &
  relying-party topology, 21 nodes across 6 `domain` sections) is the canonical netjson→C4 mapping
  example — modeled on C4-PlantUML's *Container Diagram — message bus* sample. New snapshot test.
- Initial workspace scaffold mirroring `elsa-to-mermaid`: Cargo workspace,
  `netjson_diagrams` + `netjson_diagrams_cli` crate skeletons, Makefile with
  `/dist/netjson` publishing, trust-report wiring, SPEC.md authoring the
  NetJSON → PlantUML conversion contract for all five NetJSON object types
  (`NetworkGraph`, `DeviceConfiguration`, `DeviceMonitoring`, `NetworkRoutes`,
  `NetworkCollection`).
- Sprite catalog defined against
  [plantuml-icon-font-sprites](https://github.com/tupadr3/plantuml-icon-font-sprites)
  with **stdlib-style includes** (`!include <tupadr3/...>`) so PlantUML's
  bundled stdlib resolves them offline in both `plantuml.jar` and
  `plantuml-wasm` with no runtime network call.
- Spec / diagram / **paper** editor design: paper auto-generated from the same
  IR; rule is that no field appears in both the diagram and the paper.
- **Phase 2 — Rust core implementation.** Real `normalize` / `render` / `paper`
  for all five NetJSON variants. CLI now produces clean PlantUML deployment /
  component diagrams plus per-variant Markdown papers with HTML-comment
  section anchors. `convert`, `convert_paper`, `convert_combined` public API
  is live.
- Node-role classifier (`label.rs::classify_role`) with priority chain
  `properties.role` → `properties.kind` → `properties.device_type` → label
  substring → `Generic`. Word-boundary matcher avoids "apple"→`AccessPoint`
  style false positives.
- Per-fixture snapshot tests covering all five object types and all three
  output formats (`.puml`, `.md`, `.combined.md`) — 25 cargo tests pass.
- **Phase 3–7 — every distribution surface wired.**
  - **npm package** `netjson-diagrams` — TS wrappers around the WASM core,
    bundler + Node entries, LabelResolver post-processor, Node smoke (31
    checks pass).
  - **npm CLI wrapper** `netjson-diagrams-cli` — `optionalDependencies` per
    platform, launcher resolves the matching native binary at run-time.
  - **Web app** (`apps/web`) — Vite + React + Tailwind; Spec / Diagram /
    Paper tabs; sample selector across all five fixtures; direction toggle;
    copy + download. Builds to a 207 KB JS + 268 KB WASM bundle (67 KB + 103
    KB gzipped).
  - **In-browser diagram preview** — wires PlantUML's official TeaVM build
    (Java → JavaScript, no CheerpJ) for live rendering of the Diagram tab.
    Runtime (~28 MB: plantuml.js 7.1 MB + viz-global.js 1.4 MB + tupadr3.min.js
    20 MB sprite catalog) is fetched + SHA-256-verified from PlantUML's
    `v1.2026.4` release via `scripts/fetch-plantuml-runtime.mjs`, vendored
    locally, gitignored. No `plantuml.com`/`kroki.io`/CDN traffic at render
    time. Sprite catalog migrated from `tupadr3/font-awesome/*` (FA4) to
    `tupadr3/font-awesome-6/*` after discovering FA4 is missing several icons
    referenced in our catalog.
  - **VS Code extension** (`apps/vscode-extension`) — esbuild + custom
    webview; Diagram / Paper views; direction toggle; export commands.
    Packages to a 115 KB `.vsix`.
  - **Release plumbing** — `scripts/{bump-version,sync-license,build-cli-npm-packages}.mjs`
    plus `.github/workflows/{ci,release}.yml` matching the elsa-to-mermaid
    matrix: 5-platform CLI build, WASM build, npm publish (provenance),
    crates.io publish, VS Code Marketplace + Open VSX publish, GitHub
    Release with binaries attached.

### Changed

### Fixed

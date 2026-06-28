# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The Rust crate, CLI, and npm package are versioned together — a single version
covers all three. The web app at `apps/web` is not versioned (rolling deploy).

## [Unreleased]

### Added

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

### Changed

### Fixed

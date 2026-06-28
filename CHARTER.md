# Charter — netjson-diagrams

> Links this project to the [portfolio](https://ariugwu.com) and its governing
> C-suite. The charter test: every project serves
> at least one of the five goals.

| | |
|---|---|
| **Primary goal** | **Career Relevancy Showcase** |
| **Owning officer** | CPO (product) |
| **Supporting** | CSO (offline/in-browser rendering — trust signature), CIO (the shared monorepo shape), CMO (framing) |
| **Team** | software-team — Rust+WASM+CLI+npm+web+VSCode (prefix `NJ-`) |

## How it serves the goal

`netjson-diagrams` converts **NetJSON → PlantUML** diagrams (with icon-font sprites), shipped as a
Rust core + WASM + CLI + npm + web demo + VSCode extension. It showcases the portfolio's signature
**multi-target Rust+WASM toolkit** pattern and the **offline-rendering / no-telemetry** trust stance (the
library emits inert PlantUML text; rendering is in-browser via `plantuml-wasm`, never a call to
plantuml.com / kroki.io).

## Active focus (PI-01)

- `PI-01-007` (CPO · Career): grade — CLI emits real PlantUML (Phase 2 done); confirm showcase-readiness
  and the web/VSCode polish bar.
- `PI-01-005` (CSO · Career): `trust-report` green; verify no third-party render calls anywhere.

## Constraints

- **Offline-first rendering** is non-negotiable (CSO) — it's both the trust signature and a product
  differentiator.
- Lockstep versioning across crate/CLI/npm/VSCode (CIO convention).

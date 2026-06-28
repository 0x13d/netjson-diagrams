# netjson-diagrams

Convert [NetJSON](https://netjson.org/) documents (NetworkGraph,
DeviceConfiguration, DeviceMonitoring, NetworkRoutes, NetworkCollection) into
[PlantUML](https://plantuml.com/) deployment / component diagrams with
[plantuml-icon-font-sprites](https://github.com/tupadr3/plantuml-icon-font-sprites)
for a clean academic-paper aesthetic.

Ships as a Rust library, a WASM module, a CLI binary, a TypeScript npm package,
a web demo, and a VS Code extension. The web/extension previews are powered by
an embedded `plantuml-wasm` build — no third-party servers are contacted at
runtime.

## Quick demo

```bash
# Install wasm-bindgen-cli once (we drive wasm-pack manually — see Build notes below)
cargo install wasm-bindgen-cli --version 0.2.121

# Run the full workspace
make test          # cargo workspace tests
make cli           # release CLI at target/release/netjson-diagrams
make wasm wasm-node  # both wasm-bindgen output targets

# Try the CLI
./target/release/netjson-diagrams tests/fixtures/network_graph_mesh.json
```

For the web app:

```bash
cd apps/web
npm install
npm run dev
```

For the VS Code extension:

```bash
cd apps/vscode-extension
npm install
npm run package          # produces netjson-diagrams-X.Y.Z.vsix
# Sideload it: VS Code → Extensions panel → "..." menu → Install from VSIX…
```

## Components

```text
crates/netjson_diagrams/      Rust core: detect → normalize → render
crates/netjson_diagrams_cli/  Thin binary wrapping the core
packages/netjson-diagrams/    npm package: WASM + LabelResolver
apps/web/                     Web demo (Vite + React); spec / diagram / paper tabs
apps/vscode-extension/        VS Code extension (PlantUML preview to the side)
tests/fixtures/               Canonical NetJSON inputs (one per object type)
```

## CLI

```text
netjson-diagrams [INPUT] [-o OUTPUT] [-d TD|LR]
                         [-f plantuml|paper|combined] [--paper] [--combined] [--fenced]
```

- `INPUT` — NetJSON file (omit to read stdin)
- `-o`, `--output` — write to file (omit for stdout)
- `-d`, `--direction` — diagram layout direction (default `TD`)
- `-f`, `--format` — output format: `plantuml` (default), `paper`, or `combined`
- `--paper` — shorthand for `-f paper`
- `--combined` — shorthand for `-f combined`
- `--fenced` — wrap output in a ```` ```plantuml ```` block, ready to drop into Markdown

```bash
cat mesh.json | netjson-diagrams -d LR --fenced > mesh.md
```

## npm package

```ts
import { netjsonToPlantuml, netjsonToPaper } from 'netjson-diagrams';

const diagram = await netjsonToPlantuml(networkGraphJson, {
  direction: 'LR',
  labelResolver: (kind, id) => (kind === 'node' && id === '10.0.0.1' ? 'Gateway' : undefined),
});

const paper = await netjsonToPaper(networkGraphJson);
```

`labelResolver` runs client-side as a post-processing pass on the PlantUML
output. Returning `undefined` falls through to the default label.

## How rendering decisions are made

- **Type detection** (`detect.rs`) reads the top-level `type` field.
- **Node-role classification** (`label.rs`) maps `properties.role` /
  `properties.kind` / `label` substrings to one of seven roles
  (`Router`, `Switch`, `AccessPoint`, `Server`, `Client`, `Internet`, `Generic`).
- **Sprite catalog** (`sprites.rs`) maps roles and interface kinds to
  plantuml-icon-font-sprites includes; only referenced sprites are emitted.
- **Per-type rendering** branches on the IR variant — see
  [SPEC.md](./SPEC.md#render) for the body shape per type.
- **Paper auto-generation** uses the same IR; the rule is that no field appears
  in both the diagram and the paper.

## Build notes

- `wasm-pack 0.14.0` shells out to Cargo's `--out-dir` flag, which was renamed
  to `--artifact-dir` (and made nightly-only) in current Cargo. We sidestep
  wasm-pack and drive `cargo build --target wasm32-unknown-unknown` +
  `wasm-bindgen-cli` directly via the Makefile. Outputs are byte-identical to
  wasm-pack's.
- The Rust crate is `crate-type = ["cdylib", "rlib"]` and gates WASM bindings
  behind `--features wasm`.
- The npm package ships **two** WASM builds — `wasm/` (bundler target) and
  `wasm-node/` (CommonJS for Node). Conditional `exports` route consumers
  automatically; the bundler build is the production path.

## Project layout & contributing

- [SPEC.md](./SPEC.md) — authoritative conversion behavior (schemas, IR, rendering rules)
- [CLAUDE.md](./CLAUDE.md) — operational notes: how to build, where to make a
  given change, semantic versioning rules, and known gotchas
- [CHANGELOG.md](./CHANGELOG.md) — release history
- [BRAINSTORM.md](./BRAINSTORM.md) — original brief (kept for reference)

## License

See [LICENSE.md](./LICENSE.md).

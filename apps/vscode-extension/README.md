# NetJSON Diagrams — VS Code Extension

Preview [NetJSON](https://netjson.org/) documents as [PlantUML](https://plantuml.com/)
deployment/component diagrams plus an auto-generated paper, side by side with the editor.

## Features

- **Live preview** for all five NetJSON object types: `NetworkGraph`,
  `DeviceConfiguration`, `DeviceMonitoring`, `NetworkRoutes`, `NetworkCollection`.
- **Two views in the preview panel** — Diagram (PlantUML text) and Paper
  (rendered Markdown narrative).
- **Direction toggle** (TD / LR) updates the diagram in place.
- **Export** as `.puml`, `.paper.md`, or combined `.combined.md`.

## Usage

1. Open a NetJSON `.json` file in VS Code.
2. Run **NetJSON Diagrams: Open PlantUML Preview to the Side** from the
   Command Palette, or click the preview button in the editor title bar.
3. Edit the JSON — the preview updates as you type.

To render the PlantUML to an actual image, save the `.puml` (via the export
command) and run `plantuml diagram.puml` locally. The extension intentionally
ships no in-extension renderer in v0.1.0 — the PlantUML output uses stdlib
sprite includes (`!include <tupadr3/...>`) so any recent PlantUML install
resolves them offline.

## Settings

- `netjsonDiagrams.defaultDirection` — `TD` (default) or `LR`.
- `netjsonDiagrams.previewDebounceMs` — milliseconds to debounce updates
  while editing (default `200`).

## See also

- [Project repo](https://github.com/ariugwu/netjson-diagrams)
- [CLI / npm package](https://github.com/ariugwu/netjson-diagrams#components)

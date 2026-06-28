import { createRequire } from 'node:module';
import * as path from 'node:path';

export type Direction = 'TD' | 'LR';

interface WasmModule {
  convert_to_plantuml(netjsonJson: string, optionsJson: string): string;
  convert_to_paper(netjsonJson: string): string;
  convert_to_combined(netjsonJson: string, optionsJson: string): string;
}

let cached: WasmModule | null = null;

function loadWasm(): WasmModule {
  if (cached) return cached;
  // `__dirname` in the bundled extension points at dist/. The wasm-node files
  // ship in dist/wasm/ alongside the bundled extension entry.
  const wasmPath = path.join(__dirname, 'wasm', 'netjson_diagrams.js');
  const req = createRequire(__filename);
  cached = req(wasmPath) as WasmModule;
  return cached;
}

export function convert(netjsonJson: string, direction: Direction = 'TD'): string {
  return loadWasm().convert_to_plantuml(netjsonJson, JSON.stringify({ direction }));
}

export function convertPaper(netjsonJson: string): string {
  return loadWasm().convert_to_paper(netjsonJson);
}

export function convertCombined(netjsonJson: string, direction: Direction = 'TD'): string {
  return loadWasm().convert_to_combined(netjsonJson, JSON.stringify({ direction }));
}

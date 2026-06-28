import type { LabelResolver } from './resolver.js';

export interface ConvertOptions {
  direction?: 'TD' | 'LR';
  labelResolver?: LabelResolver;
}

export type ConvertFn = (netjsonJson: string, optionsJson: string) => string;
export type PaperFn = (netjsonJson: string) => string;

export function makeNetjsonToPlantuml(convertFn: ConvertFn) {
  return async function netjsonToPlantuml(
    doc: string | object,
    options: ConvertOptions = {},
  ): Promise<string> {
    const json = typeof doc === 'string' ? doc : JSON.stringify(doc);
    const { labelResolver, ...wasmOpts } = options;
    let result = convertFn(
      json,
      JSON.stringify({ direction: wasmOpts.direction ?? 'TD' }),
    );
    if (labelResolver) {
      result = applyLabelResolver(result, json, labelResolver);
    }
    return result;
  };
}

export function makeNetjsonToPaper(paperFn: PaperFn) {
  return async function netjsonToPaper(doc: string | object): Promise<string> {
    const json = typeof doc === 'string' ? doc : JSON.stringify(doc);
    return paperFn(json);
  };
}

export function makeNetjsonToCombined(combinedFn: ConvertFn) {
  return async function netjsonToCombined(
    doc: string | object,
    options: ConvertOptions = {},
  ): Promise<string> {
    const json = typeof doc === 'string' ? doc : JSON.stringify(doc);
    const { labelResolver, ...wasmOpts } = options;
    let result = combinedFn(
      json,
      JSON.stringify({ direction: wasmOpts.direction ?? 'TD' }),
    );
    if (labelResolver) {
      result = applyLabelResolverToFencedPlantuml(result, json, labelResolver);
    }
    return result;
  };
}

// ── LabelResolver application ───────────────────────────────────────────────
//
// The Rust core has already produced PlantUML text. We walk the input JSON
// to find every entity the resolver might rename, build a (sanitized-id →
// new-label) map, then rewrite matching declaration lines.

interface Replacement {
  plantId: string;
  label: string;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function collectReplacements(doc: unknown, resolver: LabelResolver): Replacement[] {
  const out: Replacement[] = [];
  if (!isObj(doc)) return out;

  const visit = (obj: unknown): void => {
    if (!isObj(obj)) return;
    const ty = obj.type;
    if (ty === 'NetworkGraph') {
      if (Array.isArray(obj.nodes)) {
        for (const n of obj.nodes) {
          if (isObj(n) && typeof n.id === 'string') {
            const r = resolver('node', n.id);
            if (r !== undefined) out.push({ plantId: plantId(n.id), label: r });
          }
        }
      }
    } else if (ty === 'DeviceConfiguration' || ty === 'DeviceMonitoring') {
      if (Array.isArray(obj.interfaces)) {
        for (const i of obj.interfaces) {
          if (isObj(i) && typeof i.name === 'string') {
            const r = resolver('interface', i.name);
            if (r !== undefined) {
              out.push({ plantId: `iface_${sanitizeChars(i.name)}`, label: r });
            }
          }
        }
      }
    } else if (ty === 'NetworkRoutes') {
      if (Array.isArray(obj.routes)) {
        const seen = new Set<string>();
        for (const r of obj.routes) {
          if (isObj(r) && typeof r.destination === 'string' && !seen.has(r.destination)) {
            seen.add(r.destination);
            const newLabel = resolver('route', r.destination);
            if (newLabel !== undefined) {
              out.push({
                plantId: `dest_${sanitizeChars(r.destination)}`,
                label: newLabel,
              });
            }
          }
        }
      }
    } else if (ty === 'NetworkCollection') {
      if (Array.isArray(obj.collection)) {
        for (const child of obj.collection) {
          visit(child);
        }
      }
    }
  };

  visit(doc);
  return out;
}

// Mirrors `render::plant_id` in the Rust core.
function plantId(raw: string): string {
  let s = sanitizeChars(raw);
  if (s.length === 0) return 'n_unknown';
  if (/^[0-9]/.test(s)) s = `n_${s}`;
  return s;
}

function sanitizeChars(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_]/g, '_');
}

function escapeLabel(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function applyLabelResolver(
  plantuml: string,
  doc: string,
  resolver: LabelResolver,
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(doc);
  } catch {
    return plantuml;
  }
  const replacements = collectReplacements(parsed, resolver);
  if (replacements.length === 0) return plantuml;
  const byId = new Map(replacements.map((r) => [r.plantId, escapeLabel(r.label)]));
  return plantuml
    .split('\n')
    .map((line) => rewriteLine(line, byId))
    .join('\n');
}

function applyLabelResolverToFencedPlantuml(
  combined: string,
  doc: string,
  resolver: LabelResolver,
): string {
  // The combined output may contain multiple `@startuml`...`@enduml` blocks
  // (NetworkCollection); rewrite each one.
  const fence = '```plantuml';
  const start = combined.indexOf(fence);
  if (start === -1) return combined;
  const after = combined.indexOf('\n', start);
  if (after === -1) return combined;
  const end = combined.indexOf('```', after + 1);
  if (end === -1) return combined;
  const body = combined.slice(after + 1, end);
  const rewritten = applyLabelResolver(body, doc, resolver);
  return combined.slice(0, after + 1) + rewritten + combined.slice(end);
}

// Matches `node "label" as ID <<$sprite>>` / `component "label" as ID <<...>>`
// / `cloud "label" as ID <<...>>`. Captures the id. Used by DeviceConfiguration,
// DeviceMonitoring, NetworkRoutes — which still render in deployment syntax.
const DECL_LINE = /^(\s*)(node|component|cloud)\s+"[^"]*"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\b/;

// Matches the C4 node form `Container(ID, "label", ...)` — also `ContainerDb`
// and `ContainerQueue` (see render.rs::c4_macro_for_role). NetworkGraph renders
// as a C4 Container diagram, so its nodes never use the deployment syntax above;
// without this the labelResolver silently no-ops on graph nodes. Captures the id.
const C4_DECL_LINE = /^(\s*)(?:Container|ContainerDb|ContainerQueue)\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*"/;

function rewriteLine(line: string, byId: Map<string, string>): string {
  // In both the deployment and C4 forms the label is the first quoted string on
  // the line, so once we know the id the rewrite is identical.
  const m = line.match(DECL_LINE);
  const id = m ? m[3] : line.match(C4_DECL_LINE)?.[2];
  if (id === undefined) return line;
  const replacement = byId.get(id);
  if (replacement === undefined) return line;
  const first = line.indexOf('"');
  const last = line.indexOf('"', first + 1);
  if (first === -1 || last === -1) return line;
  return `${line.slice(0, first + 1)}${replacement}${line.slice(last)}`;
}

/**
 * Fast structural check: is this JSON text a recognised NetJSON object type?
 * Mirrors the Rust core's detect.rs.
 */
export type NetJsonKind =
  | 'NetworkGraph'
  | 'DeviceConfiguration'
  | 'DeviceMonitoring'
  | 'NetworkRoutes'
  | 'NetworkCollection';

const KNOWN: ReadonlySet<NetJsonKind> = new Set([
  'NetworkGraph',
  'DeviceConfiguration',
  'DeviceMonitoring',
  'NetworkRoutes',
  'NetworkCollection',
]);

export function detectNetjson(jsonText: string): NetJsonKind | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const ty = (parsed as Record<string, unknown>).type;
  if (typeof ty !== 'string') return null;
  const trimmed = ty.trim();
  return (KNOWN as ReadonlySet<string>).has(trimmed) ? (trimmed as NetJsonKind) : null;
}

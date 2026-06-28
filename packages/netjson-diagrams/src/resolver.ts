/**
 * Optional callback to override the default PlantUML label for an entity.
 * Return `undefined` to fall back to the default label produced by the Rust
 * core. The `kind` discriminates *what* is being labelled:
 *
 *   - `'node'`      → a NetworkGraph node (id = the node's NetJSON id)
 *   - `'interface'` → a DeviceConfiguration / DeviceMonitoring interface
 *                     (id = interface name, e.g. `eth0`)
 *   - `'route'`     → a NetworkRoutes destination cloud
 *                     (id = the destination CIDR/string)
 */
export type LabelResolver = (
  kind: 'node' | 'interface' | 'route',
  id: string,
) => string | undefined;

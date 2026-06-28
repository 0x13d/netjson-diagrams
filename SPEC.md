# SPEC — netjson-diagrams

> **Status:** authoritative for conversion behavior. Code is the source of truth;
> this document explains the contract behind it. For build commands, repository
> layout, and Claude-specific operational notes, see [CLAUDE.md](./CLAUDE.md).
> For release history, see [CHANGELOG.md](./CHANGELOG.md).

---

## Pipeline

```text
                                                ┌──► render       → PlantUML string
JSON string → detect (5 NetJSON types) → normalize ┤
                                                └──► render_paper → Markdown paper
```

The `normalize` stage produces a single `NetJsonIR` enum. Two renderers consume
it independently — `render` emits the PlantUML diagram, `render_paper` emits a
Markdown narrative covering the meta elements that don't fit cleanly in a
diagram. `render_combined` is a convenience that concatenates both with a fenced
`plantuml` block.

Five pure stages. The only runtime dependency is `serde_json`. No regex crates,
no HTTP, no filesystem access in the library.

---

## NetJSON schemas

NetJSON ([netjson.org](https://netjson.org/)) is a family of JSON-shaped network
documents. We support all five canonical object types, each identified by a
top-level `type` field.

### NetworkGraph

Topology data — nodes and links.

```json
{
  "type": "NetworkGraph",
  "protocol": "OLSR",
  "version": "0.6.6",
  "metric": "ETX",
  "router_id": "10.0.0.1",
  "topology_id": "topo-1",
  "label": "Mesh A",
  "nodes": [
    { "id": "10.0.0.1", "label": "Gateway", "local_addresses": ["192.168.1.1"], "properties": { "role": "router" } },
    { "id": "10.0.0.2", "label": "AP-1",    "properties": { "role": "ap" } }
  ],
  "links": [
    { "source": "10.0.0.1", "target": "10.0.0.2", "cost": 1.0, "cost_text": "ETX 1.0", "properties": { "protocol": "OLSR" } }
  ]
}
```

### DeviceConfiguration

Per-device settings — interfaces, radios, DNS.

```json
{
  "type": "DeviceConfiguration",
  "general":     { "hostname": "router-01" },
  "interfaces":  [
    {
      "name": "eth0", "type": "ethernet", "mac": "aa:bb:cc:dd:ee:ff",
      "mtu": 1500, "autostart": true,
      "addresses": [{ "address": "192.168.1.1", "mask": 24, "family": "ipv4", "proto": "static" }]
    },
    {
      "name": "wlan0", "type": "wireless",
      "wireless": { "radio": "radio0", "mode": "access_point", "ssid": "MyMesh", "encryption": { "protocol": "wpa2_personal" } }
    },
    {
      "name": "br-lan", "type": "bridge", "bridge_members": ["eth0", "wlan0"]
    }
  ],
  "radios":      [{ "name": "radio0", "protocol": "802.11n", "channel": 6, "channel_width": 20, "tx_power": 17, "country": "US" }],
  "dns_servers": ["8.8.8.8", "1.1.1.1"],
  "dns_search":  ["lan"]
}
```

### DeviceMonitoring

Runtime telemetry.

```json
{
  "type": "DeviceMonitoring",
  "general":   { "hostname": "router-01", "local_time": 1700000000, "uptime": 86400 },
  "resources": {
    "load":   [0.15, 0.12, 0.10],
    "memory": { "total": 134217728, "free": 67108864 },
    "swap":   { "total": 0, "free": 0 }
  },
  "interfaces": [
    {
      "name": "eth0", "type": "ethernet", "up": true, "mac": "aa:bb:cc:dd:ee:ff",
      "statistics": { "rx_bytes": 1024000, "tx_bytes": 2048000, "rx_packets": 1000, "tx_packets": 2000 }
    }
  ]
}
```

### NetworkRoutes

Routing table.

```json
{
  "type": "NetworkRoutes",
  "router_id": "10.0.0.1",
  "routes": [
    { "destination": "0.0.0.0/0", "next": "10.0.0.254", "device": "eth0", "cost": 1, "source": "static" },
    { "destination": "10.0.0.0/24", "next": "0.0.0.0",  "device": "eth0", "cost": 0, "source": "kernel" }
  ]
}
```

### NetworkCollection

Container for any of the above.

```json
{
  "type": "NetworkCollection",
  "collection": [
    { "type": "NetworkGraph", "nodes": [...], "links": [...] },
    { "type": "DeviceConfiguration", "general": { "hostname": "router-01" }, "interfaces": [...] }
  ]
}
```

**Detection rule** for every type: inspect the top-level `type` string. Trim
whitespace, compare case-sensitively against the five canonical values. Anything
else is an error.

---

## Intermediate representation

Version-agnostic. All rendering operates on this type. Defined in
[`crates/netjson_diagrams/src/ir.rs`](crates/netjson_diagrams/src/ir.rs).

```rust
pub enum NetJsonIR {
    Graph(GraphIR),
    Config(ConfigIR),
    Monitoring(MonitoringIR),
    Routes(RoutesIR),
    Collection(CollectionIR),
}

pub struct GraphIR {
    pub label: Option<String>,
    pub protocol: Option<String>,
    pub version: Option<String>,
    pub metric: Option<String>,
    pub router_id: Option<String>,
    pub topology_id: Option<String>,
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}

pub struct GraphNode {
    pub id: String,
    pub label: Option<String>,
    pub role: NodeRole,                    // classified from properties.role / label / id
    pub local_addresses: Vec<String>,
    pub properties: BTreeMap<String, Value>,
}

pub struct GraphLink {
    pub source: String,
    pub target: String,
    pub cost: Option<f64>,
    pub cost_text: Option<String>,
    pub properties: BTreeMap<String, Value>,
}

pub enum NodeRole { Router, Switch, AccessPoint, Server, Client, Internet, Generic }

pub struct ConfigIR {
    pub hostname: Option<String>,
    pub general: BTreeMap<String, Value>,  // everything in `general` minus hostname
    pub interfaces: Vec<InterfaceIR>,
    pub radios: Vec<RadioIR>,
    pub dns_servers: Vec<String>,
    pub dns_search: Vec<String>,
}

pub struct InterfaceIR {
    pub name: String,
    pub kind: InterfaceKind,               // ethernet|wireless|bridge|loopback|virtual|other
    pub mac: Option<String>,
    pub mtu: Option<u32>,
    pub autostart: Option<bool>,
    pub addresses: Vec<AddressIR>,
    pub wireless: Option<WirelessIR>,      // populated when kind == Wireless
    pub bridge_members: Vec<String>,       // populated when kind == Bridge
    pub extras: BTreeMap<String, Value>,   // remaining keys (txqueuelen, disabled, etc.)
}

pub enum InterfaceKind { Ethernet, Wireless, Bridge, Loopback, Virtual, Other }

pub struct AddressIR {
    pub address: String,
    pub mask: Option<u8>,
    pub family: Option<String>,            // ipv4 | ipv6
    pub proto: Option<String>,             // static | dhcp | ...
}

pub struct WirelessIR {
    pub radio: Option<String>,
    pub mode: Option<String>,              // access_point | station | adhoc | ...
    pub ssid: Option<String>,
    pub encryption: Option<Value>,         // opaque; surfaces in paper
}

pub struct RadioIR {
    pub name: String,
    pub protocol: Option<String>,
    pub channel: Option<u32>,
    pub channel_width: Option<u32>,
    pub tx_power: Option<i32>,
    pub country: Option<String>,
    pub disabled: Option<bool>,
}

pub struct MonitoringIR {
    pub hostname: Option<String>,
    pub local_time: Option<i64>,
    pub uptime: Option<i64>,
    pub general: BTreeMap<String, Value>,
    pub resources: Option<Value>,          // opaque; paper renders selected fields
    pub interfaces: Vec<MonitoredInterfaceIR>,
}

pub struct MonitoredInterfaceIR {
    pub name: String,
    pub kind: InterfaceKind,
    pub up: Option<bool>,
    pub mac: Option<String>,
    pub statistics: Option<Value>,         // opaque; rx_bytes/tx_bytes pulled on render
}

pub struct RoutesIR {
    pub router_id: Option<String>,
    pub routes: Vec<RouteIR>,
}

pub struct RouteIR {
    pub destination: String,
    pub next: Option<String>,
    pub device: Option<String>,
    pub cost: Option<f64>,
    pub source: Option<String>,
}

pub struct CollectionIR {
    pub members: Vec<NetJsonIR>,
}
```

---

## Normalization

### NetworkGraph

- `label`, `protocol`, `version`, `metric`, `router_id`, `topology_id` ← passthrough from JSON
- Nodes: iterate `json.nodes` → `GraphNode { id, label, role: classify_role(...), local_addresses, properties }`
  - `local_addresses` defaults to `[]` when absent
  - `properties` defaults to `{}` when absent
- Links: iterate `json.links` → `GraphLink { source, target, cost, cost_text, properties }`
  - A link whose `source` or `target` doesn't match any declared node id is **preserved** (PlantUML renders it as a connection to an implicit node) but logged in the IR's diagnostics field
- A node with no inbound *or* outbound link is preserved (isolated nodes render as standalone components)

### DeviceConfiguration

- `hostname` ← `json.general.hostname` (string), else `None`
- `general` ← `json.general` minus the `hostname` key
- Interfaces: iterate `json.interfaces` → `InterfaceIR`
  - `kind` from `interface.type` (case-insensitive: `ethernet`, `wireless`, `bridge`, `loopback`, `virtual`; everything else → `Other`)
  - `addresses` default to `[]`
  - `wireless` populated **only** when `kind == Wireless` and the JSON has a `wireless` object
  - `bridge_members` populated **only** when `kind == Bridge`
  - `extras` collects every interface JSON key not in the well-known set
    (`name`, `type`, `mac`, `mtu`, `autostart`, `addresses`, `wireless`,
    `bridge_members`)
- Radios: iterate `json.radios` → `RadioIR` straight-through
- `dns_servers`, `dns_search` ← passthrough (default `[]`)

### DeviceMonitoring

- `hostname`, `local_time`, `uptime` ← `json.general.*` with fallback to `None`
- `general` ← `json.general` minus the three well-known keys
- `resources` ← `json.resources` (opaque `Value`; deep-rendered in paper only)
- Interfaces: iterate `json.interfaces` → `MonitoredInterfaceIR`

### NetworkRoutes

- `router_id` ← passthrough
- Routes: iterate `json.routes` → `RouteIR`; `destination` is required (skip the entry with a diagnostic if missing)

### NetworkCollection

- Iterate `json.collection`; recurse `normalize` on each child
- Skip and diagnose children whose `type` is unrecognized; never panic
- Empty `collection` yields an empty `CollectionIR { members: [] }`

---

## Node-role classification

`classify_role(node)` in [`label.rs`](crates/netjson_diagrams/src/label.rs)
chooses an icon based on, in priority order:

1. `node.properties.role` (string) — match case-insensitive against:
   `router`, `switch`, `ap`/`access_point`, `server`, `client`/`station`, `internet`/`cloud`/`gateway`
2. `node.properties.kind` / `node.properties.device_type` — same matcher
3. Heuristic from `node.label` (case-insensitive substring): same keywords
4. Default → `Generic`

Roles map to sprite icons (see **Sprite catalog** below). The mapping is the
*only* place classification feeds rendering — the IR carries `NodeRole`, not the
icon string.

---

## Render

`render(ir, opts)` in [`render.rs`](crates/netjson_diagrams/src/render.rs).

### Output structure (all types)

Every rendered PlantUML document starts with `@startuml`, includes the sprite
library, sets a layout direction, optionally emits a `title`, then the body,
then `@enduml`. Output always ends with exactly one trailing newline.

```text
@startuml
!include <tupadr3/common>
!include <tupadr3/font-awesome-6/wifi>
...
{direction}
title "{type-specific title}"

{body}

@enduml
```

- `direction` ∈ `TD` → `top to bottom direction`, `LR` → `left to right direction`. Default `TD`.
- Only the sprite includes actually referenced in the body are emitted.
- **Exception: `NetworkGraph` renders as a C4 Container diagram** (`!include <C4/C4_Container>`), not the
  sprite structure — see **NetworkGraph body** below. The other four types keep the sprite/component form.

### NetworkGraph body — C4 Container diagram

**NetworkGraph is the exception to the sprite structure above:** it renders as a
[C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML) **Container diagram**, included
**offline** from the PlantUML stdlib. The document is:

```text
@startuml
!include <C4/C4_Container>

{direction}
LAYOUT_WITH_LEGEND()
title "{graph label or NetworkGraph}"

{System_Boundary blocks, then ungrouped containers}

{Rel lines}

@enduml
```

**Nodes → C4 elements.** Each node becomes a C4 container line:

```text
{Macro}({plant_id}, "{label}", "{technology}", "{description}")
```

- `Macro` is `ContainerDb` when the node's `role` property contains `director`/`ldap` (or is
  `db`/`database`); `ContainerQueue` when it contains `bus`/`queue`/`mq`/`broker`; else `Container`.
- `technology` = the `role` property humanized (short acronyms ≤4 chars upper-cased, else Title Case),
  with the `standards` property appended as ` · {standards}` when present.
- `description` = the node's remaining string properties (everything except `role`, `domain`,
  `standards`) joined as `key: value; …`. Omit the 4th argument entirely when empty.
- `plant_id` is `plant_id(node.id)`; `label` defaults to `node.id`.

**Sections (System_Boundary).** Nodes are grouped by their `domain` property into a
`System_Boundary({plant_id(domain)}, "{humanized domain}")` block (first-seen domain order). Nodes with
no `domain` are emitted at the top level after the boundaries. *(This is the “sections” mapping the PIV
issuance fixture exercises — see `tests/fixtures/network_graph_piv_issuance.json`.)*

**Links → Rel.**

```text
Rel({src}, {tgt}, "{label}", "{technology}")
```

- `label` prefers `cost_text`, else a formatted `cost` (`{:.2}`), else empty.
- `technology` = the link's `protocol` property; omit the 4th argument when absent/empty.

Label/technology/description content is escaped the same way as all label content (see **Label escaping**).

### DeviceConfiguration body

```text
node "Device · {hostname}" as device {
    component "{iface.name}" as {plant_id} <<${iface_sprite}>>
    ...
}

component "Radio {radio.name}" as {radio_id} <<$wifi>>
...

device .. {radio_id}
```

- Each interface renders as a `component` nested inside the device `node`.
- Bridge interfaces emit a dashed connection (`..>`) to each bridge member.
- Wireless interfaces emit a dashed connection (`..>`) to their `wireless.radio`.
- Radios render outside the device node, connected with a non-directional `..` line.

### DeviceMonitoring body

Same shape as `DeviceConfiguration` but each interface declaration is annotated
with a brief stat note:

```text
component "{iface.name}" as {plant_id} <<${iface_sprite}>>
note right of {plant_id}
  rx {human_bytes(rx_bytes)}
  tx {human_bytes(tx_bytes)}
end note
```

- `human_bytes` rounds to `B / KB / MB / GB / TB` with one decimal of precision (e.g. `1.0 MB`).
- The note is omitted when `statistics` is missing or both `rx_bytes` and `tx_bytes` are absent.

### NetworkRoutes body

```text
node "Router {router_id}" as router <<$router>>
cloud "{destination}" as {dest_id}
router --> {dest_id} : "via {next} ({device}) cost {cost}"
```

- One `cloud` per unique `destination`. If multiple routes share a destination,
  emit one cloud and one arrow per route.
- Route metadata bits missing from JSON are simply dropped from the arrow label
  (e.g. `via 10.0.0.254 (eth0)` if cost is missing).

### NetworkCollection body

Render each child independently into its own `@startuml`/`@enduml` block,
concatenated with one blank line separator. This is intentional — PlantUML
multi-diagram files use this exact convention, and each child can be extracted
losslessly by splitting on `@startuml`.

### Id sanitization

`plant_id(id)` replaces every non-`[a-zA-Z0-9_]` character with `_`. Applied
consistently to both source and target in every connection so renames match on
both ends. PlantUML ids cannot start with a digit, so we prepend `n_` when the
sanitized result starts with `[0-9]`.

### Label escaping

Labels are wrapped in `"…"`. Any `"` inside a label is replaced with `\"`
(PlantUML's documented escape). Backslashes are doubled. Unicode passes through
unchanged.

---

## Sprite catalog

Sprites come from
[plantuml-icon-font-sprites](https://github.com/tupadr3/plantuml-icon-font-sprites)
(`tupadr3/font-awesome`, `tupadr3/devicons2`, `tupadr3/common`). We pin to a
specific upstream commit via the `!include` URLs vendored at build time
(actual URLs land in `sprites.rs`).

### NodeRole → sprite

| Role          | Sprite              | Include                                  |
|---------------|---------------------|------------------------------------------|
| `Router`      | `router`            | `tupadr3/font-awesome-6/server`            |
| `Switch`      | `network_wired`     | `tupadr3/font-awesome-6/network_wired`     |
| `AccessPoint` | `wifi`              | `tupadr3/font-awesome-6/wifi`              |
| `Server`      | `server`            | `tupadr3/font-awesome-6/server`            |
| `Client`      | `laptop`            | `tupadr3/font-awesome-6/laptop`            |
| `Internet`    | `cloud`             | `tupadr3/font-awesome-6/cloud`             |
| `Generic`     | `circle_nodes` (default) | `tupadr3/font-awesome-6/circle_nodes`  |

### InterfaceKind → sprite

| Kind        | Sprite           |
|-------------|------------------|
| `Ethernet`  | `ethernet`       |
| `Wireless`  | `wifi`           |
| `Bridge`    | `code_branch`    |
| `Loopback`  | `circle_dot`     |
| `Virtual`   | `clone`          |
| `Other`     | `circle_nodes`   |

Only the includes actually referenced in a given diagram are emitted, to keep
the PlantUML preamble small.

---

## Paper

`render_paper(ir)` in [`paper.rs`](crates/netjson_diagrams/src/paper.rs)
emits a Markdown document describing the meta elements that don't fit cleanly
in the diagram. Generated from the same IR as `render` — no second pass over
the JSON.

### Rule: nothing is duplicated

A field is in **exactly one** of `{ diagram, paper }`. Per type:

| NetJSON type        | Diagram                                | Paper                                                                    |
|---------------------|----------------------------------------|--------------------------------------------------------------------------|
| `NetworkGraph`      | nodes, links (with cost label)         | protocol, version, metric, router_id, topology_id, per-node properties not in icon set |
| `DeviceConfiguration` | device, interfaces, radios, bridge edges | DNS servers, DNS search, interface IPs/MAC/MTU, wireless mode + encryption, radio details |
| `DeviceMonitoring`  | device, interfaces (with rx/tx note)   | load, memory, swap, disk, full `statistics` tables                       |
| `NetworkRoutes`     | router → destination clouds (with arrow label) | full route source/metric tables, kernel vs static origin                |
| `NetworkCollection` | composed per-member diagrams           | per-member section headers + recursive paper output                      |

### Output structure

```text
# {document title}

**Type:** `{netjson type}` · **{type-specific meta chips}`

<!-- netjson-section: {anchor} -->
## {section heading}

{prose / lists / tables}
```

Each section is preceded by an HTML comment anchor
(`<!-- netjson-section: {anchor} -->`). Downstream tooling (the web app's paper
tab and the VS Code preview) splits the document on these anchors to render
per-section toggles.

### Value formatting

`format_value_inline(value)` handles a single span:

- `null` → `_(unset)_`
- `bool`, `number` → backticked
- `string` (empty) → `_(empty string)_`; (multiline) → fenced block; (single line) → backticked
- `array` → comma-joined backticked entries; if >5 entries, fenced JSON block
- `object` → fenced JSON block

### Empty paper

If an IR has zero non-diagram fields (e.g. a NetworkGraph with no metadata),
`render_paper` emits the document title plus a single line:
`_No supplementary metadata in this document._`

---

## Public API surface

### Rust (`crate netjson_diagrams`)

```rust
pub fn convert(netjson_json: &str, opts: &ConvertOptions) -> Result<String, String>;
pub fn convert_paper(netjson_json: &str) -> Result<String, String>;
pub fn convert_combined(netjson_json: &str, opts: &ConvertOptions) -> Result<String, String>;

#[derive(serde::Deserialize, Default)]
pub struct ConvertOptions {
    pub direction: DirectionOpt,
}

#[derive(serde::Deserialize, Default)]
#[serde(rename_all = "UPPERCASE")]
pub enum DirectionOpt { #[default] TD, LR }
```

`convert_paper` ignores `ConvertOptions` (the paper has no diagram direction).

PlantUML supports only `top to bottom` and `left to right` layout directives, so
the `Direction` enum is intentionally narrower than `elsa-to-mermaid`'s.

### WASM (`#[cfg(feature = "wasm")]`)

```rust
#[wasm_bindgen]
pub fn convert_to_plantuml(netjson_json: &str, options_json: &str) -> Result<String, JsValue>;

#[wasm_bindgen]
pub fn convert_to_paper(netjson_json: &str) -> Result<String, JsValue>;

#[wasm_bindgen]
pub fn convert_to_combined(netjson_json: &str, options_json: &str) -> Result<String, JsValue>;
```

### npm package (`netjson-diagrams`)

```ts
export type LabelResolver = (kind: 'node' | 'interface' | 'route', id: string) => string | undefined;

export interface ConvertOptions {
  direction?: 'TD' | 'LR';
  labelResolver?: LabelResolver;
}

export function netjsonToPlantuml(
  doc: string | object,
  options?: ConvertOptions
): Promise<string>;

export function netjsonToPaper(
  doc: string | object
): Promise<string>;

export function netjsonToCombined(
  doc: string | object,
  options?: ConvertOptions
): Promise<string>;
```

`labelResolver` runs as a string-replacement post-processing pass on the
PlantUML output. Returning `undefined` falls through to the default label.

### CLI (`netjson-diagrams`)

```text
netjson-diagrams [INPUT] [-o OUTPUT] [-d TD|LR]
                         [-f plantuml|paper|combined] [--paper] [--combined] [--fenced]
```

- `-f plantuml` (default) — raw PlantUML diagram.
- `-f paper` / `--paper` — Markdown paper only.
- `-f combined` / `--combined` — title + fenced PlantUML + per-section paper.
- `--fenced` wraps the PlantUML output in a ` ```plantuml ` block; ignored for
  non-plantuml formats.

`--paper`, `--combined`, and `--format` are mutually exclusive. Exits non-zero
with a stderr message on any parse or conversion error.

---

## Test fixtures

Canonical inputs live in [`tests/fixtures/`](tests/fixtures/) and are referenced
by both Rust integration tests and the Node smoke. Treat them as part of the
public contract — renaming or restructuring them is a behavior change.

- `network_graph_mesh.json` — minimal mesh: gateway + two APs, one link each
- `device_configuration_router.json` — OpenWRT-style router with eth/wlan/bridge
- `device_monitoring_router.json` — same shape, with statistics
- `network_routes_basic.json` — default route + connected route
- `network_collection_mixed.json` — one NetworkGraph + one DeviceConfiguration

---

## Constraints

- No HTTP, no network, no filesystem in the library.
- `serde_json` is the only JSON dependency. No jsonpath, no regex.
- Library code uses `Result` propagation everywhere; `unwrap()` is only
  acceptable in test code and the CLI's `main()` (after a user-facing error
  message).
- The WASM build is the same Rust core, gated behind `--features wasm`.
- Sprite includes are inert references — the library never fetches them at
  runtime; resolution happens in the PlantUML renderer (web/extension uses
  `plantuml-wasm`, CLI users supply their own `plantuml.jar`).

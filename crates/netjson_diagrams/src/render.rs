//! IR → PlantUML string. See `SPEC.md#render`.

use std::collections::BTreeSet;
use std::fmt::Write as _;

use crate::ir::*;
use crate::sprites::{sprite_for_interface, sprite_for_role, Sprite};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Direction {
    #[default]
    TopDown,
    LeftRight,
}

impl Direction {
    fn directive(self) -> &'static str {
        match self {
            Direction::TopDown => "top to bottom direction",
            Direction::LeftRight => "left to right direction",
        }
    }
}

#[derive(Debug, Clone, Copy, Default)]
pub struct RenderOptions {
    pub direction: Direction,
}

pub fn render(ir: &NetJsonIR, opts: &RenderOptions) -> String {
    match ir {
        NetJsonIR::Graph(g) => render_graph(g, opts),
        NetJsonIR::Config(c) => render_config(c, opts),
        NetJsonIR::Monitoring(m) => render_monitoring(m, opts),
        NetJsonIR::Routes(r) => render_routes(r, opts),
        NetJsonIR::Collection(c) => render_collection(c, opts),
    }
}

// ── Document builder ────────────────────────────────────────────────────────

struct Doc<'a> {
    opts: &'a RenderOptions,
    title: String,
    body: String,
    sprites: BTreeSet<Sprite>,
}

impl<'a> Doc<'a> {
    fn new(opts: &'a RenderOptions, title: String) -> Self {
        Self {
            opts,
            title,
            body: String::new(),
            sprites: BTreeSet::new(),
        }
    }

    fn use_sprite(&mut self, s: Sprite) {
        self.sprites.insert(s);
    }

    fn line(&mut self, line: &str) {
        self.body.push_str(line);
        self.body.push('\n');
    }

    fn blank(&mut self) {
        self.body.push('\n');
    }

    fn finish(self) -> String {
        let mut out = String::with_capacity(self.body.len() + 256);
        out.push_str("@startuml\n");
        for sprite in &self.sprites {
            let _ = writeln!(out, "!include <{}>", sprite.include);
        }
        if !self.sprites.is_empty() {
            out.push('\n');
        }
        let _ = writeln!(out, "{}", self.opts.direction.directive());
        let _ = writeln!(out, "title \"{}\"", escape_label(&self.title));
        out.push('\n');
        out.push_str(&self.body);
        if !self.body.ends_with('\n') {
            out.push('\n');
        }
        out.push_str("@enduml\n");
        out
    }
}

// ── NetworkGraph ────────────────────────────────────────────────────────────

// A NetworkGraph renders as a **C4 Container diagram** (C4-PlantUML stdlib, included offline
// via `<C4/C4_Container>`). Nodes become Containers — `ContainerDb` for directories, `ContainerQueue`
// for buses — grouped into a `System_Boundary` per their `domain` property; links become `Rel` with
// the cost_text label and the `protocol` property as the technology. See SPEC.md#networkgraph.
fn render_graph(ir: &GraphIR, opts: &RenderOptions) -> String {
    let title = ir.label.clone().unwrap_or_else(|| "NetworkGraph".into());
    let mut out = String::new();
    out.push_str("@startuml\n");
    out.push_str("!include <C4/C4_Container>\n\n");
    let _ = writeln!(out, "{}", opts.direction.directive());
    out.push_str("LAYOUT_WITH_LEGEND()\n");
    let _ = writeln!(out, "title \"{}\"", escape_label(&title));
    out.push('\n');

    // Group nodes into a System_Boundary per `domain`, preserving first-seen order.
    let mut domain_order: Vec<&str> = Vec::new();
    for node in &ir.nodes {
        if let Some(dom) = node_domain(node) {
            if !domain_order.contains(&dom) {
                domain_order.push(dom);
            }
        }
    }
    for dom in &domain_order {
        let _ = writeln!(
            out,
            "System_Boundary({}, \"{}\") {{",
            plant_id(dom),
            escape_label(&humanize(dom))
        );
        for node in ir.nodes.iter().filter(|n| node_domain(n) == Some(*dom)) {
            let _ = writeln!(out, "    {}", c4_container_line(node));
        }
        out.push_str("}\n");
    }
    // Nodes without a domain sit at the top level.
    for node in ir.nodes.iter().filter(|n| node_domain(n).is_none()) {
        let _ = writeln!(out, "{}", c4_container_line(node));
    }

    if !ir.links.is_empty() {
        out.push('\n');
    }
    for link in &ir.links {
        let src = plant_id(&link.source);
        let tgt = plant_id(&link.target);
        let label = link
            .cost_text
            .clone()
            .or_else(|| link.cost.map(format_cost))
            .unwrap_or_default();
        let tech = link
            .properties
            .get("protocol")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if tech.is_empty() {
            let _ = writeln!(out, "Rel({src}, {tgt}, \"{}\")", escape_label(&label));
        } else {
            let _ = writeln!(
                out,
                "Rel({src}, {tgt}, \"{}\", \"{}\")",
                escape_label(&label),
                escape_label(tech)
            );
        }
    }

    out.push_str("@enduml\n");
    out
}

fn node_domain(node: &GraphNode) -> Option<&str> {
    node.properties.get("domain").and_then(|v| v.as_str())
}

/// The C4 element line for a node. Technology = the node's `role` (+ `standards`); description =
/// the remaining string properties joined as "key: value".
fn c4_container_line(node: &GraphNode) -> String {
    let id = plant_id(&node.id);
    let label = node.label.clone().unwrap_or_else(|| node.id.clone());
    let role = node
        .properties
        .get("role")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let macro_name = c4_macro_for_role(role);

    let mut tech = humanize(role);
    if let Some(std) = node.properties.get("standards").and_then(|v| v.as_str()) {
        tech = if tech.is_empty() {
            std.to_string()
        } else {
            format!("{tech} · {std}")
        };
    }

    let desc = c4_description(node);
    if desc.is_empty() {
        format!(
            "{macro_name}({id}, \"{}\", \"{}\")",
            escape_label(&label),
            escape_label(&tech)
        )
    } else {
        format!(
            "{macro_name}({id}, \"{}\", \"{}\", \"{}\")",
            escape_label(&label),
            escape_label(&tech),
            escape_label(&desc)
        )
    }
}

fn c4_macro_for_role(role: &str) -> &'static str {
    let r = role.to_ascii_lowercase();
    if r.contains("director") || r.contains("ldap") || r == "db" || r == "database" {
        "ContainerDb"
    } else if r.contains("bus") || r.contains("queue") || r.contains("mq") || r.contains("broker") {
        "ContainerQueue"
    } else {
        "Container"
    }
}

/// All string properties except role/domain/standards, joined as "key: value".
fn c4_description(node: &GraphNode) -> String {
    node.properties
        .iter()
        .filter(|(k, _)| !matches!(k.as_str(), "role" | "domain" | "standards"))
        .filter_map(|(k, v)| v.as_str().map(|s| format!("{k}: {s}")))
        .collect::<Vec<_>>()
        .join("; ")
}

/// Humanize a role/domain key: short acronyms (≤4 chars, no separator) upper-cased; else Title Case.
fn humanize(s: &str) -> String {
    if s.is_empty() {
        return String::new();
    }
    if s.len() <= 4 && !s.contains('-') && !s.contains('_') {
        return s.to_ascii_uppercase();
    }
    s.split(|c| c == '-' || c == '_')
        .map(|w| {
            let mut ch = w.chars();
            match ch.next() {
                Some(f) => f.to_uppercase().collect::<String>() + ch.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

// ── DeviceConfiguration ─────────────────────────────────────────────────────

fn render_config(ir: &ConfigIR, opts: &RenderOptions) -> String {
    let hostname_label = ir.hostname.clone().unwrap_or_else(|| "device".into());
    let title = format!("Device · {hostname_label}");
    let mut doc = Doc::new(opts, title);

    doc.line(&format!(
        "node \"Device · {}\" as device {{",
        escape_label(&hostname_label)
    ));
    for iface in &ir.interfaces {
        let sprite = sprite_for_interface(iface.kind);
        doc.use_sprite(sprite);
        let id = plant_iface_id(&iface.name);
        doc.line(&format!(
            "    component \"{}\" as {} <<${}>>",
            escape_label(&iface.name),
            id,
            sprite.name
        ));
    }
    doc.line("}");

    let has_radios = !ir.radios.is_empty();
    let has_iface_links = ir
        .interfaces
        .iter()
        .any(|i| !i.bridge_members.is_empty() || i.wireless.as_ref().and_then(|w| w.radio.as_ref()).is_some());

    if has_radios || has_iface_links {
        doc.blank();
    }

    for radio in &ir.radios {
        let sprite = sprite_for_interface(InterfaceKind::Wireless);
        doc.use_sprite(sprite);
        let id = plant_radio_id(&radio.name);
        doc.line(&format!(
            "component \"Radio {}\" as {} <<${}>>",
            escape_label(&radio.name),
            id,
            sprite.name
        ));
    }

    if has_radios && (has_iface_links || !ir.interfaces.is_empty()) {
        doc.blank();
    }

    // Bridge members → iface ..> iface
    for iface in &ir.interfaces {
        if !iface.bridge_members.is_empty() {
            let bridge_id = plant_iface_id(&iface.name);
            for member in &iface.bridge_members {
                let member_id = plant_iface_id(member);
                doc.line(&format!("{bridge_id} ..> {member_id}"));
            }
        }
    }

    // Wireless interface → radio
    for iface in &ir.interfaces {
        if let Some(wireless) = &iface.wireless {
            if let Some(radio) = &wireless.radio {
                let iface_id = plant_iface_id(&iface.name);
                let radio_id = plant_radio_id(radio);
                doc.line(&format!("{iface_id} ..> {radio_id}"));
            }
        }
    }

    // Device → radio (associate orphan radios with the device)
    for radio in &ir.radios {
        let radio_id = plant_radio_id(&radio.name);
        doc.line(&format!("device .. {radio_id}"));
    }

    doc.finish()
}

// ── DeviceMonitoring ────────────────────────────────────────────────────────

fn render_monitoring(ir: &MonitoringIR, opts: &RenderOptions) -> String {
    let hostname_label = ir.hostname.clone().unwrap_or_else(|| "device".into());
    let title = format!("Monitoring · {hostname_label}");
    let mut doc = Doc::new(opts, title);

    doc.line(&format!(
        "node \"Device · {}\" as device {{",
        escape_label(&hostname_label)
    ));
    for iface in &ir.interfaces {
        let sprite = sprite_for_interface(iface.kind);
        doc.use_sprite(sprite);
        let id = plant_iface_id(&iface.name);
        doc.line(&format!(
            "    component \"{}\" as {} <<${}>>",
            escape_label(&iface.name),
            id,
            sprite.name
        ));
    }
    doc.line("}");

    // Stat notes — emitted *after* the device block so they bind correctly.
    let mut emitted_any_note = false;
    for iface in &ir.interfaces {
        let Some(stats) = &iface.statistics else { continue };
        let rx = stats.get("rx_bytes").and_then(|v| v.as_u64());
        let tx = stats.get("tx_bytes").and_then(|v| v.as_u64());
        if rx.is_none() && tx.is_none() {
            continue;
        }
        if !emitted_any_note {
            doc.blank();
            emitted_any_note = true;
        }
        let id = plant_iface_id(&iface.name);
        doc.line(&format!("note right of {id}"));
        if let Some(rx) = rx {
            doc.line(&format!("  rx {}", human_bytes(rx)));
        }
        if let Some(tx) = tx {
            doc.line(&format!("  tx {}", human_bytes(tx)));
        }
        doc.line("end note");
    }

    doc.finish()
}

// ── NetworkRoutes ───────────────────────────────────────────────────────────

fn render_routes(ir: &RoutesIR, opts: &RenderOptions) -> String {
    let router_label = ir
        .router_id
        .clone()
        .unwrap_or_else(|| "Unknown".to_string());
    let title = format!("Routes for {router_label}");
    let mut doc = Doc::new(opts, title);

    let router_sprite = sprite_for_role(NodeRole::Router);
    doc.use_sprite(router_sprite);
    doc.line(&format!(
        "node \"Router {}\" as router <<${}>>",
        escape_label(&router_label),
        router_sprite.name
    ));

    // One cloud per unique destination — preserve route order.
    let cloud_sprite = sprite_for_role(NodeRole::Internet);
    let mut seen_destinations: BTreeSet<String> = BTreeSet::new();
    for route in &ir.routes {
        if seen_destinations.insert(route.destination.clone()) {
            doc.use_sprite(cloud_sprite);
            let id = plant_dest_id(&route.destination);
            doc.line(&format!(
                "cloud \"{}\" as {} <<${}>>",
                escape_label(&route.destination),
                id,
                cloud_sprite.name
            ));
        }
    }

    if !ir.routes.is_empty() {
        doc.blank();
    }

    for route in &ir.routes {
        let id = plant_dest_id(&route.destination);
        let label = route_arrow_label(route);
        match label {
            Some(text) => doc.line(&format!("router --> {id} : \"{text}\"")),
            None => doc.line(&format!("router --> {id}")),
        }
    }

    doc.finish()
}

fn route_arrow_label(route: &RouteIR) -> Option<String> {
    let mut parts: Vec<String> = Vec::new();
    if let Some(next) = &route.next {
        parts.push(format!("via {next}"));
    }
    if let Some(device) = &route.device {
        parts.push(format!("({device})"));
    }
    if let Some(cost) = route.cost {
        parts.push(format!("cost {}", format_cost(cost)));
    }
    if parts.is_empty() {
        None
    } else {
        Some(escape_label(&parts.join(" ")))
    }
}

// ── NetworkCollection ───────────────────────────────────────────────────────

fn render_collection(ir: &CollectionIR, opts: &RenderOptions) -> String {
    if ir.members.is_empty() {
        // Empty collection — emit an empty stub so consumers always get a
        // valid PlantUML document.
        let doc = Doc::new(opts, "NetworkCollection (empty)".to_string());
        return doc.finish();
    }
    let parts: Vec<String> = ir.members.iter().map(|m| render(m, opts)).collect();
    // Join with a blank line. Each child already ends with `\n` after `@enduml`.
    parts.join("\n")
}

// ── Formatting helpers ──────────────────────────────────────────────────────

/// PlantUML id sanitization. See `SPEC.md#id-sanitization`.
/// Replaces every non-`[A-Za-z0-9_]` character with `_`, and prepends `n_`
/// when the result would start with a digit (PlantUML ids can't lead with one).
pub fn plant_id(raw: &str) -> String {
    let mut s = sanitize_chars(raw);
    if s.is_empty() {
        return "n_unknown".to_string();
    }
    if s.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
        s.insert_str(0, "n_");
    }
    s
}

fn sanitize_chars(raw: &str) -> String {
    raw.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' { c } else { '_' })
        .collect()
}

// Prefixed forms — the prefix already supplies a leading letter, so the
// inner segment skips the `n_` digit guard.
fn plant_iface_id(name: &str) -> String {
    format!("iface_{}", sanitize_chars(name))
}

fn plant_radio_id(name: &str) -> String {
    format!("radio_{}", sanitize_chars(name))
}

fn plant_dest_id(destination: &str) -> String {
    format!("dest_{}", sanitize_chars(destination))
}

/// Escape a label for inclusion inside a PlantUML `"…"` literal.
/// See `SPEC.md#label-escaping`.
pub fn escape_label(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            _ => out.push(c),
        }
    }
    out
}

/// Format a cost as a string: drops trailing `.0` for integer-valued floats,
/// otherwise prints with up to 2 decimals.
fn format_cost(cost: f64) -> String {
    if cost.fract() == 0.0 && cost.is_finite() {
        format!("{}", cost as i64)
    } else {
        // Trim trailing zeros: 1.50 → "1.5", 1.25 → "1.25".
        let formatted = format!("{cost:.2}");
        let trimmed = formatted
            .trim_end_matches('0')
            .trim_end_matches('.')
            .to_string();
        if trimmed.is_empty() {
            "0".to_string()
        } else {
            trimmed
        }
    }
}

/// Format a byte count as `1.0 KB`, `1.0 MB`, etc.
fn human_bytes(n: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB", "PB"];
    let mut v = n as f64;
    let mut idx = 0;
    while v >= 1024.0 && idx < UNITS.len() - 1 {
        v /= 1024.0;
        idx += 1;
    }
    if idx == 0 {
        format!("{n} B")
    } else {
        format!("{v:.1} {}", UNITS[idx])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plant_id_basic() {
        assert_eq!(plant_id("10.0.0.1"), "n_10_0_0_1");
        assert_eq!(plant_id("router-01"), "router_01");
        assert_eq!(plant_id("eth0"), "eth0");
        assert_eq!(plant_id(""), "n_unknown");
        assert_eq!(plant_id("0.0.0.0/0"), "n_0_0_0_0_0");
    }

    #[test]
    fn escape_label_basic() {
        assert_eq!(escape_label("hi"), "hi");
        assert_eq!(escape_label("a\"b"), "a\\\"b");
        assert_eq!(escape_label("a\\b"), "a\\\\b");
    }

    #[test]
    fn format_cost_basic() {
        assert_eq!(format_cost(1.0), "1");
        assert_eq!(format_cost(1.5), "1.5");
        assert_eq!(format_cost(2.25), "2.25");
        assert_eq!(format_cost(0.0), "0");
    }

    #[test]
    fn human_bytes_basic() {
        assert_eq!(human_bytes(0), "0 B");
        assert_eq!(human_bytes(512), "512 B");
        assert_eq!(human_bytes(1024), "1.0 KB");
        assert_eq!(human_bytes(1024 * 1024), "1.0 MB");
        assert_eq!(human_bytes(1_048_576_000), "1000.0 MB");
        assert_eq!(human_bytes(1_073_741_824), "1.0 GB");
    }
}

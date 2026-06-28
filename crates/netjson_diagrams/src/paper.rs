//! IR → Markdown paper. See `SPEC.md#paper`.
//!
//! Rule: a field appears in **exactly one** of `{ diagram, paper }`. The
//! diagram renders the *shape* (nodes, links, devices, interfaces); the
//! paper renders the metadata that doesn't shape well.

use std::fmt::Write as _;

use crate::ir::*;
use serde_json::Value;

pub fn render_paper(ir: &NetJsonIR) -> String {
    match ir {
        NetJsonIR::Graph(g) => paper_graph(g),
        NetJsonIR::Config(c) => paper_config(c),
        NetJsonIR::Monitoring(m) => paper_monitoring(m),
        NetJsonIR::Routes(r) => paper_routes(r),
        NetJsonIR::Collection(c) => paper_collection(c),
    }
}

pub fn render_combined(ir: &NetJsonIR, plantuml: &str) -> String {
    let paper = render_paper(ir);
    let mut out = String::new();
    let mut lines = paper.lines();
    if let Some(title_line) = lines.next() {
        out.push_str(title_line);
        out.push_str("\n\n");
    }
    out.push_str("## Diagram\n\n");
    out.push_str("```plantuml\n");
    out.push_str(plantuml);
    if !plantuml.ends_with('\n') {
        out.push('\n');
    }
    out.push_str("```\n\n");
    out.push_str("## Paper\n\n");
    for line in lines {
        if line.starts_with("# ") {
            // Skip duplicated title in nested papers (NetworkCollection case).
            continue;
        }
        out.push_str(line);
        out.push('\n');
    }
    out
}

// ── NetworkGraph ────────────────────────────────────────────────────────────

fn paper_graph(g: &GraphIR) -> String {
    let title = g.label.clone().unwrap_or_else(|| "NetworkGraph".into());
    let mut out = String::new();
    let _ = writeln!(out, "# {title}");
    out.push('\n');

    let chips = graph_chips(g);
    if !chips.is_empty() {
        let _ = writeln!(out, "**Type:** `NetworkGraph` · {}", chips.join(" · "));
        out.push('\n');
    } else {
        let _ = writeln!(out, "**Type:** `NetworkGraph`");
        out.push('\n');
    }

    // Per-node properties not represented by the icon classification.
    let mut any_node_section = false;
    for node in &g.nodes {
        let interesting: Vec<(&String, &Value)> = node
            .properties
            .iter()
            .filter(|(k, _)| k.as_str() != "role" && k.as_str() != "kind" && k.as_str() != "device_type")
            .collect();
        let has_addresses = !node.local_addresses.is_empty();
        if interesting.is_empty() && !has_addresses {
            continue;
        }
        if !any_node_section {
            out.push_str("<!-- netjson-section: nodes -->\n");
            out.push_str("## Node metadata\n\n");
            any_node_section = true;
        }
        let heading = node.label.clone().unwrap_or_else(|| node.id.clone());
        let _ = writeln!(out, "### {heading}");
        let _ = writeln!(out, "_id:_ `{}`", node.id);
        if has_addresses {
            let _ = writeln!(
                out,
                "- **Local addresses:** {}",
                node.local_addresses
                    .iter()
                    .map(|a| format!("`{a}`"))
                    .collect::<Vec<_>>()
                    .join(", ")
            );
        }
        for (k, v) in interesting {
            let _ = writeln!(out, "- **{k}:** {}", format_value_inline(v));
        }
        out.push('\n');
    }

    if !any_node_section && chips.is_empty() {
        out.push_str("_No supplementary metadata in this document._\n");
    }

    out
}

fn graph_chips(g: &GraphIR) -> Vec<String> {
    let mut chips = Vec::new();
    if let Some(p) = &g.protocol {
        chips.push(format!("**Protocol:** `{p}`"));
    }
    if let Some(v) = &g.version {
        chips.push(format!("**Version:** `{v}`"));
    }
    if let Some(m) = &g.metric {
        chips.push(format!("**Metric:** `{m}`"));
    }
    if let Some(r) = &g.router_id {
        chips.push(format!("**Router id:** `{r}`"));
    }
    if let Some(t) = &g.topology_id {
        chips.push(format!("**Topology id:** `{t}`"));
    }
    chips
}

// ── DeviceConfiguration ─────────────────────────────────────────────────────

fn paper_config(c: &ConfigIR) -> String {
    let title = c
        .hostname
        .clone()
        .unwrap_or_else(|| "DeviceConfiguration".into());
    let mut out = String::new();
    let _ = writeln!(out, "# {title}");
    out.push('\n');
    let _ = writeln!(out, "**Type:** `DeviceConfiguration`");
    out.push('\n');

    if !c.general.is_empty() {
        out.push_str("<!-- netjson-section: general -->\n");
        out.push_str("## General\n\n");
        for (k, v) in &c.general {
            let _ = writeln!(out, "- **{k}:** {}", format_value_inline(v));
        }
        out.push('\n');
    }

    if !c.dns_servers.is_empty() || !c.dns_search.is_empty() {
        out.push_str("<!-- netjson-section: dns -->\n");
        out.push_str("## DNS\n\n");
        if !c.dns_servers.is_empty() {
            let _ = writeln!(
                out,
                "- **Servers:** {}",
                c.dns_servers
                    .iter()
                    .map(|s| format!("`{s}`"))
                    .collect::<Vec<_>>()
                    .join(", ")
            );
        }
        if !c.dns_search.is_empty() {
            let _ = writeln!(
                out,
                "- **Search:** {}",
                c.dns_search
                    .iter()
                    .map(|s| format!("`{s}`"))
                    .collect::<Vec<_>>()
                    .join(", ")
            );
        }
        out.push('\n');
    }

    if !c.interfaces.is_empty() {
        out.push_str("<!-- netjson-section: interfaces -->\n");
        out.push_str("## Interfaces\n\n");
        for iface in &c.interfaces {
            paper_interface(&mut out, iface);
        }
    }

    if !c.radios.is_empty() {
        out.push_str("<!-- netjson-section: radios -->\n");
        out.push_str("## Radios\n\n");
        for radio in &c.radios {
            paper_radio(&mut out, radio);
        }
    }

    out
}

fn paper_interface(out: &mut String, iface: &InterfaceIR) {
    let _ = writeln!(out, "### {} _({:?})_", iface.name, iface.kind);
    if let Some(mac) = &iface.mac {
        let _ = writeln!(out, "- **MAC:** `{mac}`");
    }
    if let Some(mtu) = iface.mtu {
        let _ = writeln!(out, "- **MTU:** `{mtu}`");
    }
    if let Some(autostart) = iface.autostart {
        let _ = writeln!(out, "- **Autostart:** `{autostart}`");
    }
    if !iface.addresses.is_empty() {
        out.push_str("- **Addresses:**\n");
        for addr in &iface.addresses {
            let mask = addr
                .mask
                .map(|m| format!("/{m}"))
                .unwrap_or_default();
            let family = addr
                .family
                .clone()
                .map(|f| format!(" ({f})"))
                .unwrap_or_default();
            let proto = addr
                .proto
                .clone()
                .map(|p| format!(" via {p}"))
                .unwrap_or_default();
            let _ = writeln!(out, "    - `{}{}`{}{}", addr.address, mask, family, proto);
        }
    }
    if let Some(wireless) = &iface.wireless {
        if let Some(mode) = &wireless.mode {
            let _ = writeln!(out, "- **Wireless mode:** `{mode}`");
        }
        if let Some(ssid) = &wireless.ssid {
            let _ = writeln!(out, "- **SSID:** `{ssid}`");
        }
        if let Some(encryption) = &wireless.encryption {
            let _ = writeln!(
                out,
                "- **Encryption:** {}",
                format_value_inline(encryption)
            );
        }
    }
    if !iface.bridge_members.is_empty() {
        let _ = writeln!(
            out,
            "- **Bridge members:** {}",
            iface
                .bridge_members
                .iter()
                .map(|m| format!("`{m}`"))
                .collect::<Vec<_>>()
                .join(", ")
        );
    }
    for (k, v) in &iface.extras {
        let _ = writeln!(out, "- **{k}:** {}", format_value_inline(v));
    }
    out.push('\n');
}

fn paper_radio(out: &mut String, radio: &RadioIR) {
    let _ = writeln!(out, "### {}", radio.name);
    if let Some(p) = &radio.protocol {
        let _ = writeln!(out, "- **Protocol:** `{p}`");
    }
    if let Some(c) = radio.channel {
        let _ = writeln!(out, "- **Channel:** `{c}`");
    }
    if let Some(w) = radio.channel_width {
        let _ = writeln!(out, "- **Channel width:** `{w}` MHz");
    }
    if let Some(p) = radio.tx_power {
        let _ = writeln!(out, "- **TX power:** `{p}` dBm");
    }
    if let Some(c) = &radio.country {
        let _ = writeln!(out, "- **Country:** `{c}`");
    }
    if let Some(d) = radio.disabled {
        let _ = writeln!(out, "- **Disabled:** `{d}`");
    }
    out.push('\n');
}

// ── DeviceMonitoring ────────────────────────────────────────────────────────

fn paper_monitoring(m: &MonitoringIR) -> String {
    let title = m
        .hostname
        .clone()
        .unwrap_or_else(|| "DeviceMonitoring".into());
    let mut out = String::new();
    let _ = writeln!(out, "# {title}");
    out.push('\n');
    let _ = writeln!(out, "**Type:** `DeviceMonitoring`");
    out.push('\n');

    if m.local_time.is_some() || m.uptime.is_some() || !m.general.is_empty() {
        out.push_str("<!-- netjson-section: general -->\n");
        out.push_str("## General\n\n");
        if let Some(t) = m.local_time {
            let _ = writeln!(out, "- **Local time:** `{t}` (epoch)");
        }
        if let Some(u) = m.uptime {
            let _ = writeln!(out, "- **Uptime:** `{u}` s");
        }
        for (k, v) in &m.general {
            let _ = writeln!(out, "- **{k}:** {}", format_value_inline(v));
        }
        out.push('\n');
    }

    if let Some(resources) = &m.resources {
        out.push_str("<!-- netjson-section: resources -->\n");
        out.push_str("## Resources\n\n");
        out.push_str("```json\n");
        out.push_str(
            &serde_json::to_string_pretty(resources)
                .unwrap_or_else(|_| resources.to_string()),
        );
        out.push_str("\n```\n\n");
    }

    if !m.interfaces.is_empty() {
        out.push_str("<!-- netjson-section: statistics -->\n");
        out.push_str("## Interface statistics\n\n");
        for iface in &m.interfaces {
            let _ = writeln!(out, "### {} _({:?})_", iface.name, iface.kind);
            if let Some(up) = iface.up {
                let _ = writeln!(out, "- **Up:** `{up}`");
            }
            if let Some(mac) = &iface.mac {
                let _ = writeln!(out, "- **MAC:** `{mac}`");
            }
            if let Some(stats) = &iface.statistics {
                out.push_str("- **Statistics:**\n\n```json\n");
                out.push_str(
                    &serde_json::to_string_pretty(stats)
                        .unwrap_or_else(|_| stats.to_string()),
                );
                out.push_str("\n```\n");
            }
            out.push('\n');
        }
    }

    out
}

// ── NetworkRoutes ───────────────────────────────────────────────────────────

fn paper_routes(r: &RoutesIR) -> String {
    let title = r
        .router_id
        .as_ref()
        .map(|id| format!("Routes for {id}"))
        .unwrap_or_else(|| "NetworkRoutes".into());
    let mut out = String::new();
    let _ = writeln!(out, "# {title}");
    out.push('\n');
    let chip = match &r.router_id {
        Some(id) => format!("**Type:** `NetworkRoutes` · **Router id:** `{id}`"),
        None => "**Type:** `NetworkRoutes`".to_string(),
    };
    let _ = writeln!(out, "{chip}");
    out.push('\n');

    if !r.routes.is_empty() {
        out.push_str("<!-- netjson-section: routes -->\n");
        out.push_str("## Routes\n\n");
        out.push_str("| Destination | Next hop | Device | Cost | Source |\n");
        out.push_str("|-------------|----------|--------|------|--------|\n");
        for route in &r.routes {
            let _ = writeln!(
                out,
                "| `{}` | {} | {} | {} | {} |",
                route.destination,
                route
                    .next
                    .as_ref()
                    .map(|s| format!("`{s}`"))
                    .unwrap_or_else(|| "—".into()),
                route
                    .device
                    .as_ref()
                    .map(|s| format!("`{s}`"))
                    .unwrap_or_else(|| "—".into()),
                route
                    .cost
                    .map(|c| format!("`{}`", format_cost_paper(c)))
                    .unwrap_or_else(|| "—".into()),
                route
                    .source
                    .as_ref()
                    .map(|s| format!("`{s}`"))
                    .unwrap_or_else(|| "—".into()),
            );
        }
        out.push('\n');
    }

    out
}

// ── NetworkCollection ───────────────────────────────────────────────────────

fn paper_collection(c: &CollectionIR) -> String {
    let mut out = String::new();
    let _ = writeln!(out, "# NetworkCollection");
    out.push('\n');
    let _ = writeln!(
        out,
        "**Type:** `NetworkCollection` · **Members:** `{}`",
        c.members.len()
    );
    out.push('\n');

    if c.members.is_empty() {
        out.push_str("_No supplementary metadata in this document._\n");
        return out;
    }

    for (i, member) in c.members.iter().enumerate() {
        let anchor = format!("member-{}", i + 1);
        let _ = writeln!(out, "<!-- netjson-section: {anchor} -->");
        let _ = writeln!(out, "## Member {}", i + 1);
        out.push('\n');
        // Inline each child's paper, shifting headings down a level.
        let child = render_paper(member);
        for line in child.lines() {
            if let Some(stripped) = line.strip_prefix("# ") {
                let _ = writeln!(out, "### {stripped}");
            } else if let Some(stripped) = line.strip_prefix("## ") {
                let _ = writeln!(out, "#### {stripped}");
            } else if let Some(stripped) = line.strip_prefix("### ") {
                let _ = writeln!(out, "##### {stripped}");
            } else {
                out.push_str(line);
                out.push('\n');
            }
        }
        out.push('\n');
    }
    out
}

// ── value formatting ────────────────────────────────────────────────────────

fn format_value_inline(value: &Value) -> String {
    match value {
        Value::Null => "_(unset)_".to_string(),
        Value::Bool(b) => format!("`{b}`"),
        Value::Number(n) => format!("`{n}`"),
        Value::String(s) if s.is_empty() => "_(empty string)_".to_string(),
        Value::String(s) if s.contains('\n') => format!("\n\n```\n{s}\n```\n"),
        Value::String(s) => format!("`{s}`"),
        Value::Array(arr) => {
            if arr.len() > 5 {
                let pretty = serde_json::to_string_pretty(value)
                    .unwrap_or_else(|_| value.to_string());
                format!("\n\n```json\n{pretty}\n```\n")
            } else {
                arr.iter()
                    .map(format_value_inline)
                    .collect::<Vec<_>>()
                    .join(", ")
            }
        }
        Value::Object(_) => {
            let pretty =
                serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string());
            format!("\n\n```json\n{pretty}\n```\n")
        }
    }
}

fn format_cost_paper(cost: f64) -> String {
    if cost.fract() == 0.0 && cost.is_finite() {
        format!("{}", cost as i64)
    } else {
        format!("{cost}")
    }
}

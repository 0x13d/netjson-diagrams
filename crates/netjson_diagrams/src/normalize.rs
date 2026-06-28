//! JSON → IR. See `SPEC.md#normalization`.

use crate::detect::NetJsonKind;
use crate::ir::*;
use crate::label::{classify_interface_kind, classify_role};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

pub fn normalize(json: &Value, kind: NetJsonKind) -> Result<NetJsonIR, String> {
    match kind {
        NetJsonKind::NetworkGraph => normalize_graph(json).map(NetJsonIR::Graph),
        NetJsonKind::DeviceConfiguration => normalize_config(json).map(NetJsonIR::Config),
        NetJsonKind::DeviceMonitoring => normalize_monitoring(json).map(NetJsonIR::Monitoring),
        NetJsonKind::NetworkRoutes => normalize_routes(json).map(NetJsonIR::Routes),
        NetJsonKind::NetworkCollection => normalize_collection(json).map(NetJsonIR::Collection),
    }
}

// ── NetworkGraph ────────────────────────────────────────────────────────────

fn normalize_graph(json: &Value) -> Result<GraphIR, String> {
    let mut ir = GraphIR::default();
    ir.label = as_string(json, "label");
    ir.protocol = as_string(json, "protocol");
    ir.version = as_string(json, "version");
    ir.metric = as_string(json, "metric");
    ir.router_id = as_string(json, "router_id");
    ir.topology_id = as_string(json, "topology_id");

    if let Some(nodes) = json.get("nodes").and_then(Value::as_array) {
        for node in nodes {
            ir.nodes.push(normalize_graph_node(node)?);
        }
    }
    if let Some(links) = json.get("links").and_then(Value::as_array) {
        for link in links {
            if let Some(l) = normalize_graph_link(link) {
                ir.links.push(l);
            }
        }
    }
    Ok(ir)
}

fn normalize_graph_node(node: &Value) -> Result<GraphNode, String> {
    let id = node
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "NetworkGraph node is missing required `id` field".to_string())?
        .to_string();
    let label = as_string(node, "label");
    let local_addresses = as_string_array(node, "local_addresses");
    let properties = node
        .get("properties")
        .and_then(Value::as_object)
        .map(object_to_btree)
        .unwrap_or_default();
    let role = classify_role(label.as_deref(), &properties);
    Ok(GraphNode {
        id,
        label,
        role,
        local_addresses,
        properties,
    })
}

fn normalize_graph_link(link: &Value) -> Option<GraphLink> {
    let source = link.get("source").and_then(Value::as_str)?.to_string();
    let target = link.get("target").and_then(Value::as_str)?.to_string();
    let cost = link.get("cost").and_then(Value::as_f64);
    let cost_text = as_string(link, "cost_text");
    let properties = link
        .get("properties")
        .and_then(Value::as_object)
        .map(object_to_btree)
        .unwrap_or_default();
    Some(GraphLink {
        source,
        target,
        cost,
        cost_text,
        properties,
    })
}

// ── DeviceConfiguration ─────────────────────────────────────────────────────

fn normalize_config(json: &Value) -> Result<ConfigIR, String> {
    let mut ir = ConfigIR::default();
    if let Some(general) = json.get("general").and_then(Value::as_object) {
        let mut general_map = object_to_btree(general);
        ir.hostname = general_map
            .remove("hostname")
            .and_then(|v| v.as_str().map(str::to_string));
        ir.general = general_map;
    }
    if let Some(interfaces) = json.get("interfaces").and_then(Value::as_array) {
        for iface in interfaces {
            if let Some(i) = normalize_interface(iface)? {
                ir.interfaces.push(i);
            }
        }
    }
    if let Some(radios) = json.get("radios").and_then(Value::as_array) {
        for radio in radios {
            if let Some(r) = normalize_radio(radio) {
                ir.radios.push(r);
            }
        }
    }
    ir.dns_servers = as_string_array(json, "dns_servers");
    ir.dns_search = as_string_array(json, "dns_search");
    Ok(ir)
}

const IFACE_KNOWN_KEYS: &[&str] = &[
    "name",
    "type",
    "mac",
    "mtu",
    "autostart",
    "addresses",
    "wireless",
    "bridge_members",
];

fn normalize_interface(iface: &Value) -> Result<Option<InterfaceIR>, String> {
    let Some(obj) = iface.as_object() else {
        return Ok(None);
    };
    let Some(name) = obj.get("name").and_then(Value::as_str).map(str::to_string) else {
        return Err("DeviceConfiguration interface is missing `name`".to_string());
    };
    let kind = classify_interface_kind(obj.get("type").and_then(Value::as_str));
    let mac = obj.get("mac").and_then(Value::as_str).map(str::to_string);
    let mtu = obj.get("mtu").and_then(Value::as_u64).map(|v| v as u32);
    let autostart = obj.get("autostart").and_then(Value::as_bool);
    let addresses = obj
        .get("addresses")
        .and_then(Value::as_array)
        .map(|arr| arr.iter().filter_map(normalize_address).collect())
        .unwrap_or_default();
    let wireless = if matches!(kind, InterfaceKind::Wireless) {
        obj.get("wireless").map(normalize_wireless)
    } else {
        None
    };
    let bridge_members = if matches!(kind, InterfaceKind::Bridge) {
        obj.get("bridge_members")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    let mut extras = BTreeMap::new();
    for (key, value) in obj {
        if !IFACE_KNOWN_KEYS.contains(&key.as_str()) {
            extras.insert(key.clone(), value.clone());
        }
    }
    Ok(Some(InterfaceIR {
        name,
        kind,
        mac,
        mtu,
        autostart,
        addresses,
        wireless,
        bridge_members,
        extras,
    }))
}

fn normalize_address(addr: &Value) -> Option<AddressIR> {
    let obj = addr.as_object()?;
    let address = obj.get("address").and_then(Value::as_str)?.to_string();
    Some(AddressIR {
        address,
        mask: obj.get("mask").and_then(Value::as_u64).map(|v| v as u8),
        family: obj.get("family").and_then(Value::as_str).map(str::to_string),
        proto: obj.get("proto").and_then(Value::as_str).map(str::to_string),
    })
}

fn normalize_wireless(w: &Value) -> WirelessIR {
    WirelessIR {
        radio: as_string(w, "radio"),
        mode: as_string(w, "mode"),
        ssid: as_string(w, "ssid"),
        encryption: w.get("encryption").cloned(),
    }
}

fn normalize_radio(radio: &Value) -> Option<RadioIR> {
    let obj = radio.as_object()?;
    let name = obj.get("name").and_then(Value::as_str)?.to_string();
    Some(RadioIR {
        name,
        protocol: obj.get("protocol").and_then(Value::as_str).map(str::to_string),
        channel: obj.get("channel").and_then(Value::as_u64).map(|v| v as u32),
        channel_width: obj
            .get("channel_width")
            .and_then(Value::as_u64)
            .map(|v| v as u32),
        tx_power: obj.get("tx_power").and_then(Value::as_i64).map(|v| v as i32),
        country: obj.get("country").and_then(Value::as_str).map(str::to_string),
        disabled: obj.get("disabled").and_then(Value::as_bool),
    })
}

// ── DeviceMonitoring ────────────────────────────────────────────────────────

fn normalize_monitoring(json: &Value) -> Result<MonitoringIR, String> {
    let mut ir = MonitoringIR::default();
    if let Some(general) = json.get("general").and_then(Value::as_object) {
        let mut general_map = object_to_btree(general);
        ir.hostname = general_map
            .remove("hostname")
            .and_then(|v| v.as_str().map(str::to_string));
        ir.local_time = general_map
            .remove("local_time")
            .and_then(|v| v.as_i64());
        ir.uptime = general_map.remove("uptime").and_then(|v| v.as_i64());
        ir.general = general_map;
    }
    ir.resources = json.get("resources").cloned();
    if let Some(interfaces) = json.get("interfaces").and_then(Value::as_array) {
        for iface in interfaces {
            if let Some(i) = normalize_monitored_interface(iface) {
                ir.interfaces.push(i);
            }
        }
    }
    Ok(ir)
}

fn normalize_monitored_interface(iface: &Value) -> Option<MonitoredInterfaceIR> {
    let obj = iface.as_object()?;
    let name = obj.get("name").and_then(Value::as_str)?.to_string();
    let kind = classify_interface_kind(obj.get("type").and_then(Value::as_str));
    Some(MonitoredInterfaceIR {
        name,
        kind,
        up: obj.get("up").and_then(Value::as_bool),
        mac: obj.get("mac").and_then(Value::as_str).map(str::to_string),
        statistics: obj.get("statistics").cloned(),
    })
}

// ── NetworkRoutes ───────────────────────────────────────────────────────────

fn normalize_routes(json: &Value) -> Result<RoutesIR, String> {
    let mut ir = RoutesIR::default();
    ir.router_id = as_string(json, "router_id");
    if let Some(routes) = json.get("routes").and_then(Value::as_array) {
        for route in routes {
            if let Some(r) = normalize_route(route) {
                ir.routes.push(r);
            }
        }
    }
    Ok(ir)
}

fn normalize_route(route: &Value) -> Option<RouteIR> {
    let obj = route.as_object()?;
    let destination = obj.get("destination").and_then(Value::as_str)?.to_string();
    Some(RouteIR {
        destination,
        next: obj.get("next").and_then(Value::as_str).map(str::to_string),
        device: obj.get("device").and_then(Value::as_str).map(str::to_string),
        cost: obj.get("cost").and_then(Value::as_f64),
        source: obj.get("source").and_then(Value::as_str).map(str::to_string),
    })
}

// ── NetworkCollection ───────────────────────────────────────────────────────

fn normalize_collection(json: &Value) -> Result<CollectionIR, String> {
    let mut ir = CollectionIR::default();
    if let Some(items) = json.get("collection").and_then(Value::as_array) {
        for item in items {
            // Unknown / malformed children are silently skipped — per SPEC,
            // never panic. A diagnostics channel could surface these later.
            let Some(ty) = item.get("type").and_then(Value::as_str) else {
                continue;
            };
            let kind = match ty {
                "NetworkGraph" => NetJsonKind::NetworkGraph,
                "DeviceConfiguration" => NetJsonKind::DeviceConfiguration,
                "DeviceMonitoring" => NetJsonKind::DeviceMonitoring,
                "NetworkRoutes" => NetJsonKind::NetworkRoutes,
                // NetworkCollection nesting is permitted by the spec.
                "NetworkCollection" => NetJsonKind::NetworkCollection,
                _ => continue,
            };
            if let Ok(child) = normalize(item, kind) {
                ir.members.push(child);
            }
        }
    }
    Ok(ir)
}

// ── helpers ─────────────────────────────────────────────────────────────────

fn as_string(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).map(str::to_string)
}

fn as_string_array(v: &Value, key: &str) -> Vec<String> {
    v.get(key)
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(|item| item.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

fn object_to_btree(obj: &Map<String, Value>) -> BTreeMap<String, Value> {
    obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
}

//! Intermediate representation. Version-agnostic; all rendering operates on
//! these types. See `SPEC.md#intermediate-representation`.

use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone)]
pub enum NetJsonIR {
    Graph(GraphIR),
    Config(ConfigIR),
    Monitoring(MonitoringIR),
    Routes(RoutesIR),
    Collection(CollectionIR),
}

// ── NetworkGraph ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
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

#[derive(Debug, Clone)]
pub struct GraphNode {
    pub id: String,
    pub label: Option<String>,
    pub role: NodeRole,
    pub local_addresses: Vec<String>,
    pub properties: BTreeMap<String, Value>,
}

#[derive(Debug, Clone)]
pub struct GraphLink {
    pub source: String,
    pub target: String,
    pub cost: Option<f64>,
    pub cost_text: Option<String>,
    pub properties: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeRole {
    Router,
    Switch,
    AccessPoint,
    Server,
    Client,
    Internet,
    Generic,
}

// ── DeviceConfiguration ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct ConfigIR {
    pub hostname: Option<String>,
    pub general: BTreeMap<String, Value>,
    pub interfaces: Vec<InterfaceIR>,
    pub radios: Vec<RadioIR>,
    pub dns_servers: Vec<String>,
    pub dns_search: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct InterfaceIR {
    pub name: String,
    pub kind: InterfaceKind,
    pub mac: Option<String>,
    pub mtu: Option<u32>,
    pub autostart: Option<bool>,
    pub addresses: Vec<AddressIR>,
    pub wireless: Option<WirelessIR>,
    pub bridge_members: Vec<String>,
    pub extras: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InterfaceKind {
    Ethernet,
    Wireless,
    Bridge,
    Loopback,
    Virtual,
    Other,
}

#[derive(Debug, Clone)]
pub struct AddressIR {
    pub address: String,
    pub mask: Option<u8>,
    pub family: Option<String>,
    pub proto: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WirelessIR {
    pub radio: Option<String>,
    pub mode: Option<String>,
    pub ssid: Option<String>,
    pub encryption: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct RadioIR {
    pub name: String,
    pub protocol: Option<String>,
    pub channel: Option<u32>,
    pub channel_width: Option<u32>,
    pub tx_power: Option<i32>,
    pub country: Option<String>,
    pub disabled: Option<bool>,
}

// ── DeviceMonitoring ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct MonitoringIR {
    pub hostname: Option<String>,
    pub local_time: Option<i64>,
    pub uptime: Option<i64>,
    pub general: BTreeMap<String, Value>,
    pub resources: Option<Value>,
    pub interfaces: Vec<MonitoredInterfaceIR>,
}

#[derive(Debug, Clone)]
pub struct MonitoredInterfaceIR {
    pub name: String,
    pub kind: InterfaceKind,
    pub up: Option<bool>,
    pub mac: Option<String>,
    pub statistics: Option<Value>,
}

// ── NetworkRoutes ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct RoutesIR {
    pub router_id: Option<String>,
    pub routes: Vec<RouteIR>,
}

#[derive(Debug, Clone)]
pub struct RouteIR {
    pub destination: String,
    pub next: Option<String>,
    pub device: Option<String>,
    pub cost: Option<f64>,
    pub source: Option<String>,
}

// ── NetworkCollection ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Default)]
pub struct CollectionIR {
    pub members: Vec<NetJsonIR>,
}

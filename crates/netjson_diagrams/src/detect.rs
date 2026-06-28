//! Top-level `type` field → NetJSON object kind. See `SPEC.md#netjson-schemas`.

use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NetJsonKind {
    NetworkGraph,
    DeviceConfiguration,
    DeviceMonitoring,
    NetworkRoutes,
    NetworkCollection,
}

pub fn detect(json: &Value) -> Result<NetJsonKind, String> {
    let ty = json
        .get("type")
        .and_then(Value::as_str)
        .ok_or_else(|| "NetJSON document is missing the top-level `type` field".to_string())?
        .trim();

    match ty {
        "NetworkGraph" => Ok(NetJsonKind::NetworkGraph),
        "DeviceConfiguration" => Ok(NetJsonKind::DeviceConfiguration),
        "DeviceMonitoring" => Ok(NetJsonKind::DeviceMonitoring),
        "NetworkRoutes" => Ok(NetJsonKind::NetworkRoutes),
        "NetworkCollection" => Ok(NetJsonKind::NetworkCollection),
        other => Err(format!(
            "unrecognized NetJSON type `{other}`; expected one of NetworkGraph, \
             DeviceConfiguration, DeviceMonitoring, NetworkRoutes, NetworkCollection"
        )),
    }
}

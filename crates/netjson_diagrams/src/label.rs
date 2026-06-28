//! Node-role + interface-kind classification. See `SPEC.md#node-role-classification`.

use crate::ir::{InterfaceKind, NodeRole};
use serde_json::Value;
use std::collections::BTreeMap;

/// Classify a graph node by, in priority order:
///   1. `properties.role`
///   2. `properties.kind`
///   3. `properties.device_type`
///   4. case-insensitive substring of `label`
///   5. fallback to `Generic`
pub fn classify_role(label: Option<&str>, properties: &BTreeMap<String, Value>) -> NodeRole {
    for key in ["role", "kind", "device_type"] {
        if let Some(role) = properties.get(key).and_then(Value::as_str) {
            if let Some(matched) = match_role_keyword(role) {
                return matched;
            }
        }
    }
    if let Some(text) = label {
        if let Some(matched) = match_role_keyword(text) {
            return matched;
        }
    }
    NodeRole::Generic
}

fn match_role_keyword(text: &str) -> Option<NodeRole> {
    let lowered = text.trim().to_ascii_lowercase();
    if lowered.is_empty() {
        return None;
    }
    if contains_word(&lowered, "router") {
        return Some(NodeRole::Router);
    }
    if contains_word(&lowered, "switch") {
        return Some(NodeRole::Switch);
    }
    if contains_word(&lowered, "ap")
        || lowered.contains("access_point")
        || lowered.contains("access point")
        || lowered.contains("accesspoint")
    {
        return Some(NodeRole::AccessPoint);
    }
    if contains_word(&lowered, "server") {
        return Some(NodeRole::Server);
    }
    if contains_word(&lowered, "client") || contains_word(&lowered, "station") {
        return Some(NodeRole::Client);
    }
    if contains_word(&lowered, "internet")
        || contains_word(&lowered, "cloud")
        || contains_word(&lowered, "gateway")
    {
        return Some(NodeRole::Internet);
    }
    None
}

/// Substring match, but only on word boundaries (avoid matching "ap" inside
/// "apple" or "router" inside "rerouter-foo" by accident at the *start*).
/// Word boundary = start/end of string or any non-alphanumeric char.
fn contains_word(haystack: &str, needle: &str) -> bool {
    if let Some(idx) = haystack.find(needle) {
        let before_ok = idx == 0
            || !haystack[..idx]
                .chars()
                .next_back()
                .map(|c| c.is_ascii_alphanumeric())
                .unwrap_or(false);
        let after_ok = idx + needle.len() == haystack.len()
            || !haystack[idx + needle.len()..]
                .chars()
                .next()
                .map(|c| c.is_ascii_alphanumeric())
                .unwrap_or(false);
        before_ok && after_ok
    } else {
        false
    }
}

/// Classify an interface by its declared `type` string.
pub fn classify_interface_kind(declared_type: Option<&str>) -> InterfaceKind {
    let Some(t) = declared_type else {
        return InterfaceKind::Other;
    };
    match t.trim().to_ascii_lowercase().as_str() {
        "ethernet" => InterfaceKind::Ethernet,
        "wireless" => InterfaceKind::Wireless,
        "bridge" => InterfaceKind::Bridge,
        "loopback" => InterfaceKind::Loopback,
        "virtual" => InterfaceKind::Virtual,
        _ => InterfaceKind::Other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn props(pairs: &[(&str, Value)]) -> BTreeMap<String, Value> {
        pairs.iter().map(|(k, v)| (k.to_string(), v.clone())).collect()
    }

    #[test]
    fn role_from_properties_role() {
        let p = props(&[("role", json!("router"))]);
        assert_eq!(classify_role(None, &p), NodeRole::Router);
    }

    #[test]
    fn role_from_properties_kind_when_role_missing() {
        let p = props(&[("kind", json!("access_point"))]);
        assert_eq!(classify_role(None, &p), NodeRole::AccessPoint);
    }

    #[test]
    fn role_from_label_when_properties_empty() {
        let p = props(&[]);
        assert_eq!(classify_role(Some("Edge Router"), &p), NodeRole::Router);
    }

    #[test]
    fn role_falls_back_to_generic() {
        let p = props(&[]);
        assert_eq!(classify_role(Some("Box-42"), &p), NodeRole::Generic);
    }

    #[test]
    fn role_priority_properties_wins_over_label() {
        let p = props(&[("role", json!("server"))]);
        assert_eq!(classify_role(Some("Router-1"), &p), NodeRole::Server);
    }

    #[test]
    fn role_ignores_partial_substrings() {
        let p = props(&[]);
        // "apple" must NOT match "ap" — word boundary required
        assert_eq!(classify_role(Some("Apple TV"), &p), NodeRole::Generic);
    }

    #[test]
    fn role_handles_access_point_variants() {
        let p = props(&[]);
        for label in ["Access Point 1", "AP-North", "AccessPoint North"] {
            assert_eq!(classify_role(Some(label), &p), NodeRole::AccessPoint, "label={label}");
        }
    }

    #[test]
    fn interface_kind_basic() {
        assert_eq!(classify_interface_kind(Some("ethernet")), InterfaceKind::Ethernet);
        assert_eq!(classify_interface_kind(Some("WIRELESS")), InterfaceKind::Wireless);
        assert_eq!(classify_interface_kind(Some("bridge")), InterfaceKind::Bridge);
        assert_eq!(classify_interface_kind(Some("loopback")), InterfaceKind::Loopback);
        assert_eq!(classify_interface_kind(Some("virtual")), InterfaceKind::Virtual);
        assert_eq!(classify_interface_kind(Some("tunnel")), InterfaceKind::Other);
        assert_eq!(classify_interface_kind(None), InterfaceKind::Other);
    }
}

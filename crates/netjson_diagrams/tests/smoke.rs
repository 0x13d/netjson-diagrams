//! Detection edge cases — the small, fast checks. Per-fixture snapshot tests
//! live in `snapshots.rs`.

use netjson_diagrams::detect::{detect, NetJsonKind};

#[test]
fn detect_recognises_all_five_netjson_types() {
    let cases = [
        ("NetworkGraph", NetJsonKind::NetworkGraph),
        ("DeviceConfiguration", NetJsonKind::DeviceConfiguration),
        ("DeviceMonitoring", NetJsonKind::DeviceMonitoring),
        ("NetworkRoutes", NetJsonKind::NetworkRoutes),
        ("NetworkCollection", NetJsonKind::NetworkCollection),
    ];
    for (ty, expected) in cases {
        let json: serde_json::Value = serde_json::json!({ "type": ty });
        assert_eq!(detect(&json).unwrap(), expected, "type {ty}");
    }
}

#[test]
fn detect_rejects_missing_type() {
    let json: serde_json::Value = serde_json::json!({});
    let err = detect(&json).unwrap_err();
    assert!(err.contains("missing"), "unexpected error: {err}");
}

#[test]
fn detect_rejects_unknown_type() {
    let json: serde_json::Value = serde_json::json!({ "type": "Mystery" });
    let err = detect(&json).unwrap_err();
    assert!(err.contains("Mystery"), "unexpected error: {err}");
}

#[test]
fn convert_rejects_malformed_json() {
    let err = netjson_diagrams::convert("{not json", &Default::default()).unwrap_err();
    assert!(err.contains("Invalid JSON"), "unexpected error: {err}");
}

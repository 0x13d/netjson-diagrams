//! Per-fixture snapshot tests. The expected outputs live in
//! `tests/snapshots/<fixture>.{puml,md,combined.md}` and are part of the
//! output contract — a change that breaks one of these is a conversation,
//! not a free update.
//!
//! Regenerating snapshots: run the CLI on each fixture and overwrite the
//! relevant snapshot file. See `CLAUDE.md` for the workflow.

use netjson_diagrams::{convert, convert_combined, convert_paper};
use pretty_assertions::assert_eq;

const FIXTURE_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../tests/fixtures");
const SNAPSHOT_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/snapshots");

fn fixture(name: &str) -> String {
    let path = format!("{FIXTURE_DIR}/{name}.json");
    std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {path}: {e}"))
}

fn snapshot(name: &str, ext: &str) -> String {
    let path = format!("{SNAPSHOT_DIR}/{name}.{ext}");
    std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {path}: {e}"))
}

fn check_fixture(name: &str) {
    let input = fixture(name);
    let opts = Default::default();

    let actual_puml = convert(&input, &opts).unwrap_or_else(|e| panic!("convert {name}: {e}"));
    assert_eq!(
        actual_puml,
        snapshot(name, "puml"),
        "PlantUML snapshot drift for {name}"
    );

    let actual_paper =
        convert_paper(&input).unwrap_or_else(|e| panic!("convert_paper {name}: {e}"));
    assert_eq!(
        actual_paper,
        snapshot(name, "md"),
        "Paper snapshot drift for {name}"
    );

    let actual_combined = convert_combined(&input, &opts)
        .unwrap_or_else(|e| panic!("convert_combined {name}: {e}"));
    assert_eq!(
        actual_combined,
        snapshot(name, "combined.md"),
        "Combined snapshot drift for {name}"
    );
}

#[test]
fn network_graph_mesh_snapshot() {
    check_fixture("network_graph_mesh");
}

#[test]
fn network_graph_piv_issuance_snapshot() {
    check_fixture("network_graph_piv_issuance");
}

#[test]
fn device_configuration_router_snapshot() {
    check_fixture("device_configuration_router");
}

#[test]
fn device_monitoring_router_snapshot() {
    check_fixture("device_monitoring_router");
}

#[test]
fn network_routes_basic_snapshot() {
    check_fixture("network_routes_basic");
}

#[test]
fn network_collection_mixed_snapshot() {
    check_fixture("network_collection_mixed");
}

// ── Non-snapshot behavioral tests ───────────────────────────────────────────

#[test]
fn direction_lr_emits_left_to_right() {
    use netjson_diagrams::{ConvertOptions, DirectionOpt};
    let input = fixture("network_graph_mesh");
    let out = convert(&input, &ConvertOptions { direction: DirectionOpt::LR })
        .expect("convert with LR direction");
    assert!(
        out.contains("left to right direction"),
        "expected LR directive, got:\n{out}"
    );
    assert!(!out.contains("top to bottom direction"));
}

#[test]
fn empty_collection_renders_valid_plantuml() {
    let input = r#"{"type":"NetworkCollection","collection":[]}"#;
    let out = convert(input, &Default::default()).expect("convert empty collection");
    assert!(out.starts_with("@startuml"), "got: {out}");
    assert!(out.contains("@enduml"));
    assert!(out.contains("NetworkCollection (empty)"));
}

#[test]
fn graph_node_missing_id_errors() {
    let input = r#"{"type":"NetworkGraph","nodes":[{"label":"x"}],"links":[]}"#;
    let err = convert(input, &Default::default()).expect_err("missing id should error");
    assert!(err.contains("id"), "unexpected error: {err}");
}

#[test]
fn route_missing_destination_is_skipped() {
    // Per SPEC, a route with no destination is skipped (with a diagnostic in
    // a future revision). The conversion must still succeed.
    let input = r#"{
      "type": "NetworkRoutes",
      "router_id": "10.0.0.1",
      "routes": [
        { "next": "10.0.0.254" },
        { "destination": "0.0.0.0/0", "next": "10.0.0.254" }
      ]
    }"#;
    let out = convert(input, &Default::default()).expect("convert with malformed route");
    assert!(out.contains("0.0.0.0/0"), "kept route missing: {out}");
    // The skipped route had only `next: 10.0.0.254`; its destination must not
    // appear as a cloud declaration.
    assert_eq!(
        out.matches("cloud \"").count(),
        1,
        "expected exactly one cloud, got:\n{out}"
    );
}

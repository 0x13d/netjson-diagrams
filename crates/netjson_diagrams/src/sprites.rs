//! plantuml-icon-font-sprites catalog. See `SPEC.md#sprite-catalog`.
//!
//! We emit stdlib-style includes (`!include <tupadr3/...>`) rather than full
//! URLs. PlantUML's bundled stdlib ships the tupadr3 sprite library, so this
//! resolves offline in both `plantuml.jar` and `plantuml-wasm` with no
//! outbound network call at render time.
//!
//! Sprite names (`<<$name>>`) match the identifiers defined inside each
//! upstream `.puml` file. Bumping the pinned upstream version requires
//! snapshot review — both the include path and the sprite name can shift.

use crate::ir::{InterfaceKind, NodeRole};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Sprite {
    /// stdlib-style include path, e.g. `tupadr3/font-awesome-6/server`.
    pub include: &'static str,
    /// Sprite reference name, e.g. `server` → `<<$server>>`.
    pub name: &'static str,
}

pub fn sprite_for_role(role: NodeRole) -> Sprite {
    match role {
        NodeRole::Router => sprite("tupadr3/font-awesome-6/server", "server"),
        NodeRole::Switch => sprite("tupadr3/font-awesome-6/network_wired", "network_wired"),
        NodeRole::AccessPoint => sprite("tupadr3/font-awesome-6/wifi", "wifi"),
        NodeRole::Server => sprite("tupadr3/font-awesome-6/server", "server"),
        NodeRole::Client => sprite("tupadr3/font-awesome-6/laptop", "laptop"),
        NodeRole::Internet => sprite("tupadr3/font-awesome-6/cloud", "cloud"),
        NodeRole::Generic => sprite("tupadr3/font-awesome-6/circle_nodes", "circle_nodes"),
    }
}

pub fn sprite_for_interface(kind: InterfaceKind) -> Sprite {
    match kind {
        InterfaceKind::Ethernet => sprite("tupadr3/font-awesome-6/ethernet", "ethernet"),
        InterfaceKind::Wireless => sprite("tupadr3/font-awesome-6/wifi", "wifi"),
        InterfaceKind::Bridge => sprite("tupadr3/font-awesome-6/code_branch", "code_branch"),
        InterfaceKind::Loopback => sprite("tupadr3/font-awesome-6/circle_dot", "circle_dot"),
        InterfaceKind::Virtual => sprite("tupadr3/font-awesome-6/clone", "clone"),
        InterfaceKind::Other => sprite("tupadr3/font-awesome-6/circle_nodes", "circle_nodes"),
    }
}

const fn sprite(include: &'static str, name: &'static str) -> Sprite {
    Sprite { include, name }
}

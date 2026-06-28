# Coffeeshop Mesh

## Diagram

```plantuml
@startuml
!include <C4/C4_Container>

top to bottom direction
LAYOUT_WITH_LEGEND()
title "Coffeeshop Mesh"

Container(n_10_0_0_1, "Gateway", "Router", "vendor: Ubiquiti")
Container(n_10_0_0_2, "AP-North", "AP")
Container(n_10_0_0_3, "AP-South", "AP")

Rel(n_10_0_0_1, n_10_0_0_2, "ETX 1.0", "OLSR")
Rel(n_10_0_0_1, n_10_0_0_3, "ETX 1.5", "OLSR")
Rel(n_10_0_0_2, n_10_0_0_3, "ETX 2.0", "OLSR")
@enduml
```

## Paper


**Type:** `NetworkGraph` · **Protocol:** `OLSR` · **Version:** `0.6.6` · **Metric:** `ETX` · **Router id:** `10.0.0.1` · **Topology id:** `topo-mesh-01`

<!-- netjson-section: nodes -->
## Node metadata

### Gateway
_id:_ `10.0.0.1`
- **Local addresses:** `192.168.1.1`
- **vendor:** `Ubiquiti`


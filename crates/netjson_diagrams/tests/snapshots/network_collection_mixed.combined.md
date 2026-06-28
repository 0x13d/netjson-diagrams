# NetworkCollection

## Diagram

```plantuml
@startuml
!include <C4/C4_Container>

top to bottom direction
LAYOUT_WITH_LEGEND()
title "Bundled topology"

Container(n_10_0_0_1, "Gateway", "Router")
Container(n_10_0_0_2, "AP-North", "AP")

Rel(n_10_0_0_1, n_10_0_0_2, "ETX 1.0")
@enduml

@startuml
!include <tupadr3/font-awesome-6/ethernet>

top to bottom direction
title "Device · router-01"

node "Device · router-01" as device {
    component "eth0" as iface_eth0 <<$ethernet>>
}
@enduml
```

## Paper


**Type:** `NetworkCollection` · **Members:** `2`

<!-- netjson-section: member-1 -->
## Member 1

### Bundled topology

**Type:** `NetworkGraph` · **Protocol:** `OLSR`


<!-- netjson-section: member-2 -->
## Member 2

### router-01

**Type:** `DeviceConfiguration`

<!-- netjson-section: interfaces -->
#### Interfaces

##### eth0 _(Ethernet)_
- **Addresses:**
    - `192.168.1.1/24` (ipv4) via static



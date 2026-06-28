# Routes for 10.0.0.1

## Diagram

```plantuml
@startuml
!include <tupadr3/font-awesome-6/cloud>
!include <tupadr3/font-awesome-6/server>

top to bottom direction
title "Routes for 10.0.0.1"

node "Router 10.0.0.1" as router <<$server>>
cloud "0.0.0.0/0" as dest_0_0_0_0_0 <<$cloud>>
cloud "10.0.0.0/24" as dest_10_0_0_0_24 <<$cloud>>
cloud "192.168.1.0/24" as dest_192_168_1_0_24 <<$cloud>>

router --> dest_0_0_0_0_0 : "via 10.0.0.254 (eth0) cost 1"
router --> dest_10_0_0_0_24 : "via 0.0.0.0 (br-lan) cost 0"
router --> dest_192_168_1_0_24 : "via 10.0.0.2 (br-lan) cost 2"
@enduml
```

## Paper


**Type:** `NetworkRoutes` · **Router id:** `10.0.0.1`

<!-- netjson-section: routes -->
## Routes

| Destination | Next hop | Device | Cost | Source |
|-------------|----------|--------|------|--------|
| `0.0.0.0/0` | `10.0.0.254` | `eth0` | `1` | `static` |
| `10.0.0.0/24` | `0.0.0.0` | `br-lan` | `0` | `kernel` |
| `192.168.1.0/24` | `10.0.0.2` | `br-lan` | `2` | `olsr` |


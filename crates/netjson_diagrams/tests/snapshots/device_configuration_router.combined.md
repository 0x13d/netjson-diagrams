# router-01

## Diagram

```plantuml
@startuml
!include <tupadr3/font-awesome-6/circle_dot>
!include <tupadr3/font-awesome-6/code_branch>
!include <tupadr3/font-awesome-6/ethernet>
!include <tupadr3/font-awesome-6/wifi>

top to bottom direction
title "Device · router-01"

node "Device · router-01" as device {
    component "lo" as iface_lo <<$circle_dot>>
    component "eth0" as iface_eth0 <<$ethernet>>
    component "wlan0" as iface_wlan0 <<$wifi>>
    component "br-lan" as iface_br_lan <<$code_branch>>
}

component "Radio radio0" as radio_radio0 <<$wifi>>

iface_br_lan ..> iface_eth0
iface_br_lan ..> iface_wlan0
iface_wlan0 ..> radio_radio0
device .. radio_radio0
@enduml
```

## Paper


**Type:** `DeviceConfiguration`

<!-- netjson-section: general -->
## General

- **description:** `OpenWRT gateway for the lab`

<!-- netjson-section: dns -->
## DNS

- **Servers:** `8.8.8.8`, `1.1.1.1`
- **Search:** `lan`

<!-- netjson-section: interfaces -->
## Interfaces

### lo _(Loopback)_
- **Addresses:**
    - `127.0.0.1/8` (ipv4) via static

### eth0 _(Ethernet)_
- **MAC:** `aa:bb:cc:dd:ee:f0`
- **MTU:** `1500`
- **Autostart:** `true`
- **Addresses:**
    - `192.168.1.1/24` (ipv4) via static

### wlan0 _(Wireless)_
- **MAC:** `aa:bb:cc:dd:ee:f1`
- **MTU:** `1500`
- **Autostart:** `true`
- **Wireless mode:** `access_point`
- **SSID:** `LabMesh`
- **Encryption:** 

```json
{
  "ciphers": [
    "ccmp"
  ],
  "protocol": "wpa2_personal"
}
```


### br-lan _(Bridge)_
- **MTU:** `1500`
- **Autostart:** `true`
- **Addresses:**
    - `10.0.0.1/24` (ipv4) via static
- **Bridge members:** `eth0`, `wlan0`

<!-- netjson-section: radios -->
## Radios

### radio0
- **Protocol:** `802.11n`
- **Channel:** `6`
- **Channel width:** `20` MHz
- **TX power:** `17` dBm
- **Country:** `US`
- **Disabled:** `false`


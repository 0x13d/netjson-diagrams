# PIV Issuance & Relying-Party Topology

## Diagram

```plantuml
@startuml
!include <C4/C4_Container>

top to bottom direction
LAYOUT_WITH_LEGEND()
title "PIV Issuance & Relying-Party Topology"

System_Boundary(issuance, "Issuance") {
    Container(ra_piv, "Registration Authority", "RA · NIST SP 800-79")
    Container(enroll_kiosk, "Enrollment Station", "Enrollment", "captures: fingerprints, facial image, I-9")
    Container(idms_piv, "Identity Management System", "IDMS")
    Container(cms_piv, "Card Management System", "CMS · FIPS 201-3, SP 800-73-4")
    Container(printer_piv, "PIV Card Personalization", "Printer", "loads: applets, topograph, CHUID, certs")
}
System_Boundary(pki, "PKI") {
    Container(ca_piv, "PIV Certificate Authority", "CA", "policies: id-fpki-common-authentication, -hardware, -cardAuth, -piv-contentSigning")
    Container(hsm_piv, "Issuance HSM (FIPS 140-3 L3)", "HSM")
    ContainerDb(ldap_piv, "Cert Directory (LDAP)", "Directory", "publishes: PIV-Auth, Digital Signature, Key Mgmt, Card-Auth certs")
    Container(ocsp_piv, "OCSP Responder", "OCSP")
}
System_Boundary(physical_access, "Physical Access") {
    Container(pacs_headend, "PACS Head-End", "PACS", "examples: LenelS2, Genetec, AMAG")
    Container(pacs_panel_b1, "Access Control Panel (Bldg-1)", "Pacs Panel")
    Container(pacs_reader_lobby, "Lobby Door Reader", "Card Reader", "auth_mode: PKI-CAK + PKI-AUTH")
}
System_Boundary(logical_access, "Logical Access") {
    ContainerDb(ad_dc, "Active Directory Domain Controller", "Directory", "function: Kerberos PKINIT smart-card logon")
    Container(workstation_1, "Desktop + Smart Card Reader", "Workstation", "middleware: PIV PKCS#11 / minidriver")
    Container(laptop_1, "Laptop + Smart Card Reader", "Laptop", "middleware: PIV PKCS#11 / minidriver")
}
System_Boundary(mobile, "Mobile") {
    Container(dpc_issuer, "Derived PIV Credential Issuer", "Dpc Issuer · NIST SP 800-157, SP 800-217")
    Container(mdm, "MDM / UEM", "MDM")
    Container(mobile_1, "Mobile Device (DPC in SE/StrongBox)", "Mobile", "key_store: Secure Enclave / StrongBox / eSE")
}
System_Boundary(email, "Email") {
    Container(mail_server, "Mail Server", "Mail Server", "examples: Exchange, M365, Postfix")
    Container(mail_client, "Mail Client (S/MIME)", "Mail Client", "uses: PIV Digital Signature + Key Management certs")
}

Rel(enroll_kiosk, ra_piv, "biometrics + I-9 capture", "HTTPS")
Rel(ra_piv, idms_piv, "vetted identity record", "TLS mTLS")
Rel(idms_piv, cms_piv, "approved enrollment", "TLS mTLS")
Rel(cms_piv, ca_piv, "CMC cert request (4 PIV certs)", "CMC over HTTPS")
Rel(ca_piv, hsm_piv, "sign with CA key", "PKCS#11")
Rel(ca_piv, ldap_piv, "publish certs + CRL", "LDAP / LDAPS")
Rel(ca_piv, ocsp_piv, "delegate revocation status", "OCSP signer trust")
Rel(cms_piv, printer_piv, "personalize card (applets, CHUID, certs)", "GlobalPlatform SCP03")
Rel(cms_piv, pacs_headend, "provision FASC-N / Card UUID", "PACS provisioning API")
Rel(pacs_headend, pacs_panel_b1, "access decisions + ACL sync", "IP (TLS)")
Rel(pacs_panel_b1, pacs_reader_lobby, "PKI-CAK challenge at the door", "OSDP v2 Secure Channel")
Rel(pacs_headend, ocsp_piv, "cert path & revocation check", "OCSP")
Rel(workstation_1, ad_dc, "smart-card logon", "Kerberos PKINIT")
Rel(laptop_1, ad_dc, "smart-card logon", "Kerberos PKINIT")
Rel(ad_dc, ldap_piv, "NTAuth trust + user cert mapping", "LDAP")
Rel(ad_dc, ocsp_piv, "PIV-Auth cert validation", "OCSP")
Rel(cms_piv, dpc_issuer, "PIV-based identity proof (SP 800-157)", "TLS mTLS")
Rel(dpc_issuer, ca_piv, "DPC cert request", "CMC over HTTPS")
Rel(dpc_issuer, mdm, "DPC provisioning handoff", "SCEP / vendor API")
Rel(mdm, mobile_1, "install DPC into secure element", "MDM agent over TLS")
Rel(mobile_1, ocsp_piv, "DPC revocation check", "OCSP")
Rel(workstation_1, mail_client, "S/MIME signing via PIV slot 9C", "PKCS#11 / CAPI")
Rel(mail_client, mail_server, "signed (and optionally encrypted) message", "SMTP + S/MIME (CMS)")
Rel(mail_server, ldap_piv, "fetch recipient Key-Management cert", "LDAP")
Rel(mail_client, ocsp_piv, "validate signer cert", "OCSP")
Rel(mobile_1, mail_server, "S/MIME signing via DPC", "SMTP + S/MIME (CMS)")
@enduml
```

## Paper


**Type:** `NetworkGraph` · **Protocol:** `Logical` · **Version:** `FIPS 201-3` · **Metric:** `TrustPath` · **Router id:** `cms.piv.example.gov` · **Topology id:** `piv-issuance-01`

<!-- netjson-section: nodes -->
## Node metadata

### Registration Authority
_id:_ `ra.piv`
- **domain:** `issuance`
- **standards:** `NIST SP 800-79`

### Enrollment Station
_id:_ `enroll.kiosk`
- **captures:** `fingerprints, facial image, I-9`
- **domain:** `issuance`

### Identity Management System
_id:_ `idms.piv`
- **domain:** `issuance`

### Card Management System
_id:_ `cms.piv`
- **domain:** `issuance`
- **standards:** `FIPS 201-3, SP 800-73-4`

### PIV Certificate Authority
_id:_ `ca.piv`
- **domain:** `pki`
- **policies:** `id-fpki-common-authentication, -hardware, -cardAuth, -piv-contentSigning`

### Issuance HSM (FIPS 140-3 L3)
_id:_ `hsm.piv`
- **domain:** `pki`

### Cert Directory (LDAP)
_id:_ `ldap.piv`
- **domain:** `pki`
- **publishes:** `PIV-Auth, Digital Signature, Key Mgmt, Card-Auth certs`

### OCSP Responder
_id:_ `ocsp.piv`
- **domain:** `pki`

### PIV Card Personalization
_id:_ `printer.piv`
- **domain:** `issuance`
- **loads:** `applets, topograph, CHUID, certs`

### PACS Head-End
_id:_ `pacs.headend`
- **domain:** `physical-access`
- **examples:** `LenelS2, Genetec, AMAG`

### Access Control Panel (Bldg-1)
_id:_ `pacs.panel.b1`
- **domain:** `physical-access`

### Lobby Door Reader
_id:_ `pacs.reader.lobby`
- **auth_mode:** `PKI-CAK + PKI-AUTH`
- **domain:** `physical-access`

### Active Directory Domain Controller
_id:_ `ad.dc`
- **domain:** `logical-access`
- **function:** `Kerberos PKINIT smart-card logon`

### Desktop + Smart Card Reader
_id:_ `workstation.1`
- **domain:** `logical-access`
- **middleware:** `PIV PKCS#11 / minidriver`

### Laptop + Smart Card Reader
_id:_ `laptop.1`
- **domain:** `logical-access`
- **middleware:** `PIV PKCS#11 / minidriver`

### Derived PIV Credential Issuer
_id:_ `dpc.issuer`
- **domain:** `mobile`
- **standards:** `NIST SP 800-157, SP 800-217`

### MDM / UEM
_id:_ `mdm`
- **domain:** `mobile`

### Mobile Device (DPC in SE/StrongBox)
_id:_ `mobile.1`
- **domain:** `mobile`
- **key_store:** `Secure Enclave / StrongBox / eSE`

### Mail Server
_id:_ `mail.server`
- **domain:** `email`
- **examples:** `Exchange, M365, Postfix`

### Mail Client (S/MIME)
_id:_ `mail.client`
- **domain:** `email`
- **uses:** `PIV Digital Signature + Key Management certs`


# Trust Report — netjson-diagrams

_Generated 2026-05-22T23:25:05Z_

Static supply-chain checks. Re-run via `bash scripts/trust-report.sh`.
Artifacts in `reports/trust/`; only this `summary.md` is committed.

| Status | Check | Detail |
|--------|-------|--------|
| OK | SBOM (syft) | 112 components — sbom.cyclonedx.json, sbom.spdx.json |
| WARN | npm audit (apps/vscode-extension) | 1 vulnerabilities — audit-npm-apps_vscode-extension.json |
| OK | npm audit (apps/web) | 0 vulnerabilities — audit-npm-apps_web.json |
| OK | npm audit (packages/netjson-diagrams) | 0 vulnerabilities — audit-npm-packages_netjson-diagrams.json |
| INFO | npm audit (packages/netjson-diagrams-cli) | see audit-npm-packages_netjson-diagrams-cli.json |
| INFO | npm audit (packages/netjson-diagrams/wasm-node) | see audit-npm-packages_netjson-diagrams_wasm-node.json |
| OK | cargo audit | 0 vulnerabilities — audit-cargo.json |
| OK | cargo deny | no findings — cargo-deny.txt |
| OK | Licenses | 112 components, 4 distinct — licenses.csv |
| INFO | Network-call inventory | 3 source matches — network-calls.txt (review for outbound) |

## Artifacts

- audit-cargo.json
- audit-npm-apps_vscode-extension.json
- audit-npm-apps_web.json
- audit-npm-packages_netjson-diagrams-cli.json
- audit-npm-packages_netjson-diagrams.json
- audit-npm-packages_netjson-diagrams_wasm-node.json
- cargo-deny.txt
- licenses.csv
- network-calls.txt
- sbom.cyclonedx.json
- sbom.spdx.json

## Reproduce

```sh
bash scripts/trust-report.sh
```

Tools used (when present): syft, npm/pnpm audit, cargo-audit, cargo-deny, jq.

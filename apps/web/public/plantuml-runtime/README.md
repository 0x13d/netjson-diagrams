# PlantUML browser runtime — vendored bundle

This directory holds the official PlantUML TeaVM build, vendored at a pinned
release so the Diagram tab renders fully offline. **The `.js` files are gitignored**
— run the fetch script to populate them.

## Refetch

```sh
node scripts/fetch-plantuml-runtime.mjs
```

The script downloads `js-plantuml-<version>.zip` from PlantUML's GitHub Releases,
extracts the four files we need into this directory, and verifies SHA-256 hashes
against the pinned values.

## Provenance

- **Upstream:** [plantuml/plantuml](https://github.com/plantuml/plantuml)
- **License:** GPL (plantuml.js + viz-global.js), MIT (tupadr3.min.js sprite content)
- **Release tag pinned:** `v1.2026.4` ([release page](https://github.com/plantuml/plantuml/releases/tag/v1.2026.4))
- **Source artifact:** [`js-plantuml-1.2026.4.zip`](https://github.com/plantuml/plantuml/releases/download/v1.2026.4/js-plantuml-1.2026.4.zip)
- **Source zip SHA-256:** `3f4977f2ea9e0fd9d39c5a0f4ae5a91ded3909d98f5fced2086817d5364de8aa`
- **Built upstream with:** `./gradlew clean teavm -Pfast` (see `teavm.sh` in PlantUML's repo)
- **Toolchain:** [TeaVM](https://github.com/konsoletyper/teavm) (Java → JavaScript) + [Viz.js](https://github.com/mdaines/viz-js) (Graphviz layout)

## Files

| File              | Size  | Purpose                                                        | SHA-256                                                            |
|-------------------|-------|----------------------------------------------------------------|--------------------------------------------------------------------|
| `plantuml.js`     | 7.1 MB | TeaVM-compiled PlantUML core, exports `render(lines, divId, opts)` | `6cd219fff5364cda385d0d6113d963f3b1386a42170fdc35970772f8364b05d5` |
| `viz-global.js`   | 1.4 MB | Viz.js (Graphviz wrapper), required before `plantuml.js` loads     | `ef2cd8a08b5cf8b65e3634131052b41870ff30bb6fb23e23a87fd09d44666cba` |
| `tupadr3.min.js`  |  20 MB | [plantuml-icon-font-sprites](https://github.com/tupadr3/plantuml-icon-font-sprites) catalog (FontAwesome 4/5/6 + devicons + more) | `750a4e9479d81686ceb72486b9192104aa92a7e6789a9e3bc1a002997343f565` |
| `c4.min.js`       | 167 KB | [C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML) stdlib (`C4/C4_Container` macros — NetworkGraph diagrams render as C4 Container diagrams) | `dc6ab447655157b3ec3a25debbf1798022b0934aef2df69b391dbc7f0d57886f` |

## Trust posture

The runtime loads only when the user opens the **Diagram** tab, and only once
per session (cached in the browser thereafter). No data leaves the browser:

- All three scripts execute locally; nothing is sent to `plantuml.com`, `kroki.io`,
  the leaningtech CDN, or any third-party server.
- The TeaVM-compiled core has no network code paths — verified via
  `reports/trust/network-calls.txt` (the only flagged URL in our source is the
  `tupadr3` sprite URL constant in `crates/netjson_diagrams/src/sprites.rs`,
  which is *text*, not a fetch).
- Stdlib includes resolve out of `window.PLANTUML_STDLIB` — `tupadr3` (sprite
  icons) populated by `tupadr3.min.js`, and `C4` (the `C4/C4_Container` macros
  NetworkGraph diagrams include) populated by `c4.min.js` — also entirely local.
- The diagram source is rendered in-process; no `<img src="…plantuml.com/uml/…"/>`
  pattern anywhere.

## Bumping the pin

When PlantUML cuts a new release:

1. Update `scripts/fetch-plantuml-runtime.mjs` (release tag + SHA-256 hashes).
2. Run the script; verify the three files land cleanly.
3. Update this README's version + hashes.
4. Re-run `cd apps/web && npm run build` and the dev server; spot-check that
   each fixture still renders correctly in the Diagram tab.
5. Bump the netjson-diagrams release (PATCH if no observable changes, MINOR if
   the diagram output drifts).

# TODO

## Register for Package Managers

* OpenVSX: https://open-vsx.org/user-settings/extensions
* VSCODE: https://marketplace.visualstudio.com/manage/publishers/0x13d
* NPM: https://www.npmjs.com/~13d
* Crates: https://crates.io/

## GitHub Release Secrets

NPM_TOKEN
CARGO_REGISTRY_TOKEN
VSCE_PAT
OVSX_PAT

## Release flow reminder

After scaffolding lands and v0.1.0 is cut, the release flow mirrors
`elsa-to-mermaid`:

```text
node scripts/bump-version.mjs X.Y.Z
  → review/edit CHANGELOG
  → commit "release: vX.Y.Z"
  → git tag vX.Y.Z && git push --tags
```

The tag fires `.github/workflows/release.yml`, which builds and publishes
everywhere. Run it via `workflow_dispatch` with `dry_run: true` first to verify
the matrix builds cleanly.

## Build-out checklist (current phase)

Phase 1 (scaffold) is the current work. Subsequent phases mirror the original
brief:

1. **Scaffold + rename** — directory rename, Cargo workspace, SPEC.md,
   fixtures, Makefile, CLAUDE.md, trust-report wiring. *(in progress)*
2. **Rust core** — `detect` / `normalize` / `render` / `paper` / `sprites`;
   snapshot tests per object type.
3. **CLI** — clap-based, mirrors `elsa-mermaid-cli` (input, `-o`, `-d`,
   `--paper`, `--combined`, `--fenced`).
4. **npm package + WASM** — bundler + node targets, smoke test.
5. **Web app** — Vite/React/Tailwind, spec / diagram / paper tabs, embedded
   `plantuml-wasm` preview.
6. **VS Code extension** — side preview, mirrors elsa pattern incl. esbuild +
   `copy-wasm.mjs`.
7. **Release plumbing** — `bump-version.mjs` lockstep across surfaces,
   `.github/workflows/{ci,release}.yml`, CHANGELOG promotion script.

## Improvements

### Theming — adopt the portfolio web standard (EPIC-011, owner ask 2026-06-11)

* **[DONE 2026-06-11] Ink palette.** `tailwind.config.ts` tokens repointed to the Tufte paper/ink base +
  Ink accents: `paper #faf7f1` · `paperDim #f3eee4` · `ink #11120f` · `inkSoft #5a5a5a` · `rule #3a3a3a` ·
  `ember` (the old `#1F6FEB` network-blue accent) → **brass `#8a6d3b`** so existing `text-ember`/`bg-ember`
  resolve to it; added a `footer #3a3a3a` token. The blue `rgba` literals in `index.css` and the blue stroke
  in `Logo.tsx` repointed to brass. Web app builds clean; browser-verified.
* **[DONE 2026-06-11] `#3a3a3a` footer → ariugwu.com.** `components/Footer.tsx` is now the constant
  `#3a3a3a` footer with a link back to the **ariugwu.com home page** (kept the GitHub link too).
* **Scope note (2026-06-11):** the literal *two-column app-shell* layout was **not** imposed — this is a
  single-column tool site; conformance is via the **Ink palette + the `#3a3a3a` footer + the home link**
  (the two-column layout is scoped to app shells in `_shared/web-standard/README.md`). UI/UX lead to confirm.

## Known risks to revisit

- **plantuml-wasm boot under Vite TLA** — same shape of risk as the
  elsa-to-mermaid d3-color trap. Prototype it before committing to it as the
  preview path. Fallback: emit text only with a "copy / open externally"
  button.
- **Sprite include pin drift** — sprite upstream changes can silently break
  visual output. Snapshot tests catch the diagram-text change but not the
  rendered-image change. Consider a periodic visual-regression spot-check.
- **AWS-icons-for-PlantUML revisit** — currently not used. If we ever want
  cloud-vs-edge differentiation in topology diagrams, the AWS pack can layer
  cleanly on top of the devicons / FontAwesome catalog.

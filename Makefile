.PHONY: wasm wasm-node wasm-build cli vsix test all clean trust-report dist web-runtime

# Builds the WASM artifact + JS bindings directly via cargo + wasm-bindgen-cli.
# wasm-pack 0.14.0 is incompatible with current Cargo (renamed --out-dir flag),
# so we drive the toolchain manually. Install once with:
#   cargo install wasm-bindgen-cli --version 0.2.121
WASM_OUT      := packages/netjson-diagrams/wasm
WASM_NODE_OUT := packages/netjson-diagrams/wasm-node
WASM_INPUT    := target/wasm32-unknown-unknown/release/netjson_diagrams.wasm

# Final publish layout. `make dist` gathers every shippable artifact here.
DIST          := dist/netjson

wasm-build:
	cargo build --release --target wasm32-unknown-unknown \
		-p netjson_diagrams --features wasm

wasm: wasm-build
	mkdir -p $(WASM_OUT)
	wasm-bindgen --target bundler --out-dir $(WASM_OUT) $(WASM_INPUT)

wasm-node: wasm-build
	mkdir -p $(WASM_NODE_OUT)
	wasm-bindgen --target nodejs --out-dir $(WASM_NODE_OUT) $(WASM_INPUT)
	# wasm-bindgen's nodejs target emits CommonJS, but the package's root
	# package.json is "type": "module", so Node would treat these .js files as
	# ESM and the named imports in src/index.node.ts would fail. Pin the folder
	# back to CommonJS so the binding stays importable. (wasm-bindgen does not
	# emit this itself; without it a clean build breaks the Node smoke test.)
	echo '{ "type": "commonjs" }' > $(WASM_NODE_OUT)/package.json

cli:
	cargo build --release -p netjson-diagrams-cli

# Downloads + SHA-256-verifies the PlantUML TeaVM browser runtime. Required
# once before `cd apps/web && npm run dev|build`. Re-run after a release pin
# bump in scripts/fetch-plantuml-runtime.mjs.
web-runtime:
	node scripts/fetch-plantuml-runtime.mjs

vsix: wasm-node
	cd apps/vscode-extension && npm install && npm run package

test:
	cargo test --workspace

all: wasm wasm-node cli

# Gather every shippable artifact under $(DIST). Runs every dependent target.
# Layout:
#   dist/netjson/cli/        — release CLI binary
#   dist/netjson/wasm/       — bundler-target WASM + bindings
#   dist/netjson/wasm-node/  — Node-target WASM + bindings
#   dist/netjson/npm/        — packed npm tarball (.tgz)
#   dist/netjson/web/        — production web build (apps/web/dist)
#   dist/netjson/vsix/       — packaged VS Code extension (.vsix)
dist: all
	rm -rf $(DIST)
	mkdir -p $(DIST)/cli $(DIST)/wasm $(DIST)/wasm-node $(DIST)/npm $(DIST)/web $(DIST)/vsix
	cp target/release/netjson-diagrams $(DIST)/cli/ 2>/dev/null || true
	cp -R $(WASM_OUT)/. $(DIST)/wasm/ 2>/dev/null || true
	cp -R $(WASM_NODE_OUT)/. $(DIST)/wasm-node/ 2>/dev/null || true
	-cd packages/netjson-diagrams && npm pack --pack-destination ../../$(DIST)/npm
	$(MAKE) web-runtime
	-cd apps/web && npm run build && cp -R dist/. ../../$(DIST)/web/
	-cd apps/vscode-extension && npm run package && cp -- *.vsix ../../$(DIST)/vsix/
	@echo
	@echo "Artifacts published to $(DIST):"
	@ls -1 $(DIST) 2>/dev/null

clean:
	cargo clean
	rm -rf $(WASM_OUT) $(WASM_NODE_OUT) packages/netjson-diagrams/dist
	rm -rf apps/vscode-extension/dist apps/vscode-extension/*.vsix
	rm -rf apps/web/public/plantuml-runtime/*.js
	rm -rf dist

trust-report:
	bash scripts/trust-report.sh

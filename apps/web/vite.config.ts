import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [react(), wasm()],
  build: {
    // Native top-level await. vite-plugin-wasm injects `await WebAssembly.instantiate(...)`
    // at module scope; downcompiling that via vite-plugin-top-level-await rewrites
    // `function` declarations into `var` assignments, which broke d3-color hoisting
    // in the elsa-to-mermaid sibling. Emit native TLA — modern browsers handle it,
    // and we never rely on legacy targets.
    target: 'esnext',
  },
  server: {
    fs: {
      allow: ['../..'],
    },
  },
  optimizeDeps: {
    exclude: ['netjson-diagrams'],
  },
});

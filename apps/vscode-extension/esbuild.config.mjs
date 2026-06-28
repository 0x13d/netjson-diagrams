import { build, context } from 'esbuild';
import { mkdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  minify: !watch,
  // VS Code provides `vscode` at runtime. wasm-node files are require()d at
  // runtime from dist/wasm/, so they must NOT be bundled.
  external: ['vscode', './wasm/*'],
};

const webviewConfig = {
  entryPoints: ['src/webview/app.ts'],
  outfile: 'dist/webview.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  minify: !watch,
};

async function run() {
  await mkdir('dist', { recursive: true });
  if (watch) {
    const extCtx = await context(extensionConfig);
    const webCtx = await context(webviewConfig);
    await Promise.all([extCtx.watch(), webCtx.watch()]);
    console.log('▸ esbuild watching extension + webview…');
    return;
  }
  await Promise.all([build(extensionConfig), build(webviewConfig)]);
  console.log('✓ build complete: dist/extension.js + dist/webview.js');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

import * as vscode from 'vscode';
import { convert, convertPaper, type Direction } from './convert.js';
import { detectNetjson, type NetJsonKind } from './detect.js';

const VIEW_TYPE = 'netjsonDiagrams.preview';

interface Payload {
  status: 'ok' | 'not-netjson' | 'error';
  documentTitle: string;
  netjsonKind?: NetJsonKind;
  plantuml?: string;
  paper?: string;
  direction: Direction;
  message?: string;
}

function deriveTitle(jsonText: string): string {
  try {
    const j = JSON.parse(jsonText) as {
      type?: string;
      label?: string;
      general?: { hostname?: string };
      router_id?: string;
    };
    if (j.type === 'NetworkGraph' && j.label) return j.label;
    if (
      (j.type === 'DeviceConfiguration' || j.type === 'DeviceMonitoring') &&
      j.general?.hostname
    ) {
      return j.general.hostname;
    }
    if (j.type === 'NetworkRoutes' && j.router_id) return `routes-${j.router_id}`;
    return j.type ?? 'netjson';
  } catch {
    return 'netjson';
  }
}

function buildPayload(jsonText: string, direction: Direction): Payload {
  const documentTitle = deriveTitle(jsonText);
  const detected = detectNetjson(jsonText);
  if (!detected) {
    return {
      status: 'not-netjson',
      direction,
      documentTitle,
      message:
        'This file does not look like a NetJSON document — top-level `type` field must be one of NetworkGraph, DeviceConfiguration, DeviceMonitoring, NetworkRoutes, NetworkCollection.',
    };
  }
  try {
    return {
      status: 'ok',
      direction,
      documentTitle,
      netjsonKind: detected,
      plantuml: convert(jsonText, direction),
      paper: convertPaper(jsonText),
    };
  } catch (e) {
    return {
      status: 'error',
      direction,
      documentTitle,
      netjsonKind: detected,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export class NetjsonPreview {
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private direction: Direction;
  private debounceTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private document: vscode.TextDocument,
    column: vscode.ViewColumn,
  ) {
    this.direction = vscode.workspace
      .getConfiguration('netjsonDiagrams')
      .get<Direction>('defaultDirection', 'TD');

    this.panel = vscode.window.createWebviewPanel(VIEW_TYPE, this.title(), column, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
    });
    this.panel.webview.html = this.renderHtml();
    this.registerListeners();
    this.update();
  }

  reveal(column: vscode.ViewColumn): void {
    this.panel.reveal(column);
  }

  dispose(): void {
    this.panel.dispose();
    for (const d of this.disposables.splice(0)) d.dispose();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private title(): string {
    return `NetJSON · ${this.document.fileName.split(/[\\/]/).pop() ?? 'netjson.json'}`;
  }

  private registerListeners(): void {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === this.document.uri.toString()) {
          this.scheduleUpdate();
        }
      }),
      vscode.workspace.onDidCloseTextDocument((doc) => {
        if (doc.uri.toString() === this.document.uri.toString()) this.dispose();
      }),
      this.panel.webview.onDidReceiveMessage((msg) => this.onWebviewMessage(msg)),
      this.panel.onDidDispose(() => this.dispose()),
    );
  }

  private onWebviewMessage(msg: unknown): void {
    if (typeof msg !== 'object' || msg === null) return;
    const m = msg as { type?: string; direction?: Direction };
    switch (m.type) {
      case 'ready':
        this.update();
        break;
      case 'setDirection':
        if (m.direction && (m.direction === 'TD' || m.direction === 'LR')) {
          this.direction = m.direction;
          this.update();
        }
        break;
    }
  }

  private scheduleUpdate(): void {
    const ms = vscode.workspace
      .getConfiguration('netjsonDiagrams')
      .get<number>('previewDebounceMs', 200);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.update(), ms);
  }

  private update(): void {
    const payload = buildPayload(this.document.getText(), this.direction);
    void this.panel.webview.postMessage({ type: 'render', payload });
  }

  private renderHtml(): string {
    const nonce = randomNonce();
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js'),
    );
    const cspSource = webview.cspSource;
    return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; font-src ${cspSource}; script-src 'nonce-${nonce}';" />
<title>NetJSON Diagrams Preview</title>
<style>
  :root { color-scheme: var(--vscode-color-scheme, light dark); }
  html, body { height: 100%; margin: 0; padding: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
  .topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 14px; border-bottom: 1px solid var(--vscode-panel-border); position: sticky; top: 0; background: var(--vscode-editor-background); z-index: 2; }
  .group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .label { text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; color: var(--vscode-descriptionForeground); }
  .seg { display: inline-flex; border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 999px; padding: 2px; }
  .seg button { all: unset; cursor: pointer; padding: 2px 10px; border-radius: 999px; font-size: 11px; color: var(--vscode-descriptionForeground); }
  .seg button[aria-pressed="true"] { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  main { padding: 16px 20px 28px; }
  .center { display: flex; align-items: center; justify-content: center; padding: 6rem 1rem; }
  .empty { color: var(--vscode-descriptionForeground); text-align: center; max-width: 40ch; line-height: 1.55; }
  .error { color: var(--vscode-errorForeground); white-space: pre-wrap; font-family: var(--vscode-editor-font-family); font-size: 12.5px; max-width: 80ch; }
  pre.plantuml { white-space: pre; font-family: var(--vscode-editor-font-family); font-size: 12.5px; line-height: 1.55; padding: 14px 16px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: var(--vscode-textBlockQuote-background); overflow-x: auto; }
  .hint { color: var(--vscode-descriptionForeground); font-size: 12px; margin: 10px 2px 0; line-height: 1.5; max-width: 80ch; }
  .hint code { background: var(--vscode-textBlockQuote-background); padding: 0 4px; border-radius: 3px; font-size: 11.5px; }

  /* Paper */
  .paper { max-width: 100ch; line-height: 1.6; font-family: var(--vscode-font-family); }
  .paper h1 { font-size: 1.7rem; margin: 0.1rem 0 0.4rem; }
  .paper h2 { font-size: 1.3rem; margin: 1.5rem 0 0.3rem; }
  .paper h3 { font-size: 1.05rem; margin: 1rem 0 0.2rem; }
  .paper h4 { font-size: 0.95rem; margin: 0.8rem 0 0.2rem; color: var(--vscode-descriptionForeground); }
  .paper p, .paper li { font-size: 13.5px; }
  .paper ul { padding-left: 1.2rem; }
  .paper code { background: var(--vscode-textBlockQuote-background); padding: 1px 5px; border-radius: 3px; font-size: 12.5px; }
  .paper pre { background: var(--vscode-textBlockQuote-background); border: 1px solid var(--vscode-panel-border); padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 12px; }
  .paper table { border-collapse: collapse; margin: 8px 0; font-size: 12.5px; }
  .paper th, .paper td { border: 1px solid var(--vscode-panel-border); padding: 4px 10px; text-align: left; vertical-align: top; }
  .paper th { background: var(--vscode-textBlockQuote-background); }
</style>
</head>
<body>
<div class="topbar">
  <div class="group">
    <span class="label">View</span>
    <div class="seg" role="radiogroup" id="view">
      <button role="radio" data-v="diagram">Diagram</button>
      <button role="radio" data-v="paper">Paper</button>
    </div>
  </div>
  <div class="group">
    <span class="label">Direction</span>
    <div class="seg" role="radiogroup" id="direction">
      <button role="radio" data-d="TD">TD</button>
      <button role="radio" data-d="LR">LR</button>
    </div>
  </div>
</div>
<main><div id="root" class="center"></div></main>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function randomNonce(): string {
  let s = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

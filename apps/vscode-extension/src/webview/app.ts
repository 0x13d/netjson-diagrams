// Webview client. Receives `render` messages from the extension host, swaps
// view modes between Diagram (PlantUML text) and Paper (parsed markdown).
//
// No external dependencies — the markdown rendering is a tiny purpose-built
// pass over the well-defined output shape emitted by paper.rs.

type Direction = 'TD' | 'LR';
type View = 'diagram' | 'paper';

interface Payload {
  status: 'ok' | 'not-netjson' | 'error';
  documentTitle: string;
  netjsonKind?: string;
  plantuml?: string;
  paper?: string;
  direction: Direction;
  message?: string;
}

interface RenderMessage {
  type: 'render';
  payload: Payload;
}

const vscode = acquireVsCodeApi();

let lastPayload: Payload | null = null;
let view: View = 'diagram';

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

function elem(tag: string, text?: string, className?: string): HTMLElement {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}

function updateButtonStates(): void {
  for (const btn of document.querySelectorAll<HTMLButtonElement>('#view button')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.v === view));
  }
  if (lastPayload) {
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#direction button')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.d === lastPayload.direction));
    }
  }
}

function renderEmpty(message: string): void {
  const root = $('root');
  root.className = 'center';
  root.replaceChildren(elem('p', message, 'empty'));
}

function renderError(message: string): void {
  const root = $('root');
  root.className = '';
  root.replaceChildren(elem('pre', message, 'error'));
}

function renderDiagram(plantuml: string): void {
  const root = $('root');
  root.className = '';
  const pre = elem('pre', plantuml, 'plantuml');
  const hint = elem('p', undefined, 'hint');
  hint.append(
    'Render this locally with ',
    elem('code', 'plantuml diagram.puml'),
    ' (or any PlantUML install). Sprite includes resolve from PlantUML’s bundled stdlib — no network calls.',
  );
  root.replaceChildren(pre, hint);
}

function renderPaper(markdown: string): void {
  const root = $('root');
  root.className = '';
  const host = elem('div', undefined, 'paper');
  host.replaceChildren(...renderMarkdownNodes(markdown));
  root.replaceChildren(host);
}

function paint(): void {
  updateButtonStates();
  const p = lastPayload;
  if (!p) {
    renderEmpty('Loading…');
    return;
  }
  if (p.status === 'not-netjson') {
    renderEmpty(p.message ?? 'Not a NetJSON document.');
    return;
  }
  if (p.status === 'error') {
    renderError(p.message ?? 'Conversion failed.');
    return;
  }
  if (view === 'diagram') renderDiagram(p.plantuml ?? '');
  else renderPaper(p.paper ?? '');
}

window.addEventListener('message', (event: MessageEvent<RenderMessage>) => {
  if (event.data?.type === 'render') {
    lastPayload = event.data.payload;
    paint();
  }
});

document.querySelectorAll<HTMLButtonElement>('#view button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const v = btn.dataset.v as View | undefined;
    if (v === 'diagram' || v === 'paper') {
      view = v;
      paint();
    }
  });
});

document.querySelectorAll<HTMLButtonElement>('#direction button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const d = btn.dataset.d as Direction | undefined;
    if (d === 'TD' || d === 'LR') {
      vscode.postMessage({ type: 'setDirection', direction: d });
    }
  });
});

vscode.postMessage({ type: 'ready' });

// ── Tiny markdown renderer for paper.rs output ──────────────────────────────
//
// Targets exactly the shape paper.rs emits: ATX headings (# … ######), bullet
// lists with `-`, inline `**bold**`/`*italic*`/`` `code` ``, fenced ``` blocks
// (optional language hint), and pipe tables. HTML comments are stripped (they
// carry section anchors for downstream tooling).

function renderMarkdownNodes(md: string): Node[] {
  const cleaned = md.replace(/<!--[\s\S]*?-->/g, '');
  const lines = cleaned.split('\n');
  const out: Node[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      const lang = fence[1].trim();
      i++;
      const buf: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      if (lang) code.dataset.lang = lang;
      code.textContent = buf.join('\n');
      pre.appendChild(code);
      out.push(pre);
      continue;
    }
    // Pipe table — recognised by `|` at both ends and a separator on next line.
    if (
      /^\s*\|.*\|\s*$/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|?\s*[:\- ]+\s*(\|\s*[:\- ]+\s*)+\|?\s*$/.test(lines[i + 1])
    ) {
      const headerCells = splitTableRow(line);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      out.push(renderTable(headerCells, bodyRows));
      continue;
    }
    // Heading
    const head = line.match(/^(#{1,6})\s+(.*)$/);
    if (head) {
      const level = head[1].length;
      const el = document.createElement(`h${level}`);
      appendInline(el, head[2]);
      out.push(el);
      i++;
      continue;
    }
    // Unordered list (`- …` or `    - …` for nesting)
    if (/^\s*-\s+/.test(line)) {
      const result = parseList(lines, i);
      out.push(result.ul);
      i = result.next;
      continue;
    }
    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }
    // Paragraph: gather consecutive non-blank, non-heading, non-list lines
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^\s*-\s+/.test(lines[i]) &&
      !/^```/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    const p = document.createElement('p');
    appendInline(p, buf.join(' '));
    out.push(p);
  }
  return out;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function renderTable(header: string[], rows: string[][]): HTMLTableElement {
  const tbl = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for (const h of header) {
    const th = document.createElement('th');
    appendInline(th, h);
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  tbl.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const c of row) {
      const td = document.createElement('td');
      appendInline(td, c);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  tbl.appendChild(tbody);
  return tbl;
}

interface ListResult {
  ul: HTMLUListElement;
  next: number;
}

function parseList(lines: string[], start: number, baseIndent = 0): ListResult {
  const ul = document.createElement('ul');
  let i = start;
  while (i < lines.length) {
    const match = lines[i].match(/^(\s*)-\s+(.*)$/);
    if (!match) break;
    const indent = match[1].length;
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      const prev = ul.lastElementChild as HTMLLIElement | null;
      if (prev) {
        const nested = parseList(lines, i, indent);
        prev.appendChild(nested.ul);
        i = nested.next;
        continue;
      }
    }
    const li = document.createElement('li');
    appendInline(li, match[2]);
    ul.appendChild(li);
    i++;
  }
  return { ul, next: i };
}

function appendInline(host: HTMLElement, text: string): void {
  // Tokenise: `code`, **bold**, *italic*; everything else is literal text.
  const tokens = Array.from(text.matchAll(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g));
  let last = 0;
  for (const m of tokens) {
    const idx = m.index ?? 0;
    if (idx > last) host.appendChild(document.createTextNode(text.slice(last, idx)));
    const t = m[0];
    if (t.startsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = t.slice(2, -2);
      host.appendChild(strong);
    } else if (t.startsWith('*')) {
      const em = document.createElement('em');
      em.textContent = t.slice(1, -1);
      host.appendChild(em);
    } else {
      const code = document.createElement('code');
      code.textContent = t.slice(1, -1);
      host.appendChild(code);
    }
    last = idx + t.length;
  }
  if (last < text.length) host.appendChild(document.createTextNode(text.slice(last)));
}

// ── acquireVsCodeApi shim ───────────────────────────────────────────────────

interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState<T = unknown>(): T | undefined;
  setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

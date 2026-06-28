import * as vscode from 'vscode';
import { NetjsonPreview } from './preview.js';
import { detectNetjson } from './detect.js';

const previews = new Map<string, NetjsonPreview>();

function setContext(doc: vscode.TextDocument | undefined): void {
  const isNetjson =
    !!doc && doc.languageId === 'json' && detectNetjson(doc.getText()) !== null;
  void vscode.commands.executeCommand('setContext', 'netjsonDiagrams.isNetjson', isNetjson);
}

function openPreview(context: vscode.ExtensionContext, toSide: boolean): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showInformationMessage('Open a NetJSON file first.');
    return;
  }
  const document = editor.document;
  const key = document.uri.toString();
  const column = toSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active;
  const existing = previews.get(key);
  if (existing) {
    existing.reveal(column);
    return;
  }
  const preview = new NetjsonPreview(context, document, column);
  previews.set(key, preview);
  const cleanup = vscode.workspace.onDidCloseTextDocument((closed) => {
    if (closed.uri.toString() === key) {
      previews.delete(key);
      cleanup.dispose();
    }
  });
  context.subscriptions.push(cleanup);
}

type ExportKind = 'plantuml' | 'paper' | 'combined';

async function exportFile(kind: ExportKind): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showInformationMessage('Open a NetJSON file first.');
    return;
  }
  const detected = detectNetjson(editor.document.getText());
  if (!detected) {
    void vscode.window.showWarningMessage(
      'Current document is not a recognised NetJSON object type.',
    );
    return;
  }
  const direction = vscode.workspace
    .getConfiguration('netjsonDiagrams')
    .get<'TD' | 'LR'>('defaultDirection', 'TD');
  const { convert, convertPaper, convertCombined } = await import('./convert.js');
  let content: string;
  let suffix: string;
  let filters: Record<string, string[]>;
  try {
    switch (kind) {
      case 'plantuml':
        content = convert(editor.document.getText(), direction);
        suffix = '.puml';
        filters = { PlantUML: ['puml', 'plantuml'], Text: ['txt'] };
        break;
      case 'paper':
        content = convertPaper(editor.document.getText());
        suffix = '.paper.md';
        filters = { Markdown: ['md'] };
        break;
      case 'combined':
      default:
        content = convertCombined(editor.document.getText(), direction);
        suffix = '.combined.md';
        filters = { Markdown: ['md'] };
        break;
    }
  } catch (e) {
    void vscode.window.showErrorMessage(
      `Conversion failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return;
  }
  const defaultUri = vscode.Uri.file(
    editor.document.uri.fsPath.replace(/\.json$/i, '') + suffix,
  );
  const target = await vscode.window.showSaveDialog({
    defaultUri,
    filters,
    title:
      kind === 'plantuml'
        ? 'Export PlantUML'
        : kind === 'paper'
          ? 'Export Paper'
          : 'Export Combined Paper',
  });
  if (!target) return;
  await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf8'));
  void vscode.window.showInformationMessage(`Wrote ${target.fsPath}`);
}

export function activate(context: vscode.ExtensionContext): void {
  setContext(vscode.window.activeTextEditor?.document);
  context.subscriptions.push(
    vscode.commands.registerCommand('netjsonDiagrams.openPreview', () =>
      openPreview(context, false),
    ),
    vscode.commands.registerCommand('netjsonDiagrams.openPreviewToSide', () =>
      openPreview(context, true),
    ),
    vscode.commands.registerCommand('netjsonDiagrams.exportPlantuml', () =>
      exportFile('plantuml'),
    ),
    vscode.commands.registerCommand('netjsonDiagrams.exportPaper', () => exportFile('paper')),
    vscode.commands.registerCommand('netjsonDiagrams.exportCombined', () =>
      exportFile('combined'),
    ),
    vscode.window.onDidChangeActiveTextEditor((e) => setContext(e?.document)),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document === vscode.window.activeTextEditor?.document) {
        setContext(e.document);
      }
    }),
  );
}

export function deactivate(): void {
  for (const p of previews.values()) p.dispose();
  previews.clear();
}

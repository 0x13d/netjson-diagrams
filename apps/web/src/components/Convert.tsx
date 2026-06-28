import { useEffect, useMemo, useState } from 'react';
import { netjsonToPaper, netjsonToPlantuml } from 'netjson-diagrams';
import type { ConvertOptions } from 'netjson-diagrams';
import { DEFAULT_SAMPLE, SAMPLES } from '../samples';
import { Paper } from './Paper';
import { Diagram } from './Diagram';

type Direction = NonNullable<ConvertOptions['direction']>;
type ViewMode = 'spec' | 'diagram' | 'paper';

const VIEW_MODES: { id: ViewMode; label: string; sub: string }[] = [
  { id: 'spec', label: 'Spec', sub: 'NetJSON source' },
  { id: 'diagram', label: 'Diagram', sub: 'PlantUML' },
  { id: 'paper', label: 'Paper', sub: 'Markdown narrative' },
];

function downloadFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function Convert() {
  const [input, setInput] = useState<string>(DEFAULT_SAMPLE.json);
  const [direction, setDirection] = useState<Direction>('TD');
  const [view, setView] = useState<ViewMode>('diagram');
  const [plantuml, setPlantuml] = useState('');
  const [paper, setPaper] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'plantuml' | 'paper' | null>(null);
  const [showSource, setShowSource] = useState(false);

  const docTitle = useMemo(() => {
    try {
      const parsed = JSON.parse(input) as { type?: string; label?: string; general?: { hostname?: string }; router_id?: string };
      if (parsed.type === 'NetworkGraph' && parsed.label) return parsed.label;
      if (parsed.type === 'DeviceConfiguration' && parsed.general?.hostname) return parsed.general.hostname;
      if (parsed.type === 'DeviceMonitoring' && parsed.general?.hostname) return parsed.general.hostname;
      if (parsed.type === 'NetworkRoutes' && parsed.router_id) return `routes-${parsed.router_id}`;
      return parsed.type ?? 'netjson';
    } catch {
      return 'netjson';
    }
  }, [input]);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const trimmed = input.trim();
    if (!trimmed) {
      setPlantuml('');
      setPaper('');
      return;
    }

    Promise.all([
      netjsonToPlantuml(trimmed, { direction }),
      netjsonToPaper(trimmed),
    ])
      .then(([puml, md]) => {
        if (cancelled) return;
        setPlantuml(puml);
        setPaper(md);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(String(e instanceof Error ? e.message : e));
        setPlantuml('');
        setPaper('');
      });

    return () => {
      cancelled = true;
    };
  }, [input, direction]);

  const loadSample = (slug: string) => {
    const sample = SAMPLES.find((s) => s.slug === slug);
    if (sample) setInput(sample.json);
  };

  const copy = async (kind: 'plantuml' | 'paper') => {
    const text = kind === 'plantuml' ? plantuml : paper;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1400);
    } catch {
      // clipboard may be unavailable (insecure contexts); silently noop
    }
  };

  return (
    <section id="convert" className="mx-auto max-w-6xl px-6 sm:px-8 pb-20">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-inkSoft">
        <span className="inline-block w-6 h-px bg-ink/30" />
        <span>Convert</span>
      </div>
      <h2 className="mt-5 font-display text-[clamp(1.75rem,4vw,2.75rem)] leading-tight tracking-tightest">
        Three views of one document.
      </h2>
      <p className="mt-3 max-w-2xl text-inkSoft text-[15.5px] leading-[1.6]">
        Edit the Spec tab and watch the Diagram and Paper rebuild on every keystroke. The PlantUML
        text is what you'd compile with <code className="font-mono text-[13px] bg-paperDim px-1.5 py-0.5 rounded">plantuml.jar</code> locally — no
        third-party servers are involved.
      </p>

      {/* Toolbar */}
      <div className="mt-8 flex flex-wrap items-center gap-3 text-[13px]">
        <label className="flex items-center gap-2 text-inkSoft">
          <span className="uppercase tracking-[0.18em] text-[11px]">Sample</span>
          <select
            value={SAMPLES.find((s) => s.json === input)?.slug ?? ''}
            onChange={(e) => loadSample(e.target.value)}
            className="bg-paperDim border border-ink/15 rounded-md px-2.5 py-1 text-ink"
          >
            <option value="">(custom)</option>
            {SAMPLES.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label} — {s.description}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-inkSoft">
          <span className="uppercase tracking-[0.18em] text-[11px]">Direction</span>
          <div className="inline-flex rounded-md overflow-hidden border border-ink/15">
            {(['TD', 'LR'] as Direction[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={`px-2.5 py-1 text-ink ${
                  direction === d ? 'bg-ink text-paper' : 'bg-paperDim hover:bg-ink/5'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </label>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex items-end gap-0 border-b border-ink/15">
        {VIEW_MODES.map((m) => {
          const active = view === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setView(m.id)}
              className={`px-4 pt-2 pb-2.5 -mb-px border-b-2 transition-colors ${
                active
                  ? 'border-ember text-ink'
                  : 'border-transparent text-inkSoft hover:text-ink'
              }`}
            >
              <div className="text-[14px] font-medium tracking-tight">{m.label}</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-inkSoft">{m.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Surface */}
      <div className="mt-4 rounded-lg border border-ink/10 bg-paper shadow-sm">
        {view === 'spec' && (
          <div className="p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              className="w-full min-h-[420px] font-mono text-[13px] leading-[1.55] bg-paperDim/40 border border-ink/10 rounded-md p-3 text-ink focus:outline-none focus:border-ember/60"
            />
            <div className="mt-2 flex items-center justify-between text-[12px] text-inkSoft">
              <span>NetJSON document title: <span className="font-mono text-ink">{docTitle}</span></span>
              <span>{input.length.toLocaleString()} chars</span>
            </div>
          </div>
        )}
        {view === 'diagram' && (
          <DiagramTab
            text={plantuml}
            error={error}
            docTitle={docTitle}
            showSource={showSource}
            onToggleSource={() => setShowSource((v) => !v)}
            copied={copied === 'plantuml'}
            onCopy={() => copy('plantuml')}
            onDownload={() => downloadFile(`${docTitle}.puml`, plantuml, 'text/plain')}
          />
        )}
        {view === 'paper' && (
          <PaperTab
            markdown={paper}
            error={error}
            docTitle={docTitle}
            copied={copied === 'paper'}
            onCopy={() => copy('paper')}
            onDownload={() => downloadFile(`${docTitle}.md`, paper, 'text/markdown')}
          />
        )}
      </div>

      {view === 'diagram' && (
        <p className="mt-4 max-w-3xl text-[13px] leading-[1.6] text-inkSoft">
          <strong className="text-ink">Renderer:</strong> the official PlantUML TeaVM build
          (Java&nbsp;→&nbsp;JavaScript), vendored from{' '}
          <a
            className="underline decoration-ink/30 hover:decoration-ink"
            href="https://github.com/plantuml/plantuml/releases"
            target="_blank"
            rel="noreferrer"
          >
            github.com/plantuml/plantuml
          </a>
          . Loads on first activation (~28 MB, cached). Nothing leaves your browser; no third-party server is contacted at render time.
        </p>
      )}
    </section>
  );
}

function DiagramTab(props: {
  text: string;
  error: string | null;
  docTitle: string;
  showSource: boolean;
  onToggleSource: () => void;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="p-3">
      {props.error ? (
        <ErrorBlock error={props.error} />
      ) : (
        <Diagram
          plantuml={props.text}
          showSource={props.showSource}
          // When the user hits "View PlantUML source instead" inside the
          // loading overlay, we don't toggle (which would flip back if they
          // ever re-entered) — we *set* to source so the escape sticks until
          // they explicitly switch back via the toolbar.
          onSwitchToSource={props.showSource ? undefined : props.onToggleSource}
        />
      )}
      <Toolbar
        copied={props.copied}
        onCopy={props.onCopy}
        onDownload={props.onDownload}
        downloadName={`${props.docTitle}.puml`}
        sourceToggle={{ showSource: props.showSource, onToggle: props.onToggleSource }}
      />
    </div>
  );
}

function PaperTab(props: {
  markdown: string;
  error: string | null;
  docTitle: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="p-5">
      {props.error ? (
        <ErrorBlock error={props.error} />
      ) : (
        <Paper markdown={props.markdown || ''} />
      )}
      <Toolbar
        copied={props.copied}
        onCopy={props.onCopy}
        onDownload={props.onDownload}
        downloadName={`${props.docTitle}.md`}
      />
    </div>
  );
}

function Toolbar(props: {
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  downloadName: string;
  sourceToggle?: { showSource: boolean; onToggle: () => void };
}) {
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-[12.5px]">
      {props.sourceToggle && (
        <button
          type="button"
          onClick={props.sourceToggle.onToggle}
          className="px-3 py-1 rounded-md border border-ink/15 hover:border-ink/40 text-ink transition-colors"
        >
          {props.sourceToggle.showSource ? 'View rendered' : 'View source'}
        </button>
      )}
      <button
        type="button"
        onClick={props.onCopy}
        className="px-3 py-1 rounded-md border border-ink/15 hover:border-ink/40 text-ink transition-colors"
      >
        {props.copied ? 'Copied ✓' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={props.onDownload}
        className="px-3 py-1 rounded-md bg-ink text-paper hover:bg-ember transition-colors"
      >
        Download {props.downloadName}
      </button>
    </div>
  );
}

function ErrorBlock({ error }: { error: string }) {
  return (
    <div className="font-mono text-[13px] leading-[1.55] bg-paperDim/40 border border-ember/40 rounded-md p-4 text-ember">
      {error}
    </div>
  );
}

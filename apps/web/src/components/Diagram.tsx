import { useEffect, useId, useRef, useState } from 'react';
import { loadPlantuml, type LoadProgress } from '../lib/plantumlRuntime';
import { LoadingOverlay } from './LoadingOverlay';

interface DiagramProps {
  plantuml: string;
  /** When true, show raw PlantUML text instead of the rendered SVG. */
  showSource: boolean;
  /** Caller-provided escape hatch: lets the user opt out of waiting for
   *  the renderer and view source instead. Surfaced inside the overlay. */
  onSwitchToSource?: () => void;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function Diagram({ plantuml, showSource, onSwitchToSource }: DiagramProps) {
  const hostId = useId().replace(/:/g, '_');
  const hostRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<((lines: string[], id: string) => void) | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);

  // Lazy-load the PlantUML runtime once the diagram is asked to render.
  useEffect(() => {
    if (showSource || renderRef.current) return;
    setStatus('loading');
    setError(null);
    let cancelled = false;
    loadPlantuml((p) => {
      if (cancelled) return;
      setProgress(p);
    })
      .then((render) => {
        if (cancelled) return;
        renderRef.current = render;
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [showSource]);

  // Render whenever input changes (after runtime is ready).
  useEffect(() => {
    if (showSource) return;
    if (status !== 'ready') return;
    const render = renderRef.current;
    if (!render) return;
    const host = hostRef.current;
    if (!host) return;
    try {
      host.replaceChildren();
      render(plantuml.split(/\r\n|\r|\n/), hostId);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [plantuml, status, hostId, showSource]);

  if (showSource) {
    return (
      <pre className="font-mono text-[12.5px] leading-[1.6] bg-paperDim/40 border border-ink/10 rounded-md p-4 text-ink overflow-x-auto max-h-[560px]">
        <code>{plantuml || '(empty)'}</code>
      </pre>
    );
  }

  return (
    <div className="bg-paperDim/30 border border-ink/10 rounded-md p-4 min-h-[320px] relative overflow-x-auto">
      {status === 'error' && (
        <p className="text-[13px] text-ember">
          PlantUML runtime failed to load: <span className="font-mono">{error}</span>
        </p>
      )}
      {error && status === 'ready' && (
        <p className="text-[13px] text-ember mb-2">
          Render error: <span className="font-mono">{error}</span>
        </p>
      )}
      {/* The TeaVM render() injects the SVG into this div by id */}
      <div id={hostId} ref={hostRef} className="puml-host" />
      {status === 'loading' && (
        <LoadingOverlay progress={progress} onSwitchToSource={onSwitchToSource} />
      )}
    </div>
  );
}

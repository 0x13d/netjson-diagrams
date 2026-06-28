import type { FileProgress, LoadProgress } from '../lib/plantumlRuntime';

interface LoadingOverlayProps {
  progress: LoadProgress | null;
  onSwitchToSource?: () => void;
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function LoadingOverlay({ progress, onSwitchToSource }: LoadingOverlayProps) {
  const totalSize = progress?.totalSize ?? 0;
  const totalReceived = progress?.totalReceived ?? 0;
  const percent = totalSize > 0 ? Math.min(100, (totalReceived / totalSize) * 100) : 0;
  const fromCache = (progress?.files ?? []).every((f) => f.source === 'cache' || f.source === 'done');
  const allFromCache = (progress?.files ?? []).every((f) => f.source === 'cache');

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-paper/85 backdrop-blur-sm rounded-md">
      <div className="w-full max-w-md animate-riseIn">
        <div className="flex items-center gap-3 mb-3">
          <Spinner />
          <div>
            <h3 className="font-display text-[20px] leading-tight tracking-tightest">
              {allFromCache ? 'Restoring PlantUML renderer' : 'Loading PlantUML renderer'}
            </h3>
            <p className="text-[11.5px] text-inkSoft mt-0.5">
              {fromCache && allFromCache
                ? 'Hitting your local cache — no network call.'
                : 'First-time download. Cached locally for next time.'}
            </p>
          </div>
        </div>

        <ProgressBar percent={percent} />
        <div className="flex items-baseline justify-between mt-1.5">
          <span className="text-[11.5px] text-inkSoft font-mono">
            {humanBytes(totalReceived)} / {humanBytes(totalSize)}
          </span>
          <span className="text-[11.5px] text-inkSoft font-mono">{percent.toFixed(0)}%</span>
        </div>

        <ul className="mt-4 space-y-1.5">
          {(progress?.files ?? []).map((f) => (
            <FileRow key={f.name} file={f} />
          ))}
        </ul>

        {onSwitchToSource && (
          <div className="mt-5 flex items-center justify-between text-[12px]">
            <span className="text-inkSoft">
              Don&rsquo;t want to wait?
            </span>
            <button
              type="button"
              onClick={onSwitchToSource}
              className="px-3 py-1 rounded-md border border-ink/15 hover:border-ink/40 text-ink transition-colors"
            >
              View PlantUML source instead →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-ink/10 overflow-hidden">
      <div
        className="h-full bg-ember transition-[width] duration-150 ease-out"
        style={{ width: `${percent}%` }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

function FileRow({ file }: { file: FileProgress }) {
  const filePercent = file.size > 0 ? Math.min(100, (file.received / file.size) * 100) : 0;
  return (
    <li className="flex items-center gap-2 text-[12px] font-mono">
      <SourceGlyph source={file.source} />
      <span className="flex-1 text-ink truncate">{file.name}</span>
      <span className="text-inkSoft tabular-nums">
        {file.source === 'cache'
          ? `cached · ${humanBytes(file.size)}`
          : file.source === 'pending'
            ? `queued · ${humanBytes(file.size)}`
            : file.source === 'error'
              ? 'failed'
              : `${humanBytes(file.received)} / ${humanBytes(file.size)} · ${filePercent.toFixed(0)}%`}
      </span>
    </li>
  );
}

function SourceGlyph({ source }: { source: FileProgress['source'] }) {
  const cls = 'inline-block w-2 h-2 rounded-full flex-shrink-0';
  switch (source) {
    case 'cache':
      // Solid; nothing transferred.
      return <span className={`${cls} bg-ink/50`} aria-label="from cache" />;
    case 'fetching':
      // Pulse to signal activity.
      return <span className={`${cls} bg-ember animate-pulse`} aria-label="downloading" />;
    case 'done':
      return <span className={`${cls} bg-ember`} aria-label="downloaded" />;
    case 'error':
      // Use a hollow ring via border + transparent bg to imply failure.
      return <span className={`${cls} border border-ember bg-paper`} aria-label="failed" />;
    case 'pending':
    default:
      return <span className={`${cls} border border-ink/30 bg-paper`} aria-label="queued" />;
  }
}

function Spinner() {
  return (
    <svg
      className="w-6 h-6 text-ember"
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="loading"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

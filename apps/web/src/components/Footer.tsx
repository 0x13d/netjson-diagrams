export function Footer() {
  // Portfolio web-standard footer (EPIC-011): constant #3a3a3a, links back to the
  // ariugwu.com home page. See _shared/web-standard/README.md.
  return (
    <footer className="bg-footer text-paper/75 mt-24">
      <div className="mx-auto max-w-6xl px-6 sm:px-8 py-8 text-[13px] flex flex-wrap items-center justify-between gap-3">
        <span>
          netjson-diagrams · Rust core compiled to WASM · runs locally in your browser, no third-party servers.
        </span>
        <span className="flex items-center gap-5">
          <a
            href="https://github.com/ariugwu/netjson-diagrams"
            target="_blank"
            rel="noreferrer"
            className="text-paper/85 hover:text-paper transition-colors"
          >
            github →
          </a>
          <a href="https://ariugwu.com" className="inline-flex items-center gap-1.5 text-paper/85 hover:text-paper transition-colors">
            <span aria-hidden="true">←</span>
            ariugwu.com
          </a>
        </span>
      </div>
    </footer>
  );
}

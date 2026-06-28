function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function Hero() {
  return (
    <section id="top" style={{ paddingTop: '0.75rem'}} className="relative mx-auto max-w-6xl px-6 pt-20 pb-14 sm:pb-20">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-inkSoft animate-fadeIn">
        <span className="inline-block w-6 h-px bg-ink/30" />
        <span>NetJSON visualizer</span>
      </div>

      <h1
        className="mt-6 font-display text-[clamp(2.5rem,6.5vw,5rem)] leading-[0.96] tracking-tightest text-balance animate-riseIn"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 30' }}
      >
        Networks,
        <br />
        <em
          className="not-italic text-ember"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1' }}
        >
          rendered.
        </em>
      </h1>

      <p
        className="mt-7 max-w-xl text-[17px] leading-[1.6] text-inkSoft text-pretty animate-riseIn"
        style={{ animationDelay: '120ms' }}
      >
        Paste a NetJSON document — graph, configuration, monitoring, routes, or a collection — and
        read it back as a PlantUML deployment diagram plus a Markdown paper of the metadata that
        doesn't fit cleanly in a diagram. Same engine that drives the CLI and the npm package,
        running locally in WebAssembly.
      </p>

      <div
        className="mt-10 flex flex-wrap items-center gap-3 text-sm animate-riseIn"
        style={{ animationDelay: '220ms' }}
      >
        <button
          type="button"
          onClick={() => scrollToId('convert')}
          className="px-5 py-2.5 rounded-full bg-ink text-paper font-medium hover:bg-ember transition-colors"
        >
          Try the converter
        </button>
        <button
          type="button"
          onClick={() => scrollToId('how')}
          className="px-5 py-2.5 rounded-full border border-ink/15 hover:border-ink/40 transition-colors text-ink"
        >
          How it works →
        </button>
      </div>

      <div
        className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 max-w-3xl animate-fadeIn"
        style={{ animationDelay: '380ms' }}
      >
        {[
          ['Types', 'All five NetJSON shapes'],
          ['Output', 'PlantUML + paper'],
          ['Sprites', 'tupadr3, offline'],
          ['Engine', 'Rust → WASM'],
        ].map(([k, v]) => (
          <div key={k} className="border-t border-ink/15 pt-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-inkSoft">{k}</div>
            <div className="text-[14px] mt-0.5 text-ink">{v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

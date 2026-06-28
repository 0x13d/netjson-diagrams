const STEPS = [
  {
    n: '01',
    title: 'Detect',
    body: 'The Rust core inspects the top-level `type` field and routes to one of five normalizers — NetworkGraph, DeviceConfiguration, DeviceMonitoring, NetworkRoutes, NetworkCollection.',
  },
  {
    n: '02',
    title: 'Normalize',
    body: 'JSON becomes a typed IR. Roles classify by `properties.role` → `kind` → label substring. Interface kinds (ethernet, wireless, bridge, loopback, virtual) map to sprite icons.',
  },
  {
    n: '03',
    title: 'Render',
    body: 'IR becomes a PlantUML deployment / component diagram. Only the sprite includes the diagram actually uses are emitted. Stdlib-style `!include <tupadr3/...>` resolves offline.',
  },
  {
    n: '04',
    title: 'Paper',
    body: 'The metadata that doesn’t shape well — DNS, encryption, full routing tables, monitoring statistics — auto-generates as a Markdown paper. No field appears in both diagram and paper.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 sm:px-8 py-20">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-inkSoft">
        <span className="inline-block w-6 h-px bg-ink/30" />
        <span>How it works</span>
      </div>
      <h2 className="mt-5 font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-tight tracking-tightest">
        Four pipeline stages, one Rust core.
      </h2>
      <p className="mt-4 max-w-2xl text-inkSoft text-[16px] leading-[1.65]">
        Same pipeline whether you call the CLI, the npm package, or load the browser demo. No
        runtime network calls — sprite includes resolve against PlantUML's bundled stdlib.
      </p>
      <ol className="mt-10 grid sm:grid-cols-2 gap-x-10 gap-y-8">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-5">
            <div className="font-mono text-[12px] text-inkSoft pt-1.5">{s.n}</div>
            <div>
              <h3 className="text-[18px] font-medium tracking-tight">{s.title}</h3>
              <p className="mt-1.5 text-[15px] leading-[1.6] text-inkSoft text-pretty">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

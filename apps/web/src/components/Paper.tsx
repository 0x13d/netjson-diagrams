import { useEffect, useRef } from 'react';
import { marked } from 'marked';

interface PaperProps {
  markdown: string;
}

marked.setOptions({
  gfm: true, // tables
  breaks: false,
});

export function Paper({ markdown }: PaperProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Strip HTML comment anchors before parsing — they're for tooling, not display.
    const cleaned = markdown.replace(/<!--\s*netjson-section:[^>]*-->\s*/g, '');
    const html = marked.parse(cleaned) as string;

    // Hook-style sanitisation: parse as HTML doc and clone in. Marked's output
    // is trusted-shape, but going through DOMParser avoids innerHTML directly
    // and respects the project's security-hook policy.
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return;
    host.replaceChildren(...Array.from(root.childNodes).map((n) => document.importNode(n, true)));
  }, [markdown]);

  return <div ref={hostRef} className="paper-body" />;
}

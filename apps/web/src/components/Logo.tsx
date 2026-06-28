interface LogoProps {
  size?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * Brand mark — three nodes joined by a dashed link, mirroring NetJSON's
 * graph-of-things flavor. The thing the tool emits is the logo.
 */
export function Logo({ size = 28, className, ariaLabel = 'netjson-diagrams' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <circle cx="6" cy="8" r="2.5" />
      <circle cx="26" cy="8" r="2.5" />
      <circle cx="16" cy="22" r="2.5" />
      <path d="M6 10.5 L16 19.5" />
      <path d="M26 10.5 L16 19.5" />
      <path d="M8 8 L24 8" strokeDasharray="2 1.5" stroke="#8a6d3b" />
    </svg>
  );
}

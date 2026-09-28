/** Small line icons for the graph panel. They inherit currentColor. */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ChevronLeft({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12.5 4.5 7 10l5.5 5.5" />
    </svg>
  );
}

export function ChevronRight({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7.5 4.5 13 10l-5.5 5.5" />
    </svg>
  );
}

export function InboxIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 11.5 5 5h10l2 6.5V15.5H3v-4Z" />
      <path d="M3 11.5h4l1 2h4l1-2h4" />
    </svg>
  );
}

/** An open book: Studio is where the by-hand practice happens. */
export function StudioIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 5.5C8.5 4.3 6.3 4 3.5 4.3v10.4c2.8-.3 5 .1 6.5 1.3 1.5-1.2 3.7-1.6 6.5-1.3V4.3C13.7 4 11.5 4.3 10 5.5Z" />
      <path d="M10 5.5V16" />
    </svg>
  );
}

export function CloseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}

export function Spinner({ className = "h-3 w-3" }: IconProps) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-spin rounded-full border-[1.5px] border-current border-t-transparent ${className}`}
    />
  );
}

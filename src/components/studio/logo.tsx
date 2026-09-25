import { cn } from "@/lib/utils";

export function StudioLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="5" width="11.5" height="22" rx="2.5" className="fill-surface" />
      <rect x="17.5" y="5" width="11.5" height="22" rx="2.5" className="fill-surface" />
      <path d="M15.2 4.5v23" className="stroke-brand" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M6.5 11h5M6.5 16h4M20.5 11h5M20.5 16h3.5" className="stroke-foreground-muted" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

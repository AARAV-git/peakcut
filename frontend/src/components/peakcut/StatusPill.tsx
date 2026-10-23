"use client";

import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "muted" | "accent" | "amber";

const tones: Record<Tone, string> = {
  ok: "bg-primary/12 text-primary border-primary/25",
  warn: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  muted: "bg-muted text-muted-foreground border-border",
  accent: "bg-primary/12 text-primary border-primary/25",
  amber: "bg-amber-500/12 text-amber-300 border-amber-500/25",
};

export function StatusPill({
  tone = "muted",
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide tabular",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

"use client";

import { cn } from "@/lib/utils";

export function SectionTitle({
  eyebrow,
  title,
  description,
  icon: Icon,
  right,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="space-y-1.5">
        {eyebrow && (
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-primary/80">
            {Icon && <Icon className="size-3.5" />}
            {eyebrow}
          </div>
        )}
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="max-w-2xl text-sm text-muted-foreground text-balance">
            {description}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

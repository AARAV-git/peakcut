"use client";

import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ErrorBanner({
  message,
  onDismiss,
  className,
}: {
  message: string;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex-1 text-destructive-foreground/90 text-foreground/80">
        <span className="font-medium text-destructive">Request failed. </span>
        <span className="text-foreground/70">{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="rounded p-1 text-muted-foreground transition hover:bg-destructive/15 hover:text-foreground"
          aria-label="Dismiss error"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

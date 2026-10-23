"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Loader({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground text-sm", className)}>
      <Loader2 className="size-4 animate-spin text-primary" />
      {label && <span>{label}</span>}
    </div>
  );
}

export function FullLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 className="size-7 animate-spin text-primary" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { Play, Sparkles, Tag } from "lucide-react";
import type { Highlight, Summary } from "@/lib/peakcut/types";
import { fmtScore, formatTime } from "@/lib/peakcut/format";
import { cn } from "@/lib/utils";

export function HighlightCard({
  highlight,
  summary,
  active,
  onPlay,
}: {
  highlight: Highlight;
  summary?: Summary;
  active: boolean;
  onPlay: () => void;
}) {
  const duration = highlight.end_sec - highlight.start_sec;
  const scorePct = Math.round(highlight.score * 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card/60 p-3.5 transition",
        active
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
          : "border-border hover:border-primary/30",
      )}
    >
      {active && (
        <span className="absolute left-0 top-0 h-full w-0.5 bg-primary" aria-hidden />
      )}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-8 shrink-0 flex-col items-center justify-center rounded-md text-xs font-bold tabular",
            active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80",
          )}
        >
          {highlight.rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground tabular">
              {highlight.highlight_id}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground tabular">
              {formatTime(highlight.start_sec)}–{formatTime(highlight.end_sec)}
              <span className="text-muted-foreground/60">· {duration.toFixed(1)}s</span>
            </span>
          </div>

          {summary ? (
            <>
              <h4 className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                {summary.title}
              </h4>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {summary.summary}
              </p>
              {summary.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {summary.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      <Tag className="size-2.5" />
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="mt-1 space-y-1.5">
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
            </div>
          )}

          {/* score bar */}
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-primary"
                style={{ width: `${scorePct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-foreground/80 tabular">
              {fmtScore(highlight.score)}
            </span>
          </div>
        </div>

        <button
          onClick={onPlay}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg border transition",
            active
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary",
          )}
          aria-label={`Play highlight ${highlight.highlight_id}`}
          title={`Jump to ${formatTime(highlight.start_sec)}`}
        >
          <Play className="ml-0.5 size-4" />
        </button>
      </div>
    </motion.div>
  );
}

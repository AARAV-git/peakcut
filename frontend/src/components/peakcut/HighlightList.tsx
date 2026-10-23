"use client";

import { motion } from "framer-motion";
import { ListVideo } from "lucide-react";
import type { HighlightsResponse, Summary } from "@/lib/peakcut/types";
import { HighlightCard } from "./HighlightCard";
import { FullLoader } from "./Loader";

export function HighlightList({
  highlights,
  summaries,
  currentTime,
  loadingSummaries,
  onSeek,
}: {
  highlights: HighlightsResponse;
  summaries: Summary[];
  currentTime: number;
  loadingSummaries: boolean;
  onSeek: (t: number) => void;
}) {
  const summaryMap = new Map(summaries.map((s) => [s.highlight_id, s]));
  const sorted = [...highlights.highlights].sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListVideo className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Highlights</h3>
        </div>
        <span className="text-[11px] text-muted-foreground tabular">
          {sorted.length} segments · {Math.round(highlights.budget_ratio * 100)}% budget
        </span>
      </div>
      <div className="scrollbar-slim -mr-2 max-h-[560px] flex-1 space-y-2.5 overflow-y-auto pr-2">
        {sorted.map((h) => (
          <HighlightCard
            key={h.highlight_id}
            highlight={h}
            summary={summaryMap.get(h.highlight_id)}
            active={currentTime >= h.start_sec && currentTime <= h.end_sec}
            onPlay={() => onSeek(h.start_sec)}
          />
        ))}
        {loadingSummaries && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-2"
          >
            <FullLoader label="Generating LLM titles & summaries" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

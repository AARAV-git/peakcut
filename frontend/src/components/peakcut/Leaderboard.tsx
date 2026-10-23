"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown, Crown, Medal } from "lucide-react";
import type { ExperimentRun } from "@/lib/peakcut/types";
import { fmtDate, fmtScore } from "@/lib/peakcut/format";
import { StatusPill } from "./StatusPill";
import { cn } from "@/lib/utils";

type SortKey = "f1" | "map" | "precision" | "recall" | "run_id" | "trained_at";

export function Leaderboard({
  runs,
  selectedRunId,
  onSelect,
}: {
  runs: ExperimentRun[];
  selectedRunId: string;
  onSelect: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("f1");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [lossFilter, setLossFilter] = useState<string>("all");
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");

  const losses = useMemo(
    () => Array.from(new Set(runs.map((r) => r.loss))),
    [runs],
  );
  const frameworks = useMemo(
    () => Array.from(new Set(runs.map((r) => r.framework))),
    [runs],
  );

  const filtered = useMemo(() => {
    let out = runs.filter(
      (r) =>
        (lossFilter === "all" || r.loss === lossFilter) &&
        (frameworkFilter === "all" || r.framework === frameworkFilter),
    );
    out = [...out].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return out;
  }, [runs, lossFilter, frameworkFilter, sortKey, sortDir]);

  const bestF1 = Math.max(...runs.map((r) => r.f1));

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "run_id" || key === "trained_at" ? "asc" : "desc");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/50">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2.5">
        <span className="text-xs font-medium text-muted-foreground">Filter</span>
        <select
          value={lossFilter}
          onChange={(e) => setLossFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none transition focus:border-primary"
        >
          <option value="all">All losses</option>
          {losses.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={frameworkFilter}
          onChange={(e) => setFrameworkFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none transition focus:border-primary"
        >
          <option value="all">All frameworks</option>
          {frameworks.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[11px] text-muted-foreground tabular">
          {filtered.length} of {runs.length} runs
        </span>
      </div>

      <div className="scrollbar-slim overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">
                <SortBtn label="Run" k="run_id" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              </th>
              <th className="px-3 py-2.5 font-medium">Framework</th>
              <th className="px-3 py-2.5 font-medium">Loss</th>
              <th className="px-3 py-2.5 font-medium">Backbone</th>
              <th className="px-3 py-2.5 text-right font-medium">
                <SortBtn label="F1" k="f1" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium">
                <SortBtn label="mAP" k="map" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium">
                <SortBtn label="Prec" k="precision" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium">
                <SortBtn label="Rec" k="recall" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
              </th>
              <th className="px-4 py-2.5 text-right font-medium">
                <SortBtn label="Trained" k="trained_at" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const selected = r.run_id === selectedRunId;
              const isBest = r.f1 === bestF1;
              return (
                <motion.tr
                  key={r.run_id}
                  layout
                  onClick={() => onSelect(r.run_id)}
                  className={cn(
                    "cursor-pointer border-b border-border/40 transition last:border-0",
                    selected
                      ? "bg-primary/8"
                      : "hover:bg-accent/50",
                  )}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground tabular">
                      {i === 0 && sortKey === "f1" && sortDir === "desc" ? (
                        <Crown className="size-3.5 text-amber-400" />
                      ) : i < 3 && sortKey === "f1" && sortDir === "desc" ? (
                        <Medal className="size-3.5 text-primary/70" />
                      ) : null}
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-foreground">
                        {r.run_id}
                      </span>
                      {isBest && <StatusPill tone="amber">best F1</StatusPill>}
                      {r.note === "Feature-space baseline, no training" && (
                        <StatusPill tone="muted">baseline</StatusPill>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-medium",
                      r.framework === "pytorch"
                        ? "bg-orange-500/12 text-orange-300"
                        : "bg-rose-500/12 text-rose-300",
                    )}>
                      {r.framework}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground/80">{r.loss}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{r.backbone}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-mono text-sm font-semibold text-foreground tabular">
                      {fmtScore(r.f1)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-sm text-foreground/80 tabular">
                    {fmtScore(r.map)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground tabular">
                    {fmtScore(r.precision)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground tabular">
                    {fmtScore(r.recall)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular">
                    {fmtDate(r.trained_at)}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortBtn({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <button
      onClick={() => onClick(k)}
      className={cn(
        "inline-flex items-center gap-1 transition hover:text-foreground",
        align === "right" && "flex-row-reverse",
        active && "text-foreground",
      )}
    >
      {label}
      {active ? (
        sortDir === "asc" ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </button>
  );
}

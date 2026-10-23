"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Cpu,
  FlaskConical,
  GitBranch,
  Layers,
  Network,
  TrendingUp,
} from "lucide-react";
import { Leaderboard } from "./Leaderboard";
import { CategoryMetrics } from "./CategoryMetrics";
import { SectionTitle } from "./SectionTitle";
import { StatusPill } from "./StatusPill";
import { FullLoader } from "./Loader";
import { ErrorBanner } from "./ErrorBanner";
import { getExperiments, getRunMetricsApi } from "@/lib/peakcut/api";
import { fmtCompact, fmtDate, fmtScore } from "@/lib/peakcut/format";
import type { ExperimentRun, RunMetrics } from "@/lib/peakcut/types";

export function ExperimentsPage() {
  const [runs, setRuns] = useState<ExperimentRun[] | null>(null);
  const [selectedRunId, setSelectedRunId] = useState("ranking_s42");
  const [metrics, setMetrics] = useState<RunMetrics | null>(null);
  const [metricsRunId, setMetricsRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getExperiments()
      .then(setRuns)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load experiments"));
  }, []);

  // Loading is derived: true while the fetched metrics don't match the
  // current selection. State is only mutated inside async callbacks, which
  // keeps this effect free of synchronous setState calls.
  const loadingMetrics = metricsRunId !== selectedRunId;

  useEffect(() => {
    let alive = true;
    getRunMetricsApi(selectedRunId)
      .then((m) => {
        if (!alive) return;
        setMetrics(m);
        setMetricsRunId(selectedRunId);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load metrics");
        setMetricsRunId(selectedRunId);
      });
    return () => {
      alive = false;
    };
  }, [selectedRunId]);

  const selectedRun = runs?.find((r) => r.run_id === selectedRunId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionTitle
        eyebrow="Experiments"
        title="Leaderboard & per-category metrics"
        description="Every trained run across loss functions and frameworks, scored by F1 and mAP on the held-out benchmark. Select a row to inspect its category breakdown."
        icon={FlaskConical}
        right={
          runs && (
            <div className="flex items-center gap-2">
              <StatusPill tone="muted">{runs.length} runs</StatusPill>
              <StatusPill tone="accent">
                best F1 {fmtScore(Math.max(...runs.map((r) => r.f1)))}
              </StatusPill>
            </div>
          )
        }
      />

      {error && (
        <div className="mt-5">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="mt-5">
        {!runs ? (
          <FullLoader label="Loading experiments" />
        ) : (
          <Leaderboard
            runs={runs}
            selectedRunId={selectedRunId}
            onSelect={setSelectedRunId}
          />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {metrics ? (
            <CategoryMetrics metrics={metrics} />
          ) : (
            loadingMetrics && <FullLoader label="Loading per-category metrics" />
          )}
        </div>

        {selectedRun && <RunDetail run={selectedRun} metrics={metrics} />}
      </div>
    </div>
  );
}

function RunDetail({
  run,
  metrics,
}: {
  run: ExperimentRun;
  metrics: RunMetrics | null;
}) {
  const overall = metrics?.overall ?? {
    f1: run.f1,
    map: run.map,
    precision: run.precision,
    recall: run.recall,
  };

  return (
    <motion.div
      key={run.run_id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card/50 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-base font-semibold text-foreground">
              {run.run_id}
            </h3>
            <span className={cnBadge(run.framework)}>{run.framework}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {run.loss} loss · {run.backbone}
          </p>
        </div>
        <StatusPill tone="accent" dot>
          selected
        </StatusPill>
      </div>

      {run.note && (
        <p className="mt-3 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {run.note}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Detail icon={GitBranch} label="Loss" value={run.loss} />
        <Detail icon={Cpu} label="Framework" value={run.framework} />
        <Detail icon={Network} label="Backbone" value={run.backbone} />
        <Detail icon={Layers} label="Params" value={run.params_m > 0 ? `${fmtCompact(run.params_m * 1_000_000)}` : "—"} />
        <Detail icon={TrendingUp} label="Epochs" value={run.epochs > 0 ? String(run.epochs) : "n/a"} />
        <Detail icon={CalendarDays} label="Trained" value={fmtDate(run.trained_at)} />
      </div>

      <div className="mt-5 space-y-3">
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Overall metrics
        </h4>
        <MetricBar label="F1" value={overall.f1} tone="primary" />
        <MetricBar label="mAP" value={overall.map} tone="amber" />
        <MetricBar label="Precision" value={overall.precision} tone="primary" subtle />
        <MetricBar label="Recall" value={overall.recall} tone="primary" subtle />
      </div>
    </motion.div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function MetricBar({
  label,
  value,
  tone,
  subtle,
}: {
  label: string;
  value: number;
  tone: "primary" | "amber";
  subtle?: boolean;
}) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={subtle ? "text-muted-foreground" : "font-medium text-foreground"}>
          {label}
        </span>
        <span className="font-mono tabular text-foreground/80">{fmtScore(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{
            background:
              tone === "amber"
                ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                : "linear-gradient(90deg,var(--primary),color-mix(in oklch,var(--primary) 60%,#fff))",
          }}
        />
      </div>
    </div>
  );
}

function cnBadge(framework: string) {
  return [
    "rounded px-1.5 py-0.5 text-[11px] font-medium",
    framework === "pytorch"
      ? "bg-orange-500/12 text-orange-300"
      : "bg-rose-500/12 text-rose-300",
  ].join(" ");
}

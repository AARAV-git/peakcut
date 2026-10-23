"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RunMetrics } from "@/lib/peakcut/types";
import { categoryLabel, fmtScore } from "@/lib/peakcut/format";
import { cn } from "@/lib/utils";

type Metric = "f1" | "map";

export function CategoryMetrics({ metrics }: { metrics: RunMetrics }) {
  const [metric, setMetric] = useState<Metric>("f1");

  const data = metrics.by_category.map((c) => ({
    category: c.category,
    f1: Math.round(c.f1 * 1000) / 1000,
    map: Math.round(c.map * 1000) / 1000,
    n: c.n_videos,
  }));

  const max = Math.max(...data.map((d) => d[metric]));

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Per-category metrics</h3>
          <p className="text-[11px] text-muted-foreground">
            {metrics.run_id} · {data.length} categories
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5 text-xs">
          {(["f1", "map"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                "rounded-md px-3 py-1 font-medium uppercase transition",
                metric === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="category"
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.3 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as {
                  category: string;
                  f1: number;
                  map: number;
                  n: number;
                };
                return (
                  <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
                    <div className="font-medium text-foreground">
                      {categoryLabel(p.category)}{" "}
                      <span className="text-muted-foreground">({p.category})</span>
                    </div>
                    <div className="mt-1 space-y-0.5 tabular">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">F1</span>
                        <span className="font-medium text-primary">{fmtScore(p.f1)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">mAP</span>
                        <span className="font-medium text-amber-400">{fmtScore(p.map)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">videos</span>
                        <span className="font-medium text-foreground/80">{p.n}</span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey={metric} radius={[4, 4, 0, 0]} maxBarSize={42}>
              {data.map((d, i) => {
                const ratio = d[metric] / max;
                return (
                  <Cell
                    key={i}
                    fill={
                      metric === "f1"
                        ? ratio > 0.85
                          ? "var(--primary)"
                          : ratio > 0.6
                            ? "color-mix(in oklch, var(--primary) 70%, var(--muted))"
                            : "color-mix(in oklch, var(--primary) 45%, var(--muted))"
                        : ratio > 0.85
                          ? "#fbbf24"
                          : ratio > 0.6
                            ? "color-mix(in oklch, #fbbf24 70%, var(--muted))"
                            : "color-mix(in oklch, #fbbf24 45%, var(--muted))"
                    }
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Hover a bar for full breakdown</span>
        <span className="tabular">
          overall {metric} {fmtScore(metrics.overall[metric])}
        </span>
      </div>
    </div>
  );
}

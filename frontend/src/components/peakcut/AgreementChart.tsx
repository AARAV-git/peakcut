"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { AnnotatorAgreement } from "@/lib/peakcut/types";
import { formatTime, fmtScore } from "@/lib/peakcut/format";

const ANNOTATOR_COLORS = ["#f59e0b", "#a78bfa", "#38bdf8", "#fb7185", "#84cc16"];

export function AgreementChart({ agreement }: { agreement: AnnotatorAgreement }) {
  const data = useMemo(() => {
    const n = agreement.model_scores.length;
    const annotators = Object.keys(agreement.annotator_scores);
    // Downsample to ~180 points for a smooth render regardless of fps.
    const step = Math.max(1, Math.floor(n / 180));
    const rows: Array<Record<string, number>> = [];
    for (let i = 0; i < n; i += step) {
      const t = i / agreement.fps;
      const row: Record<string, number> = { t };
      for (const a of annotators) {
        row[`ann_${a}`] = Math.round((agreement.annotator_scores[a][i] ?? 0) * 1000) / 1000;
      }
      row.model = Math.round(agreement.model_scores[i] * 1000) / 1000;
      rows.push(row);
    }
    return rows;
  }, [agreement]);

  const annotators = Object.keys(agreement.annotator_scores);

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Annotator scores vs. model prediction
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {agreement.n_annotators} annotators · {agreement.fps} fps · {agreement.model_scores.length} frames
          </p>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, agreement.duration_sec]}
              tickFormatter={(v) => formatTime(v)}
              stroke="var(--muted-foreground)"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
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
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
                    <div className="mb-1 font-medium text-foreground tabular">
                      {formatTime(Number(label))}
                    </div>
                    <div className="space-y-0.5">
                      {payload.map((p) => (
                        <div key={String(p.dataKey)} className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: p.color }}
                            />
                            {p.dataKey === "model" ? "model" : `annotator ${String(p.dataKey).replace("ann_", "")}`}
                          </span>
                          <span className="font-mono tabular text-foreground/80">
                            {fmtScore(Number(p.value))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(v) =>
                v === "model" ? "model" : `ann. ${String(v).replace("ann_", "")}`
              }
            />
            {annotators.map((a, i) => (
              <Line
                key={a}
                type="monotone"
                dataKey={`ann_${a}`}
                stroke={ANNOTATOR_COLORS[i % ANNOTATOR_COLORS.length]}
                strokeWidth={1.25}
                dot={false}
                isAnimationActive={false}
                opacity={0.7}
              />
            ))}
            <Line
              type="monotone"
              dataKey="model"
              stroke="var(--primary)"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { HighlightsResponse } from "@/lib/peakcut/types";
import { formatTime, fmtScore } from "@/lib/peakcut/format";

export function ScoreChart({
  highlights,
  currentTime,
  onSeek,
}: {
  highlights: HighlightsResponse;
  currentTime: number;
  onSeek: (t: number) => void;
}) {
  const data = useMemo(() => {
    return highlights.scores.map((s, i) => ({
      t: i / highlights.fps,
      score: Math.round(s * 1000) / 1000,
    }));
  }, [highlights]);

  const maxScore = highlights.highlights[0]?.score ?? 0;

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 12, bottom: 6, left: -8 }}
          onClick={(e) => {
            const x = e?.activeLabel;
            if (typeof x === "number") onSeek(Math.max(0, Math.min(highlights.duration_sec, x)));
          }}
        >
          <defs>
            <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
              <stop offset="60%" stopColor="var(--primary)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[0, highlights.duration_sec]}
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
            width={32}
          />
          {/* highlight regions */}
          {highlights.highlights.map((h) => (
            <ReferenceArea
              key={h.highlight_id}
              x1={h.start_sec}
              x2={h.end_sec}
              fill="#f59e0b"
              fillOpacity={0.12}
              stroke="#f59e0b"
              strokeOpacity={0.25}
              strokeDasharray="3 3"
            />
          ))}
          <Tooltip
            cursor={{ stroke: "var(--primary)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { t: number; score: number };
              return (
                <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs shadow-xl">
                  <div className="font-medium text-foreground tabular">{formatTime(p.t)}</div>
                  <div className="text-muted-foreground tabular">
                    score <span className="text-primary font-medium">{fmtScore(p.score)}</span>
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="var(--primary)"
            strokeWidth={1.75}
            fill="url(#scoreFill)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
          />
          <ReferenceLine
            x={currentTime}
            stroke="var(--primary)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          {maxScore > 0 && (
            <ReferenceLine
              y={maxScore}
              stroke="#f59e0b"
              strokeDasharray="2 4"
              strokeOpacity={0.5}
              label={{
                value: `top ${fmtScore(maxScore)}`,
                position: "insideTopRight",
                fill: "#fbbf24",
                fontSize: 10,
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

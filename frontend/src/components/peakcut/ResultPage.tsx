"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Cpu,
  Gauge,
  Hash,
  Layers,
  ScanSearch,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";
import { ScoreChart } from "./ScoreChart";
import { HighlightList } from "./HighlightList";
import { SectionTitle } from "./SectionTitle";
import { StatusPill } from "./StatusPill";
import { FullLoader } from "./Loader";
import { usePeakcut } from "@/store/peakcut";
import { VIDEO_CATALOG } from "@/lib/peakcut/mock-data";
import { fmtMs, fmtScore, formatTime } from "@/lib/peakcut/format";

export function ResultPage() {
  const {
    highlights,
    summaries,
    loadingHighlights,
    loadingSummaries,
    setTab,
  } = usePeakcut();

  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [prevVideoId, setPrevVideoId] = useState<string | undefined>(
    highlights?.video_id,
  );
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset playback position whenever a new analysis arrives. Done during
  // render (the React-recommended reset-on-prop-change pattern) rather than
  // in an effect, to avoid synchronous setState inside an effect body.
  if (highlights?.video_id !== prevVideoId) {
    setPrevVideoId(highlights?.video_id);
    setCurrentTime(0);
    setPlaying(false);
  }

  // Playback ticker: advance at fps resolution so the chart marker glides.
  useEffect(() => {
    if (!playing || !highlights) return;
    const step = 1 / highlights.fps;
    tickRef.current = setInterval(() => {
      setCurrentTime((t) => {
        const next = t + step;
        if (next >= highlights.duration_sec) {
          setPlaying(false);
          return highlights.duration_sec;
        }
        return next;
      });
    }, 1000 / highlights.fps);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [playing, highlights]);

  if (loadingHighlights && !highlights) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <FullLoader label="Running highlight detection pipeline" />
      </div>
    );
  }

  if (!highlights) {
    return <EmptyState onAnalyze={() => setTab("analyze")} />;
  }

  const meta = VIDEO_CATALOG.find((v) => v.video_id === highlights.video_id);
  const title =
    meta?.title ??
    (highlights.video_id.startsWith("upload_") ? "Uploaded clip" : highlights.video_id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionTitle
        eyebrow={`Result · ${highlights.video_id}`}
        title={title}
        description="Frame-level importance over time, the selected highlight segments, and LLM-generated titles and summaries. Click a highlight or scrub the chart to seek."
        icon={Sparkles}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="accent">{highlights.run_id}</StatusPill>
            <StatusPill tone="muted">{highlights.fps} fps</StatusPill>
            <StatusPill tone="amber">{Math.round(highlights.budget_ratio * 100)}% budget</StatusPill>
          </div>
        }
      />

      {/* Stat strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Clock} label="Duration" value={formatTime(highlights.duration_sec)} />
        <Stat icon={Hash} label="Highlights" value={String(highlights.highlights.length)} />
        <Stat icon={Target} label="Top score" value={fmtScore(highlights.highlights[0]?.score ?? 0)} />
        <Stat icon={Zap} label="Processing" value={fmtMs(highlights.processing_ms)} />
      </div>

      {/* Main grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <VideoPlayer
            highlights={highlights}
            title={title}
            currentTime={currentTime}
            playing={playing}
            onTogglePlay={() => setPlaying((p) => !p)}
            onSeek={(t) => {
              setCurrentTime(t);
              setPlaying(false);
            }}
            onStep={(d) =>
              setCurrentTime((t) =>
                Math.max(0, Math.min(highlights.duration_sec, t + d)),
              )
            }
          />

          {/* Score chart */}
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Importance score over time
                </h3>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary" /> model score
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-amber-400/40 ring-1 ring-amber-400/50" />
                  highlight
                </span>
              </div>
            </div>
            <div className="h-56 sm:h-64">
              <ScoreChart
                highlights={highlights}
                currentTime={currentTime}
                onSeek={(t) => {
                  setCurrentTime(t);
                  setPlaying(false);
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {highlights.scores.length} frames sampled · click anywhere on the curve to seek the player.
            </p>
          </div>
        </div>

        {/* Highlight list */}
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <HighlightList
            highlights={highlights}
            summaries={summaries}
            currentTime={currentTime}
            loadingSummaries={loadingSummaries}
            onSeek={(t) => {
              setCurrentTime(t);
              setPlaying(true);
            }}
          />
        </div>
      </div>

      {/* Feature / pipeline footer note */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <InfoTile
          icon={Layers}
          title="Feature extraction"
          body={`TSN-BNInception features extracted at ${highlights.fps} fps from the decoded stream.`}
        />
        <InfoTile
          icon={Cpu}
          title="Ranking model"
          body={`Forward pass with ${highlights.run_id}. Segments selected under a ${Math.round(highlights.budget_ratio * 100)}% summary budget.`}
        />
        <InfoTile
          icon={Sparkles}
          title="LLM captions"
          body="Per-highlight title, summary and tags generated from the selected segment window."
        />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-3.5 py-3">
      <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground tabular">{value}</p>
      </div>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3.5">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function EmptyState({ onAnalyze }: { onAnalyze: () => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20"
      >
        <ScanSearch className="size-8" />
      </motion.div>
      <h2 className="mt-5 text-xl font-semibold text-foreground">No result yet</h2>
      <p className="mt-2 text-sm text-muted-foreground text-balance">
        Head to the Analyze tab and either upload a clip or pick one from the benchmark to
        generate highlights, a score curve, and LLM captions.
      </p>
      <button
        onClick={onAnalyze}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        <ScanSearch className="size-4" />
        Go to Analyze
      </button>
    </div>
  );
}

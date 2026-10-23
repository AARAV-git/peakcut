"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  Clock,
  Cpu,
  Database,
  Film,
  Layers,
  PlayCircle,
  Sparkles,
  Wand2,
} from "lucide-react";
import { VideoUploader, type UploadedFile } from "./VideoUploader";
import { SectionTitle } from "./SectionTitle";
import { StatusPill } from "./StatusPill";
import { ErrorBanner } from "./ErrorBanner";
import { usePeakcut } from "@/store/peakcut";
import {
  getExperiments,
  getVideos,
  postHighlights,
  postSummaries,
} from "@/lib/peakcut/api";
import type { ExperimentRun, PipelineStage, VideoMeta } from "@/lib/peakcut/types";
import {
  categoryLabel,
  fmtMs,
  formatTime,
  shortId,
} from "@/lib/peakcut/format";
import { cn } from "@/lib/utils";

const PIPELINE: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "ingest", label: "Ingest & demux frames", icon: Film },
  { id: "features", label: "Extract TSN features @2fps", icon: Layers },
  { id: "model", label: "Ranking model forward pass", icon: Cpu },
  { id: "segment", label: "Select segments · 15% budget", icon: Boxes },
  { id: "summary", label: "LLM titles & summaries", icon: Sparkles },
];

export function AnalyzePage() {
  const {
    setTab,
    setHighlights,
    setSummaries,
    setLoadingHighlights,
    setLoadingSummaries,
    setError,
    error,
    resetAnalysis,
    highlights,
    loadingHighlights,
  } = usePeakcut();

  const [videos, setVideos] = useState<VideoMeta[] | null>(null);
  const [runs, setRuns] = useState<ExperimentRun[] | null>(null);
  const [runId, setRunId] = useState("ranking_s42");
  const [stages, setStages] = useState<PipelineStage[]>(
    PIPELINE.map((p) => ({ id: p.id, label: p.label, status: "pending" })),
  );
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  useEffect(() => {
    getVideos().then(setVideos);
    getExperiments().then(setRuns);
  }, []);

  async function runAnalysis(req: Parameters<typeof postHighlights>[0], label: string) {
    resetAnalysis();
    setError(null);
    setActiveVideo(label);
    setLoadingHighlights(true);

    // animate pipeline stages while the request is in flight
    setStages(PIPELINE.map((p) => ({ id: p.id, label: p.label, status: "pending" })));
    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    PIPELINE.forEach((p, i) => {
      stageTimers.push(
        setTimeout(() => {
          setStages((prev) =>
            prev.map((s, idx) =>
              idx === i
                ? { ...s, status: "active" }
                : idx < i
                  ? { ...s, status: "done" }
                  : s,
            ),
          );
        }, i * 280),
      );
    });

    try {
      const h = await postHighlights(req);
      setStages((prev) => prev.map((s) => ({ ...s, status: "done" })));
      setHighlights(h);
      setLoadingHighlights(false);
      // fetch summaries for the highlights
      setLoadingSummaries(true);
      try {
        const ids = h.highlights.map((x) => x.highlight_id);
        const sums = await postSummaries(
          // uploads use the seed video's summaries behind the scenes
          h.video_id.startsWith("upload_") ? "video_06" : h.video_id,
          ids,
        );
        setSummaries(sums);
      } finally {
        setLoadingSummaries(false);
      }
      setTab("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setLoadingHighlights(false);
    } finally {
      stageTimers.clear();
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card/40">
        <div className="bg-grid bg-grid-fade absolute inset-0 opacity-60" />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <StatusPill tone="accent" dot>
                Online · ranking_s42
              </StatusPill>
              <StatusPill tone="muted">15% summary budget</StatusPill>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl">
                Find the moments that matter,
                <span className="bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-transparent">
                  {" "}ranked by importance.
                </span>
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground text-balance sm:text-base">
                Peakcut scores every frame of a video with a learning-to-rank model, then
                carves out the top 15% as highlights — each captioned with an LLM-generated
                title and summary.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Cpu className="size-3.5 text-primary" /> TSN-BNInception</span>
              <span className="flex items-center gap-1.5"><Layers className="size-3.5 text-primary" /> 2 fps sampling</span>
              <span className="flex items-center gap-1.5"><Database className="size-3.5 text-primary" /> DuckDB read-only</span>
              <span className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-primary" /> LLM captions</span>
            </div>
          </div>

          {/* Uploader card */}
          <div className="rounded-xl border border-border bg-background/60 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Analyze a new video</h3>
              </div>
              <RunSelector runs={runs} value={runId} onChange={setRunId} />
            </div>
            <VideoUploader
              disabled={loadingHighlights}
              onFile={(f: UploadedFile) =>
                runAnalysis({ file: f.file, run_id: runId }, f.name)
              }
            />
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Uploaded clips run the model live and are <span className="text-foreground/70">not persisted</span> —
              the API opens the DB read-only. Known clips below read cached predictions.
            </p>
          </div>
        </div>
      </section>

      {/* Pipeline progress */}
      {(loadingHighlights || activeVideo) && (
        <PipelineProgress
          stages={stages}
          label={activeVideo ?? ""}
          processing={loadingHighlights}
        />
      )}

      {error && (
        <div className="mt-6">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Known videos */}
      <section className="mt-10">
        <SectionTitle
          eyebrow="Known videos"
          title="Pick a clip from the benchmark"
          description="Curated clips from TVSum and SumMe with cached frame scores, highlight segments, and annotator agreement."
          icon={Film}
          right={
            videos && (
              <StatusPill tone="muted">
                {videos.length} videos · {new Set(videos.map((v) => v.dataset)).size} datasets
              </StatusPill>
            )
          }
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos?.map((v, i) => (
            <VideoCard
              key={v.video_id}
              video={v}
              index={i}
              disabled={loadingHighlights}
              onAnalyze={() =>
                runAnalysis({ video_id: v.video_id, run_id: runId }, v.title)
              }
            />
          ))}
          {!videos &&
            Array.from({ length: 8 }).map((_, i) => <VideoCardSkeleton key={i} />)}
        </div>
      </section>

      {highlights && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setTab("result")}
            className="group inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <PlayCircle className="size-4" />
            View last result
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function RunSelector({
  runs,
  value,
  onChange,
}: {
  runs: ExperimentRun[] | null;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="hidden sm:inline">Run</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
      >
        {runs?.map((r) => (
          <option key={r.run_id} value={r.run_id}>
            {r.run_id} · {r.loss}
          </option>
        ))}
      </select>
    </label>
  );
}

function PipelineProgress({
  stages,
  label,
  processing,
}: {
  stages: PipelineStage[];
  label: string;
  processing: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-6 overflow-hidden"
    >
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            <span className="truncate text-sm font-medium text-foreground">
              {processing ? "Analyzing" : "Done"}: {label}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground tabular">POST /highlights</span>
        </div>
        <ol className="grid gap-2 sm:grid-cols-5">
          {stages.map((s) => {
            const def = PIPELINE.find((p) => p.id === s.id)!;
            const Icon = def.icon;
            return (
              <li
                key={s.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition",
                  s.status === "done"
                    ? "border-primary/30 bg-primary/5"
                    : s.status === "active"
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-background/40 opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    s.status === "done"
                      ? "bg-primary/15 text-primary"
                      : s.status === "active"
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.status === "active" ? (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="size-3.5 rounded-full border-2 border-primary/30 border-t-primary"
                    />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0 text-xs font-medium leading-tight text-foreground/90">
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </motion.section>
  );
}

const THUMB_GRADIENTS = [
  "from-emerald-500/30 to-teal-700/40",
  "from-amber-500/30 to-orange-700/40",
  "from-rose-500/30 to-pink-700/40",
  "from-violet-500/30 to-purple-700/40",
  "from-cyan-500/30 to-blue-700/40",
  "from-lime-500/30 to-green-700/40",
];

function VideoCard({
  video,
  index,
  disabled,
  onAnalyze,
}: {
  video: VideoMeta;
  index: number;
  disabled: boolean;
  onAnalyze: () => void;
}) {
  const grad = THUMB_GRADIENTS[index % THUMB_GRADIENTS.length];
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onAnalyze}
      disabled={disabled}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card/50 text-left transition hover:border-primary/40 hover:bg-card disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className={cn("relative aspect-video w-full bg-gradient-to-br", grad)}>
        <div className="bg-grid absolute inset-0 opacity-30" />
        <div className="absolute left-2 top-2 flex items-center gap-1">
          <span className="rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/80 backdrop-blur">
            {video.dataset}
          </span>
        </div>
        <div className="absolute right-2 top-2 rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 tabular backdrop-blur">
          {video.category}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-background/80 text-primary opacity-0 ring-1 ring-primary/30 backdrop-blur transition group-hover:opacity-100">
            <PlayCircle className="size-6" />
          </span>
        </div>
        <div className="absolute bottom-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white tabular">
          {formatTime(video.duration_sec)}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground tabular">
            #{shortId(video.video_id)}
          </span>
          <Clock className="size-3 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-semibold text-foreground">{video.title}</p>
        <p className="text-xs text-muted-foreground">{categoryLabel(video.category)}</p>
      </div>
    </motion.button>
  );
}

function VideoCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/50">
      <div className="aspect-video w-full animate-pulse bg-muted" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-12 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export { fmtMs };

"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Gauge,
  GitCompare,
  Sigma,
  Users,
} from "lucide-react";
import { AgreementChart } from "./AgreementChart";
import { SectionTitle } from "./SectionTitle";
import { StatusPill } from "./StatusPill";
import { FullLoader } from "./Loader";
import { ErrorBanner } from "./ErrorBanner";
import { getVideoAgreement, getVideos } from "@/lib/peakcut/api";
import { VIDEO_CATALOG } from "@/lib/peakcut/mock-data";
import { categoryLabel, fmtScore, formatTime, shortId } from "@/lib/peakcut/format";
import type { AnnotatorAgreement, VideoMeta } from "@/lib/peakcut/types";
import { cn } from "@/lib/utils";

export function AnnotatorsPage() {
  const [videos, setVideos] = useState<VideoMeta[]>(VIDEO_CATALOG);
  const [videoId, setVideoId] = useState("video_03");
  const [agreement, setAgreement] = useState<AnnotatorAgreement | null>(null);
  const [loadedVideoId, setLoadedVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getVideos().then(setVideos);
  }, []);

  // Loading is derived from whether the loaded agreement matches the current
  // selection; state is only mutated inside async callbacks so the effect
  // body stays free of synchronous setState calls.
  const loading = loadedVideoId !== videoId;

  useEffect(() => {
    let alive = true;
    getVideoAgreement(videoId)
      .then((a) => {
        if (!alive) return;
        setAgreement(a);
        setLoadedVideoId(videoId);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load agreement");
        setLoadedVideoId(videoId);
      });
    return () => {
      alive = false;
    };
  }, [videoId]);

  const selectedVideo = useMemo(
    () => videos.find((v) => v.video_id === videoId),
    [videos, videoId],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SectionTitle
        eyebrow="Annotator agreement"
        title="How much do annotators disagree?"
        description="Each benchmark video is scored by multiple human annotators. Peakcut measures inter-annotator agreement and highlights clips where subjective disagreement is high — those are the hardest cases for the ranker."
        icon={BarChart3}
        right={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Video</span>
            <select
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition focus:border-primary"
            >
              {videos.map((v) => (
                <option key={v.video_id} value={v.video_id}>
                  #{shortId(v.video_id)} · {v.title}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {error && (
        <div className="mt-5">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {selectedVideo && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <StatusPill tone="muted">{selectedVideo.dataset}</StatusPill>
          <StatusPill tone="muted">{categoryLabel(selectedVideo.category)}</StatusPill>
          <StatusPill tone="muted">{formatTime(selectedVideo.duration_sec)}</StatusPill>
          {agreement?.high_disagreement ? (
            <StatusPill tone="warn" dot>high disagreement</StatusPill>
          ) : (
            agreement && <StatusPill tone="ok" dot>low disagreement</StatusPill>
          )}
        </div>
      )}

      {!agreement || loading ? (
        <div className="mt-6">
          <FullLoader label="Loading annotator agreement" />
        </div>
      ) : (
        <motion.div
          key={agreement.video_id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-6"
        >
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AgreementCard agreement={agreement} />
            <StatCard
              icon={Users}
              label="Annotators"
              value={String(agreement.n_annotators)}
              hint="independent raters"
            />
            <StatCard
              icon={GitCompare}
              label="Mean correlation"
              value={fmtScore(agreement.mean_correlation)}
              hint="model vs. annotators"
              tone="primary"
            />
            <StatCard
              icon={Sigma}
              label="Score variance"
              value={fmtScore(agreement.variance)}
              hint="across annotators"
            />
          </div>

          <AgreementChart agreement={agreement} />

          {/* Insight panel */}
          <div
            className={cn(
              "rounded-xl border p-4",
              agreement.high_disagreement
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-primary/25 bg-primary/5",
            )}
          >
            <div className="flex items-start gap-3">
              {agreement.high_disagreement ? (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
              )}
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  {agreement.high_disagreement
                    ? "This is a high-disagreement clip"
                    : "Annotators broadly agree on this clip"}
                </h4>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {agreement.high_disagreement
                    ? `Agreement of ${fmtScore(agreement.agreement)} sits below the 0.45 threshold. At least one annotator scores the clip very differently from the rest — typically a subjective moment (e.g. a subtle play vs. a non-event). The ranker has to hedge on these clips, which is why per-category F1 drops for ambiguous categories.`
                    : `Agreement of ${fmtScore(agreement.agreement)} is well above the 0.45 threshold. Annotator curves track closely and the model's prediction stays within the human band, so this clip is a reliable training signal.`}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function AgreementCard({ agreement }: { agreement: AnnotatorAgreement }) {
  const pct = Math.round(agreement.agreement * 100);
  const high = agreement.high_disagreement;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-4",
        high ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card/50",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Gauge className="size-3.5" />
        Agreement
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span
          className={cn(
            "text-3xl font-bold tabular",
            high ? "text-amber-400" : "text-primary",
          )}
        >
          {fmtScore(agreement.agreement)}
        </span>
        <span className="mb-1 text-xs text-muted-foreground tabular">/ 1.0</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn("h-full rounded-full", high ? "bg-amber-400" : "bg-primary")}
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {high ? "below 0.45 threshold" : "above 0.45 threshold"}
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary";
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("size-3.5", tone === "primary" && "text-primary")} />
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-bold tabular", tone === "primary" ? "text-primary" : "text-foreground")}>
        {value}
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}



"use client";

import { useMemo } from "react";
import {
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  Settings2,
} from "lucide-react";
import type { HighlightsResponse } from "@/lib/peakcut/types";
import { formatTime } from "@/lib/peakcut/format";
import { cn } from "@/lib/utils";

const SCENE_GRADIENTS = [
  "from-emerald-900 via-teal-800 to-slate-900",
  "from-amber-900 via-orange-800 to-slate-900",
  "from-rose-900 via-pink-800 to-slate-900",
  "from-violet-900 via-purple-800 to-slate-900",
  "from-cyan-900 via-blue-800 to-slate-900",
];

export function VideoPlayer({
  highlights,
  title,
  currentTime,
  playing,
  onTogglePlay,
  onSeek,
  onStep,
}: {
  highlights: HighlightsResponse;
  title: string;
  currentTime: number;
  playing: boolean;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onStep: (delta: number) => void;
}) {
  const progress = Math.min(100, (currentTime / highlights.duration_sec) * 100);
  const sceneIndex = useMemo(
    () => Math.floor((currentTime / Math.max(1, highlights.duration_sec)) * SCENE_GRADIENTS.length) %
      SCENE_GRADIENTS.length,
    [currentTime, highlights.duration_sec],
  );
  const grad = SCENE_GRADIENTS[sceneIndex];
  const frame = Math.floor(currentTime * highlights.fps);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      {/* Stage */}
      <div className={cn("relative aspect-video w-full bg-gradient-to-br", grad)}>
        <div className="bg-grid absolute inset-0 opacity-20" />
        {/* film vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
          <div className="flex items-center gap-2 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-rose-500" />
            {highlights.video_id.startsWith("upload_") ? "UPLOAD" : highlights.video_id}
          </div>
          <div className="rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium text-white/90 tabular backdrop-blur">
            frame {frame} · {highlights.fps}fps
          </div>
        </div>

        {/* center play */}
        <button
          onClick={onTogglePlay}
          className="group absolute inset-0 flex items-center justify-center"
          aria-label={playing ? "Pause" : "Play"}
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/30 backdrop-blur transition group-hover:scale-105 group-hover:bg-white/20">
            {playing ? (
              <Pause className="size-7" />
            ) : (
              <Play className="ml-0.5 size-7" />
            )}
          </span>
        </button>

        {/* title */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="rounded-md bg-black/40 px-2.5 py-1 backdrop-blur">
            <p className="text-sm font-semibold text-white">{title}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-2 bg-background/95 px-3 py-2.5">
        {/* scrubber */}
        <div className="group relative h-4 cursor-pointer" onClick={onScrub}>
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
            {/* highlight ticks */}
            {highlights.highlights.map((h) => (
              <span
                key={h.highlight_id}
                className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 ring-2 ring-amber-400/30"
                style={{
                  left: `${(h.start_sec / highlights.duration_sec) * 100}%`,
                }}
                title={`Highlight ${h.highlight_id}`}
              />
            ))}
          </div>
          <div
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background opacity-0 shadow transition group-hover:opacity-100"
            style={{ left: `${progress}%` }}
          />
        </div>

        {/* buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStep(-5)}
            className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Back 5 seconds"
          >
            <SkipBack className="size-4" />
          </button>
          <button
            onClick={onTogglePlay}
            className="rounded p-1.5 text-foreground transition hover:bg-accent"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button
            onClick={() => onStep(5)}
            className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Forward 5 seconds"
          >
            <SkipForward className="size-4" />
          </button>

          <span className="ml-1 text-xs text-muted-foreground tabular">
            {formatTime(currentTime)} <span className="text-muted-foreground/50">/</span>{" "}
            {formatTime(highlights.duration_sec)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Volume">
              <Volume2 className="size-4" />
            </button>
            <button className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Settings">
              <Settings2 className="size-4" />
            </button>
            <button className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Fullscreen">
              <Maximize2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  function onScrub(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, ratio)) * highlights.duration_sec);
  }
}

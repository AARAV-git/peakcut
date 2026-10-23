"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileVideo, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCompact } from "@/lib/peakcut/format";
import { ErrorBanner } from "./ErrorBanner";

const MAX_BYTES = 512 * 1024 * 1024; // 512 MB
const ACCEPTED = ["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"];

export type UploadedFile = { name: string; size: number; type: string; file: File };

export function VideoUploader({
  onFile,
  disabled,
}: {
  onFile: (file: UploadedFile) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<UploadedFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback((f: File): string | null => {
    const okType = ACCEPTED.includes(f.type) || /\.(mp4|mov|mkv|webm)$/i.test(f.name);
    if (!okType) return "Unsupported file type. Use MP4, MOV, MKV or WebM.";
    if (f.size > MAX_BYTES) return `File too large (max ${fmtCompact(MAX_BYTES)}).`;
    return null;
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      const err = validate(f);
      if (err) {
        setError(err);
        setPicked(null);
        return;
      }
      setError(null);
      setPicked({ name: f.name, size: f.size, type: f.type, file: f });
      onFile({ name: f.name, size: f.size, type: f.type, file: f });
    },
    [onFile, validate],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [disabled, handleFile],
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/40",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />

        <motion.div
          animate={dragging ? { y: -4, scale: 1.05 } : { y: 0, scale: 1 }}
          className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20"
        >
          <UploadCloud className="size-7" />
        </motion.div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {dragging ? "Drop to upload" : "Drag & drop a video, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground">
            MP4 · MOV · MKV · WebM — up to {fmtCompact(MAX_BYTES)}
          </p>
        </div>

        <div className="absolute right-3 top-3">
          <span className="rounded-md bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground ring-1 ring-border">
            multipart POST /highlights
          </span>
        </div>
      </div>

      {picked && !error && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3.5 py-2.5"
        >
          <FileVideo className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{picked.name}</p>
            <p className="text-xs text-muted-foreground tabular">
              {fmtCompact(picked.size)} · {picked.type || "video"}
            </p>
          </div>
          <button
            onClick={() => setPicked(null)}
            className="rounded p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="size-4" />
          </button>
        </motion.div>
      )}

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
    </div>
  );
}

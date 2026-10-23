// Formatting + time utilities for Peakcut.

/** seconds -> "m:ss" (or "h:mm:ss" for long videos) */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** mm:ss -> seconds (best-effort) */
export function parseTime(value: string): number {
  const parts = value.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return 0;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/** fixed 3-decimals for scores / metrics */
export function fmtScore(value: number, decimals = 3): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(decimals);
}

/** 0..1 -> percentage string with one decimal */
export function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

/** millis -> "1.2s" / "820ms" */
export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** compact duration "2.1m views"-style for params */
export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** category code -> human label (TVSum convention) */
export const CATEGORY_LABELS: Record<string, string> = {
  BK: "Bearpark Climbing",
  DS: "Jump Practice",
  FM: "Fun Marathon",
  GA: "Vehicle Pickup",
  MS: "Miami Surf",
  PK: "Parkour Run",
  PR: "Playground Swings",
  VT: "Valley View",
  WT: "Walking Tour",
  YS: "Yard Sale",
  COOK: "Cooking Show",
  SOCC: "Soccer Match",
  FIRE: "Fireworks",
  CLIM: "Tower Climb",
};

export function categoryLabel(code: string): string {
  return CATEGORY_LABELS[code] ?? code;
}

/** short id like "video_07" -> "07" */
export function shortId(id: string): string {
  const m = id.match(/(\d+)$/);
  return m ? m[1] : id;
}

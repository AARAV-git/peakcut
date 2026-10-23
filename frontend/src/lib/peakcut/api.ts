// Peakcut — API client. Every call goes through a real `fetch` against the
// Next.js route handlers under /api/peakcut/*, which mirror the FastAPI
// contract 1:1. Swap `API_URL` for `VITE_API_URL` and point it at the FastAPI
// origin and the whole chain keeps working unchanged.
//
//   component -> hook -> api.* (here) -> /api/peakcut/* route handler
//                                     -> repository (mock-data) -> "DB tables"
//
// A small client-side delay is layered on top of the network round-trip so
// loading states and the analyze pipeline animation stay exercised.

import type {
  AnnotatorAgreement,
  ExperimentRun,
  HighlightsResponse,
  HealthStatus,
  RunMetrics,
  Summary,
  VideoMeta,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/peakcut";
export { API_URL };

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const jitter = (base: number, spread = 0.3) =>
  base + Math.round((Math.random() - 0.5) * base * spread);

/** Shared fetch wrapper: JSON handling + typed errors. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    // never cache live pipeline / experiment data
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  await delay(jitter(120));
  return request<HealthStatus>("/health");
}

export async function getVideos(): Promise<VideoMeta[]> {
  await delay(jitter(180));
  return request<VideoMeta[]>("/videos");
}

export type HighlightsRequest =
  | { video_id: string; run_id?: string }
  | { file: File; run_id?: string };

export async function postHighlights(
  req: HighlightsRequest,
): Promise<HighlightsResponse> {
  // Uploaded files run the model live — a slower, multi-stage feel.
  if ("file" in req) {
    await delay(jitter(1400, 0.4));
    const form = new FormData();
    form.append("file", req.file);
    if (req.run_id) form.append("run_id", req.run_id);
    // NOTE: do not set Content-Type — the browser adds the multipart boundary.
    return request<HighlightsResponse>("/highlights", {
      method: "POST",
      body: form,
    });
  }
  await delay(jitter(520, 0.4));
  return request<HighlightsResponse>("/highlights", {
    method: "POST",
    body: JSON.stringify({ video_id: req.video_id, run_id: req.run_id }),
  });
}

export async function postSummaries(
  videoId: string,
  highlightIds: string[],
): Promise<Summary[]> {
  await delay(jitter(680, 0.4));
  return request<Summary[]>("/summaries", {
    method: "POST",
    body: JSON.stringify({ video_id: videoId, highlight_ids: highlightIds }),
  });
}

export async function getVideoAgreement(
  videoId: string,
): Promise<AnnotatorAgreement> {
  await delay(jitter(260));
  return request<AnnotatorAgreement>(`/videos/${encodeURIComponent(videoId)}`);
}

export async function getExperiments(): Promise<ExperimentRun[]> {
  await delay(jitter(220));
  return request<ExperimentRun[]>("/experiments");
}

export async function getRunMetricsApi(runId: string): Promise<RunMetrics> {
  await delay(jitter(240));
  return request<RunMetrics>(
    `/experiments/${encodeURIComponent(runId)}/metrics`,
  );
}

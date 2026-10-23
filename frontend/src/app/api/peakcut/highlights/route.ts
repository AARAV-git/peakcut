import { NextResponse } from "next/server";
import { getHighlights, VIDEO_CATALOG } from "@/lib/peakcut/mock-data";
import type { HighlightsResponse } from "@/lib/peakcut/types";

// POST /api/peakcut/highlights
// Mirrors FastAPI POST /highlights. Accepts either:
//   - multipart/form-data with a `file` field (uploaded clip -> runs the model live)
//   - application/json: { video_id, run_id? }  (known video -> reads cached predictions)
//
// Response includes the full per-frame `scores` array (the score curve) plus
// the selected `highlights` segments under a 15% summary budget.
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  // --- Uploaded clip (multipart) -------------------------------------------
  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const runId = (form.get("run_id") as string | null) ?? "ranking_s42";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { detail: "missing `file` field in multipart body" },
        { status: 422 },
      );
    }

    // Uploaded clips run the model live; results are NOT persisted (the API
    // opens the DB read-only). We reuse a representative video's curve and
    // stamp it as an upload so the UI can tell the two flows apart.
    const seed = VIDEO_CATALOG.find((v) => v.video_id === "video_06")!;
    const res: HighlightsResponse = {
      ...getHighlights(seed.video_id, runId),
    };
    res.video_id = `upload_${Math.random().toString(36).slice(2, 8)}`;
    res.processing_ms = 1300 + Math.round(Math.random() * 600);
    // surface the uploaded filename so the result header can show it
    (res as HighlightsResponse & { filename?: string }).filename = file.name;
    return NextResponse.json(res);
  }

  // --- Known video (JSON) ---------------------------------------------------
  let body: { video_id?: string; run_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { detail: "invalid JSON body" },
      { status: 422 },
    );
  }

  const videoId = body.video_id;
  const runId = body.run_id ?? "ranking_s42";
  if (!videoId) {
    return NextResponse.json(
      { detail: "`video_id` is required" },
      { status: 422 },
    );
  }
  if (!VIDEO_CATALOG.some((v) => v.video_id === videoId)) {
    return NextResponse.json(
      { detail: `unknown video ${videoId}` },
      { status: 404 },
    );
  }
  return NextResponse.json(getHighlights(videoId, runId));
}

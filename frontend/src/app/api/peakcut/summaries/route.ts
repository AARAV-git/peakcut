import { NextResponse } from "next/server";
import { getHighlights, getSummaries, VIDEO_CATALOG } from "@/lib/peakcut/mock-data";
import type { Summary } from "@/lib/peakcut/types";

// POST /api/peakcut/summaries
// Mirrors FastAPI POST /summaries. Two request shapes:
//   - known video:   { video_id, highlight_ids: string[] }
//   - uploaded clip: { video_id: "upload_*", highlights: Highlight[] }
//
// For known videos the summaries are read from the cached `summaries` table.
// For uploads we map the (seeded) highlight ids onto the seed video's summary
// library — emulating the caption + LLM generation path.
export async function POST(req: Request) {
  let body: {
    video_id?: string;
    highlight_ids?: string[];
    highlights?: Array<{ highlight_id: string; start_sec: number; end_sec: number }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "invalid JSON body" }, { status: 422 });
  }

  const videoId = body.video_id;
  if (!videoId) {
    return NextResponse.json({ detail: "`video_id` is required" }, { status: 422 });
  }

  // Uploaded clip — emulated LLM path. We resolve summaries against the seed
  // video's library so the highlight ids line up.
  if (videoId.startsWith("upload_")) {
    const seed = "video_06";
    const seedIds = getHighlights(seed).highlights.map((h) => h.highlight_id);
    const requestedIds = body.highlights?.map((h) => h.highlight_id) ?? body.highlight_ids ?? [];
    const all = getSummaries(seed, seedIds);
    const out: Summary[] = requestedIds
      .map((id, i) => {
        const tmpl = all[i % all.length];
        return { ...tmpl, highlight_id: id };
      });
    return NextResponse.json(out);
  }

  // Known video — read from the cached summaries table.
  if (!VIDEO_CATALOG.some((v) => v.video_id === videoId)) {
    return NextResponse.json(
      { detail: `unknown video ${videoId}` },
      { status: 404 },
    );
  }
  const ids = body.highlight_ids ?? [];
  return NextResponse.json(getSummaries(videoId, ids));
}

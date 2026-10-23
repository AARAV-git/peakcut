import { NextResponse } from "next/server";
import { getAgreement, VIDEO_CATALOG } from "@/lib/peakcut/mock-data";

// GET /api/peakcut/videos/[id]
// Mirrors FastAPI GET /videos/{video_id} — video detail with annotator
// agreement curves. Joins videos + annotations + annotator_agreement.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const video = VIDEO_CATALOG.find((v) => v.video_id === id);
  if (!video) {
    return NextResponse.json(
      { detail: `unknown video ${id}` },
      { status: 404 },
    );
  }
  try {
    return NextResponse.json(getAgreement(id));
  } catch {
    return NextResponse.json(
      { detail: `no agreement data for ${id}` },
      { status: 404 },
    );
  }
}

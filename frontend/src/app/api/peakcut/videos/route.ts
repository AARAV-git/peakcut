import { NextResponse } from "next/server";
import { VIDEO_CATALOG } from "@/lib/peakcut/mock-data";

// GET /api/peakcut/videos
// Mirrors FastAPI GET /videos — list of known videos so the "pick a video"
// option on the Analyze page works. Backed by the videos "table".
export async function GET() {
  return NextResponse.json(VIDEO_CATALOG);
}

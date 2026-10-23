import { NextResponse } from "next/server";
import { EXPERIMENTS } from "@/lib/peakcut/mock-data";

// GET /api/peakcut/experiments
// Mirrors FastAPI GET /experiments — leaderboard of runs (loss, F1, mAP).
// Backed by the experiments + metrics "tables".
export async function GET() {
  return NextResponse.json(EXPERIMENTS);
}

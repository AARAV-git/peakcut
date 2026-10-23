import { NextResponse } from "next/server";
import { getHealth } from "@/lib/peakcut/mock-data";

// GET /api/peakcut/health
// Mirrors FastAPI GET /health — returns model-loaded and DB-reachable status.
// The repository layer (mock-data) reports both flags; no DB write occurs.
export async function GET() {
  return NextResponse.json(getHealth());
}

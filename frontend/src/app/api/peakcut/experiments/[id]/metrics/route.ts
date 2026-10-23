import { NextResponse } from "next/server";
import { EXPERIMENTS, getRunMetrics } from "@/lib/peakcut/mock-data";

// GET /api/peakcut/experiments/[id]/metrics
// Mirrors FastAPI GET /experiments/{run_id}/metrics — overall + per-category
// metrics for one run. Returns 404 for an unknown run_id.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!EXPERIMENTS.some((r) => r.run_id === id)) {
    return NextResponse.json(
      { detail: `unknown run ${id}` },
      { status: 404 },
    );
  }
  return NextResponse.json(getRunMetrics(id));
}

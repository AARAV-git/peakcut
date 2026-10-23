import type {
  AnnotatorAgreement,
  CategoryMetric,
  ExperimentRun,
  HighlightsResponse,
  RunMetrics,
  Summary,
  VideoMeta,
} from "./types";

// Deterministic PRNG (mulberry32) so every render of the "database" is stable.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Gaussian-ish bump centered at c, width w, height h */
function bump(x: number, c: number, w: number, h: number): number {
  const d = (x - c) / w;
  return h * Math.exp(-0.5 * d * d);
}

// ---------------------------------------------------------------------------
// Video catalog — a curated mix of TVSum + SumMe style clips.
// ---------------------------------------------------------------------------
export const VIDEO_CATALOG: VideoMeta[] = [
  { video_id: "video_01", dataset: "tvsum", category: "BK", duration_sec: 58.4, title: "Bearpark Climbing", source: "TVSum" },
  { video_id: "video_02", dataset: "tvsum", category: "DS", duration_sec: 60.0, title: "Jump Practice", source: "TVSum" },
  { video_id: "video_03", dataset: "tvsum", category: "FM", duration_sec: 105.6, title: "Fun Marathon", source: "TVSum" },
  { video_id: "video_04", dataset: "tvsum", category: "GA", duration_sec: 60.0, title: "Vehicle Pickup", source: "TVSum" },
  { video_id: "video_05", dataset: "tvsum", category: "MS", duration_sec: 50.4, title: "Miami Surf", source: "TVSum" },
  { video_id: "video_06", dataset: "tvsum", category: "PK", duration_sec: 57.6, title: "Parkour Run", source: "TVSum" },
  { video_id: "video_07", dataset: "tvsum", category: "PR", duration_sec: 60.0, title: "Playground Swings", source: "TVSum" },
  { video_id: "video_08", dataset: "tvsum", category: "VT", duration_sec: 60.0, title: "Valley View", source: "TVSum" },
  { video_id: "video_09", dataset: "summe", category: "CLIM", duration_sec: 144.0, title: "Tower Climb", source: "SumMe" },
  { video_id: "video_10", dataset: "summe", category: "COOK", duration_sec: 94.5, title: "Cooking Show", source: "SumMe" },
  { video_id: "video_11", dataset: "summe", category: "SOCC", duration_sec: 265.0, title: "Soccer Match", source: "SumMe" },
  { video_id: "video_12", dataset: "summe", category: "FIRE", duration_sec: 118.0, title: "Fireworks Display", source: "SumMe" },
];

const FPS = 2;

// Pre-defined highlight centers (in seconds) per video, used to build both the
// score curve and the highlight segments. Tuned so each clip has 3–6 moments.
const HIGHLIGHT_CENTERS: Record<string, number[]> = {
  video_01: [12, 27, 41, 52],
  video_02: [9, 24, 38, 49],
  video_03: [18, 44, 71, 92],
  video_04: [11, 28, 47],
  video_05: [8, 22, 35, 44],
  video_06: [10, 23, 36, 49],
  video_07: [14, 31, 48],
  video_08: [9, 27, 44],
  video_09: [22, 58, 88, 119, 138],
  video_10: [12, 34, 58, 81],
  video_11: [31, 78, 124, 168, 210, 248],
  video_12: [14, 39, 66, 92, 108],
};

// Per-video annotator configuration: how many annotators, and which one is the
// "noisy" outlier (drives the high_disagreement flag).
const ANNOTATOR_CFG: Record<string, { n: number; outlier: number; agreement: number }> = {
  video_01: { n: 4, outlier: -1, agreement: 0.71 },
  video_02: { n: 5, outlier: -1, agreement: 0.66 },
  video_03: { n: 5, outlier: 2, agreement: 0.39 },
  video_04: { n: 4, outlier: -1, agreement: 0.62 },
  video_05: { n: 5, outlier: -1, agreement: 0.58 },
  video_06: { n: 5, outlier: 1, agreement: 0.34 },
  video_07: { n: 4, outlier: -1, agreement: 0.69 },
  video_08: { n: 4, outlier: -1, agreement: 0.64 },
  video_09: { n: 5, outlier: 3, agreement: 0.41 },
  video_10: { n: 5, outlier: -1, agreement: 0.55 },
  video_11: { n: 5, outlier: 0, agreement: 0.29 },
  video_12: { n: 4, outlier: -1, agreement: 0.6 },
};

/** Build the model frame-score curve for a video: baseline noise + bumps. */
function buildModelScores(video: VideoMeta): number[] {
  const n = Math.max(2, Math.round(video.duration_sec * FPS));
  const rng = mulberry32(hashStr(video.video_id + "::model"));
  const centers = HIGHLIGHT_CENTERS[video.video_id] ?? [];
  const scores: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    let v = 0.08 + rng() * 0.07; // baseline
    for (const c of centers) {
      // each bump has a slightly different width/height
      const w = 3 + (hashStr(video.video_id + c) % 100) / 100 * 2.5;
      const h = 0.55 + (hashStr(video.video_id + "h" + c) % 100) / 100 * 0.4;
      v += bump(t, c, w, h);
    }
    v += (rng() - 0.5) * 0.04; // jitter
    scores.push(Math.max(0, Math.min(1, v)));
  }
  return scores;
}

/** Derive highlight segments from the score curve under a 15% budget. */
function buildHighlights(video: VideoMeta, scores: number[]): HighlightsResponse["highlights"] {
  const centers = HIGHLIGHT_CENTERS[video.video_id] ?? [];
  const budget = video.duration_sec * 0.15;
  // each highlight is ~ budget / n centers wide, centered on the peak
  const segWidth = Math.max(2.5, budget / Math.max(1, centers.length));
  const segments = centers
    .map((c, i) => {
      const start = Math.max(0, c - segWidth / 2);
      const end = Math.min(video.duration_sec, c + segWidth / 2);
      // score = average model score within the segment window
      const i0 = Math.floor(start * FPS);
      const i1 = Math.ceil(end * FPS);
      let sum = 0;
      let count = 0;
      for (let k = i0; k <= i1 && k < scores.length; k++) {
        sum += scores[k] ?? 0;
        count++;
      }
      const score = count ? sum / count : 0;
      return {
        highlight_id: `h${i + 1}`,
        start_sec: Math.round(start * 10) / 10,
        end_sec: Math.round(end * 10) / 10,
        score: Math.round(score * 1000) / 1000,
        rank: 0,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, rank: i + 1 }));
  return segments;
}

const MODEL_SCORE_CACHE = new Map<string, number[]>();
const HIGHLIGHTS_CACHE = new Map<string, HighlightsResponse>();

export function getModelScores(videoId: string): number[] {
  if (MODEL_SCORE_CACHE.has(videoId)) return MODEL_SCORE_CACHE.get(videoId)!;
  const video = VIDEO_CATALOG.find((v) => v.video_id === videoId);
  if (!video) return [];
  const s = buildModelScores(video);
  MODEL_SCORE_CACHE.set(videoId, s);
  return s;
}

export function getHighlights(videoId: string, runId = "ranking_s42"): HighlightsResponse {
  const key = `${videoId}::${runId}`;
  if (HIGHLIGHTS_CACHE.has(key)) return HIGHLIGHTS_CACHE.get(key)!;
  const video = VIDEO_CATALOG.find((v) => v.video_id === videoId);
  if (!video) throw new Error(`unknown video ${videoId}`);
  const scores = getModelScores(videoId);
  const highlights = buildHighlights(video, scores);
  const res: HighlightsResponse = {
    video_id: videoId,
    run_id: runId,
    fps: FPS,
    duration_sec: video.duration_sec,
    scores,
    highlights,
    budget_ratio: 0.15,
    processing_ms: 180 + (hashStr(videoId) % 420),
  };
  HIGHLIGHTS_CACHE.set(key, res);
  return res;
}

// ---------------------------------------------------------------------------
// LLM titles + summaries (cached per video)
// ---------------------------------------------------------------------------
const SUMMARY_LIBRARY: Record<string, Summary[]> = {};
function buildSummaries(videoId: string): Summary[] {
  if (SUMMARY_LIBRARY[videoId]) return SUMMARY_LIBRARY[videoId];
  const hl = getHighlights(videoId).highlights;
  const video = VIDEO_CATALOG.find((v) => v.video_id === videoId)!;
  const rng = mulberry32(hashStr(videoId + "::summaries"));

  const TEMPLATES: Record<string, { title: string; summary: string; tags: string[] }[]> = {
    BK: [
      { title: "First Pitch Reached", summary: "Climber establishes footing on the lower crux and chalks up before committing to the overhang.", tags: ["crux", "footwork"] },
      { title: "Overhang Crux", summary: "Dynamic move across the overhang; the climber flags and locks off before the final pull.", tags: ["dynamic", "lock-off"] },
      { title: "Anchor Build", summary: "Clean gear placement at the ledge; the belayer takes up slack as the climber builds the anchor.", tags: ["gear", "anchor"] },
      { title: "Top-Out Celebration", summary: "Climber mantels over the lip and celebrates with the crew below as the rope goes slack.", tags: ["topout", "celebration"] },
    ],
    DS: [
      { title: "Warm-up Set", summary: "Athlete runs through dynamic warm-up drills and a few approach jumps before the platform.", tags: ["warmup"] },
      { title: "Approach Run", summary: "Measured acceleration into the takeoff board, arms cycling for maximum vertical.", tags: ["approach"] },
      { title: "Airborne Peak", summary: "Peak height captured mid-flight; clean tuck and eyes forward on the landing zone.", tags: ["airtime"] },
      { title: "Stuck Landing", summary: "Solid two-foot landing with controlled forward absorption; crowd reacts.", tags: ["landing"] },
    ],
    FM: [
      { title: "Start Line Energy", summary: "Runners jostle at the start as the horn fires; pacing settles within the first 200m.", tags: ["start"] },
      { title: "Lead Pack Break", summary: "Front pack strings out on the hill; a small breakaway of three forms at the front.", tags: ["breakaway"] },
      { title: "Aid Station Pass", summary: "Smooth handoff at the aid station; the leader grabs fluid without breaking stride.", tags: ["aid"] },
      { title: "Final Kick", summary: "Kick to the line with 400m to go; the chase pack closes but cannot match the pace.", tags: ["kick", "finish"] },
    ],
    GA: [
      { title: "Curbside Arrival", summary: "Vehicle pulls up to the curb; passenger checks the app and waves the driver down.", tags: ["arrival"] },
      { title: "Trunk Load", summary: "Luggage loaded into the trunk efficiently; quick confirmation of the destination.", tags: ["loading"] },
      { title: "Pull-Away", summary: "Smooth pull into traffic; turn signal and mirror check before merging.", tags: ["departure"] },
    ],
    MS: [
      { title: "Paddling Out", summary: "Surfer paddles past the break; sets a line and waits for the right peak to build.", tags: ["paddle"] },
      { title: "Drop-In", summary: "Clean drop-in on a chest-high wave; bottom turn sets up the section ahead.", tags: ["dropin"] },
      { title: "Cutback", summary: "Sharp cutback returns to the pocket; spray off the rail as the board redirects.", tags: ["cutback"] },
      { title: "Kick-Out", summary: "Kick-out over the closing lip; surfer surfaces and turns for the next set.", tags: ["kickout"] },
    ],
    PK: [
      { title: "Run-Up", summary: "Traceur builds speed down the alley, eyes locked on the launch wall.", tags: ["approach"] },
      { title: "Wall Run", summary: "Two-step wall run transitions into a cat leap; precise hand placement on the ledge.", tags: ["wallrun"] },
      { title: "Precision Jump", summary: "Precision jump across the gap; sticky landing on the narrow rail with no hop-out.", tags: ["precision"] },
      { title: "Roll Out", summary: "Shoulder roll dissipates the impact; traceur flows straight into the next line.", tags: ["roll"] },
    ],
    PR: [
      { title: "First Push", summary: "Child gets an initial push from behind; legs pump to find the swing rhythm.", tags: ["push"] },
      { title: "Peak Arc", summary: "Swing reaches peak height at the front of the arc; chains go slack for a beat.", tags: ["peak"] },
      { title: "Dismount", summary: "Controlled jump-off at the back of the arc; clean two-foot landing in the mulch.", tags: ["dismount"] },
    ],
    VT: [
      { title: "Ridge Reveal", summary: "Camera crests the ridge and the valley opens up; wide panoramic sweep of the basin.", tags: ["reveal"] },
      { title: "Ridge Walk", summary: "Steady walk along the exposed ridge; wind audible as the view stays wide.", tags: ["walk"] },
      { title: "Sunset Frame", summary: "Low sun flares across the valley; final hold on the silhouette of the peaks.", tags: ["sunset"] },
    ],
    CLIM: [
      { title: "Approach Hike", summary: "Long approach up the scree field; gear check at the base of the tower.", tags: ["approach"] },
      { title: "Pitch 2 Crux", summary: "Thin crack pitch; climber plugs small cams and heel-hooks through the bulge.", tags: ["crux", "gear"] },
      { title: "Belay Swap", summary: "Quick belay swap at the hanging stance; rope management stays clean.", tags: ["belay"] },
      { title: "Summit Block", summary: "Final mantel onto the summit block; panoramic spin before the rap setup.", tags: ["summit"] },
      { title: "Rappel Descent", summary: "Clean double-rope rappel; knots tied and backed up at the anchor.", tags: ["rappel"] },
    ],
    COOK: [
      { title: "Mise en Place", summary: "Chef walks through mise en place; knife work on the aromatics stays consistent.", tags: ["prep"] },
      { title: "Sear & Flip", summary: "Pan rips hot; protein sears hard and gets a clean single flip at the right moment.", tags: ["sear"] },
      { title: "Sauce Mount", summary: "Butter mounted into the pan sauce; emulsion comes together off the heat.", tags: ["sauce"] },
      { title: "Plating", summary: "Final plate-up with tweezers; micro-herb garnish and a deliberate wipe of the rim.", tags: ["plating"] },
    ],
    SOCC: [
      { title: "Midfield Press", summary: "High press forces a turnover in midfield; transition begins with a sharp vertical pass.", tags: ["press"] },
      { title: "Through Ball", summary: "Weighted through ball splits the centre-backs; striker runs onto it in stride.", tags: ["pass"] },
      { title: "Goal — Near Post", summary: "Low driven finish across the keeper at the near post; bench erupts.", tags: ["goal"] },
      { title: "Save — Diving", summary: "Full-stretch diving save tips it around the post; keeper is up quickly to claim the corner.", tags: ["save"] },
      { title: "Counter Attack", summary: "Lightning three-pass counter from a defensive corner; final finish is bundled in.", tags: ["counter"] },
      { title: "Final Whistle", summary: "Referee checks the watch and blows full time; players collapse and the crowd sings.", tags: ["whistle"] },
    ],
    FIRE: [
      { title: "First Ignition", summary: "First shell launches and bursts low; crowd oohs as the colour blooms across the bay.", tags: ["ignition"] },
      { title: "Aerial Bursts", summary: "Synchronized aerial bursts; three colours layer into a single wide pattern.", tags: ["aerial"] },
      { title: "Finale Cascade", summary: "Finale cascade fills the sky with rapid-fire shells; reflections shimmer on the water.", tags: ["finale"] },
      { title: "Crowd Reaction", summary: "Cut to the crowd during the finale; phones up and applause rolling through.", tags: ["reaction"] },
      { title: "Smoke Fade", summary: "Smoke drifts across the bay as the last shells fade; ambient applause tails off.", tags: ["fade"] },
    ],
  };

  const lib = TEMPLATES[video.category] ?? TEMPLATES.BK;
  const out: Summary[] = hl.map((h, i) => {
    const t = lib[i % lib.length];
    return {
      highlight_id: h.highlight_id,
      title: t.title,
      summary: t.summary,
      tags: t.tags,
    };
  });
  SUMMARY_LIBRARY[videoId] = out;
  void rng;
  return out;
}

export function getSummaries(videoId: string, highlightIds?: string[]): Summary[] {
  const all = buildSummaries(videoId);
  if (!highlightIds?.length) return all;
  const set = new Set(highlightIds);
  return all.filter((s) => set.has(s.highlight_id));
}

// ---------------------------------------------------------------------------
// Experiments (leaderboard) + per-category metrics
// ---------------------------------------------------------------------------
export const EXPERIMENTS: ExperimentRun[] = [
  { run_id: "ranking_s42", framework: "pytorch", loss: "ranking", backbone: "TSN-BNInception", f1: 0.571, map: 0.312, precision: 0.601, recall: 0.544, trained_at: "2024-11-04", epochs: 90, params_m: 8.6, note: "ListNet ranking loss, 15% budget" },
  { run_id: "contrastive_s7", framework: "pytorch", loss: "contrastive", backbone: "TSN-BNInception", f1: 0.562, map: 0.301, precision: 0.589, recall: 0.539, trained_at: "2024-11-02", epochs: 84, params_m: 8.6, note: "NT-Xent, τ=0.07" },
  { run_id: "triplet_s7", framework: "pytorch", loss: "triplet", backbone: "TSN-BNInception", f1: 0.548, map: 0.294, precision: 0.576, recall: 0.522, trained_at: "2024-10-28", epochs: 78, params_m: 8.6, note: "Margin 0.3, semi-hard mining" },
  { run_id: "ranking_s7", framework: "tensorflow", loss: "ranking", backbone: "TSN-BNInception", f1: 0.535, map: 0.281, precision: 0.562, recall: 0.511, trained_at: "2024-10-22", epochs: 90, params_m: 8.6, note: "TF port, same recipe" },
  { run_id: "mse_s21", framework: "pytorch", loss: "mse", backbone: "TSN-BNInception", f1: 0.493, map: 0.258, precision: 0.529, recall: 0.463, trained_at: "2024-10-14", epochs: 70, params_m: 8.6, note: "Regression baseline" },
  { run_id: "knn_s42", framework: "pytorch", loss: "knn", backbone: "TSN-BNInception", f1: 0.421, map: 0.198, precision: 0.467, recall: 0.385, trained_at: "2024-10-01", epochs: 0, params_m: 0, note: "Feature-space baseline, no training" },
];

const CATEGORY_SET = ["BK", "DS", "FM", "GA", "MS", "PK", "PR", "VT", "COOK", "SOCC", "FIRE", "CLIM"];

const RUN_METRICS_CACHE = new Map<string, RunMetrics>();
export function getRunMetrics(runId: string): RunMetrics {
  if (RUN_METRICS_CACHE.has(runId)) return RUN_METRICS_CACHE.get(runId)!;
  const run = EXPERIMENTS.find((r) => r.run_id === runId) ?? EXPERIMENTS[0];
  const rng = mulberry32(hashStr(runId + "::metrics"));
  const byCategory: CategoryMetric[] = CATEGORY_SET.map((cat) => {
    const jitter = (rng() - 0.5) * 0.12;
    return {
      category: cat,
      n_videos: VIDEO_CATALOG.filter((v) => v.category === cat).length || 1,
      f1: Math.max(0.05, Math.min(0.85, run.f1 + jitter)),
      map: Math.max(0.02, Math.min(0.6, run.map + jitter * 0.8)),
    };
  });
  const res: RunMetrics = {
    run_id: runId,
    overall: { f1: run.f1, map: run.map, precision: run.precision, recall: run.recall },
    by_category: byCategory,
  };
  RUN_METRICS_CACHE.set(runId, res);
  return res;
}

// ---------------------------------------------------------------------------
// Annotator agreement
// ---------------------------------------------------------------------------
const AGREEMENT_CACHE = new Map<string, AnnotatorAgreement>();
export function getAgreement(videoId: string): AnnotatorAgreement {
  if (AGREEMENT_CACHE.has(videoId)) return AGREEMENT_CACHE.get(videoId)!;
  const video = VIDEO_CATALOG.find((v) => v.video_id === videoId);
  if (!video) throw new Error(`unknown video ${videoId}`);
  const cfg = ANNOTATOR_CFG[videoId] ?? { n: 5, outlier: -1, agreement: 0.5 };
  const model = getModelScores(videoId);
  const n = model.length;
  const annotator_scores: Record<string, number[]> = {};
  let varianceSum = 0;
  let corrSum = 0;

  for (let a = 0; a < cfg.n; a++) {
    const rng = mulberry32(hashStr(`${videoId}::ann::${a}`));
    const bias = (rng() - 0.5) * 0.1;
    const scale = 0.85 + rng() * 0.3;
    const noiseAmp = a === cfg.outlier ? 0.22 : 0.07;
    const arr: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const base = model[i] * scale + bias + (rng() - 0.5) * noiseAmp;
      arr[i] = Math.max(0, Math.min(1, base));
    }
    annotator_scores[String(a + 1)] = arr;
    // simple correlation proxy against model
    let mc = 0;
    for (let i = 0; i < n; i++) {
      mc += 1 - Math.abs(arr[i] - model[i]);
    }
    corrSum += mc / n;
  }
  // per-frame variance across annotators
  for (let i = 0; i < n; i++) {
    const vals = Object.values(annotator_scores).map((a) => a[i]);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    varianceSum += vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  }
  const variance = varianceSum / n;
  const mean_correlation = corrSum / cfg.n;
  const high_disagreement = cfg.agreement < 0.45;

  const res: AnnotatorAgreement = {
    video_id: videoId,
    category: video.category,
    duration_sec: video.duration_sec,
    agreement: cfg.agreement,
    high_disagreement,
    n_annotators: cfg.n,
    annotator_scores,
    model_scores: model,
    fps: FPS,
    mean_correlation,
    variance,
  };
  AGREEMENT_CACHE.set(videoId, res);
  return res;
}

export function getHealth() {
  return {
    status: "ok" as const,
    model_loaded: true,
    db_reachable: true,
    version: "0.4.2",
    uptime_sec: 92441,
  };
}

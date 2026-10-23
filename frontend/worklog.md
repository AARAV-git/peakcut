---
Task ID: 1
Agent: Z.ai Code (main)
Task: Complete the Peakcut frontend — make it production-ready and professional for an interview reviewer, mirroring the described FastAPI contract end-to-end.

Work Log:
- Audited the existing in-progress Peakcut implementation: all four screens (Analyze, Result, Experiments, Annotators) and their components (AppShell, VideoUploader, VideoPlayer, ScoreChart, HighlightList, HighlightCard, Leaderboard, CategoryMetrics, AgreementChart, Loader, ErrorBanner, StatusPill, SectionTitle, PeakLogo) plus the Zustand store, types, mock-data, and format utils were already in place. The client (api.ts) imported mock data directly, and the only API route was a "Hello, world!" placeholder.
- Built the real backend layer: Next.js route handlers under /api/peakcut/* that mirror the FastAPI contract 1:1, with mock-data.ts acting as the repository:
  - GET  /api/peakcut/health
  - GET  /api/peakcut/videos
  - GET  /api/peakcut/videos/[id]            (annotator agreement detail)
  - POST /api/peakcut/highlights             (JSON for known videos, multipart for uploads)
  - POST /api/peakcut/summaries              (known-video + upload LLM-caption paths)
  - GET  /api/peakcut/experiments
  - GET  /api/peakcut/experiments/[id]/metrics
- Refactored src/lib/peakcut/api.ts to call those routes through a real fetch wrapper (shared request() with JSON handling + typed errors, cache: no-store, correct multipart handling that lets the browser set the boundary). Kept client-side latency jitter so loading states stay exercised. Fixed a type bug (getExperiments was typed as VideoMeta[]).
- Wired the uploader to send the real File as multipart: extended UploadedFile with the raw File, updated VideoUploader to pass it, and updated AnalyzePage's call site.
- Fixed a real latent bug in mock-data.ts getRunMetrics(): object shorthand `{ by_category }` referenced an undefined variable (the var is camelCase `byCategory`), which threw ReferenceError and made POST /experiments/[id]/metrics return 500. Changed to `by_category: byCategory`. Per-category metrics now render.
- Fixed 3 ESLint `react-hooks/set-state-in-effect` errors using React-recommended patterns: ExperimentsPage and AnnotatorsPage now derive loading state (metricsRunId/loadedVideoId vs. selection) and only mutate state inside async callbacks; ResultPage resets playback via the "adjust state during render" prev-prop pattern instead of an effect.
- Verified end-to-end with Agent Browser:
  - Analyze: 12 video cards (TVSum + SumMe), run selector, uploader, health pill v0.4.2.
  - Known-video golden path: clicked Fun Marathon → pipeline animation → auto-nav to Result → video player + scrubber, score curve (top 0.935), 4 highlights with LLM titles (Start Line Energy, Lead Pack Break, Aid Station Pass, Final Kick) + tags + score bars, play-highlight seek.
  - Experiments: sortable leaderboard (6 runs, filters, best-F1 crown on ranking_s42 F1=0.571/mAP=0.312), row selection drives metrics fetch, per-category bar chart + run detail panel with overall metric bars.
  - Annotators: agreement line chart (annotators vs model), stat cards, insight panel that correctly flips between "high-disagreement clip" (video_03, 0.39) and "broadly agree" (video_01, 0.71) on video switch.
  - Upload flow verified via curl: multipart POST /highlights returns upload_* response with full score curve; POST /summaries maps LLM titles to requested highlight ids.
  - Mobile (390x844): mobile tab bar renders, hero + cards reflow, footer pushed down naturally on long content.
  - No page errors, no console errors. All 6 API routes return HTTP 200.
- `bun run lint` passes with zero errors/warnings.

Stage Summary:
- Peakcut is now a complete, interview-grade single-page app with a real request chain: component → Zustand store/hooks → api.* fetch client → /api/peakcut/* route handlers → repository (mock-data) → "DB tables".
- The frontend contract matches the FastAPI spec exactly, so pointing NEXT_PUBLIC_API_URL at a real FastAPI origin is a 1:1 swap.
- Artifacts: 7 new route handlers under src/app/api/peakcut/, refactored src/lib/peakcut/api.ts, bug fix in src/lib/peakcut/mock-data.ts, lint fixes in ExperimentsPage/AnnotatorsPage/ResultPage, uploader wired to real File upload.
- Verification screenshots: analyze-desktop.png, result-desktop.png, experiments-final.png, experiments-full.png.

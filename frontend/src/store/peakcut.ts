"use client";

import { create } from "zustand";
import type { AnalysisTab, HighlightsResponse, Summary } from "@/lib/peakcut/types";

type PeakcutState = {
  activeTab: AnalysisTab;
  selectedVideoId: string | null;
  highlights: HighlightsResponse | null;
  summaries: Summary[];
  loadingHighlights: boolean;
  loadingSummaries: boolean;
  error: string | null;

  setTab: (tab: AnalysisTab) => void;
  setSelectedVideo: (id: string | null) => void;
  setHighlights: (h: HighlightsResponse | null) => void;
  setSummaries: (s: Summary[]) => void;
  setLoadingHighlights: (b: boolean) => void;
  setLoadingSummaries: (b: boolean) => void;
  setError: (e: string | null) => void;
  resetAnalysis: () => void;
};

export const usePeakcut = create<PeakcutState>((set) => ({
  activeTab: "analyze",
  selectedVideoId: null,
  highlights: null,
  summaries: [],
  loadingHighlights: false,
  loadingSummaries: false,
  error: null,

  setTab: (tab) => set({ activeTab: tab }),
  setSelectedVideo: (id) => set({ selectedVideoId: id }),
  setHighlights: (h) => set({ highlights: h }),
  setSummaries: (s) => set({ summaries: s }),
  setLoadingHighlights: (b) => set({ loadingHighlights: b }),
  setLoadingSummaries: (b) => set({ loadingSummaries: b }),
  setError: (e) => set({ error: e }),
  resetAnalysis: () =>
    set({
      highlights: null,
      summaries: [],
      error: null,
      loadingHighlights: false,
      loadingSummaries: false,
    }),
}));

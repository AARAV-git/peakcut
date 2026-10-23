"use client";

import { AppShell } from "@/components/peakcut/AppShell";
import { AnalyzePage } from "@/components/peakcut/AnalyzePage";
import { ResultPage } from "@/components/peakcut/ResultPage";
import { ExperimentsPage } from "@/components/peakcut/ExperimentsPage";
import { AnnotatorsPage } from "@/components/peakcut/AnnotatorsPage";
import { usePeakcut } from "@/store/peakcut";

export default function Home() {
  const activeTab = usePeakcut((s) => s.activeTab);

  return (
    <AppShell>
      {activeTab === "analyze" && <AnalyzePage />}
      {activeTab === "result" && <ResultPage />}
      {activeTab === "experiments" && <ExperimentsPage />}
      {activeTab === "annotators" && <AnnotatorsPage />}
    </AppShell>
  );
}

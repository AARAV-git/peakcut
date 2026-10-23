"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  Clapperboard,
  FlaskConical,
  GitBranch,
  PlayCircle,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import { PeakLogo } from "./PeakLogo";
import { StatusPill } from "./StatusPill";
import { usePeakcut } from "@/store/peakcut";
import { getHealthStatus } from "@/lib/peakcut/api";
import type { AnalysisTab, HealthStatus } from "@/lib/peakcut/types";
import { cn } from "@/lib/utils";

const TABS: { id: AnalysisTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "analyze", label: "Analyze", icon: ScanSearch },
  { id: "result", label: "Result", icon: PlayCircle },
  { id: "experiments", label: "Experiments", icon: FlaskConical },
  { id: "annotators", label: "Annotators", icon: BarChart3 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { activeTab, setTab, highlights } = usePeakcut();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let alive = true;
    getHealthStatus().then((h) => alive && setHealth(h));
    return () => {
      alive = false;
    };
  }, []);

  const resultDisabled = activeTab !== "result" && !highlights;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header health={health} activeTab={activeTab} setTab={setTab} resultDisabled={resultDisabled} />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}

function Header({
  health,
  activeTab,
  setTab,
  resultDisabled,
}: {
  health: HealthStatus | null;
  activeTab: AnalysisTab;
  setTab: (t: AnalysisTab) => void;
  resultDisabled: boolean;
}) {
  return (
    <header className="glass sticky top-0 z-40 border-b border-border/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => setTab("analyze")}
          className="group flex items-center gap-2.5"
          aria-label="Peakcut home"
        >
          <PeakLogo className="transition-transform group-hover:scale-105" />
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              Peakcut
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Highlight Ranking
            </span>
          </div>
        </button>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Primary">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            const disabled = t.id === "result" && resultDisabled;
            return (
              <button
                key={t.id}
                onClick={() => !disabled && setTab(t.id)}
                disabled={disabled}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
                  active
                    ? "text-foreground"
                    : disabled
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {t.label}
                {active && (
                  <motion.span
                    layoutId="tab-active"
                    className="absolute inset-0 -z-10 rounded-lg bg-accent ring-1 ring-border"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {health && (
            <StatusPill tone={health.model_loaded ? "ok" : "warn"} dot={health.model_loaded}>
              {health.model_loaded ? "Model ready" : "Model loading"}
            </StatusPill>
          )}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="hidden items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground sm:flex"
            title="Model checkpoint"
          >
            <GitBranch className="size-3.5" />
            <span className="tabular">v{health?.version ?? "—"}</span>
          </a>
        </div>
      </div>

      {/* mobile tab bar */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/70 px-2 py-1.5 md:hidden" aria-label="Primary mobile">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          const disabled = t.id === "result" && resultDisabled;
          return (
            <button
              key={t.id}
              onClick={() => !disabled && setTab(t.id)}
              disabled={disabled}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "bg-accent text-foreground"
                  : disabled
                    ? "text-muted-foreground/40"
                    : "text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-border/70 bg-card/30">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <PeakLogo className="size-4" />
            <span className="font-medium text-foreground/80">Peakcut</span>
            <span className="text-muted-foreground/70">· learning-to-rank video highlights</span>
          </span>
          <span className="hidden items-center gap-1.5 md:flex">
            <Sparkles className="size-3.5 text-primary" />
            TSN-BNInception backbone · 15% summary budget
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FooterBadge icon={Clapperboard} label="TVSum" />
          <FooterBadge icon={Activity} label="SumMe" />
          <FooterBadge icon={FlaskConical} label="PyTorch" />
        </div>
      </div>
    </footer>
  );
}

function FooterBadge({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
      <Icon className="size-3 text-primary" />
      {label}
    </span>
  );
}

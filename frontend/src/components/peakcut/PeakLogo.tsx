"use client";

import { cn } from "@/lib/utils";

export function PeakLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7", className)}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="peakcut-grad" x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" stroke="oklch(1 0 0 / 0.08)" />
      {/* rear peak */}
      <path d="M5 24.5L13 10l5 8.5L21 13l6 11.5H5Z" fill="url(#peakcut-grad)" fillOpacity="0.35" />
      {/* main peak */}
      <path d="M3 25L12 8l6.5 11L21 14l8 11H3Z" fill="url(#peakcut-grad)" />
      {/* highlight cut */}
      <path d="M12 8l4.2 7.1-1.8 2.4-2.4-1.2L9.5 21 12 8Z" fill="oklch(0.16 0.02 162)" fillOpacity="0.55" />
      <circle cx="23.5" cy="9.5" r="1.6" fill="#fbbf24" />
    </svg>
  );
}

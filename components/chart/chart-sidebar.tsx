"use client";

import { TimeframeSection } from "./timeframe-section";
import { WalletSection } from "./wallet-section";
import { SourceSection } from "./source-section";

export function ChartSidebar() {
  return (
    <div className="w-72 shrink-0 border-l border-[#222] bg-[#0a0a0a] overflow-y-auto">
      <div className="space-y-0">
        <TimeframeSection />
        <WalletSection />
        <SourceSection />
      </div>
    </div>
  );
}

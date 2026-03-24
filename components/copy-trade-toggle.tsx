"use client";

import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useWalletStore } from "@/lib/stores/wallet-store";
import { formatUSD } from "@/lib/format";
import type { TrackedWallet } from "@/lib/types";

export function CopyTradeToggle({ wallet }: { wallet: TrackedWallet }) {
  const toggleCopyTrade = useWalletStore((s) => s.toggleCopyTrade);

  return (
    <div className="flex items-center gap-2">
      <Switch
        size="sm"
        checked={wallet.copyTradeEnabled}
        onCheckedChange={() => toggleCopyTrade(wallet.address)}
      />
      {wallet.copyTradeEnabled ? (
        <Badge
          variant="outline"
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0"
        >
          Copy ON
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="border-neutral-700 bg-neutral-800 text-neutral-500 text-[10px] px-1.5 py-0"
        >
          Copy OFF
        </Badge>
      )}
      {wallet.copyTradeEnabled && (
        <span className="text-[10px] text-neutral-500">
          {wallet.copyTradeConfig.multiplier}x / max{" "}
          {formatUSD(wallet.copyTradeConfig.maxSingleTrade)}
        </span>
      )}
    </div>
  );
}

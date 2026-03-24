"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { WalletDetailDialog } from "@/components/wallet-detail-dialog";
import { fetchBalance } from "@/lib/polymarket-api";
import { useWalletStore } from "@/lib/stores/wallet-store";
import { formatUSD } from "@/lib/format";
import { POLL_INTERVAL_BALANCE } from "@/lib/constants";
import type { TrackedWallet } from "@/lib/types";

export function WalletHeader({ wallet }: { wallet: TrackedWallet }) {
  const remove = useWalletStore((s) => s.remove);
  const [copied, setCopied] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: balance } = useQuery({
    queryKey: ["balance", wallet.address],
    queryFn: () => fetchBalance(wallet.address),
    refetchInterval: POLL_INTERVAL_BALANCE,
  });

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [wallet.address]);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-sm text-neutral-100 truncate cursor-pointer hover:text-blue-400 transition-colors"
              onClick={() => setDetailOpen(true)}
              title="View wallet details"
            >
              {wallet.label}
            </span>
            {balance !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-neutral-400 shrink-0">
                    {formatUSD(balance)}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[10px]">
                  USDC.e balance via Polygon RPC
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <span
            className="font-mono text-[10px] text-neutral-500 cursor-pointer hover:text-neutral-300 transition-colors"
            title={copied ? "Copied!" : "Click to copy"}
            onClick={copyAddress}
          >
            {copied ? "Copied to clipboard!" : wallet.address}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-neutral-500 hover:text-red-400"
          onClick={() => remove(wallet.address)}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <WalletDetailDialog
        wallet={wallet}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}

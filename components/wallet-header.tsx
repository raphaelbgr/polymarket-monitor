"use client";

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchBalance } from "@/lib/polymarket-api";
import { useWalletStore } from "@/lib/stores/wallet-store";
import { POLL_INTERVAL_BALANCE } from "@/lib/constants";
import type { TrackedWallet } from "@/lib/types";

function abbreviateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletHeader({ wallet }: { wallet: TrackedWallet }) {
  const remove = useWalletStore((s) => s.remove);

  const { data: balance } = useQuery({
    queryKey: ["balance", wallet.address],
    queryFn: () => fetchBalance(wallet.address),
    refetchInterval: POLL_INTERVAL_BALANCE,
  });

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold text-sm text-neutral-100 truncate">
          {wallet.label}
        </span>
        <span className="font-mono text-xs text-neutral-500 shrink-0">
          {abbreviateAddress(wallet.address)}
        </span>
        {balance !== undefined && (
          <span className="text-xs text-neutral-400 shrink-0">
            ${balance.toFixed(2)}
          </span>
        )}
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
  );
}

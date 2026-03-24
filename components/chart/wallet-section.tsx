"use client";

import { useWalletStore } from "@/lib/stores/wallet-store";
import { useChartStore } from "@/lib/stores/chart-store";

export function WalletSection() {
  const wallets = useWalletStore((s) => s.wallets);
  const enabledWallets = useChartStore((s) => s.enabledWallets);
  const walletColors = useChartStore((s) => s.walletColors);
  const toggleWallet = useChartStore((s) => s.toggleWallet);

  if (wallets.length === 0) {
    return (
      <div className="border-b border-[#222] px-4 py-3">
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
          Wallets
        </h3>
        <p className="text-xs text-neutral-500">
          No wallets tracked. Add wallets on the Dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-[#222] px-4 py-3">
      <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
        Wallets
      </h3>
      <div className="space-y-1.5">
        {wallets.map((w) => {
          const key = w.address.toLowerCase();
          const enabled = enabledWallets.has(key);
          const color = walletColors[key] || "#737373";

          return (
            <button
              key={key}
              onClick={() => toggleWallet(w.address)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                enabled
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
              }`}
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: enabled ? color : "#404040" }}
              />
              <span className="truncate">{w.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

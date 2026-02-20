"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useSystemStore } from "@/lib/stores/system-store";
import { formatUSD } from "@/lib/format";

function RelativeTime({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (timestamp === 0) return <span className="text-neutral-500">--</span>;

  const diffMs = now - timestamp * 1000;
  const diffS = Math.max(0, Math.floor(diffMs / 1000));

  if (diffS < 60) return <span>{diffS}s ago</span>;
  if (diffS < 3600) return <span>{Math.floor(diffS / 60)}m ago</span>;
  return <span>{Math.floor(diffS / 3600)}h ago</span>;
}

export function StatusBar() {
  const status = useSystemStore((s) => s.status);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const pollStale =
    status.pollLastSuccess > 0 &&
    now - status.pollLastSuccess * 1000 > 30_000;

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center gap-4 border-b border-[#222] bg-[#0a0a0a]/95 px-4 py-2 font-mono text-xs backdrop-blur">
      {/* WS Status */}
      <div className="flex items-center gap-1.5">
        <div
          className={`h-2 w-2 rounded-full ${
            status.wsConnected
              ? "bg-emerald-500"
              : "bg-red-500 animate-pulse"
          }`}
        />
        <span className="text-neutral-400">WS</span>
        {status.wsConnected ? (
          <span className="text-emerald-400">
            <RelativeTime timestamp={status.wsLastMessage} />
          </span>
        ) : (
          <span className="text-red-400">disconnected</span>
        )}
      </div>

      {/* Poll Status */}
      <div className="flex items-center gap-1.5">
        <span className="text-neutral-400">Poll</span>
        <span className={pollStale ? "text-red-400" : "text-neutral-300"}>
          <RelativeTime timestamp={status.pollLastSuccess} />
        </span>
        {pollStale && (
          <span className="text-red-400">(stale)</span>
        )}
      </div>

      {/* Engine Status */}
      <div className="flex items-center gap-1.5">
        <span className="text-neutral-400">Engine</span>
        {status.copyTradeEngine === "ACTIVE" && (
          <Badge
            variant="outline"
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] px-1.5 py-0"
          >
            ACTIVE
          </Badge>
        )}
        {status.copyTradeEngine === "PAUSED" && (
          <Badge
            variant="outline"
            className="border-orange-500/30 bg-orange-500/10 text-orange-400 animate-pulse text-[10px] px-1.5 py-0"
          >
            PAUSED
          </Badge>
        )}
        {status.copyTradeEngine === "OFF" && (
          <Badge
            variant="outline"
            className="border-neutral-700 bg-neutral-800 text-neutral-500 text-[10px] px-1.5 py-0"
          >
            OFF
          </Badge>
        )}
      </div>

      {/* Balance */}
      <div className="flex items-center gap-1.5">
        <span className="text-neutral-400">Bal</span>
        <span
          className={
            status.userBalance < 2
              ? "text-yellow-400 animate-pulse"
              : "text-neutral-300"
          }
        >
          {formatUSD(status.userBalance)}
        </span>
      </div>

      {/* Order Counts */}
      <div className="flex items-center gap-3 ml-auto">
        <span className="text-emerald-400">
          {status.ordersFilled} filled
        </span>
        <span className="text-red-400">
          {status.ordersFailed} failed
        </span>
        <span className="text-amber-400">
          {status.ordersSkipped} skipped
        </span>
      </div>
    </div>
  );
}

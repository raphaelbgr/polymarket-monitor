"use client";

import {
  Search,
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Pause,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSystemStore } from "@/lib/stores/system-store";
import type { OrderStatus } from "@/lib/types";

const statusConfig: Record<
  OrderStatus["status"],
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  DETECTED: { icon: Search, className: "text-blue-400 bg-blue-500/10" },
  VALIDATING: {
    icon: ShieldCheck,
    className: "text-blue-400 bg-blue-500/10",
  },
  PLACING: { icon: Clock, className: "text-amber-400 bg-amber-500/10" },
  FILLED: {
    icon: CheckCircle,
    className: "text-emerald-400 bg-emerald-500/10",
  },
  FAILED: { icon: XCircle, className: "text-red-400 bg-red-500/10" },
  SKIPPED: {
    icon: AlertTriangle,
    className: "text-amber-400 bg-amber-500/10",
  },
  PAUSED: { icon: Pause, className: "text-orange-400 animate-pulse" },
  RESUMED: { icon: Play, className: "text-emerald-400 bg-emerald-500/10" },
};

export function OrderLifecycle({
  walletLabel,
}: {
  walletLabel: string;
}) {
  const orderStatuses = useSystemStore((s) => s.orderStatuses);

  const filtered = orderStatuses.filter(
    (o) => o.walletLabel === walletLabel
  );

  if (filtered.length === 0) return null;

  const visible = filtered.slice(0, 5);

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-neutral-400 mb-1">
        Orders ({filtered.length})
      </div>
      <div className="space-y-1">
        {visible.map((order, i) => {
          const config = statusConfig[order.status];
          const Icon = config.icon;
          return (
            <div
              key={`${order.orderId ?? order.status}-${order.timestamp}-${i}`}
              className="flex items-center gap-2 text-xs"
            >
              <Badge
                variant="outline"
                className={`shrink-0 text-[10px] px-1.5 py-0 gap-1 ${config.className}`}
              >
                <Icon className="size-3" />
                {order.status}
              </Badge>
              <span className="text-neutral-300 truncate">
                {order.message}
              </span>
              {order.error && (
                <span className="text-red-400 truncate">{order.error}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

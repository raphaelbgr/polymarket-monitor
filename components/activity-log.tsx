"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSystemStore } from "@/lib/stores/system-store";
import { formatTime } from "@/lib/format";

const sourceBadgeColors: Record<string, string> = {
  WS: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  POLL: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  COPY: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  SYSTEM: "border-neutral-600 bg-neutral-800 text-neutral-400",
  RPC: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
};

const levelColors: Record<string, string> = {
  info: "text-neutral-300",
  warn: "text-amber-400",
  error: "text-red-400",
  success: "text-emerald-400",
};

export function ActivityLog() {
  const activityLog = useSystemStore((s) => s.activityLog);

  return (
    <div className="border-t border-[#222] bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-medium text-neutral-400">
          Activity Log
        </span>
        <span className="text-xs text-neutral-500">
          {activityLog.length} entries
        </span>
      </div>
      <ScrollArea className="h-48 px-4 pb-2">
        {activityLog.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            No activity yet
          </div>
        ) : (
          <div className="space-y-1">
            {activityLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 text-xs"
              >
                <span className="shrink-0 font-mono text-neutral-500">
                  {formatTime(entry.timestamp)}
                </span>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] px-1.5 py-0 ${
                    sourceBadgeColors[entry.source] ||
                    sourceBadgeColors.SYSTEM
                  }`}
                >
                  {entry.source}
                </Badge>
                <span
                  className={
                    levelColors[entry.level] || levelColors.info
                  }
                >
                  {entry.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

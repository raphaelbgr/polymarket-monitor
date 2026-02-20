"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, X, ChevronDown, Save } from "lucide-react";
import { useFilterStore, useTradeFilter, usePositionFilter } from "@/lib/stores/filter-store";
import { PresetSelector } from "@/components/preset-selector";
import type { TradeFilter, PositionFilter } from "@/lib/shared/filters";

// ---------------------------------------------------------------------------
// TradeFilterBar
// ---------------------------------------------------------------------------

export function TradeFilterBar({ address }: { address: string }) {
  const filter = useTradeFilter(address);
  const setFilter = useFilterStore((s) => s.setTradeFilter);
  const clearFilter = useFilterStore((s) => s.clearTradeFilter);
  const [open, setOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<TradeFilter>) => {
      setFilter(address, { ...filter, ...patch });
    },
    [address, filter, setFilter],
  );

  const hasFilters =
    (filter.side?.length ?? 0) > 0 ||
    filter.minSize !== undefined ||
    filter.maxSize !== undefined ||
    filter.titleSearch ||
    filter.outcome ||
    (filter.tags?.length ?? 0) > 0 ||
    (filter.source?.length ?? 0) > 0;

  const activeCount = [
    filter.side?.length ? 1 : 0,
    filter.minSize !== undefined || filter.maxSize !== undefined ? 1 : 0,
    filter.titleSearch ? 1 : 0,
    filter.outcome ? 1 : 0,
    filter.tags?.length ? 1 : 0,
    filter.source?.length ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Quick toggles */}
      <SideToggle
        active={filter.side}
        onChange={(side) => update({ side: side.length ? side : undefined })}
      />
      <SourceToggle
        active={filter.source}
        onChange={(source) =>
          update({ source: source.length ? source : undefined })
        }
      />

      {/* Advanced filters popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 gap-1"
          >
            <Filter className="size-3" />
            {activeCount > 0 && (
              <span className="text-blue-400">{activeCount}</span>
            )}
            <ChevronDown className="size-2.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 bg-[#111] border-[#333] p-3 space-y-3"
          align="start"
        >
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-500 uppercase">
              Title search
            </label>
            <Input
              placeholder="Bitcoin, Trump..."
              className="h-6 text-xs bg-[#0a0a0a] border-[#333]"
              value={filter.titleSearch ?? ""}
              onChange={(e) =>
                update({
                  titleSearch: e.target.value || undefined,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-500 uppercase">
              Outcome
            </label>
            <Input
              placeholder="Yes, No..."
              className="h-6 text-xs bg-[#0a0a0a] border-[#333]"
              value={filter.outcome ?? ""}
              onChange={(e) =>
                update({ outcome: e.target.value || undefined })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-500 uppercase">
              Size range (USD)
            </label>
            <div className="flex gap-1.5">
              <Input
                type="number"
                placeholder="Min"
                className="h-6 text-xs bg-[#0a0a0a] border-[#333]"
                value={filter.minSize ?? ""}
                onChange={(e) =>
                  update({
                    minSize: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
              <Input
                type="number"
                placeholder="Max"
                className="h-6 text-xs bg-[#0a0a0a] border-[#333]"
                value={filter.maxSize ?? ""}
                onChange={(e) =>
                  update({
                    maxSize: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-500 uppercase">
              Tags (comma-separated)
            </label>
            <Input
              placeholder="crypto, politics..."
              className="h-6 text-xs bg-[#0a0a0a] border-[#333]"
              value={filter.tags?.join(", ") ?? ""}
              onChange={(e) => {
                const tags = e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
                update({ tags: tags.length ? tags : undefined });
              }}
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Presets */}
      <PresetSelector address={address} scope="trades" />

      {/* Clear all */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] text-neutral-500 hover:text-red-400 gap-0.5"
          onClick={() => clearFilter(address)}
        >
          <X className="size-3" />
          Clear
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PositionFilterBar
// ---------------------------------------------------------------------------

export function PositionFilterBar({ address }: { address: string }) {
  const filter = usePositionFilter(address);
  const setFilter = useFilterStore((s) => s.setPositionFilter);
  const clearFilter = useFilterStore((s) => s.clearPositionFilter);
  const [open, setOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<PositionFilter>) => {
      setFilter(address, { ...filter, ...patch });
    },
    [address, filter, setFilter],
  );

  const hasFilters =
    (filter.status?.length ?? 0) > 0 ||
    filter.minValue !== undefined ||
    filter.maxValue !== undefined ||
    filter.titleSearch ||
    (filter.tags?.length ?? 0) > 0;

  const activeCount = [
    filter.status?.length ? 1 : 0,
    filter.minValue !== undefined || filter.maxValue !== undefined ? 1 : 0,
    filter.titleSearch ? 1 : 0,
    filter.tags?.length ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Status toggles */}
      <StatusToggle
        active={filter.status}
        onChange={(status) =>
          update({ status: status.length ? status : undefined })
        }
      />

      {/* Advanced */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 gap-1"
          >
            <Filter className="size-3" />
            {activeCount > 0 && (
              <span className="text-blue-400">{activeCount}</span>
            )}
            <ChevronDown className="size-2.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 bg-[#111] border-[#333] p-3 space-y-3"
          align="start"
        >
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-500 uppercase">
              Title search
            </label>
            <Input
              placeholder="Bitcoin, Trump..."
              className="h-6 text-xs bg-[#0a0a0a] border-[#333]"
              value={filter.titleSearch ?? ""}
              onChange={(e) =>
                update({ titleSearch: e.target.value || undefined })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-500 uppercase">
              Market value range (USD)
            </label>
            <div className="flex gap-1.5">
              <Input
                type="number"
                placeholder="Min"
                className="h-6 text-xs bg-[#0a0a0a] border-[#333]"
                value={filter.minValue ?? ""}
                onChange={(e) =>
                  update({
                    minValue: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
              <Input
                type="number"
                placeholder="Max"
                className="h-6 text-xs bg-[#0a0a0a] border-[#333]"
                value={filter.maxValue ?? ""}
                onChange={(e) =>
                  update({
                    maxValue: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-500 uppercase">
              P&L range (USD)
            </label>
            <div className="flex gap-1.5">
              <Input
                type="number"
                placeholder="Min"
                className="h-6 text-xs bg-[#0a0a0a] border-[#333]"
                value={filter.minPnl ?? ""}
                onChange={(e) =>
                  update({
                    minPnl: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
              <Input
                type="number"
                placeholder="Max"
                className="h-6 text-xs bg-[#0a0a0a] border-[#333]"
                value={filter.maxPnl ?? ""}
                onChange={(e) =>
                  update({
                    maxPnl: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-neutral-500 uppercase">
              Tags (comma-separated)
            </label>
            <Input
              placeholder="crypto, politics..."
              className="h-6 text-xs bg-[#0a0a0a] border-[#333]"
              value={filter.tags?.join(", ") ?? ""}
              onChange={(e) => {
                const tags = e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
                update({ tags: tags.length ? tags : undefined });
              }}
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Presets */}
      <PresetSelector address={address} scope="positions" />

      {/* Clear all */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] text-neutral-500 hover:text-red-400 gap-0.5"
          onClick={() => clearFilter(address)}
        >
          <X className="size-3" />
          Clear
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle pills
// ---------------------------------------------------------------------------

function SideToggle({
  active,
  onChange,
}: {
  active?: ("BUY" | "SELL")[];
  onChange: (val: ("BUY" | "SELL")[]) => void;
}) {
  const toggle = (val: "BUY" | "SELL") => {
    const current = active ?? [];
    if (current.includes(val)) {
      onChange(current.filter((v) => v !== val));
    } else {
      onChange([...current, val]);
    }
  };

  return (
    <>
      <Badge
        variant="outline"
        className={`text-[9px] px-1.5 py-0 cursor-pointer select-none transition-colors ${
          active?.includes("BUY")
            ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
            : "border-[#333] text-neutral-600 hover:text-neutral-400"
        }`}
        onClick={() => toggle("BUY")}
      >
        BUY
      </Badge>
      <Badge
        variant="outline"
        className={`text-[9px] px-1.5 py-0 cursor-pointer select-none transition-colors ${
          active?.includes("SELL")
            ? "border-red-500/50 bg-red-500/20 text-red-400"
            : "border-[#333] text-neutral-600 hover:text-neutral-400"
        }`}
        onClick={() => toggle("SELL")}
      >
        SELL
      </Badge>
    </>
  );
}

function SourceToggle({
  active,
  onChange,
}: {
  active?: ("WS" | "POLL")[];
  onChange: (val: ("WS" | "POLL")[]) => void;
}) {
  const toggle = (val: "WS" | "POLL") => {
    const current = active ?? [];
    if (current.includes(val)) {
      onChange(current.filter((v) => v !== val));
    } else {
      onChange([...current, val]);
    }
  };

  return (
    <>
      <Badge
        variant="outline"
        className={`text-[9px] px-1.5 py-0 cursor-pointer select-none transition-colors ${
          active?.includes("WS")
            ? "border-blue-500/50 bg-blue-500/20 text-blue-400"
            : "border-[#333] text-neutral-600 hover:text-neutral-400"
        }`}
        onClick={() => toggle("WS")}
      >
        WS
      </Badge>
      <Badge
        variant="outline"
        className={`text-[9px] px-1.5 py-0 cursor-pointer select-none transition-colors ${
          active?.includes("POLL")
            ? "border-purple-500/50 bg-purple-500/20 text-purple-400"
            : "border-[#333] text-neutral-600 hover:text-neutral-400"
        }`}
        onClick={() => toggle("POLL")}
      >
        POLL
      </Badge>
    </>
  );
}

function StatusToggle({
  active,
  onChange,
}: {
  active?: string[];
  onChange: (val: string[]) => void;
}) {
  const statuses = [
    { value: "active", label: "Active", color: "blue" },
    { value: "won", label: "Won", color: "emerald" },
    { value: "lost", label: "Lost", color: "red" },
    { value: "resolving", label: "Resolving", color: "amber" },
  ] as const;

  const toggle = (val: string) => {
    const current = active ?? [];
    if (current.includes(val)) {
      onChange(current.filter((v) => v !== val));
    } else {
      onChange([...current, val]);
    }
  };

  return (
    <>
      {statuses.map((s) => (
        <Badge
          key={s.value}
          variant="outline"
          className={`text-[9px] px-1.5 py-0 cursor-pointer select-none transition-colors ${
            active?.includes(s.value)
              ? `border-${s.color}-500/50 bg-${s.color}-500/20 text-${s.color}-400`
              : "border-[#333] text-neutral-600 hover:text-neutral-400"
          }`}
          onClick={() => toggle(s.value)}
        >
          {s.label}
        </Badge>
      ))}
    </>
  );
}

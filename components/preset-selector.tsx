"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bookmark, Save, Trash2 } from "lucide-react";
import { useFilterStore, useTradeFilter, usePositionFilter } from "@/lib/stores/filter-store";
import type { FilterPreset } from "@/lib/shared/filters";

export function PresetSelector({
  address,
  scope,
}: {
  address: string;
  scope: "trades" | "positions";
}) {
  const presets = useFilterStore((s) => s.presets);
  const loadPresets = useFilterStore((s) => s.loadPresets);
  const savePreset = useFilterStore((s) => s.savePreset);
  const deletePreset = useFilterStore((s) => s.deletePreset);
  const applyPreset = useFilterStore((s) => s.applyPreset);
  const tradeFilter = useTradeFilter(address);
  const positionFilter = usePositionFilter(address);

  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const scopePresets = presets.filter((p) => p.scope === scope);

  const handleSave = () => {
    if (!saveName.trim()) return;
    const filters = scope === "trades" ? tradeFilter : positionFilter;

    const preset: FilterPreset = {
      id: `${scope}-${Date.now()}`,
      name: saveName.trim(),
      scope,
      filters,
    };

    savePreset(preset);
    setSaveName("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 gap-0.5"
        >
          <Bookmark className="size-3" />
          {scopePresets.length > 0 && (
            <span className="text-neutral-400">{scopePresets.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 bg-[#111] border-[#333] p-2 space-y-2"
        align="start"
      >
        {scopePresets.length === 0 && (
          <div className="text-[10px] text-neutral-600 text-center py-1">
            No saved presets
          </div>
        )}
        {scopePresets.map((preset) => (
          <div
            key={preset.id}
            className="flex items-center justify-between group"
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-neutral-300 hover:text-white flex-1 justify-start"
              onClick={() => {
                applyPreset(address, preset);
                setOpen(false);
              }}
            >
              {preset.name}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
              onClick={() => deletePreset(preset.id)}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}

        <div className="border-t border-[#333] pt-2 flex gap-1">
          <Input
            placeholder="Preset name..."
            className="h-6 text-xs bg-[#0a0a0a] border-[#333] flex-1"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-neutral-500 hover:text-emerald-400"
            onClick={handleSave}
            disabled={!saveName.trim()}
          >
            <Save className="size-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

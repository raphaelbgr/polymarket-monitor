"use client";

import { create } from "zustand";
import type { TradeFilter, PositionFilter, FilterPreset } from "../shared/filters";

const PRESETS_KEY = "polymarket-filter-presets";
const TAG_OVERRIDES_KEY = "polymarket-tag-overrides";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface FilterState {
  // Active filters per wallet (keyed by lowercase address)
  tradeFilters: Record<string, TradeFilter>;
  positionFilters: Record<string, PositionFilter>;

  // Presets
  presets: FilterPreset[];

  // Actions
  setTradeFilter: (wallet: string, filter: TradeFilter) => void;
  setPositionFilter: (wallet: string, filter: PositionFilter) => void;
  clearTradeFilter: (wallet: string) => void;
  clearPositionFilter: (wallet: string) => void;

  // Presets
  loadPresets: () => void;
  savePreset: (preset: FilterPreset) => void;
  deletePreset: (id: string) => void;
  applyPreset: (wallet: string, preset: FilterPreset) => void;
}

function loadPresetsFromStorage(): FilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresetsToStorage(presets: FilterPreset[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export const useFilterStore = create<FilterState>((set, get) => ({
  tradeFilters: {},
  positionFilters: {},
  presets: [],

  setTradeFilter: (wallet, filter) => {
    const key = wallet.toLowerCase();
    set((s) => ({
      tradeFilters: { ...s.tradeFilters, [key]: filter },
    }));
  },

  setPositionFilter: (wallet, filter) => {
    const key = wallet.toLowerCase();
    set((s) => ({
      positionFilters: { ...s.positionFilters, [key]: filter },
    }));
  },

  clearTradeFilter: (wallet) => {
    const key = wallet.toLowerCase();
    set((s) => {
      const next = { ...s.tradeFilters };
      delete next[key];
      return { tradeFilters: next };
    });
  },

  clearPositionFilter: (wallet) => {
    const key = wallet.toLowerCase();
    set((s) => {
      const next = { ...s.positionFilters };
      delete next[key];
      return { positionFilters: next };
    });
  },

  loadPresets: () => {
    set({ presets: loadPresetsFromStorage() });
  },

  savePreset: (preset) => {
    set((s) => {
      const next = s.presets.filter((p) => p.id !== preset.id);
      next.push(preset);
      savePresetsToStorage(next);
      return { presets: next };
    });
  },

  deletePreset: (id) => {
    set((s) => {
      const next = s.presets.filter((p) => p.id !== id);
      savePresetsToStorage(next);
      return { presets: next };
    });
  },

  applyPreset: (wallet, preset) => {
    if (preset.scope === "trades") {
      get().setTradeFilter(wallet, preset.filters as TradeFilter);
    } else {
      get().setPositionFilter(wallet, preset.filters as PositionFilter);
    }
  },
}));

// Stable empty objects — shared reference avoids infinite re-render loops.
const EMPTY_TRADE_FILTER: TradeFilter = {};
const EMPTY_POSITION_FILTER: PositionFilter = {};

export function useTradeFilter(wallet: string): TradeFilter {
  return useFilterStore(
    (s) => s.tradeFilters[wallet.toLowerCase()] ?? EMPTY_TRADE_FILTER,
  );
}

export function usePositionFilter(wallet: string): PositionFilter {
  return useFilterStore(
    (s) => s.positionFilters[wallet.toLowerCase()] ?? EMPTY_POSITION_FILTER,
  );
}

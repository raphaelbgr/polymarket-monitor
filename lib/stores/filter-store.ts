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
  getTradeFilter: (wallet: string) => TradeFilter;
  getPositionFilter: (wallet: string) => PositionFilter;

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

  getTradeFilter: (wallet) => {
    return get().tradeFilters[wallet.toLowerCase()] ?? {};
  },

  getPositionFilter: (wallet) => {
    return get().positionFilters[wallet.toLowerCase()] ?? {};
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

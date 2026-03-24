import { create } from "zustand";
import { DEFAULT_TIMEFRAMES, WALLET_COLORS, type Timeframe } from "../chart/constants";

export type ChartStyle = "candles" | "area";

interface ChartState {
  selectedTimeframe: Timeframe;
  enabledTimeframes: Set<Timeframe>;
  enabledWallets: Set<string>;
  walletColors: Record<string, string>;
  sidebarOpen: boolean;
  sources: { binance: boolean; polymarket: boolean };
  showPastPredictions: boolean;
  chartStyle: ChartStyle;

  setTimeframe: (tf: Timeframe) => void;
  toggleTimeframe: (tf: Timeframe) => void;
  toggleWallet: (address: string) => void;
  setWalletColor: (address: string, color: string) => void;
  toggleSidebar: () => void;
  toggleSource: (source: "binance" | "polymarket") => void;
  togglePastPredictions: () => void;
  toggleChartStyle: () => void;
  initWalletColors: (wallets: Array<{ address: string }>) => void;
}

function loadPersistedState(): Partial<Pick<ChartState, "selectedTimeframe" | "enabledTimeframes" | "sidebarOpen" | "sources" | "showPastPredictions" | "walletColors" | "enabledWallets" | "chartStyle">> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("chart-settings");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      selectedTimeframe: parsed.selectedTimeframe,
      enabledTimeframes: parsed.enabledTimeframes
        ? new Set(parsed.enabledTimeframes as Timeframe[])
        : undefined,
      sidebarOpen: parsed.sidebarOpen,
      sources: parsed.sources,
      showPastPredictions: parsed.showPastPredictions,
      walletColors: parsed.walletColors,
      enabledWallets: parsed.enabledWallets
        ? new Set(parsed.enabledWallets as string[])
        : undefined,
      chartStyle: parsed.chartStyle,
    };
  } catch {
    return {};
  }
}

function persist(state: ChartState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      "chart-settings",
      JSON.stringify({
        selectedTimeframe: state.selectedTimeframe,
        enabledTimeframes: Array.from(state.enabledTimeframes),
        enabledWallets: Array.from(state.enabledWallets),
        walletColors: state.walletColors,
        sidebarOpen: state.sidebarOpen,
        sources: state.sources,
        showPastPredictions: state.showPastPredictions,
        chartStyle: state.chartStyle,
      }),
    );
  } catch {
    // ignore storage errors
  }
}

export const useChartStore = create<ChartState>((set, get) => {
  const saved = loadPersistedState();

  return {
    selectedTimeframe: saved.selectedTimeframe ?? ("5m" as Timeframe),
    enabledTimeframes: saved.enabledTimeframes ?? new Set(DEFAULT_TIMEFRAMES),
    enabledWallets: saved.enabledWallets ?? new Set<string>(),
    walletColors: saved.walletColors ?? {},
    sidebarOpen: saved.sidebarOpen ?? true,
    sources: saved.sources ?? { binance: true, polymarket: true },
    showPastPredictions: saved.showPastPredictions ?? false,
    chartStyle: saved.chartStyle ?? "area",

    setTimeframe: (tf: Timeframe) => {
      set({ selectedTimeframe: tf });
      persist(get());
    },

    toggleTimeframe: (tf: Timeframe) => {
      const next = new Set(get().enabledTimeframes);
      if (next.has(tf)) {
        if (next.size > 1) next.delete(tf); // Keep at least one
      } else {
        next.add(tf);
      }
      set({ enabledTimeframes: next });
      persist(get());
    },

    toggleWallet: (address: string) => {
      const key = address.toLowerCase();
      const next = new Set(get().enabledWallets);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      set({ enabledWallets: next });
      persist(get());
    },

    setWalletColor: (address: string, color: string) => {
      const key = address.toLowerCase();
      set({ walletColors: { ...get().walletColors, [key]: color } });
      persist(get());
    },

    toggleSidebar: () => {
      set({ sidebarOpen: !get().sidebarOpen });
      persist(get());
    },

    toggleSource: (source: "binance" | "polymarket") => {
      const sources = { ...get().sources, [source]: !get().sources[source] };
      set({ sources });
      persist(get());
    },

    togglePastPredictions: () => {
      set({ showPastPredictions: !get().showPastPredictions });
      persist(get());
    },

    toggleChartStyle: () => {
      set({ chartStyle: get().chartStyle === "candles" ? "area" : "candles" });
      persist(get());
    },

    initWalletColors: (wallets: Array<{ address: string }>) => {
      const existing = get().walletColors;
      const updated = { ...existing };
      const enabledNext = new Set(get().enabledWallets);
      let changed = false;

      for (let i = 0; i < wallets.length; i++) {
        const key = wallets[i].address.toLowerCase();
        if (!updated[key]) {
          updated[key] = WALLET_COLORS[i % WALLET_COLORS.length];
          changed = true;
        }
        // If enabledWallets is empty (first init), enable all
        if (get().enabledWallets.size === 0) {
          enabledNext.add(key);
        }
      }

      if (changed || get().enabledWallets.size === 0) {
        set({ walletColors: updated, enabledWallets: enabledNext });
        persist(get());
      }
    },
  };
});

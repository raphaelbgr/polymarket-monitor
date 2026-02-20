import { create } from "zustand";
import { TrackedWallet, CopyTradeConfig } from "../types";
import { loadWallets, saveWallets, addWallet, removeWallet } from "../wallets";

interface WalletState {
  wallets: TrackedWallet[];
  initialized: boolean;
  init: () => void;
  add: (address: string, label: string) => void;
  remove: (address: string) => void;
  toggleCopyTrade: (address: string) => void;
  updateCopyTradeConfig: (
    address: string,
    config: Partial<CopyTradeConfig>
  ) => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallets: [],
  initialized: false,

  init: () => {
    if (get().initialized) return;
    const wallets = loadWallets();
    set({ wallets, initialized: true });
  },

  add: (address: string, label: string) => {
    const updated = addWallet(get().wallets, address, label);
    set({ wallets: updated });
  },

  remove: (address: string) => {
    const updated = removeWallet(get().wallets, address);
    set({ wallets: updated });
  },

  toggleCopyTrade: (address: string) => {
    const wallets = get().wallets.map((w) =>
      w.address === address.toLowerCase()
        ? { ...w, copyTradeEnabled: !w.copyTradeEnabled }
        : w
    );
    saveWallets(wallets);
    set({ wallets });
  },

  updateCopyTradeConfig: (
    address: string,
    config: Partial<CopyTradeConfig>
  ) => {
    const wallets = get().wallets.map((w) =>
      w.address === address.toLowerCase()
        ? { ...w, copyTradeConfig: { ...w.copyTradeConfig, ...config } }
        : w
    );
    saveWallets(wallets);
    set({ wallets });
  },
}));

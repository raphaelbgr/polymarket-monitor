import { TrackedWallet, CopyTradeConfig } from "./types";
import { DEFAULT_COPY_TRADE_CONFIG } from "./constants";
import defaultWalletsJson from "../wallets.json";

const STORAGE_KEY = "polymarket-tracked-wallets";

export function getDefaultWallets(): TrackedWallet[] {
  return defaultWalletsJson.wallets.map((w) => ({
    address: w.address.toLowerCase(),
    label: w.label,
    notes: w.notes,
    copyTradeEnabled: false,
    copyTradeConfig: { ...DEFAULT_COPY_TRADE_CONFIG },
  }));
}

export function loadWallets(): TrackedWallet[] {
  if (typeof window === "undefined") return getDefaultWallets();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return getDefaultWallets();
  try {
    return JSON.parse(stored) as TrackedWallet[];
  } catch {
    return getDefaultWallets();
  }
}

export function saveWallets(wallets: TrackedWallet[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
}

export function addWallet(wallets: TrackedWallet[], address: string, label: string): TrackedWallet[] {
  const normalized = address.toLowerCase();
  if (wallets.some((w) => w.address === normalized)) return wallets;
  const updated = [
    ...wallets,
    {
      address: normalized,
      label,
      copyTradeEnabled: false,
      copyTradeConfig: { ...DEFAULT_COPY_TRADE_CONFIG },
    },
  ];
  saveWallets(updated);
  return updated;
}

export function removeWallet(wallets: TrackedWallet[], address: string): TrackedWallet[] {
  const updated = wallets.filter((w) => w.address !== address.toLowerCase());
  saveWallets(updated);
  return updated;
}

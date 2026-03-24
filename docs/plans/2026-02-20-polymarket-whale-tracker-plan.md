# Polymarket Whale Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time Next.js dashboard that monitors Polymarket whale wallets and enables one-click copy-trading.

**Architecture:** Single-language TypeScript stack. Next.js 14+ App Router for the dashboard with API proxy routes. Official `@polymarket/real-time-data-client` for live trade streams. Zustand for client state, React Query for server state polling. Standalone Node.js WebSocket server using `@polymarket/clob-client` for copy-trade order execution.

**Tech Stack:** Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui, viem, zustand, @tanstack/react-query, @tanstack/react-table, @polymarket/real-time-data-client, @polymarket/clob-client

**Design doc:** `docs/plans/2026-02-20-polymarket-whale-tracker-design.md`

---

## Phase 1: Foundation

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

**Step 1: Create Next.js app**

Run:
```bash
cd C:/Users/rbgnr/git/polymarket-monitor
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm
```

If directory is not empty (has docs/), move docs out, scaffold, move back.

**Step 2: Install core dependencies**

Run:
```bash
npm install zustand @tanstack/react-query viem @polymarket/real-time-data-client
npm install -D @types/node
```

**Step 3: Install shadcn/ui**

Run:
```bash
npx shadcn@latest init -d
```

Accept defaults (New York style, neutral base color, CSS variables).

**Step 4: Add shadcn components we need**

Run:
```bash
npx shadcn@latest add card badge button input label switch separator scroll-area table dialog popover tooltip
```

**Step 5: Configure dark theme in globals.css**

Replace the body/background styles in `app/globals.css` with:
```css
:root {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
}

body {
  background: #0a0a0a;
  color: #fafafa;
}
```

**Step 6: Update layout.tsx**

Set dark class on html, add Inter font, set metadata title to "Polymarket Whale Tracker".

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind, shadcn/ui, and core deps"
```

---

### Task 2: Types and Constants

**Files:**
- Create: `lib/types.ts`
- Create: `lib/constants.ts`

**Step 1: Create lib/types.ts**

```typescript
export interface TrackedWallet {
  address: string;
  label: string;
  notes?: string;
  copyTradeEnabled: boolean;
  copyTradeConfig: CopyTradeConfig;
}

export interface CopyTradeConfig {
  multiplier: number;
  maxSingleTrade: number;
  priceImprovementPct: number;
}

export interface Trade {
  conditionId: string;
  title: string;
  outcome: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: number;
  transactionHash: string;
  walletAddress: string;
  source: "WS" | "POLL";
}

export interface Position {
  conditionId: string;
  title: string;
  outcome: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  unrealizedPnl: number;
  marketValue: number;
  asset: string;
}

export interface OrderStatus {
  orderId: string | null;
  status: "DETECTED" | "VALIDATING" | "PLACING" | "FILLED" | "FAILED" | "SKIPPED" | "PAUSED" | "RESUMED";
  message: string;
  error?: string;
  reason?: string;
  timestamp: number;
  walletLabel: string;
  trade: Trade;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error" | "success";
  message: string;
  source: string;
}

export interface SystemStatus {
  wsConnected: boolean;
  wsLastMessage: number;
  pollLastSuccess: number;
  copyTradeEngine: "ACTIVE" | "PAUSED" | "OFF";
  copyTradeMessage: string;
  userBalance: number;
  ordersTotal: number;
  ordersFilled: number;
  ordersFailed: number;
  ordersSkipped: number;
}

// Raw API response types (before transformation)
export interface RawTrade {
  conditionId: string;
  title: string;
  outcome: string;
  side: string;
  size: string;
  price: string;
  timestamp: number;
  transactionHash: string;
  proxyWallet: string;
  asset: string;
}

export interface RawPosition {
  conditionId: string;
  title: string;
  outcome: string;
  size: string;
  avgPrice: string;
  curPrice: string;
  asset: string;
  proxyWallet: string;
}
```

**Step 2: Create lib/constants.ts**

```typescript
export const DATA_API_BASE = "https://data-api.polymarket.com";
export const CLOB_API_BASE = "https://clob.polymarket.com";
export const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
export const POLYGON_RPC_URL = "https://polygon-rpc.com";
export const POLYGON_RPC_FALLBACK = "https://rpc.ankr.com/polygon";

export const USDC_E_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;
export const USDC_E_DECIMALS = 6;

export const WS_PING_INTERVAL = 5000;
export const POLL_INTERVAL_TRADES = 15_000;
export const POLL_INTERVAL_POSITIONS = 30_000;
export const POLL_INTERVAL_BALANCE = 30_000;
export const DEDUP_SET_MAX_SIZE = 10_000;

export const COPY_TRADE_WS_URL = "ws://localhost:8765";

export const DEFAULT_COPY_TRADE_CONFIG = {
  multiplier: 0.5,
  maxSingleTrade: 1.0,
  priceImprovementPct: 0.02,
} as const;
```

**Step 3: Commit**

```bash
git add lib/types.ts lib/constants.ts
git commit -m "feat: add TypeScript types and constants for Polymarket APIs"
```

---

### Task 3: Wallet Configuration

**Files:**
- Create: `wallets.json`
- Create: `lib/wallets.ts`

**Step 1: Create wallets.json**

```json
{
  "wallets": [
    {
      "address": "0xd0d6053c3c37e727402d84c14069780d360993aa",
      "label": "uncommon-oat",
      "notes": "$487K portfolio. High-freq BTC/ETH/SOL 5-min directional markets."
    },
    {
      "address": "0x1979ae6b7e6534de9c4539d0c205e582ca637c9d",
      "label": "square-guy",
      "notes": "$608K portfolio. BTC/ETH/SOL/XRP Up or Down markets, 5-min to 4-hour."
    },
    {
      "address": "0x204f72f35326db932158cba6adff0b9a1da95e14",
      "label": "swisstony",
      "notes": ""
    }
  ]
}
```

**Step 2: Create lib/wallets.ts**

Wallet management module that loads defaults from `wallets.json`, stores user additions in localStorage, and manages copy-trade config per wallet.

```typescript
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
```

**Step 3: Enable JSON imports in tsconfig.json**

Add `"resolveJsonModule": true` to compilerOptions (should already be there from Next.js scaffold, verify).

**Step 4: Commit**

```bash
git add wallets.json lib/wallets.ts
git commit -m "feat: add wallet config with localStorage persistence and defaults"
```

---

## Phase 2: API Proxy Routes

All Data API and Polygon RPC calls go through Next.js API routes to bypass CORS restrictions.

### Task 4: Balance API Route

**Files:**
- Create: `app/api/balance/route.ts`

**Step 1: Create the route**

Uses viem to call Polygon RPC for USDC.e balance.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { polygon } from "viem/chains";
import { USDC_E_ADDRESS, POLYGON_RPC_URL, POLYGON_RPC_FALLBACK } from "@/lib/constants";

const client = createPublicClient({
  chain: polygon,
  transport: http(POLYGON_RPC_URL, {
    retryCount: 1,
    timeout: 10_000,
    fetchOptions: {},
    onFetchResponse: undefined,
  }),
});

const fallbackClient = createPublicClient({
  chain: polygon,
  transport: http(POLYGON_RPC_FALLBACK),
});

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  try {
    let balance: bigint;
    try {
      balance = await client.readContract({
        address: USDC_E_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
    } catch {
      // Fallback RPC
      balance = await fallbackClient.readContract({
        address: USDC_E_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
    }

    const formatted = parseFloat(formatUnits(balance, 6));
    return NextResponse.json({ balance: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 2: Test manually**

Run: `npm run dev`
Visit: `http://localhost:3000/api/balance?address=0xd0d6053c3c37e727402d84c14069780d360993aa`
Expected: JSON with `{ "balance": <number> }`

**Step 3: Commit**

```bash
git add app/api/balance/route.ts
git commit -m "feat: add balance API route using viem + Polygon RPC"
```

---

### Task 5: Trades API Route

**Files:**
- Create: `app/api/trades/route.ts`

**Step 1: Create the route**

Proxies to `https://data-api.polymarket.com/trades`.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { DATA_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const limit = request.nextUrl.searchParams.get("limit") || "50";

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  try {
    const url = `${DATA_API_BASE}/trades?user=${address}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Data API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add app/api/trades/route.ts
git commit -m "feat: add trades API route proxying Polymarket Data API"
```

---

### Task 6: Positions API Route

**Files:**
- Create: `app/api/positions/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { DATA_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  try {
    const url = `${DATA_API_BASE}/positions?user=${address}&sizeThreshold=0&limit=500`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Data API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add app/api/positions/route.ts
git commit -m "feat: add positions API route proxying Polymarket Data API"
```

---

### Task 7: Midpoint API Route

**Files:**
- Create: `app/api/midpoint/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { CLOB_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const tokenId = request.nextUrl.searchParams.get("token_id");

  if (!tokenId) {
    return NextResponse.json({ error: "token_id required" }, { status: 400 });
  }

  try {
    const url = `${CLOB_API_BASE}/midpoint?token_id=${tokenId}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `CLOB API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add app/api/midpoint/route.ts
git commit -m "feat: add midpoint API route proxying Polymarket CLOB API"
```

---

### Task 8: Market API Route

**Files:**
- Create: `app/api/market/route.ts`

**Step 1: Create the route**

Proxies to both CLOB and Gamma APIs depending on query params.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { CLOB_API_BASE, GAMMA_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const conditionId = request.nextUrl.searchParams.get("conditionId");
  const source = request.nextUrl.searchParams.get("source") || "clob";

  if (!conditionId) {
    return NextResponse.json({ error: "conditionId required" }, { status: 400 });
  }

  try {
    let url: string;
    if (source === "gamma") {
      url = `${GAMMA_API_BASE}/markets?conditionId=${conditionId}&limit=1`;
    } else {
      url = `${CLOB_API_BASE}/markets/${conditionId}`;
    }

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add app/api/market/route.ts
git commit -m "feat: add market API route proxying CLOB and Gamma APIs"
```

---

## Phase 3: Real-Time Data Layer

### Task 9: Polymarket API Helper

**Files:**
- Create: `lib/polymarket-api.ts`

**Step 1: Create server-side API helper**

Provides typed fetch functions used by components via React Query.

```typescript
import { RawTrade, RawPosition, Trade, Position } from "./types";

export function parseTrade(raw: RawTrade, source: "WS" | "POLL"): Trade {
  return {
    conditionId: raw.conditionId,
    title: raw.title || `Market ${raw.conditionId.slice(0, 10)}...`,
    outcome: raw.outcome,
    side: raw.side as "BUY" | "SELL",
    size: parseFloat(raw.size),
    price: parseFloat(raw.price),
    timestamp: raw.timestamp,
    transactionHash: raw.transactionHash,
    walletAddress: raw.proxyWallet.toLowerCase(),
    source,
  };
}

export function parsePosition(raw: RawPosition): Position {
  const size = parseFloat(raw.size);
  const avgPrice = parseFloat(raw.avgPrice);
  const curPrice = parseFloat(raw.curPrice);
  return {
    conditionId: raw.conditionId,
    title: raw.title || `Market ${raw.conditionId.slice(0, 10)}...`,
    outcome: raw.outcome,
    size,
    avgPrice,
    curPrice,
    unrealizedPnl: (curPrice - avgPrice) * size,
    marketValue: curPrice * size,
    asset: raw.asset,
  };
}

export async function fetchTrades(address: string): Promise<RawTrade[]> {
  const res = await fetch(`/api/trades?address=${address}&limit=50`);
  if (!res.ok) throw new Error(`Trades fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchPositions(address: string): Promise<RawPosition[]> {
  const res = await fetch(`/api/positions?address=${address}`);
  if (!res.ok) throw new Error(`Positions fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchBalance(address: string): Promise<number> {
  const res = await fetch(`/api/balance?address=${address}`);
  if (!res.ok) throw new Error(`Balance fetch failed: ${res.status}`);
  const data = await res.json();
  return data.balance;
}

export async function fetchMidpoint(tokenId: string): Promise<string> {
  const res = await fetch(`/api/midpoint?token_id=${tokenId}`);
  if (!res.ok) throw new Error(`Midpoint fetch failed: ${res.status}`);
  const data = await res.json();
  return data.mid;
}
```

**Step 2: Commit**

```bash
git add lib/polymarket-api.ts
git commit -m "feat: add Polymarket API helper with typed parsers"
```

---

### Task 10: WebSocket Client Wrapper

**Files:**
- Create: `lib/ws-client.ts`

**Step 1: Create WebSocket wrapper using official RTDS client**

This wraps `@polymarket/real-time-data-client` and filters trades by tracked wallet addresses.

```typescript
import {
  RealTimeDataClient,
  Message,
  ConnectionStatus,
} from "@polymarket/real-time-data-client";
import { RawTrade } from "./types";

export type TradeCallback = (trade: RawTrade) => void;
export type StatusCallback = (connected: boolean) => void;

let client: RealTimeDataClient | null = null;
let tradeCallback: TradeCallback | null = null;
let statusCallback: StatusCallback | null = null;
let trackedAddresses: Set<string> = new Set();

export function setTrackedAddresses(addresses: string[]) {
  trackedAddresses = new Set(addresses.map((a) => a.toLowerCase()));
}

export function connectWebSocket(
  onTrade: TradeCallback,
  onStatus: StatusCallback
) {
  if (client) {
    client.disconnect();
  }

  tradeCallback = onTrade;
  statusCallback = onStatus;

  client = new RealTimeDataClient({
    onConnect: (c) => {
      c.subscribe({
        subscriptions: [{ topic: "activity", type: "trades" }],
      });
      statusCallback?.(true);
    },
    onMessage: (_c, message: Message) => {
      if (message.topic === "activity" && message.type === "trades") {
        const payload = message.payload as any;
        const proxyWallet = (payload.proxyWallet || "").toLowerCase();
        if (trackedAddresses.has(proxyWallet)) {
          tradeCallback?.({
            conditionId: payload.conditionId,
            title: payload.title || payload.name || "",
            outcome: payload.outcome,
            side: payload.side,
            size: String(payload.size),
            price: String(payload.price),
            timestamp: payload.timestamp,
            transactionHash: payload.transactionHash,
            proxyWallet,
            asset: payload.asset || "",
          });
        }
      }
    },
    onStatusChange: (status: ConnectionStatus) => {
      statusCallback?.(status === ConnectionStatus.CONNECTED);
    },
    autoReconnect: true,
    pingInterval: 5000,
  });

  client.connect();
}

export function disconnectWebSocket() {
  if (client) {
    client.disconnect();
    client = null;
  }
}
```

**Step 2: Commit**

```bash
git add lib/ws-client.ts
git commit -m "feat: add WebSocket client wrapper using official RTDS library"
```

---

### Task 11: Zustand Stores

**Files:**
- Create: `lib/stores/trade-store.ts`
- Create: `lib/stores/wallet-store.ts`
- Create: `lib/stores/system-store.ts`

**Step 1: Create trade store**

Manages live trades per wallet with dedup.

```typescript
import { create } from "zustand";
import { Trade } from "../types";
import { DEDUP_SET_MAX_SIZE } from "../constants";

interface TradeState {
  tradesByWallet: Record<string, Trade[]>;
  seenTxHashes: Set<string>;
  addTrade: (trade: Trade) => boolean; // returns true if new
  getTradesForWallet: (address: string) => Trade[];
}

export const useTradeStore = create<TradeState>((set, get) => ({
  tradesByWallet: {},
  seenTxHashes: new Set(),

  addTrade: (trade: Trade) => {
    const { seenTxHashes, tradesByWallet } = get();

    if (seenTxHashes.has(trade.transactionHash)) return false;

    // Evict oldest if set is full
    if (seenTxHashes.size >= DEDUP_SET_MAX_SIZE) {
      const iter = seenTxHashes.values();
      const oldest = iter.next().value;
      if (oldest) seenTxHashes.delete(oldest);
    }
    seenTxHashes.add(trade.transactionHash);

    const wallet = trade.walletAddress.toLowerCase();
    const existing = tradesByWallet[wallet] || [];
    const updated = [trade, ...existing].slice(0, 100); // keep last 100

    set({
      tradesByWallet: { ...tradesByWallet, [wallet]: updated },
      seenTxHashes: new Set(seenTxHashes),
    });

    return true;
  },

  getTradesForWallet: (address: string) => {
    return get().tradesByWallet[address.toLowerCase()] || [];
  },
}));
```

**Step 2: Create wallet store**

```typescript
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
  updateCopyTradeConfig: (address: string, config: Partial<CopyTradeConfig>) => void;
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

  updateCopyTradeConfig: (address: string, config: Partial<CopyTradeConfig>) => {
    const wallets = get().wallets.map((w) =>
      w.address === address.toLowerCase()
        ? { ...w, copyTradeConfig: { ...w.copyTradeConfig, ...config } }
        : w
    );
    saveWallets(wallets);
    set({ wallets });
  },
}));
```

**Step 3: Create system store**

```typescript
import { create } from "zustand";
import { ActivityLogEntry, OrderStatus, SystemStatus } from "../types";

interface SystemState {
  status: SystemStatus;
  activityLog: ActivityLogEntry[];
  orderStatuses: OrderStatus[];
  setWsConnected: (connected: boolean) => void;
  setWsLastMessage: (timestamp: number) => void;
  setPollLastSuccess: (timestamp: number) => void;
  setCopyTradeEngine: (status: SystemStatus["copyTradeEngine"], message: string) => void;
  setUserBalance: (balance: number) => void;
  addLogEntry: (entry: Omit<ActivityLogEntry, "id">) => void;
  addOrderStatus: (status: OrderStatus) => void;
  incrementOrders: (type: "filled" | "failed" | "skipped") => void;
}

let logCounter = 0;

export const useSystemStore = create<SystemState>((set, get) => ({
  status: {
    wsConnected: false,
    wsLastMessage: 0,
    pollLastSuccess: 0,
    copyTradeEngine: "OFF",
    copyTradeMessage: "No wallets have copy-trade enabled",
    userBalance: 0,
    ordersTotal: 0,
    ordersFilled: 0,
    ordersFailed: 0,
    ordersSkipped: 0,
  },
  activityLog: [],
  orderStatuses: [],

  setWsConnected: (connected) =>
    set((s) => ({ status: { ...s.status, wsConnected: connected } })),

  setWsLastMessage: (timestamp) =>
    set((s) => ({ status: { ...s.status, wsLastMessage: timestamp } })),

  setPollLastSuccess: (timestamp) =>
    set((s) => ({ status: { ...s.status, pollLastSuccess: timestamp } })),

  setCopyTradeEngine: (engine, message) =>
    set((s) => ({
      status: { ...s.status, copyTradeEngine: engine, copyTradeMessage: message },
    })),

  setUserBalance: (balance) =>
    set((s) => ({ status: { ...s.status, userBalance: balance } })),

  addLogEntry: (entry) => {
    const id = `log-${++logCounter}-${Date.now()}`;
    set((s) => ({
      activityLog: [{ ...entry, id }, ...s.activityLog].slice(0, 200),
    }));
  },

  addOrderStatus: (status) =>
    set((s) => ({
      orderStatuses: [status, ...s.orderStatuses].slice(0, 100),
      status: { ...s.status, ordersTotal: s.status.ordersTotal + 1 },
    })),

  incrementOrders: (type) =>
    set((s) => ({
      status: {
        ...s.status,
        ...(type === "filled" && { ordersFilled: s.status.ordersFilled + 1 }),
        ...(type === "failed" && { ordersFailed: s.status.ordersFailed + 1 }),
        ...(type === "skipped" && { ordersSkipped: s.status.ordersSkipped + 1 }),
      },
    })),
}));
```

**Step 4: Commit**

```bash
git add lib/stores/
git commit -m "feat: add Zustand stores for trades, wallets, and system state"
```

---

## Phase 4: UI Components

### Task 12: React Query Provider

**Files:**
- Create: `components/providers.tsx`
- Modify: `app/layout.tsx`

**Step 1: Create providers wrapper**

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**Step 2: Wrap layout.tsx body with Providers**

In `app/layout.tsx`, import `Providers` and wrap `{children}` with it.

**Step 3: Commit**

```bash
git add components/providers.tsx app/layout.tsx
git commit -m "feat: add React Query provider"
```

---

### Task 13: StatusBar Component

**Files:**
- Create: `components/status-bar.tsx`

**Step 1: Create StatusBar**

Sticky top bar showing: WS status, poll heartbeat, engine status, balance, order counts.

```typescript
"use client";

import { useSystemStore } from "@/lib/stores/system-store";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

function RelativeTime({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timestamp) return <span className="text-neutral-500">never</span>;
  const seconds = Math.floor((now - timestamp * 1000) / 1000);
  if (seconds < 0) return <span>just now</span>;
  if (seconds < 60) return <span>{seconds}s ago</span>;
  return <span>{Math.floor(seconds / 60)}m ago</span>;
}

export function StatusBar() {
  const status = useSystemStore((s) => s.status);

  const isPollingStale = status.pollLastSuccess > 0 &&
    Date.now() / 1000 - status.pollLastSuccess > 30;

  const isBalanceLow = status.userBalance > 0 && status.userBalance < 2;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-[#222] bg-[#0a0a0a]/95 px-4 py-2 backdrop-blur text-xs font-mono">
      <div className="flex items-center gap-4">
        {/* WS Status */}
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${
            status.wsConnected ? "bg-emerald-500" : "bg-red-500 animate-pulse"
          }`} />
          <span className="text-neutral-400">WS</span>
          <span className={status.wsConnected ? "text-emerald-400" : "text-red-400"}>
            {status.wsConnected ? "connected" : "disconnected"}
          </span>
          {status.wsLastMessage > 0 && (
            <span className="text-neutral-500">
              <RelativeTime timestamp={status.wsLastMessage} />
            </span>
          )}
        </div>

        {/* Poll Status */}
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${
            isPollingStale ? "bg-red-500 animate-pulse" : "bg-emerald-500"
          }`} />
          <span className="text-neutral-400">Poll:</span>
          <span className={isPollingStale ? "text-red-400" : "text-neutral-300"}>
            <RelativeTime timestamp={status.pollLastSuccess} />
          </span>
        </div>

        {/* Engine Status */}
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-400">Engine:</span>
          <Badge
            variant="outline"
            className={
              status.copyTradeEngine === "ACTIVE"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : status.copyTradeEngine === "PAUSED"
                ? "border-orange-500/30 bg-orange-500/10 text-orange-400 animate-pulse"
                : "border-neutral-700 bg-neutral-800 text-neutral-500"
            }
          >
            {status.copyTradeEngine}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Balance */}
        <div className={`flex items-center gap-1 ${isBalanceLow ? "text-yellow-400 animate-pulse" : "text-neutral-300"}`}>
          <span>${status.userBalance.toFixed(2)}</span>
          <span className="text-neutral-500">USDC.e</span>
        </div>

        {/* Order Counts */}
        <div className="flex items-center gap-2 text-neutral-500">
          <span className="text-emerald-400">{status.ordersFilled} filled</span>
          <span>/</span>
          <span className="text-red-400">{status.ordersFailed} failed</span>
          <span>/</span>
          <span className="text-amber-400">{status.ordersSkipped} skipped</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/status-bar.tsx
git commit -m "feat: add StatusBar component with WS, poll, engine, and balance indicators"
```

---

### Task 14: ActivityLog Component

**Files:**
- Create: `components/activity-log.tsx`

**Step 1: Create ActivityLog**

Scrollable log at bottom showing every system event.

```typescript
"use client";

import { useSystemStore } from "@/lib/stores/system-store";
import { ScrollArea } from "@/components/ui/scroll-area";

const levelColors = {
  info: "text-neutral-400",
  warn: "text-amber-400",
  error: "text-red-400",
  success: "text-emerald-400",
};

const sourceColors: Record<string, string> = {
  WS: "text-blue-400",
  POLL: "text-purple-400",
  COPY: "text-amber-400",
  SYSTEM: "text-neutral-500",
  RPC: "text-cyan-400",
};

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

export function ActivityLog() {
  const log = useSystemStore((s) => s.activityLog);

  return (
    <div className="border-t border-[#222] bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#222]">
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
          Activity Log
        </span>
        <span className="text-xs text-neutral-600">{log.length} entries</span>
      </div>
      <ScrollArea className="h-48">
        <div className="px-4 py-1 space-y-0.5">
          {log.length === 0 && (
            <div className="text-xs text-neutral-600 py-4 text-center">
              No activity yet. Waiting for connections...
            </div>
          )}
          {log.map((entry) => (
            <div key={entry.id} className="flex gap-2 text-xs font-mono leading-5">
              <span className="text-neutral-600 shrink-0">
                {formatTime(entry.timestamp)}
              </span>
              <span className={`shrink-0 ${sourceColors[entry.source] || "text-neutral-500"}`}>
                [{entry.source}]
              </span>
              <span className={levelColors[entry.level]}>
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/activity-log.tsx
git commit -m "feat: add ActivityLog component with color-coded entries"
```

---

### Task 15: WalletHeader Component

**Files:**
- Create: `components/wallet-header.tsx`

**Step 1: Create WalletHeader**

Shows label, abbreviated address, balance, and remove button.

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBalance } from "@/lib/polymarket-api";
import { TrackedWallet } from "@/lib/types";
import { POLL_INTERVAL_BALANCE } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/lib/stores/wallet-store";

function abbreviateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletHeader({ wallet }: { wallet: TrackedWallet }) {
  const remove = useWalletStore((s) => s.remove);

  const { data: balance } = useQuery({
    queryKey: ["balance", wallet.address],
    queryFn: () => fetchBalance(wallet.address),
    refetchInterval: POLL_INTERVAL_BALANCE,
  });

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm text-neutral-100">
          {wallet.label}
        </span>
        <span className="text-xs text-neutral-500 font-mono">
          {abbreviateAddress(wallet.address)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono text-neutral-300">
          {balance !== undefined ? `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "..."}
          <span className="text-neutral-500 text-xs ml-1">USDC.e</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-neutral-600 hover:text-red-400"
          onClick={() => remove(wallet.address)}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/wallet-header.tsx
git commit -m "feat: add WalletHeader with balance polling and remove button"
```

---

### Task 16: PositionsTable Component

**Files:**
- Create: `components/positions-table.tsx`

**Step 1: Create PositionsTable**

Shows open positions with P&L coloring.

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPositions } from "@/lib/polymarket-api";
import { parsePosition } from "@/lib/polymarket-api";
import { Position } from "@/lib/types";
import { POLL_INTERVAL_POSITIONS } from "@/lib/constants";

export function PositionsTable({ address }: { address: string }) {
  const { data: rawPositions, isLoading } = useQuery({
    queryKey: ["positions", address],
    queryFn: () => fetchPositions(address),
    refetchInterval: POLL_INTERVAL_POSITIONS,
  });

  const positions: Position[] = (rawPositions || [])
    .map(parsePosition)
    .filter((p) => p.size > 0.01)
    .sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue));

  if (isLoading) {
    return <div className="text-xs text-neutral-600 py-2">Loading positions...</div>;
  }

  if (positions.length === 0) {
    return <div className="text-xs text-neutral-600 py-2">No open positions</div>;
  }

  return (
    <div>
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
        Positions ({positions.length})
      </div>
      <div className="space-y-1">
        {positions.slice(0, 10).map((pos) => (
          <div
            key={`${pos.conditionId}-${pos.outcome}`}
            className="flex items-center justify-between text-xs font-mono bg-[#0a0a0a] rounded px-2 py-1"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-neutral-300 truncate max-w-[200px]">
                {pos.title}
              </span>
              <span className="text-neutral-500 shrink-0">{pos.outcome}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-neutral-400">
                {pos.size.toFixed(1)} @ {pos.avgPrice.toFixed(2)}
              </span>
              <span
                className={
                  pos.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"
                }
              >
                {pos.unrealizedPnl >= 0 ? "+" : ""}
                ${pos.unrealizedPnl.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
        {positions.length > 10 && (
          <div className="text-xs text-neutral-600 text-center">
            +{positions.length - 10} more
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/positions-table.tsx
git commit -m "feat: add PositionsTable with P&L coloring and polling"
```

---

### Task 17: TradesFeed Component

**Files:**
- Create: `components/trades-feed.tsx`

**Step 1: Create TradesFeed**

Live scrolling trade list with source badges (WS/POLL).

```typescript
"use client";

import { useTradeStore } from "@/lib/stores/trade-store";
import { Trade } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";

function RelativeAge({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const seconds = Math.floor((now - timestamp * 1000) / 1000);
  if (seconds < 0) return <span>just now</span>;
  if (seconds < 60) return <span>{seconds}s ago</span>;
  if (seconds < 3600) return <span>{Math.floor(seconds / 60)}m ago</span>;
  return <span>{Math.floor(seconds / 3600)}h ago</span>;
}

export function TradesFeed({ address }: { address: string }) {
  const trades = useTradeStore((s) => s.getTradesForWallet(address));

  if (trades.length === 0) {
    return (
      <div>
        <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
          Live Trades
        </div>
        <div className="text-xs text-neutral-600 py-2">
          Waiting for trades...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
        Live Trades ({trades.length})
      </div>
      <div className="space-y-1">
        {trades.slice(0, 15).map((trade) => (
          <div
            key={trade.transactionHash}
            className="flex items-center justify-between text-xs font-mono bg-[#0a0a0a] rounded px-2 py-1"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Badge
                variant="outline"
                className={`text-[10px] px-1 py-0 ${
                  trade.source === "WS"
                    ? "border-blue-500/30 text-blue-400"
                    : "border-purple-500/30 text-purple-400"
                }`}
              >
                {trade.source}
              </Badge>
              <span
                className={
                  trade.side === "BUY" ? "text-emerald-400" : "text-red-400"
                }
              >
                {trade.side}
              </span>
              <span className="text-neutral-400">{trade.outcome}</span>
              <span className="text-neutral-300">
                {trade.size.toFixed(1)} @ ${trade.price.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-neutral-500 truncate max-w-[150px]">
                {trade.title}
              </span>
              <span className="text-neutral-600">
                <RelativeAge timestamp={trade.timestamp} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/trades-feed.tsx
git commit -m "feat: add TradesFeed with source badges and relative timestamps"
```

---

### Task 18: CopyTradeToggle Component

**Files:**
- Create: `components/copy-trade-toggle.tsx`

**Step 1: Create CopyTradeToggle**

Per-wallet toggle for copy-trade with configuration.

```typescript
"use client";

import { TrackedWallet } from "@/lib/types";
import { useWalletStore } from "@/lib/stores/wallet-store";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export function CopyTradeToggle({ wallet }: { wallet: TrackedWallet }) {
  const toggleCopyTrade = useWalletStore((s) => s.toggleCopyTrade);

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={wallet.copyTradeEnabled}
        onCheckedChange={() => toggleCopyTrade(wallet.address)}
        className="data-[state=checked]:bg-emerald-500"
      />
      <Badge
        variant="outline"
        className={
          wallet.copyTradeEnabled
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]"
            : "border-neutral-700 bg-neutral-800 text-neutral-500 text-[10px]"
        }
      >
        Copy {wallet.copyTradeEnabled ? "ON" : "OFF"}
      </Badge>
      {wallet.copyTradeEnabled && (
        <span className="text-[10px] text-neutral-600 font-mono">
          {wallet.copyTradeConfig.multiplier}x / max ${wallet.copyTradeConfig.maxSingleTrade}
        </span>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/copy-trade-toggle.tsx
git commit -m "feat: add CopyTradeToggle with config display"
```

---

### Task 19: OrderLifecycle Component

**Files:**
- Create: `components/order-lifecycle.tsx`

**Step 1: Create OrderLifecycle**

Shows copy-trade order status history for a wallet.

```typescript
"use client";

import { useSystemStore } from "@/lib/stores/system-store";
import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { color: string; icon: string }> = {
  DETECTED: { color: "text-blue-400", icon: "🔵" },
  VALIDATING: { color: "text-blue-400", icon: "⏳" },
  PLACING: { color: "text-amber-400", icon: "📤" },
  FILLED: { color: "text-emerald-400", icon: "✅" },
  FAILED: { color: "text-red-400", icon: "❌" },
  SKIPPED: { color: "text-amber-400", icon: "⏭" },
  PAUSED: { color: "text-orange-400", icon: "⏸" },
  RESUMED: { color: "text-emerald-400", icon: "▶" },
};

export function OrderLifecycle({ walletLabel }: { walletLabel: string }) {
  const orders = useSystemStore((s) =>
    s.orderStatuses.filter((o) => o.walletLabel === walletLabel)
  );

  if (orders.length === 0) return null;

  return (
    <div>
      <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
        Copy-Trade Orders
      </div>
      <div className="space-y-1">
        {orders.slice(0, 5).map((order, i) => {
          const cfg = statusConfig[order.status] || { color: "text-neutral-400", icon: "•" };
          return (
            <div
              key={`${order.timestamp}-${i}`}
              className={`flex items-center gap-2 text-xs font-mono rounded px-2 py-1 ${
                order.status === "FAILED" ? "bg-red-500/5" : "bg-[#0a0a0a]"
              }`}
            >
              <span>{cfg.icon}</span>
              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${cfg.color}`}>
                {order.status}
              </Badge>
              <span className="text-neutral-400 truncate">{order.message}</span>
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
```

**Step 2: Commit**

```bash
git add components/order-lifecycle.tsx
git commit -m "feat: add OrderLifecycle component with status badges"
```

---

### Task 20: WalletCard Component

**Files:**
- Create: `components/wallet-card.tsx`

**Step 1: Create WalletCard**

Composes WalletHeader, PositionsTable, TradesFeed, CopyTradeToggle, OrderLifecycle.

```typescript
"use client";

import { TrackedWallet } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { WalletHeader } from "./wallet-header";
import { PositionsTable } from "./positions-table";
import { TradesFeed } from "./trades-feed";
import { CopyTradeToggle } from "./copy-trade-toggle";
import { OrderLifecycle } from "./order-lifecycle";
import { Separator } from "@/components/ui/separator";

export function WalletCard({ wallet }: { wallet: TrackedWallet }) {
  return (
    <Card className="bg-[#111111] border-[#222] overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-4">
        <WalletHeader wallet={wallet} />
        <CopyTradeToggle wallet={wallet} />
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        <Separator className="bg-[#222]" />
        <PositionsTable address={wallet.address} />
        <Separator className="bg-[#222]" />
        <TradesFeed address={wallet.address} />
        <OrderLifecycle walletLabel={wallet.label} />
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add components/wallet-card.tsx
git commit -m "feat: add WalletCard composing all sub-components"
```

---

### Task 21: AddWalletForm Component

**Files:**
- Create: `components/add-wallet-form.tsx`

**Step 1: Create AddWalletForm**

```typescript
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWalletStore } from "@/lib/stores/wallet-store";

export function AddWalletForm() {
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const addWallet = useWalletStore((s) => s.add);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAddr = address.trim();
    const trimmedLabel = label.trim();
    if (!trimmedAddr || !trimmedLabel) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddr)) return;
    addWallet(trimmedAddr, trimmedLabel);
    setAddress("");
    setLabel("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2 border-b border-[#222]">
      <Input
        placeholder="0x... proxy wallet address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="bg-[#111] border-[#333] text-sm font-mono h-8 flex-1"
      />
      <Input
        placeholder="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="bg-[#111] border-[#333] text-sm h-8 w-32"
      />
      <Button type="submit" size="sm" variant="outline" className="h-8 border-[#333] text-xs">
        + Add
      </Button>
    </form>
  );
}
```

**Step 2: Commit**

```bash
git add components/add-wallet-form.tsx
git commit -m "feat: add AddWalletForm with address validation"
```

---

### Task 22: Dashboard Component + Main Page

**Files:**
- Create: `components/dashboard.tsx`
- Modify: `app/page.tsx`

**Step 1: Create Dashboard**

The main component that:
- Initializes wallet store
- Connects WebSocket
- Sets up trade polling
- Composes StatusBar, AddWalletForm, WalletCard grid, ActivityLog

```typescript
"use client";

import { useEffect, useCallback, useRef } from "react";
import { useWalletStore } from "@/lib/stores/wallet-store";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useSystemStore } from "@/lib/stores/system-store";
import { connectWebSocket, disconnectWebSocket, setTrackedAddresses } from "@/lib/ws-client";
import { fetchTrades } from "@/lib/polymarket-api";
import { parseTrade } from "@/lib/polymarket-api";
import { POLL_INTERVAL_TRADES } from "@/lib/constants";
import { StatusBar } from "./status-bar";
import { AddWalletForm } from "./add-wallet-form";
import { WalletCard } from "./wallet-card";
import { ActivityLog } from "./activity-log";

export function Dashboard() {
  const wallets = useWalletStore((s) => s.wallets);
  const init = useWalletStore((s) => s.init);
  const addTrade = useTradeStore((s) => s.addTrade);
  const addLogEntry = useSystemStore((s) => s.addLogEntry);
  const setWsConnected = useSystemStore((s) => s.setWsConnected);
  const setWsLastMessage = useSystemStore((s) => s.setWsLastMessage);
  const setPollLastSuccess = useSystemStore((s) => s.setPollLastSuccess);

  // Track cursor per wallet for polling (skip first poll)
  const cursors = useRef<Record<string, number>>({});
  const initialized = useRef(false);

  // Initialize wallets from localStorage
  useEffect(() => {
    init();
  }, [init]);

  // Update tracked addresses when wallets change
  useEffect(() => {
    setTrackedAddresses(wallets.map((w) => w.address));
  }, [wallets]);

  // WebSocket connection
  useEffect(() => {
    connectWebSocket(
      (rawTrade) => {
        const trade = parseTrade(rawTrade, "WS");
        const isNew = addTrade(trade);
        if (isNew) {
          setWsLastMessage(trade.timestamp);
          addLogEntry({
            timestamp: Math.floor(Date.now() / 1000),
            level: "info",
            message: `${trade.side} ${trade.outcome} ${trade.size.toFixed(1)} @ $${trade.price.toFixed(2)} — ${trade.title}`,
            source: "WS",
          });
        }
      },
      (connected) => {
        setWsConnected(connected);
        addLogEntry({
          timestamp: Math.floor(Date.now() / 1000),
          level: connected ? "success" : "warn",
          message: connected
            ? "WebSocket connected to Polymarket"
            : "WebSocket disconnected, reconnecting...",
          source: "SYSTEM",
        });
      }
    );

    return () => disconnectWebSocket();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling fallback
  useEffect(() => {
    if (wallets.length === 0) return;

    const poll = async () => {
      for (const wallet of wallets) {
        try {
          const rawTrades = await fetchTrades(wallet.address);

          // First poll — establish cursor, don't replay history
          if (!(wallet.address in cursors.current)) {
            const maxTs = rawTrades.reduce(
              (max, t) => Math.max(max, t.timestamp),
              0
            );
            cursors.current[wallet.address] = maxTs;
            continue;
          }

          const cursor = cursors.current[wallet.address];
          let newMaxTs = cursor;

          for (const raw of rawTrades) {
            if (raw.timestamp > cursor) {
              const trade = parseTrade(raw, "POLL");
              const isNew = addTrade(trade);
              if (isNew) {
                addLogEntry({
                  timestamp: Math.floor(Date.now() / 1000),
                  level: "info",
                  message: `${trade.side} ${trade.outcome} ${trade.size.toFixed(1)} @ $${trade.price.toFixed(2)} — ${trade.title}`,
                  source: "POLL",
                });
              }
              newMaxTs = Math.max(newMaxTs, raw.timestamp);
            }
          }

          cursors.current[wallet.address] = newMaxTs;
        } catch (err: any) {
          addLogEntry({
            timestamp: Math.floor(Date.now() / 1000),
            level: "error",
            message: `Poll failed for ${wallet.label}: ${err.message}`,
            source: "POLL",
          });
        }
      }
      setPollLastSuccess(Math.floor(Date.now() / 1000));
    };

    // First poll immediately
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_TRADES);
    return () => clearInterval(interval);
  }, [wallets]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <StatusBar />
      <AddWalletForm />

      <main className="flex-1 p-4">
        {wallets.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-neutral-600 text-sm">
            No wallets tracked. Add a wallet address above.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {wallets.map((wallet) => (
              <WalletCard key={wallet.address} wallet={wallet} />
            ))}
          </div>
        )}
      </main>

      <ActivityLog />
    </div>
  );
}
```

**Step 2: Update app/page.tsx**

```typescript
import { Dashboard } from "@/components/dashboard";

export default function Home() {
  return <Dashboard />;
}
```

**Step 3: Verify the app runs**

Run: `npm run dev`
Visit: `http://localhost:3000`
Expected: Dark dashboard with StatusBar, AddWalletForm, 3 default wallet cards, and ActivityLog. WebSocket should connect (green dot). First poll should establish cursors.

**Step 4: Commit**

```bash
git add components/dashboard.tsx app/page.tsx
git commit -m "feat: add Dashboard component wiring WS, polling, and all UI together"
```

---

## Phase 5: Copy-Trade Server

### Task 23: Copy-Trade Server (Standalone Node.js)

**Files:**
- Create: `server/copy-trade-server.ts`
- Create: `server/package.json`
- Create: `server/tsconfig.json`

**Step 1: Create server/package.json**

```json
{
  "name": "polymarket-copy-trade-server",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx copy-trade-server.ts",
    "dev": "tsx watch copy-trade-server.ts"
  },
  "dependencies": {
    "@polymarket/clob-client": "^5.2.3",
    "ethers": "^5.7.2",
    "ws": "^8.18.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["*.ts"]
}
```

**Step 3: Create server/.env.example**

```
PRIVATE_KEY=0x...your_private_key_here
PROXY_ADDRESS=0x...your_polymarket_proxy_wallet
SIGNATURE_TYPE=0
```

**Step 4: Create server/copy-trade-server.ts**

The full copy-trade server:
- WebSocket server on port 8765
- Receives trade signals from the dashboard
- Validates: trade age, midpoint, drift, market status
- Places orders via @polymarket/clob-client
- Pushes status updates back to dashboard
- Circuit breaker on balance errors

```typescript
import { WebSocketServer, WebSocket } from "ws";
import { ClobClient, Chain, Side, OrderType } from "@polymarket/clob-client";
import { SignatureType } from "@polymarket/order-utils";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// --- Config ---
const PORT = 8765;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const PROXY_ADDRESS = process.env.PROXY_ADDRESS || undefined;
const SIG_TYPE = parseInt(process.env.SIGNATURE_TYPE || "0") as 0 | 1 | 2;

const BALANCE_CHECK_URL = "https://polygon-rpc.com";
const USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

// --- State ---
let clobClient: ClobClient | null = null;
let paused = false;
let balance = 0;
const clients = new Set<WebSocket>();

// --- Helpers ---
function broadcast(msg: object) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function log(message: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${message}`);
}

async function fetchBalance(address: string): Promise<number> {
  const clean = address.slice(2).toLowerCase().padStart(64, "0");
  const calldata = "0x70a08231" + clean;

  const res = await fetch(BALANCE_CHECK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: USDC_E, data: calldata }, "latest"],
    }),
  });

  const json = await res.json();
  return parseInt(json.result, 16) / 1_000_000;
}

function roundPrice(price: number, tickSize: string = "0.01"): number {
  const tick = parseFloat(tickSize);
  return Math.floor(price / tick) * tick;
}

function roundSize(size: number): number {
  return Math.floor(size * 100) / 100;
}

// --- Init CLOB Client ---
async function initClient() {
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  const tempClient = new ClobClient(
    "https://clob.polymarket.com",
    Chain.POLYGON,
    wallet,
    undefined,
    SIG_TYPE as any,
    PROXY_ADDRESS,
  );

  const creds = await tempClient.createOrDeriveApiKey();
  log(`API creds derived: ${creds.key.slice(0, 8)}...`);

  clobClient = new ClobClient(
    "https://clob.polymarket.com",
    Chain.POLYGON,
    wallet,
    creds,
    SIG_TYPE as any,
    PROXY_ADDRESS,
  );

  // Initial balance check
  const addr = PROXY_ADDRESS || (await wallet.getAddress());
  balance = await fetchBalance(addr);
  log(`Initial balance: $${balance.toFixed(2)} USDC.e`);
  broadcast({ type: "balance", usdce: balance, timestamp: Math.floor(Date.now() / 1000) });
  broadcast({ type: "engine", status: "ACTIVE", message: "Copy-trade engine running" });
}

// --- Handle Copy Trade ---
async function handleCopyTrade(data: any) {
  const { trade, config } = data;
  const now = Math.floor(Date.now() / 1000);

  broadcast({
    type: "status",
    orderId: null,
    status: "DETECTED",
    message: `Trade detected from ${trade.walletLabel}`,
    timestamp: now,
  });

  // Check if paused
  if (paused) {
    broadcast({
      type: "status",
      orderId: null,
      status: "SKIPPED",
      reason: "paused",
      message: "Engine paused (low balance)",
      timestamp: now,
    });
    return;
  }

  // Only copy BUY trades
  if (trade.side !== "BUY") {
    broadcast({
      type: "status",
      orderId: null,
      status: "SKIPPED",
      reason: "sell",
      message: "Skipping SELL trade (only copying BUY)",
      timestamp: now,
    });
    return;
  }

  // Check trade age
  const age = now - trade.timestamp;
  if (age > 60) {
    broadcast({
      type: "status",
      orderId: null,
      status: "SKIPPED",
      reason: "stale",
      message: `Trade ${age}s old, max 60s`,
      timestamp: now,
    });
    return;
  }

  broadcast({
    type: "status",
    orderId: null,
    status: "VALIDATING",
    message: "Checking market status and live price...",
    timestamp: now,
  });

  if (!clobClient) {
    broadcast({
      type: "status",
      orderId: null,
      status: "FAILED",
      error: "CLOB client not initialized",
      timestamp: now,
    });
    return;
  }

  try {
    // Get market metadata
    const market = await clobClient.getMarket(trade.conditionId);
    if (!market || !market.accepting_orders) {
      broadcast({
        type: "status",
        orderId: null,
        status: "SKIPPED",
        reason: "resolved",
        message: "Market not accepting orders (resolved/closed)",
        timestamp: now,
      });
      return;
    }

    // Find token ID for the outcome
    const tokens = market.tokens || [];
    const token = tokens.find((t: any) => t.outcome === trade.outcome);
    if (!token) {
      broadcast({
        type: "status",
        orderId: null,
        status: "FAILED",
        error: `Token not found for outcome "${trade.outcome}"`,
        timestamp: now,
      });
      return;
    }

    // Get live midpoint
    const midpointData = await clobClient.getMidpoint(token.token_id);
    const midpoint = parseFloat(midpointData?.mid || "0");

    // Skip resolved markets
    if (midpoint <= 0.03 || midpoint >= 0.97) {
      broadcast({
        type: "status",
        orderId: null,
        status: "SKIPPED",
        reason: "resolved",
        message: `Midpoint ${midpoint.toFixed(3)} — market essentially resolved`,
        timestamp: now,
      });
      return;
    }

    // Price drift check (>20%)
    const drift = Math.abs(midpoint - trade.price) / trade.price;
    if (drift > 0.20) {
      broadcast({
        type: "status",
        orderId: null,
        status: "SKIPPED",
        reason: "drift",
        message: `Price drifted ${(drift * 100).toFixed(0)}% (whale: $${trade.price.toFixed(2)}, now: $${midpoint.toFixed(2)})`,
        timestamp: now,
      });
      return;
    }

    // Calculate order size
    const tickSize = String(market.minimum_tick_size || "0.01");
    const minOrderSize = parseFloat(market.minimum_order_size || "0");
    const negRisk = market.neg_risk || false;

    let price = trade.price * (1 + config.priceImprovementPct);
    price = roundPrice(price, tickSize);
    price = Math.min(price, 0.99); // Cap at 0.99

    let size = trade.size * config.multiplier;
    const maxByDollars = config.maxSingleTrade / price;
    size = Math.min(size, maxByDollars);
    size = roundSize(size);

    // Enforce minimum order
    if (size * price < 1) {
      size = Math.ceil(1 / price * 100) / 100;
    }
    size = Math.max(size, minOrderSize);
    size = roundSize(size);

    // Check balance
    if (size * price > balance) {
      broadcast({
        type: "status",
        orderId: null,
        status: "FAILED",
        error: "not enough balance / allowance",
        timestamp: now,
      });

      // Trigger circuit breaker
      paused = true;
      broadcast({ type: "engine", status: "PAUSED", message: "Insufficient balance, checking every 60s" });
      startBalanceChecker();
      return;
    }

    broadcast({
      type: "status",
      orderId: null,
      status: "PLACING",
      message: `BUY ${trade.outcome} ${size.toFixed(2)} @ $${price.toFixed(2)} — ${trade.title}`,
      timestamp: now,
    });

    // Place order
    const resp = await clobClient.createAndPostOrder(
      {
        tokenID: token.token_id,
        price,
        side: Side.BUY,
        size,
      },
      { tickSize: tickSize as any, negRisk },
      OrderType.GTC,
    );

    const orderId = resp?.orderID || resp?.id || null;

    broadcast({
      type: "status",
      orderId,
      status: "FILLED",
      message: `Order ${orderId || "unknown"} placed successfully`,
      timestamp: Math.floor(Date.now() / 1000),
    });

    log(`ORDER PLACED: BUY ${trade.outcome} ${size} @ $${price} — ${trade.title}`);
  } catch (err: any) {
    const errorMsg = err?.error_msg || err?.msg || err?.message || String(err);
    broadcast({
      type: "status",
      orderId: null,
      status: "FAILED",
      error: errorMsg,
      timestamp: Math.floor(Date.now() / 1000),
    });

    if (errorMsg.includes("not enough balance")) {
      paused = true;
      broadcast({ type: "engine", status: "PAUSED", message: "Insufficient balance, checking every 60s" });
      startBalanceChecker();
    }
  }
}

// --- Circuit Breaker: Balance Checker ---
let balanceCheckInterval: ReturnType<typeof setInterval> | null = null;

function startBalanceChecker() {
  if (balanceCheckInterval) return;

  balanceCheckInterval = setInterval(async () => {
    try {
      const wallet = new ethers.Wallet(PRIVATE_KEY);
      const addr = PROXY_ADDRESS || (await wallet.getAddress());
      balance = await fetchBalance(addr);
      broadcast({ type: "balance", usdce: balance, timestamp: Math.floor(Date.now() / 1000) });

      if (balance >= 2) {
        paused = false;
        if (balanceCheckInterval) {
          clearInterval(balanceCheckInterval);
          balanceCheckInterval = null;
        }
        broadcast({ type: "engine", status: "ACTIVE", message: `Balance $${balance.toFixed(2)} detected, trading again` });
        broadcast({
          type: "status",
          orderId: null,
          status: "RESUMED",
          message: `Balance $${balance.toFixed(2)} detected, trading again`,
          timestamp: Math.floor(Date.now() / 1000),
        });
        log(`Circuit breaker cleared. Balance: $${balance.toFixed(2)}`);
      }
    } catch (err) {
      log(`Balance check error: ${err}`);
    }
  }, 60_000);
}

// --- Periodic Balance Broadcast ---
setInterval(async () => {
  try {
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    const addr = PROXY_ADDRESS || (await wallet.getAddress());
    balance = await fetchBalance(addr);
    broadcast({ type: "balance", usdce: balance, timestamp: Math.floor(Date.now() / 1000) });
  } catch {}
}, 30_000);

// --- WebSocket Server ---
const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  clients.add(ws);
  log(`Client connected. Total: ${clients.size}`);

  // Send current state
  ws.send(JSON.stringify({ type: "balance", usdce: balance, timestamp: Math.floor(Date.now() / 1000) }));
  ws.send(JSON.stringify({
    type: "engine",
    status: paused ? "PAUSED" : "ACTIVE",
    message: paused ? "Insufficient balance" : "Copy-trade engine running",
  }));

  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === "copy_trade") {
        handleCopyTrade(data);
      }
    } catch (err) {
      log(`Invalid message: ${err}`);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    log(`Client disconnected. Total: ${clients.size}`);
  });
});

// --- Startup ---
log(`Copy-trade server starting on port ${PORT}...`);
initClient().catch((err) => {
  log(`Failed to initialize CLOB client: ${err.message}`);
  log("Server will run without trading capability. Fix credentials and restart.");
  broadcast({ type: "engine", status: "OFF", message: `Init failed: ${err.message}` });
});

log(`WebSocket server listening on ws://localhost:${PORT}`);
```

**Step 5: Install deps and verify**

Run:
```bash
cd C:/Users/rbgnr/git/polymarket-monitor/server
npm install
```

**Step 6: Commit**

```bash
cd C:/Users/rbgnr/git/polymarket-monitor
git add server/
git commit -m "feat: add copy-trade server with CLOB client, circuit breaker, and WS protocol"
```

---

## Phase 6: Integration & Polish

### Task 24: Connect Dashboard to Copy-Trade Server

**Files:**
- Create: `lib/copy-trade-client.ts`
- Modify: `components/dashboard.tsx` — add copy-trade WS connection
- Modify: `lib/stores/system-store.ts` — wire balance/engine updates from server

**Step 1: Create copy-trade client**

```typescript
import { COPY_TRADE_WS_URL } from "./constants";
import { Trade, CopyTradeConfig } from "./types";

let ws: WebSocket | null = null;
let messageHandler: ((data: any) => void) | null = null;

export function connectCopyTradeServer(onMessage: (data: any) => void) {
  messageHandler = onMessage;

  function connect() {
    try {
      ws = new WebSocket(COPY_TRADE_WS_URL);
    } catch {
      setTimeout(connect, 5000);
      return;
    }

    ws.onopen = () => {
      messageHandler?.({ type: "engine", status: "ACTIVE", message: "Connected to copy-trade server" });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        messageHandler?.(data);
      } catch {}
    };

    ws.onclose = () => {
      messageHandler?.({ type: "engine", status: "OFF", message: "Copy-trade server disconnected" });
      setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();
}

export function sendCopyTradeRequest(trade: Trade, walletLabel: string, config: CopyTradeConfig) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    type: "copy_trade",
    trade: {
      conditionId: trade.conditionId,
      title: trade.title,
      outcome: trade.outcome,
      side: trade.side,
      size: trade.size,
      price: trade.price,
      timestamp: trade.timestamp,
      transactionHash: trade.transactionHash,
      walletLabel,
    },
    config,
  }));
}

export function disconnectCopyTradeServer() {
  ws?.close();
  ws = null;
}
```

**Step 2: Update Dashboard to connect copy-trade server and auto-send BUY trades**

In `components/dashboard.tsx`, add:
- Import `connectCopyTradeServer`, `sendCopyTradeRequest`, `disconnectCopyTradeServer`
- On mount, connect to copy-trade server
- Handle server messages (balance, engine, status) → update system store
- When a new WS trade is detected and copy-trade is enabled for that wallet, auto-send to server

**Step 3: Commit**

```bash
git add lib/copy-trade-client.ts components/dashboard.tsx
git commit -m "feat: wire dashboard to copy-trade server with auto-send for enabled wallets"
```

---

### Task 25: Vercel Configuration

**Files:**
- Create: `vercel.json`
- Modify: `.gitignore` — ensure `server/.env` is ignored

**Step 1: Create vercel.json**

```json
{
  "framework": "nextjs"
}
```

**Step 2: Add to .gitignore**

Ensure these lines are in `.gitignore`:
```
server/.env
server/node_modules/
```

**Step 3: Commit**

```bash
git add vercel.json .gitignore
git commit -m "feat: add Vercel config and gitignore for server secrets"
```

---

### Task 26: Final Verification

**Step 1: Run the dashboard**

```bash
cd C:/Users/rbgnr/git/polymarket-monitor
npm run dev
```

Visit `http://localhost:3000`. Verify:
- 3 default wallet cards appear
- StatusBar shows WS connected (green dot)
- Positions load for each wallet
- Activity log shows connection events
- Adding/removing wallets works
- Poll heartbeat updates

**Step 2: Run the copy-trade server (optional, needs credentials)**

```bash
cd C:/Users/rbgnr/git/polymarket-monitor/server
# Create .env with PRIVATE_KEY and PROXY_ADDRESS
npm run dev
```

Verify:
- Server starts on port 8765
- Dashboard StatusBar shows Engine: ACTIVE
- Balance appears in header

**Step 3: Build check**

```bash
cd C:/Users/rbgnr/git/polymarket-monitor
npm run build
```

Expected: Build succeeds with no errors.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final verification — dashboard and copy-trade server working"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1 Foundation | 1-3 | Scaffold, types, wallet config |
| 2 API Layer | 4-8 | 5 proxy routes (balance, trades, positions, midpoint, market) |
| 3 Real-Time | 9-11 | WS client, API helper, Zustand stores |
| 4 UI | 12-22 | All components + Dashboard page |
| 5 Copy-Trade | 23 | Standalone Node.js server with CLOB client |
| 6 Integration | 24-26 | Wire copy-trade to UI, Vercel config, verification |

**Total: 26 tasks, ~2-3 hours estimated build time with subagents.**

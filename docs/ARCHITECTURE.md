# Architecture

## System Overview

Polymarket Monitor is a real-time whale wallet tracker and copy-trade dashboard. It monitors whale wallets on Polymarket prediction markets and can automatically mirror their trades.

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (Next.js Dashboard — localhost:3440)                │
│                                                              │
│  ┌─────────┐  ┌───────────┐  ┌───────────┐                  │
│  │ Trade    │  │ Wallet    │  │ System    │  Zustand Stores   │
│  │ Store    │  │ Store     │  │ Store     │                  │
│  └────┬─────┘  └─────┬─────┘  └─────┬─────┘                  │
│       │              │              │                        │
│  ┌────┴──────────────┴──────────────┴────┐                   │
│  │           Dashboard (orchestrator)     │                   │
│  │  WebSocket ← RTDS (real-time trades)  │                   │
│  │  Polling   ← Data API (fallback)      │                   │
│  │  WS Client → Copy-Trade Server        │                   │
│  └────┬──────────────┬──────────────┬────┘                   │
│       │              │              │                        │
│  ┌────┴────┐  ┌──────┴──────┐  ┌───┴────────┐               │
│  │ Wallet  │  │ Trades Feed │  │ Positions  │  Components    │
│  │ Cards   │  │ + Detail    │  │ Table      │               │
│  └─────────┘  └─────────────┘  └────────────┘               │
└──────────────────────────────────────────────────────────────┘
        │                    │
        │ API proxy routes   │ WebSocket
        ▼                    ▼
┌───────────────┐   ┌───────────────────────┐
│ Next.js API   │   │ Copy-Trade Server     │
│ /api/trades   │   │ (standalone Node.js)  │
│ /api/positions│   │ ws://localhost:8765    │
│ /api/balance  │   │                       │
│ /api/leader.. │   │ @polymarket/clob-client│
│ /api/portfol..│   │ Order placement       │
│ /api/midpoint │   │ Circuit breaker       │
│ /api/market   │   └───────────┬───────────┘
└───────┬───────┘               │
        │                       │
        ▼                       ▼
┌───────────────────────────────────────────┐
│  External Services                         │
│                                            │
│  data-api.polymarket.com  (Data API)       │
│  clob.polymarket.com      (CLOB API)       │
│  gamma-api.polymarket.com (Gamma API)      │
│  ws-live-data.polymarket.com (RTDS WS)     │
│  polygon-bor-rpc.publicnode.com (RPC)      │
└────────────────────────────────────────────┘
```

## Two-Process Architecture

The system runs as **two separate processes**:

### 1. Next.js Dashboard (port 3440)

The browser-facing application. Handles UI rendering, data fetching, and real-time trade streaming.

**Why Next.js?** Server-side API proxy routes bypass CORS restrictions from Polymarket APIs. The frontend is entirely client-rendered (`"use client"` on all components).

### 2. Copy-Trade Server (port 8765)

Standalone Node.js WebSocket server that executes orders on Polymarket.

**Why separate?** It needs a private key for signing blockchain transactions. Keeping it out of the Next.js process prevents key exposure to the browser bundle and allows independent lifecycle management.

## Data Flow Paths

### Path 1: Real-Time (WebSocket)

```
Polymarket RTDS → ws-client.ts → Dashboard → Trade Store → UI
                                     │
                                     └→ copy-trade-client.ts → Copy-Trade Server → CLOB API
```

1. `ws-client.ts` connects to the official `@polymarket/real-time-data-client`
2. Subscribes to `{ topic: "activity", type: "trades" }` for ALL on-chain trades
3. Filters by tracked wallet addresses (via `Set<string>` lookup)
4. Dashboard receives trade, adds to store, logs activity
5. If copy-trade is enabled for that wallet, sends signal to copy-trade server

### Path 2: Polling Fallback

```
Every 15s: Dashboard → /api/trades → Data API → Dashboard → Trade Store → UI
```

1. Dashboard polls each tracked wallet every 15 seconds
2. Uses a per-wallet cursor (`>=` comparison) to only process new trades
3. First poll sets the cursor and skips all historical trades
4. Deduplication via `seenTxHashes` Set (shared with WebSocket path)

### Path 3: Position & Balance Queries

```
React Query (30s) → /api/positions → Data API → UI
React Query (30s) → /api/balance → Polygon RPC → UI
```

Managed by React Query with automatic refetching at configured intervals.

### Path 4: Wallet Analytics (on-demand)

```
User clicks wallet → Dialog opens → React Query fetches:
  /api/leaderboard     → PnL, volume, rank, username
  /api/portfolio-value  → total open position value
  /api/positions        → full position list
  /api/balance          → USDC.e balance
```

All queries use `enabled: open` so they only fire when the dialog is visible.

## State Management

Three Zustand stores, each with a distinct responsibility:

### Trade Store (`lib/stores/trade-store.ts`)

| State | Type | Purpose |
|-------|------|---------|
| `tradesByWallet` | `Record<string, Trade[]>` | Max 100 trades per wallet, newest first |
| `seenTxHashes` | `Set<string>` | Deduplication across WS + polling, max 10,000 |

**Key behavior:** `addTrade()` returns `boolean` — `true` if new (triggers UI + copy-trade), `false` if duplicate.

### Wallet Store (`lib/stores/wallet-store.ts`)

| State | Type | Purpose |
|-------|------|---------|
| `wallets` | `TrackedWallet[]` | Tracked wallet list with copy-trade config |
| `initialized` | `boolean` | Prevents double-init race |

**Persistence:** Reads from / writes to `localStorage` under key `polymarket-tracked-wallets`. Falls back to `wallets.json` defaults.

### System Store (`lib/stores/system-store.ts`)

| State | Type | Purpose |
|-------|------|---------|
| `status` | `SystemStatus` | WS connection, poll health, engine state, balance, order counts |
| `activityLog` | `ActivityLogEntry[]` | Max 200 entries, newest first |
| `orderStatuses` | `OrderStatus[]` | Max 100 entries, newest first |

## API Proxy Layer

All 7 API routes serve as CORS-bypassing proxies. The browser never talks directly to Polymarket APIs.

| Route | Upstream | Purpose |
|-------|----------|---------|
| `/api/trades` | `data-api.polymarket.com/trades` | Recent trades for a wallet |
| `/api/positions` | `data-api.polymarket.com/positions` | All positions (limit 500) |
| `/api/balance` | Polygon RPC `eth_call` | USDC.e on-chain balance |
| `/api/leaderboard` | `data-api.polymarket.com/v1/leaderboard` | PnL, volume, rank |
| `/api/portfolio-value` | `data-api.polymarket.com/value` | Open positions total value |
| `/api/midpoint` | `clob.polymarket.com/midpoint` | Current market price |
| `/api/market` | `clob.polymarket.com/markets` or `gamma-api` | Market metadata |

## Component Hierarchy

```
app/layout.tsx
└── Providers (QueryClient + TooltipProvider)
    └── app/page.tsx
        └── Dashboard
            ├── StatusBar
            ├── AddWalletForm
            ├── WalletCard[] (grid layout)
            │   ├── WalletHeader
            │   │   └── WalletDetailDialog (modal, 3 tabs)
            │   ├── CopyTradeToggle
            │   ├── PositionsTable
            │   ├── Separator
            │   ├── TradesFeed
            │   └── OrderLifecycle
            └── ActivityLog
```

## Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 16 | Server-side API routes for CORS bypass |
| State | Zustand | Lightweight, no boilerplate, works well with Sets/Maps |
| Data fetching | React Query | Automatic refetching, caching, loading states |
| Blockchain | viem | Balance queries on Polygon (lighter than ethers for read-only) |
| WS trades | @polymarket/real-time-data-client | Official SDK, handles subscription protocol |
| WS orders | Raw WebSocket (ws) | Simple protocol, standalone server |
| Order execution | @polymarket/clob-client | Official SDK for CLOB API, handles signing |
| Styling | Tailwind + shadcn/ui | Dark theme, consistent component library |
| Formatting | Intl APIs | Locale-safe USD/number formatting, explicit timezone |

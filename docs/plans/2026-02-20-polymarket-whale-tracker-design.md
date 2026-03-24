# Polymarket Whale Wallet Tracker + Copy-Trade Dashboard

**Date:** 2026-02-20
**Status:** Approved

## Overview

Real-time Next.js dashboard monitoring Polymarket whale wallets with one-click copy-trading. Dark theme, minimalist UI. Every status, connection, order, and error visible to the user at all times.

## Architecture

Single-language TypeScript stack (no Python).

```
Browser (Client Components)
├── @polymarket/real-time-data-client → live trade stream
├── Zustand stores → global state (wallets, trades, WS status)
├── @tanstack/react-query → poll REST APIs with refetchInterval
├── shadcn/ui + Tailwind → dark theme UI
└── Copy-trade WS client → connects to local Node.js server

Next.js API Routes (Server, Vercel-deployable)
├── /api/trades       → proxy Data API (CORS bypass)
├── /api/positions    → proxy Data API (CORS bypass)
├── /api/balance      → Polygon RPC via viem
├── /api/midpoint     → proxy CLOB API
└── /api/market       → proxy CLOB/Gamma API

Copy-Trade Server (standalone Node.js, runs locally)
├── @polymarket/clob-client → order signing + placement
├── WebSocket server → pushes status to browser
├── Circuit breaker + balance monitoring
└── Requires private key (never deployed to Vercel)
```

## Library Stack

| Category | Library | Package |
|---|---|---|
| Polymarket Real-Time | Official RTDS client | `@polymarket/real-time-data-client` |
| Polymarket Trading | Official CLOB client (TS) | `@polymarket/clob-client` |
| Blockchain/RPC | Viem | `viem` |
| State Management | Zustand | `zustand` |
| Server State/Polling | TanStack Query | `@tanstack/react-query` |
| UI Components | shadcn/ui | CLI-based |
| Data Tables | TanStack Table (via shadcn) | `@tanstack/react-table` |
| Charts | None (tables only, YAGNI) | — |

## Key Design Decisions

1. **Official RTDS client over hand-rolled WS** — auto-reconnect, typed events, maintained by Polymarket team.
2. **All TypeScript** — `@polymarket/clob-client` replaces `py-clob-client`. Single language, simpler deployment.
3. **Tables only** — no charts. Clean numbers with P&L coloring. Charts can be added later.
4. **Zustand for client state, React Query for server state** — clear separation. Zustand holds trades, WS status, wallet configs. React Query handles API polling with caching.
5. **Copy-trade as standalone Node.js server** — not in Next.js API routes because it needs persistent WebSocket connections and private key access. Communicates with browser via local WebSocket.

## Data Flow

1. **Trade detection (primary):** RTDS client subscribes to `activity.trades`, filters by tracked `proxyWallet` addresses client-side.
2. **Trade detection (fallback):** React Query polls `/api/trades?address=X` every 15s. Dedup by `transactionHash` (bounded set, max 10K, evict oldest).
3. **Positions:** React Query polls `/api/positions` every 30s per wallet.
4. **Balance:** React Query polls `/api/balance` every 30s via viem against Polygon RPC.
5. **Copy-trade:** Browser detects BUY → sends to local WS server → server validates (age <60s, midpoint check, drift <20%) → places order via CLOB client → pushes status back to browser.

## Project Structure

```
polymarket-monitor/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       ├── trades/route.ts
│       ├── positions/route.ts
│       ├── balance/route.ts
│       ├── midpoint/route.ts
│       └── market/route.ts
├── components/
│   ├── dashboard.tsx
│   ├── status-bar.tsx
│   ├── wallet-card.tsx
│   ├── trades-feed.tsx
│   ├── positions-table.tsx
│   ├── add-wallet-form.tsx
│   ├── copy-trade-toggle.tsx
│   ├── order-lifecycle.tsx
│   ├── activity-log.tsx
│   └── wallet-header.tsx
├── lib/
│   ├── polymarket-api.ts
│   ├── ws-client.ts
│   ├── types.ts
│   ├── wallets.ts
│   ├── constants.ts
│   └── stores/
│       ├── trade-store.ts
│       ├── wallet-store.ts
│       └── system-store.ts
├── server/
│   └── copy-trade-server.ts
├── wallets.json
├── next.config.js
├── tailwind.config.ts
├── components.json
├── tsconfig.json
├── package.json
└── vercel.json
```

## UI Design

- Dark theme (`bg-[#0a0a0a]`)
- Sticky status bar: WS status, poll heartbeat, engine status, balance, order counts
- Responsive wallet card grid: balance + positions + live trades + copy-trade toggle
- Activity log at bottom: scrolling event log with timestamps
- Color coding: green=BUY/profit, red=SELL/loss, yellow=skipped, orange=paused

## API Reference

All Polymarket API endpoints, response formats, gotchas, and constraints are documented in the original spec and remain unchanged. Key endpoints:

- Data API: `https://data-api.polymarket.com` (trades, positions)
- CLOB API: `https://clob.polymarket.com` (midpoint, markets, orders)
- Gamma API: `https://gamma-api.polymarket.com` (market metadata)
- Polygon RPC: `https://polygon-rpc.com` (on-chain balances)
- WebSocket: `wss://ws-live-data.polymarket.com` (real-time trades)

## Known Gotchas

1. Gamma API returns JSON-encoded strings — must `JSON.parse()`
2. USDC.e has 6 decimals, not 18
3. Always query proxy wallet address, not EOA
4. WebSocket streams ALL trades — filter client-side by proxyWallet
5. First poll returns empty (by design — establishes cursor)
6. Data API and RPC need CORS proxy via Next.js API routes
7. Timestamps are Unix seconds (multiply by 1000 for JS Date)
8. `size` and `price` are strings in API responses
9. tick_size must be string for CLOB client ROUNDING_CONFIG
10. Minimum order = $1 USDC (size * price >= 1)
11. minimum_order_size varies per market
12. Stale trades lose money — always check age + live midpoint
13. Resolved markets have midpoints near 0 or 1 — skip these
14. Price drift >20% from whale price — skip to avoid bad entries
15. Public RPC rate limits — poll max every 30s, use fallback RPCs

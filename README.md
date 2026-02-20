# Polymarket Whale Monitor

Real-time Polymarket whale wallet monitoring and copy-trade dashboard. Track what the top traders are buying, filter by market category, and optionally mirror their trades.

## Architecture

```
External Consumers (bots, scripts, mobile)
        | REST API (port 8766)
        v
+---------------------------------------------------+
| Copy-Trade + API Server (Node.js)                  |
|                                                     |
|  Express HTTP --- api-router.ts (port 8766)         |
|  WS Server   --- copy-trade protocol (port 8765)    |
|  RTDS Client --- server-side trade stream            |
|                                                     |
|  Shared State:                                      |
|  +-- tradeCache (per wallet, max 500)               |
|  +-- orderHistory, engineState, balance             |
|  +-- tagOverrides (data/tag-overrides.json)         |
|  +-- presets (data/presets.json)                     |
+---------------------------------------------------+
        ^ WS (copy-trade)
        |
+---------------------------------------------------+
| Browser Dashboard (Next.js, port 3440)              |
|  +-- RTDS WS -> Trade Store                         |
|  +-- Polling -> /api/ proxy -> Trade Store           |
|  +-- FilterBar + PresetSelector                     |
|  |   +-- filterTrades/filterPositions (shared)       |
|  +-- WS Client -> Copy-Trade Server                 |
|  +-- lib/shared/ <- same tags, filters, parse        |
+---------------------------------------------------+
```

## Quick Start

### 1. Dashboard (Next.js)

```bash
npm install
npm run dev
```

Open [http://localhost:3440](http://localhost:3440).

### 2. Copy-Trade + API Server

```bash
cd server
npm install
cp .env.example .env    # edit with your keys
npm run dev
```

- WebSocket (copy-trade): `ws://localhost:8765`
- REST API: `http://localhost:8766/api/v1`

## Ports

| Service | Port | Protocol |
|---------|------|----------|
| Next.js Dashboard | 3440 | HTTP |
| Copy-Trade WS | 8765 | WebSocket |
| REST API | 8766 | HTTP |

## REST API Endpoints

All endpoints are under `http://localhost:8766/api/v1`. Auth via `Authorization: Bearer <WS_AUTH_TOKEN>` (disabled if env var not set).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/wallets` | List tracked wallets |
| GET | `/trades?wallets=0x...&side=BUY&tags=crypto` | Filtered trades from cache |
| GET | `/positions/:wallet?status=active&minValue=100` | Filtered positions (live) |
| GET | `/balance/:wallet` | USDC.e balance |
| GET | `/leaderboard/:wallet` | Leaderboard stats |
| GET | `/portfolio-value/:wallet` | Portfolio value |
| GET | `/status` | System status, cache stats |
| GET | `/orders?status=FILLED` | Copy-trade order history |
| GET | `/tags` | All known tags + overrides |
| PUT | `/tags/:conditionId` | Set manual tag override |
| GET | `/presets` | List saved filter presets |
| PUT | `/presets/:id` | Create/update preset |
| DELETE | `/presets/:id` | Delete preset |
| GET | `/market/:conditionId` | Market metadata |

### Trade Filter Parameters

| Param | Example | Description |
|-------|---------|-------------|
| `wallets` | `0xabc,0xdef` | Comma-separated wallet addresses |
| `side` | `BUY` | BUY, SELL, or both |
| `minSize` / `maxSize` | `100` | USD size range |
| `minPrice` / `maxPrice` | `0.10` | Price range (0-1) |
| `titleSearch` | `Bitcoin` | Title substring match |
| `outcome` | `Yes` | Outcome substring match |
| `tags` | `crypto,btc` | Tag filter (comma-separated) |
| `source` | `WS` | WS, POLL, or both |
| `since` / `until` | `1708000000` | Unix timestamp range |
| `conditionId` | `0x...` | Exact market match |
| `limit` | `50` | Max results (default 100) |

### Position Filter Parameters

| Param | Example | Description |
|-------|---------|-------------|
| `status` | `active,won` | active, resolving, won, lost |
| `minShares` / `maxShares` | `10` | Share count range |
| `minValue` / `maxValue` | `100` | Market value range (USD) |
| `minPnl` / `maxPnl` | `-500` | Unrealized P&L range |
| `minReturn` / `maxReturn` | `-50` | Percent P&L range |
| `titleSearch` | `Trump` | Title substring match |
| `tags` | `politics` | Tag filter |
| `conditionId` | `0x...` | Exact market match |

## Tag System

Markets are auto-tagged by scanning titles against 70+ keywords:

| Category | Example Tags |
|----------|-------------|
| Crypto | `crypto`, `btc`, `eth`, `sol`, `xrp`, `doge` |
| Politics | `politics` |
| Sports | `sports`, `basketball`, `football`, `soccer`, `mma` |
| Economy | `economy`, `stocks` |
| Directional | `directional` (up/down, above/below markets) |
| Time-based | `short-term`, `medium-term`, `long-term` |
| Entertainment | `entertainment` |
| Tech | `tech`, `space` |

Tags can be manually overridden per market via `PUT /api/v1/tags/:conditionId`.

## Dashboard Features

- **Real-time trade feed** via Polymarket RTDS WebSocket + polling fallback
- **Per-wallet filter bars** with quick toggles (BUY/SELL, WS/POLL, Active/Won/Lost/Resolving)
- **Advanced filters** popover (title search, size range, P&L range, tags)
- **Saveable filter presets** (persisted in localStorage)
- **Position tracking** with live P&L, market value, and status badges
- **Copy-trade engine** with circuit breaker, price drift protection, and order lifecycle display
- **Wallet analytics** dialog with leaderboard stats and portfolio value

## Project Structure

```
lib/
  shared/           # Shared between dashboard + server
    types.ts         # All TypeScript interfaces
    constants.ts     # API URLs, intervals, addresses
    format.ts        # Formatters (USD, time, price, status)
    parse.ts         # parseTrade(), parsePosition()
    tags.ts          # Tag auto-detection + overrides
    filters.ts       # Filter types + application logic
  stores/            # Zustand stores
    trade-store.ts   # In-memory trade cache (browser)
    wallet-store.ts  # Tracked wallets (localStorage)
    system-store.ts  # System status, activity log
    filter-store.ts  # Per-wallet filters + presets
  polymarket-api.ts  # Browser API client (via Next.js proxy)
  ws-client.ts       # RTDS WebSocket wrapper
  copy-trade-client.ts  # Browser WS client to copy-trade server

server/
  copy-trade-server.ts   # Main server (WS 8765 + HTTP 8766)
  api-router.ts          # Express REST API routes
  auth-middleware.ts     # Bearer token auth
  polymarket-api-direct.ts  # Direct Polymarket API client
  rtds-client.ts         # Server-side RTDS trade stream
  trade-cache.ts         # In-memory trade cache (server)
  tag-store.ts           # File-based tag overrides
  preset-store.ts        # File-based filter presets

components/
  dashboard.tsx          # Main orchestrator
  wallet-card.tsx        # Per-wallet card
  trades-feed.tsx        # Trade list with filters
  positions-table.tsx    # Position table with filters
  filter-bar.tsx         # TradeFilterBar + PositionFilterBar
  preset-selector.tsx    # Save/load filter presets
  ...
```

## Environment Variables

### Dashboard (.env.local)

```
NEXT_PUBLIC_COPY_TRADE_WS_TOKEN=your-token
```

### Server (server/.env)

```
PRIVATE_KEY=0x...           # Wallet private key for order signing
PROXY_ADDRESS=0x...         # Polymarket proxy wallet address
SIGNATURE_TYPE=0            # 0=EOA, 1=POLY_PROXY, 2=GNOSIS_SAFE
WS_AUTH_TOKEN=your-token    # Shared auth token (WS + REST API)
```

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **State:** Zustand, React Query
- **Server:** Express 5, WebSocket (ws), tsx
- **Blockchain:** viem, ethers, @polymarket/clob-client
- **Real-time:** @polymarket/real-time-data-client (RTDS)

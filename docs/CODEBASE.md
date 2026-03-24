# Codebase Reference

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.1.6 |
| UI | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui (Radix) | 3.8.5 |
| State | Zustand | 5.0.11 |
| Data Fetching | React Query | 5.90.21 |
| Blockchain | viem | 2.46.2 |
| WS (browser) | @polymarket/real-time-data-client | 1.4.0 |
| WS (server) | ws | 8.18.0 |
| Orders (server) | @polymarket/clob-client | 5.2.3 |
| Signing (server) | ethers | 5.7.2 |

## File Map

```
polymarket-monitor/
├── app/
│   ├── layout.tsx              Root layout (dark mode, Geist fonts, Providers)
│   ├── page.tsx                Home page (renders Dashboard)
│   └── api/
│       ├── balance/route.ts    USDC.e balance via Polygon RPC (viem)
│       ├── trades/route.ts     Proxy → Data API /trades
│       ├── positions/route.ts  Proxy → Data API /positions
│       ├── leaderboard/route.ts Proxy → Data API /v1/leaderboard
│       ├── portfolio-value/route.ts Proxy → Data API /value
│       ├── midpoint/route.ts   Proxy → CLOB API /midpoint
│       └── market/route.ts     Proxy → CLOB API or Gamma API /markets
│
├── components/
│   ├── dashboard.tsx           Main orchestrator (WS + polling + copy-trade)
│   ├── wallet-card.tsx         Per-wallet card container
│   ├── wallet-header.tsx       Label, full address, balance, detail dialog trigger
│   ├── wallet-detail-dialog.tsx Analytics dialog (Overview/Positions/Trades tabs)
│   ├── add-wallet-form.tsx     Address + label input form
│   ├── trades-feed.tsx         Trade list with timestamps, expand toggle
│   ├── positions-table.tsx     Position list with Open/Settled badges, expand
│   ├── copy-trade-toggle.tsx   Enable/disable copy-trading switch
│   ├── status-bar.tsx          Sticky bar: WS, poll, engine, balance, orders
│   ├── activity-log.tsx        Scrollable event log
│   ├── order-lifecycle.tsx     Order status tracker per wallet
│   ├── providers.tsx           QueryClient + TooltipProvider
│   └── ui/                     shadcn/ui generated components
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── popover.tsx
│       ├── scroll-area.tsx
│       ├── separator.tsx
│       ├── switch.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       └── tooltip.tsx
│
├── lib/
│   ├── types.ts                All TypeScript interfaces
│   ├── constants.ts            API URLs, intervals, contract addresses
│   ├── polymarket-api.ts       Fetch functions + parse helpers
│   ├── format.ts               Intl-based formatting (GMT-3, USD, numbers)
│   ├── ws-client.ts            RTDS WebSocket wrapper
│   ├── copy-trade-client.ts    Browser WS client to copy-trade server
│   ├── wallets.ts              localStorage persistence
│   ├── utils.ts                cn() Tailwind helper
│   └── stores/
│       ├── trade-store.ts      Trades by wallet + dedup set
│       ├── wallet-store.ts     Wallet list + copy-trade config
│       └── system-store.ts     Status, activity log, order statuses
│
├── server/
│   └── copy-trade-server.ts    Standalone order execution server
│
├── wallets.json                Default tracked wallets (3 whales)
├── package.json                Dependencies and scripts
└── docs/
    ├── ARCHITECTURE.md         System design and data flow
    ├── BUSINESS-LOGIC.md       Trade detection, copy-trade, circuit breaker
    └── CODEBASE.md             This file
```

## Type System

### Core Domain Types (`lib/types.ts`)

```typescript
TrackedWallet {
  address: string
  label: string
  notes?: string
  copyTradeEnabled: boolean
  copyTradeConfig: CopyTradeConfig
}

CopyTradeConfig {
  multiplier: number         // 0.01-10, default 0.5
  maxSingleTrade: number     // $0.50-$10,000, default $1
  priceImprovementPct: number // 0-10%, default 2%
}

Trade {
  conditionId: string        // Polymarket market ID
  title: string              // Market title
  outcome: string            // "Yes" or "No"
  side: "BUY" | "SELL"
  size: number               // Number of shares
  price: number              // Price per share (0-1)
  timestamp: number          // Unix seconds
  transactionHash: string    // On-chain tx hash
  walletAddress: string      // Lowercase proxy wallet
  source: "WS" | "POLL"     // How trade was detected
}

Position {
  conditionId: string
  title: string
  outcome: string
  size: number
  avgPrice: number           // Entry price
  curPrice: number           // Current market price
  unrealizedPnl: number      // (curPrice - avgPrice) × size
  marketValue: number        // curPrice × size
  asset: string              // Token ID
  redeemable: boolean        // true = settled, false = open
  endDate: string            // Market end date
  cashPnl: number            // Realized + unrealized PnL
  realizedPnl: number        // PnL from settled positions
  slug: string               // Market URL slug
  icon: string               // Market icon URL
}
```

### API Response Types

```typescript
RawTrade {                   // From Data API (string values)
  conditionId, title, outcome, side: string
  size, price: string        // Parsed to numbers by parseTrade()
  timestamp: number
  transactionHash, proxyWallet, asset: string
}

RawPosition {                // From Data API (string values)
  conditionId, title, outcome: string
  size, avgPrice, curPrice, asset, proxyWallet: string
  redeemable?: boolean       // Optional enrichment fields
  endDate?, cashPnl?, percentPnl?, realizedPnl?: string
  initialValue?, currentValue?, totalBought?: string
  slug?, icon?, eventSlug?: string
}

LeaderboardData {
  rank: number
  userName: string
  vol: number                // Total volume (USD)
  pnl: number                // All-time PnL (USD)
  profileImage: string
  xUsername: string
  verifiedBadge: boolean
}

PortfolioValue {
  user: string
  value: number              // Total open position value (USD)
}
```

### System Types

```typescript
SystemStatus {
  wsConnected: boolean
  wsLastMessage: number      // Unix seconds
  pollLastSuccess: number    // Unix seconds
  copyTradeEngine: "ACTIVE" | "PAUSED" | "OFF"
  copyTradeMessage: string
  userBalance: number        // USDC.e balance
  ordersTotal: number
  ordersFilled: number
  ordersFailed: number
  ordersSkipped: number
}

OrderStatus {
  orderId: string | null
  status: "DETECTED" | "VALIDATING" | "PLACING" | "FILLED" |
          "FAILED" | "SKIPPED" | "PAUSED" | "RESUMED"
  message: string
  error?: string
  reason?: string
  timestamp: number
  walletLabel: string
  trade: Trade
}

ActivityLogEntry {
  id: string                 // Auto-generated unique ID
  timestamp: number          // Unix seconds
  level: "info" | "warn" | "error" | "success"
  message: string
  source: string             // "WS" | "POLL" | "COPY" | "SYSTEM" | "RPC"
}
```

## Constants (`lib/constants.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `DATA_API_BASE` | `https://data-api.polymarket.com` | Trades, positions, leaderboard |
| `CLOB_API_BASE` | `https://clob.polymarket.com` | Midpoint, market info, orders |
| `GAMMA_API_BASE` | `https://gamma-api.polymarket.com` | Alternative market info |
| `POLYGON_RPC_URL` | `https://polygon-bor-rpc.publicnode.com` | Primary Polygon RPC |
| `POLYGON_RPC_FALLBACK` | `https://polygon.drpc.org` | Fallback RPC |
| `USDC_E_ADDRESS` | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | USDC.e on Polygon |
| `USDC_E_DECIMALS` | `6` | Token decimals |
| `POLL_INTERVAL_TRADES` | `15,000` ms | Trade polling frequency |
| `POLL_INTERVAL_POSITIONS` | `30,000` ms | Position refresh frequency |
| `POLL_INTERVAL_BALANCE` | `30,000` ms | Balance check frequency |
| `DEDUP_SET_MAX_SIZE` | `10,000` | Max cached transaction hashes |
| `COPY_TRADE_WS_URL` | `ws://localhost:8765` | Copy-trade server address |
| `DEFAULT_COPY_TRADE_CONFIG` | `{0.5x, $1, 2%}` | Default copy-trade params |

## Scripts

```bash
npm run dev        # Start Next.js dev server on port 3440
npm run build      # Production build
npm run start      # Production server on port 3440
npm run lint       # ESLint

# Copy-trade server (separate terminal):
npx tsx server/copy-trade-server.ts
```

## Environment Variables

### Next.js (`.env.local`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_COPY_TRADE_WS_TOKEN` | No | Auth token for copy-trade server |

### Copy-Trade Server (`.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `PRIVATE_KEY` | Yes | Wallet private key for signing orders |
| `PROXY_ADDRESS` | No | Polymarket proxy/funder address |
| `SIGNATURE_TYPE` | No | 0=EOA, 1=Poly Proxy, 2=Gnosis Safe |
| `WS_AUTH_TOKEN` | No | Required token for browser connections |

## Known Gotchas

1. **RTDS `onMessage` signature**: Takes `(client, message)` — client is the FIRST parameter, not message
2. **`@polymarket/clob-client` TickSize**: Must be string literal `"0.01"`, not a number
3. **Zustand Set/Map mutations**: Always clone BEFORE mutating — `new Set(old)` then modify, not modify-then-clone
4. **Polling cursor**: Use `>=` not `>` — the dedup set handles exact-timestamp duplicates
5. **WebSocket auth**: Even on localhost, server rejects connections without token if `WS_AUTH_TOKEN` is set
6. **`addOrderStatus` counters**: Only `FILLED`/`FAILED`/`SKIPPED` should increment counters — these are final states
7. **Balance on server**: Uses raw RPC `eth_call` (not viem) to avoid adding viem dependency to server
8. **Price rounding**: Always round DOWN to tick size — rounding up causes CLOB rejections

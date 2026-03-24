# Business Logic

## Core Concept

Monitor whale wallets on Polymarket, display their trades and positions in real-time, and optionally copy their trades with configurable parameters.

## Trade Detection

Trades are detected through two redundant paths:

### WebSocket (Primary — `lib/ws-client.ts`)

- Connects to Polymarket's official Real-Time Data Service (RTDS)
- Subscribes to ALL on-chain trades: `{ topic: "activity", type: "trades" }`
- Client-side filtering: checks `proxyWallet` against tracked address Set
- Latency: sub-second from on-chain execution
- Auto-reconnect with exponential backoff (5s → 60s max)

### Polling (Fallback — `components/dashboard.tsx`)

- Polls Data API every 15 seconds per wallet via `/api/trades`
- Cursor-based: tracks max timestamp per wallet
- First poll sets cursor, skips all historical trades (no replay)
- Subsequent polls: `timestamp >= cursor` + dedup via `seenTxHashes`
- Catches trades missed by WebSocket disconnections

### Deduplication

Both paths share a single `seenTxHashes: Set<string>` in the Trade Store (max 10,000 entries). `addTrade()` returns `false` for duplicates, preventing double-counting and double copy-trades.

## Copy-Trade Pipeline

When a new trade is detected from a wallet with `copyTradeEnabled: true`:

### Browser Side

1. Dashboard detects new trade from `addTrade()` returning `true`
2. Checks `wallet.copyTradeEnabled` in current wallet store state
3. Calls `sendCopyTradeRequest(trade, walletLabel, copyTradeConfig)` via WebSocket
4. Logs "Copy-trade request sent" to activity log

### Server Side (`server/copy-trade-server.ts`)

The copy-trade server receives the signal and runs a **7-step validation pipeline**:

#### Step 1: Engine Check
- If circuit breaker is active (balance < $2), skip with reason `circuit_breaker`

#### Step 2: Side Filter
- Only BUY trades are copied (SELL trades are skipped)
- Rationale: selling requires owning the position; copy-trading sells is complex

#### Step 3: Freshness Check
- Trade must be < 60 seconds old
- Stale trades are skipped (price may have moved significantly)

#### Step 4: Market Validation
- Fetches market info from CLOB API
- Checks `market.accepting_orders === true`
- Closed or resolved markets are skipped

#### Step 5: Outcome Matching
- Finds the specific token (outcome) in the market's token list
- Case-insensitive comparison against `trade.outcome`

#### Step 6: Midpoint Sanity
- Fetches current midpoint price for the token
- Skips if midpoint < 3% or > 97% (indicates resolved/near-resolved market)

#### Step 7: Price Drift Check
- Compares current midpoint against whale's trade price
- Skips if drift > 20%
- Prevents buying at significantly worse prices than the whale got

### Order Parameter Calculation

After validation passes:

```
1. Scale size:     orderSize = whaleSize × multiplier (e.g., 0.5x)
2. Cap by USD:     orderSize = min(orderSize, maxSingleTrade / whalePrice)
3. Price improve:  orderPrice = whalePrice × (1 + priceImprovementPct)
4. Cap price:      orderPrice = min(orderPrice, 0.99)
5. Round price:    Floor to tick size (never round up — prevents rejections)
6. Round size:     Floor to 2 decimals
7. Min USD check:  If size × price < $1, increase size to meet minimum
8. Min order size: If size < market.minimum_order_size, increase to meet it
9. Sanity:         If size ≤ 0 or price ≤ 0, skip
```

### Order Execution

- Uses `clobClient.createAndPostOrder()` with `OrderType.GTC` (Good 'Til Cancelled)
- On success: broadcasts `FILLED` status with `orderId`
- On failure: broadcasts `FAILED` status; checks error message for balance issues

### Copy-Trade Configuration

Per-wallet configuration stored in `TrackedWallet.copyTradeConfig`:

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `multiplier` | 0.5 | 0.01-10 | Scale factor for whale's trade size |
| `maxSingleTrade` | $1.00 | $0.50-$10,000 | Maximum USD per order |
| `priceImprovementPct` | 2% | 0-10% | How much higher to bid (faster fills) |

## Circuit Breaker

Automatic safety mechanism in the copy-trade server:

```
Balance Check (every 30s)
    │
    ▼
Balance < $2? ──yes──▶ PAUSE engine
    │                     │
    no                    │ Check every 60s
    │                     │
    ▼                     ▼
Continue normal      Balance >= $2? ──yes──▶ RESUME engine
operation                │
                         no
                         │
                         ▼
                    Keep checking
```

**Triggers:**
- Periodic balance check falls below $2 threshold
- Order rejected with "insufficient balance" error

**Effects:**
- All new copy-trade requests are skipped with reason `circuit_breaker`
- Balance polling switches from 30s to 60s interval
- Dashboard shows engine status as `PAUSED` (orange, pulsing)

**Recovery:**
- Automatic when balance recovers above $2
- Resumes normal 30s balance polling
- Dashboard shows engine status as `ACTIVE` (green)

## Order Lifecycle States

Each copy-trade order progresses through these states:

```
DETECTED → VALIDATING → PLACING → FILLED
                │           │
                ▼           ▼
            SKIPPED      FAILED
```

| State | Meaning |
|-------|---------|
| `DETECTED` | Trade signal received from browser |
| `VALIDATING` | Running 7-step validation pipeline |
| `PLACING` | Validation passed, sending to CLOB API |
| `FILLED` | Order accepted by CLOB (not necessarily matched yet) |
| `SKIPPED` | Validation failed (reason attached) |
| `FAILED` | CLOB API rejected or error occurred |
| `PAUSED` | Engine paused (circuit breaker) |
| `RESUMED` | Engine resumed (balance recovered) |

Only `FILLED`, `FAILED`, and `SKIPPED` increment the dashboard counters.

## Wallet Management

### Storage

- **Default wallets**: loaded from `wallets.json` (3 pre-configured whales)
- **Persistence**: `localStorage` under key `polymarket-tracked-wallets`
- **Fallback**: if localStorage is empty or corrupt, uses defaults

### Default Tracked Whales

| Label | Address | Notes |
|-------|---------|-------|
| uncommon-oat | `0xd0d6...93aa` | $487K portfolio, high-freq BTC/ETH/SOL 5-min markets |
| square-guy | `0x1979...c9d` | $608K portfolio, BTC/ETH/SOL/XRP up/down markets |
| swisstony | `0x204f...5e14` | — |

### Address Format

All addresses are normalized to lowercase throughout the codebase. The `proxyWallet` field from Polymarket APIs is the wallet used for on-chain transactions.

## Position Tracking

Positions are fetched from the Data API with these parameters:
- `sizeThreshold=0` — include all positions regardless of size
- `limit=500` — maximum positions per query
- `sortBy=CURRENT&sortDirection=DESC` — highest value first

### Position States

| Field | Meaning |
|-------|---------|
| `redeemable: false` | Open position (market still active) |
| `redeemable: true` | Settled position (market resolved, can redeem) |
| `cashPnl > 0` | Winning position |
| `cashPnl < 0` | Losing position |

### Display Filtering

- Positions with `size <= 0.01` are hidden (dust)
- Default view shows top 10 by market value
- Expandable to show all positions in scrollable area

## Wallet Analytics

Available via the wallet detail dialog (click wallet label):

### Data Sources

| Metric | Source | Endpoint |
|--------|--------|----------|
| Username, rank | Leaderboard API | `/v1/leaderboard?user=...&timePeriod=ALL` |
| Total volume, PnL | Leaderboard API | Same endpoint |
| Portfolio value | Value API | `/value?user=...` |
| USDC.e balance | Polygon RPC | `balanceOf()` on USDC.e contract |
| Positions | Data API | `/positions?user=...` |
| Trades | In-memory store | Collected via WS + polling since session start |

### Computed Metrics

- **Open count**: positions where `redeemable === false`
- **Settled count**: positions where `redeemable === true`
- **Winning count/total**: positions where `cashPnl > 0`
- **Losing count/total**: positions where `cashPnl < 0`

## Formatting Conventions

All formatting uses `Intl` APIs with explicit configuration:

| Function | Output | Example |
|----------|--------|---------|
| `formatTime(ts)` | HH:MM:SS in GMT-3 | `14:23:45` |
| `formatTimeWithAge(ts, now)` | Time + relative | `14:23:45 (2m ago)` |
| `formatDateTime(ts)` | Short date+time | `Feb 20, 14:23` |
| `formatUSD(val)` | USD with commas | `$1,234.50` |
| `formatNumber(val)` | Number with commas | `119,066,610.25` |
| `formatPrice(val)` | 3 decimal places | `0.653` |

Timezone is hardcoded to `America/Sao_Paulo` (GMT-3) for consistent display.

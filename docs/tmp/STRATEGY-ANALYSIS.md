# Whale Wallet Strategy Breakdown

**Date:** 2026-02-20
**Data Source:** Polymarket Data API (live positions + leaderboard)

---

## Overview Table

| Wallet | Rank | Volume | All-Time PnL | Portfolio | Positions | Strategy |
|--------|------|--------|-------------|-----------|-----------|----------|
| **uncommon-oat** | #84 | $119M | +$996K | $51K | 80 (26 open) | Crypto short-term directional |
| **square-guy** | #182 | $78M | +$606K | $81K | 89 (46 open) | Crypto short-term hedged |
| **swisstony** | #15 | $401M | +$4.5M | $397K | 500 (499 open) | Sports/tennis market maker |

---

## 1. UNCOMMON-OAT — "Crypto Binary Scalper"

**Address:** `0xd0d6053c3c37e727402d84c14069780d360993aa`
**Username:** k9Q2mX4L8A7ZP3R

### What they do

1. **100% crypto "Up or Down" markets** — exclusively BTC (67%), XRP (14%), SOL (10%), ETH (9%)
2. **Heavy BTC concentration** — $34K of $42K total invested is in Bitcoin markets
3. **Bearish bias** — 36 Down vs 18 Up positions on BTC (2:1 ratio favoring Down)
4. **Hourly timeframes** — all positions are on hourly snapshots ("10AM ET", "11AM ET", etc.) and some 5-15 minute intervals
5. **Both-sides hedging on active markets** — 13 out of 67 unique markets have BOTH Up and Down positions (buying both sides to lock in guaranteed profit when one side is mispriced)
6. **Size disparity** — median position is just 1 share, but max is 17,965 shares ($9,682). They concentrate capital on high-conviction bets and scatter tiny positions elsewhere
7. **Win rate 24.1%** but near break-even — avg win ($0.41) > avg loss ($0.13), so they profit on the spread despite low hit rate

### The Strategy in Steps

1. Monitor BTC/ETH price action approaching hourly boundaries
2. When they see a directional signal, take a large position (5,000-18,000 shares at $0.40-0.70)
3. Also take the opposite side on the same market at a cheap price as insurance
4. For less certain markets, sprinkle 1-share "lottery ticket" positions
5. Net result: small edge compounded over massive volume ($119M cumulative)

### Current Big Bets

- $15K on BTC Up (10AM ET) — already +$5,527
- $10K on BTC Down (11AM ET) — already +$2,916
- $6.5K on ETH Up (10AM ET) — already +$2,069

### Position Stats

- Avg entry price: 0.442 | Median: 0.459
- Cheap (<0.30): 26 | Mid (0.30-0.70): 41 | Expensive (>0.70): 12
- Total invested: $41,778

---

## 2. SQUARE-GUY — "Multi-Asset Crypto Hedger"

**Address:** `0x1979ae6b7e6534de9c4539d0c205e582ca637c9d`
**Username:** (default address-based)

### What they do

1. **Diversified across 4 crypto assets** — XRP (27 pos), SOL (23), BTC (20), ETH (19) — much more balanced than uncommon-oat
2. **Aggressive both-sides hedging** — 36 out of 53 unique markets have BOTH sides (68%). This is a systematic hedging strategy
3. **Larger position sizes** — median 783 shares, avg $1,089 cost per position
4. **Currently underwater** — settled PnL is -$2,815 (37.2% win rate). Losing money short-term despite $606K all-time profit
5. **Longer time horizons** — includes 4-hour windows ("8:00AM-12:00PM ET") alongside short intervals
6. **Slightly bullish skew** — more Up positions than Down across all assets

### The Strategy in Steps

1. Enter BOTH sides of a crypto Up/Down market at different times, seeking price discrepancies
2. If Up is at 0.60 and Down is at 0.35, buy both — the guaranteed payout is 1.00, so if total cost < 1.00, it's risk-free profit
3. Spread across all major cryptos to diversify event risk
4. Use larger timeframes (4h) for higher-conviction core positions
5. Layer in shorter-interval positions (5-15 min) for active scalping

### Current Big Bets

- $9K on BTC Down (8AM-12PM) — losing $3,750
- $5.9K on BTC Down (11AM) — gaining +$2,110
- $3.9K on ETH Up (8AM-12PM) — gaining +$169

### Position Stats

- Avg entry price: 0.475 | Median: 0.486
- Cheap (<0.30): 26 | Mid (0.30-0.70): 45 | Expensive (>0.70): 18
- Total invested: $96,979

### Key difference from uncommon-oat

Square-guy hedges 68% of markets vs uncommon-oat's 19%. This makes them more of a market-maker than a directional trader. The goal is to profit from bid-ask spread inefficiencies, not from predicting direction.

---

## 3. SWISSTONY — "Sports Betting Market Maker"

**Address:** `0x204f72f35326db932158cba6adff0b9a1da95e14`
**Username:** swisstony

### What they do

1. **Zero crypto** — entirely sports betting: European football (La Liga, Bundesliga, Serie A, Ligue 1, Premier League), NBA, tennis
2. **Massive scale** — 500 positions, $348K invested, 499 still open. Only 1 settled so far
3. **Market-making on sports outcomes** — consistently buys BOTH sides of every market:
   - "Will Athletic Club win?" -> holds both Yes AND No
   - "Rayo vs Real Oviedo O/U 2.5" -> holds both Over AND Under
   - Tennis matches -> holds both players
4. **93 markets with both sides** (29% of unique markets) — but many single-sided positions are on related markets (O/U 1.5, O/U 2.5, O/U 3.5 on the same match)
5. **Strong "No" bias** — heavily betting against teams winning: on "Will X win?" markets, most single-side positions are "No"
6. **Multi-line coverage per match** — for a single football game, they'll take:
   - Win/Loss: Yes + No
   - O/U 1.5, O/U 2.5, O/U 3.5, O/U 4.5: Over + Under
   - Both Teams to Score: Yes + No
   - This creates complex hedged portfolios across correlated outcomes
7. **Entry price avg 0.569** — buying moderately priced outcomes, not cheap lottery tickets
8. **Highest bankroll** — $397K portfolio value, rank #15 globally

### The Strategy in Steps

1. Scan upcoming sports events (football, NBA, tennis) 1-3 days out
2. For each event, model expected probabilities vs Polymarket prices
3. Buy BOTH sides when the combined cost < $1.00 (guaranteed arbitrage)
4. On single-sided bets, heavily favor "No" on underdog wins (betting favorites don't win is cheap and wins often)
5. Layer O/U lines across multiple thresholds to capture value at different levels
6. For tennis, pick the perceived winner when odds are mispriced
7. Scale: run this across 100+ events simultaneously

### Current Big Bets

- $44K on Jessica Pegula (tennis) — already +$19K profit
- $27K combined on Athletic Club win market (both sides)
- $13K on Mainz vs Hamburger O/U 2.5 (both sides)
- $9.3K on Bayer Leverkusen "No" win — +$1,424

### Position Stats

- Avg entry price: 0.569 | Median: 0.550
- Cheap (<0.30): 51 | Mid (0.30-0.70): 301 | Expensive (>0.70): 148
- Total invested: $348,295

### Key insight

Swisstony is running a systematic sports arbitrage operation. With $401M lifetime volume and $4.5M profit, that's a ~1.1% edge consistently extracted across thousands of sports events.

---

## Comparison: Three Distinct Strategies

| | uncommon-oat | square-guy | swisstony |
|---|---|---|---|
| **Asset Class** | Crypto only | Crypto only | Sports only |
| **Core Approach** | Directional scalping | Hedged market-making | Sports arbitrage |
| **Hedging Rate** | 19% of markets | 68% of markets | 29% of markets |
| **Bias** | Bearish (2:1 Down) | Slightly bullish | "No" bias on wins |
| **Avg Position** | $529 | $1,090 | $697 |
| **Edge** | ~0.83% of volume | ~0.77% of volume | ~1.13% of volume |
| **Risk Level** | High (concentrated) | Medium (diversified) | Low (hedged+diversified) |

---

## Observations for Copy-Trading

1. **uncommon-oat** is the most "copyable" — clear directional bets on crypto with identifiable entry signals. But the 24% win rate means you need volume to profit.
2. **square-guy** is harder to copy profitably — the edge comes from timing both-side entries at the right moment. Copying only one side of a hedged pair loses the edge.
3. **swisstony** is nearly impossible to copy — requires deep sports knowledge, simultaneous multi-line positions, and the margin is thin (1.1%). Best observed rather than copied.

---

*Analysis generated from live Polymarket Data API on 2026-02-20*

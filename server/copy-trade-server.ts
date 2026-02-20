/**
 * Polymarket Copy-Trade Server
 *
 * Standalone Node.js server that receives trade signals from the whale-tracker
 * dashboard via WebSocket and executes copy-trades on Polymarket using the
 * CLOB client.
 *
 * Runs as a separate process from the Next.js dashboard because it needs:
 * - A private key for signing orders
 * - Persistent WebSocket connections to clients
 * - The @polymarket/clob-client package for order placement
 */

import "dotenv/config";
import { WebSocketServer, WebSocket } from "ws";
import { ethers } from "ethers";
import { ClobClient, Chain, Side, OrderType } from "@polymarket/clob-client";
import type { TickSize } from "@polymarket/clob-client/dist/types.js";
import { SignatureType } from "@polymarket/order-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TradeSignal {
  conditionId: string;
  title: string;
  outcome: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: number;
  transactionHash: string;
  walletLabel: string;
}

interface CopyTradeConfig {
  multiplier: number;
  maxSingleTrade: number;
  priceImprovementPct: number;
}

interface IncomingMessage {
  type: "copy_trade";
  trade: TradeSignal;
  config: CopyTradeConfig;
}

type OrderStatus =
  | "DETECTED"
  | "VALIDATING"
  | "SKIPPED"
  | "PLACING"
  | "FILLED"
  | "FAILED";

interface StatusMessage {
  type: "status";
  orderId: string | null;
  status: OrderStatus;
  message: string;
  reason?: string;
  error?: string;
  timestamp: number;
  walletLabel?: string;
  trade?: TradeSignal;
}

interface BalanceMessage {
  type: "balance";
  usdce: number;
  timestamp: number;
}

interface EngineMessage {
  type: "engine";
  status: "ACTIVE" | "PAUSED";
  message: string;
}

type OutgoingMessage = StatusMessage | BalanceMessage | EngineMessage;

interface ApiCreds {
  key: string;
  secret: string;
  passphrase: string;
}

// ---------------------------------------------------------------------------
// Environment & constants
// ---------------------------------------------------------------------------

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const PROXY_ADDRESS = process.env.PROXY_ADDRESS ?? "";
const SIGNATURE_TYPE_RAW = parseInt(process.env.SIGNATURE_TYPE ?? "0", 10);

const WS_PORT = 8765;
const CLOB_HOST = "https://clob.polymarket.com";
const POLYGON_RPC = "https://polygon-rpc.com";
const USDC_E_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

const MAX_TRADE_AGE_S = 60;
const MIDPOINT_FLOOR = 0.03;
const MIDPOINT_CEILING = 0.97;
const MAX_PRICE_DRIFT = 0.20; // 20 %
const MIN_USDC_ORDER = 1; // $1 minimum order value
const BALANCE_POLL_INTERVAL_MS = 30_000;
const CIRCUIT_BREAKER_POLL_MS = 60_000;
const CIRCUIT_BREAKER_THRESHOLD = 2; // $2

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

let clobClient: ClobClient | null = null;
let walletAddress = "";
let enginePaused = false;
let lastBalance = -1;
let balanceTimerId: ReturnType<typeof setInterval> | null = null;
let circuitTimerId: ReturnType<typeof setInterval> | null = null;

const clients = new Set<WebSocket>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function broadcast(msg: OutgoingMessage): void {
  const payload = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function statusMsg(
  status: OrderStatus,
  message: string,
  extra?: Partial<StatusMessage>,
): StatusMessage {
  return {
    type: "status",
    orderId: null,
    status,
    message,
    timestamp: now(),
    ...extra,
  };
}

function log(level: "INFO" | "WARN" | "ERROR", msg: string): void {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level}]`;
  if (level === "ERROR") {
    console.error(`${prefix} ${msg}`);
  } else if (level === "WARN") {
    console.warn(`${prefix} ${msg}`);
  } else {
    console.log(`${prefix} ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Balance check (raw Polygon RPC, no viem dependency)
// ---------------------------------------------------------------------------

async function fetchBalance(address: string): Promise<number> {
  const clean = address.slice(2).toLowerCase().padStart(64, "0");
  const calldata = "0x70a08231" + clean;

  const res = await fetch(POLYGON_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        { to: USDC_E_ADDRESS, data: calldata },
        "latest",
      ],
    }),
  });

  const json = (await res.json()) as { result: string };
  return parseInt(json.result, 16) / 1_000_000;
}

async function broadcastBalance(): Promise<void> {
  try {
    const bal = await fetchBalance(walletAddress);
    lastBalance = bal;
    broadcast({ type: "balance", usdce: bal, timestamp: now() });
  } catch (err) {
    log("WARN", `Balance fetch failed: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

function activateCircuitBreaker(): void {
  if (enginePaused) return;
  enginePaused = true;
  log("WARN", "Circuit breaker activated — pausing copy-trade engine");
  broadcast({
    type: "engine",
    status: "PAUSED",
    message: `Insufficient balance ($${lastBalance.toFixed(2)}), checking every 60s`,
  });

  // Stop normal balance polling
  if (balanceTimerId) {
    clearInterval(balanceTimerId);
    balanceTimerId = null;
  }

  // Start circuit breaker polling
  circuitTimerId = setInterval(async () => {
    try {
      const bal = await fetchBalance(walletAddress);
      lastBalance = bal;
      broadcast({ type: "balance", usdce: bal, timestamp: now() });

      if (bal >= CIRCUIT_BREAKER_THRESHOLD) {
        log("INFO", `Balance recovered to $${bal.toFixed(2)} — resuming engine`);
        enginePaused = false;

        if (circuitTimerId) {
          clearInterval(circuitTimerId);
          circuitTimerId = null;
        }

        // Resume normal balance polling
        balanceTimerId = setInterval(broadcastBalance, BALANCE_POLL_INTERVAL_MS);

        broadcast({
          type: "engine",
          status: "ACTIVE",
          message: `Copy-trade engine resumed (balance: $${bal.toFixed(2)})`,
        });
      }
    } catch (err) {
      log("WARN", `Circuit breaker balance check failed: ${(err as Error).message}`);
    }
  }, CIRCUIT_BREAKER_POLL_MS);
}

// ---------------------------------------------------------------------------
// Tick-size rounding
// ---------------------------------------------------------------------------

function roundToTick(price: number, tickSize: number, direction: "down"): number {
  const ticks = Math.floor(price / tickSize);
  return parseFloat((ticks * tickSize).toFixed(4));
}

function roundSize(size: number): number {
  return Math.floor(size * 100) / 100;
}

// ---------------------------------------------------------------------------
// Trade execution
// ---------------------------------------------------------------------------

async function executeCopyTrade(
  trade: TradeSignal,
  config: CopyTradeConfig,
): Promise<void> {
  const label = `[${trade.walletLabel}] ${trade.title} ${trade.outcome}`;

  const tradeExtra: Partial<StatusMessage> = { walletLabel: trade.walletLabel, trade };

  // -- DETECTED --
  broadcast(statusMsg("DETECTED", `${label} — ${trade.side} ${trade.size}@${trade.price}`, tradeExtra));
  log("INFO", `Trade detected: ${label} ${trade.side} ${trade.size}@${trade.price}`);

  // -- Engine paused? --
  if (enginePaused) {
    broadcast(
      statusMsg("SKIPPED", `${label} — engine paused (circuit breaker)`, {
        reason: "circuit_breaker",
        ...tradeExtra,
      }),
    );
    log("WARN", `Skipped (engine paused): ${label}`);
    return;
  }

  // -- VALIDATING --
  broadcast(statusMsg("VALIDATING", `${label} — checking trade validity`, tradeExtra));

  // 1. Only BUY
  if (trade.side !== "BUY") {
    broadcast(
      statusMsg("SKIPPED", `${label} — only BUY trades are copied`, {
        reason: "sell_trade",
        ...tradeExtra,
      }),
    );
    log("INFO", `Skipped (SELL): ${label}`);
    return;
  }

  // 2. Freshness
  const age = now() - trade.timestamp;
  if (age > MAX_TRADE_AGE_S) {
    broadcast(
      statusMsg("SKIPPED", `${label} — trade is ${age}s old (max ${MAX_TRADE_AGE_S}s)`, {
        reason: "stale",
        ...tradeExtra,
      }),
    );
    log("INFO", `Skipped (stale ${age}s): ${label}`);
    return;
  }

  if (!clobClient) {
    broadcast(statusMsg("FAILED", `${label} — CLOB client not initialized`, { error: "no_client", ...tradeExtra }));
    log("ERROR", "CLOB client not initialized");
    return;
  }

  // 3. Fetch market info
  let market: Awaited<ReturnType<ClobClient["getMarket"]>>;
  try {
    market = await clobClient.getMarket(trade.conditionId);
  } catch (err) {
    broadcast(
      statusMsg("FAILED", `${label} — could not fetch market`, {
        error: (err as Error).message,
        ...tradeExtra,
      }),
    );
    log("ERROR", `Market fetch failed for ${trade.conditionId}: ${(err as Error).message}`);
    return;
  }

  // 4. Market accepting orders?
  if (!market.accepting_orders) {
    broadcast(
      statusMsg("SKIPPED", `${label} — market not accepting orders`, {
        reason: "market_closed",
        ...tradeExtra,
      }),
    );
    log("INFO", `Skipped (not accepting orders): ${label}`);
    return;
  }

  // 5. Find the matching token
  const token = (market.tokens as Array<{ token_id: string; outcome: string; price: number; winner: boolean }>)
    .find((t) => t.outcome.toLowerCase() === trade.outcome.toLowerCase());

  if (!token) {
    broadcast(
      statusMsg("FAILED", `${label} — outcome "${trade.outcome}" not found in market`, {
        error: "outcome_not_found",
        ...tradeExtra,
      }),
    );
    log("ERROR", `Outcome "${trade.outcome}" not found in market ${trade.conditionId}`);
    return;
  }

  // 6. Check midpoint — skip resolved markets
  let midpointValue: number;
  try {
    const midResp = await clobClient.getMidpoint(token.token_id);
    midpointValue = parseFloat((midResp as { mid: string }).mid);
  } catch (err) {
    broadcast(
      statusMsg("FAILED", `${label} — could not fetch midpoint`, {
        error: (err as Error).message,
        ...tradeExtra,
      }),
    );
    log("ERROR", `Midpoint fetch failed: ${(err as Error).message}`);
    return;
  }

  if (midpointValue <= MIDPOINT_FLOOR || midpointValue >= MIDPOINT_CEILING) {
    broadcast(
      statusMsg("SKIPPED", `${label} — midpoint ${midpointValue} is near 0 or 1 (likely resolved)`, {
        reason: "resolved",
        ...tradeExtra,
      }),
    );
    log("INFO", `Skipped (midpoint ${midpointValue}): ${label}`);
    return;
  }

  // 7. Price drift check
  const drift = Math.abs(midpointValue - trade.price) / trade.price;
  if (drift > MAX_PRICE_DRIFT) {
    broadcast(
      statusMsg(
        "SKIPPED",
        `${label} — price drifted ${(drift * 100).toFixed(1)}% (mid=${midpointValue}, whale=${trade.price})`,
        { reason: "price_drift", ...tradeExtra },
      ),
    );
    log("INFO", `Skipped (drift ${(drift * 100).toFixed(1)}%): ${label}`);
    return;
  }

  // -- Calculate order parameters --
  const tickSizeNum = parseFloat(String(market.minimum_tick_size ?? "0.01"));
  const tickSizeStr = String(market.minimum_tick_size ?? "0.01") as TickSize;
  const minOrderSize = parseFloat(String(market.minimum_order_size ?? 0));
  const negRisk = market.neg_risk ?? false;

  // Scale size by multiplier
  let orderSize = trade.size * config.multiplier;

  // Cap by maxSingleTrade / price
  const maxSharesByUsd = config.maxSingleTrade / trade.price;
  if (orderSize > maxSharesByUsd) {
    orderSize = maxSharesByUsd;
  }

  // Apply price improvement (BUY slightly higher to fill faster)
  let orderPrice = trade.price * (1 + config.priceImprovementPct);

  // Cap price at 0.99
  if (orderPrice > 0.99) {
    orderPrice = 0.99;
  }

  // Round price down to tick size
  orderPrice = roundToTick(orderPrice, tickSizeNum, "down");

  // Round size down to 2 decimals
  orderSize = roundSize(orderSize);

  // Enforce $1 USDC minimum (size * price >= 1)
  if (orderSize * orderPrice < MIN_USDC_ORDER) {
    const minSize = Math.ceil((MIN_USDC_ORDER / orderPrice) * 100) / 100;
    orderSize = minSize;
  }

  // Enforce market minimum_order_size
  if (orderSize < minOrderSize) {
    orderSize = Math.ceil(minOrderSize * 100) / 100;
  }

  // Final sanity check
  if (orderSize <= 0 || orderPrice <= 0) {
    broadcast(
      statusMsg("SKIPPED", `${label} — calculated size or price is zero`, {
        reason: "zero_order",
        ...tradeExtra,
      }),
    );
    log("WARN", `Skipped (zero order): size=${orderSize}, price=${orderPrice}`);
    return;
  }

  // -- PLACING --
  broadcast(
    statusMsg(
      "PLACING",
      `${label} — BUY ${orderSize}@${orderPrice} (whale: ${trade.size}@${trade.price})`,
      tradeExtra,
    ),
  );
  log(
    "INFO",
    `Placing order: BUY ${orderSize}@${orderPrice} token=${token.token_id} tick=${tickSizeStr} negRisk=${negRisk}`,
  );

  try {
    const resp = await clobClient.createAndPostOrder(
      {
        tokenID: token.token_id,
        price: orderPrice,
        side: Side.BUY,
        size: orderSize,
      },
      { tickSize: tickSizeStr, negRisk },
      OrderType.GTC,
    );

    if (resp.success) {
      broadcast(
        statusMsg("FILLED", `${label} — order placed: ${orderSize}@${orderPrice}`, {
          orderId: resp.orderID ?? null,
          ...tradeExtra,
        }),
      );
      log("INFO", `Order placed successfully: ${resp.orderID ?? "no-id"}`);
    } else {
      const errMsg = (resp as Record<string, unknown>).status
        ? String((resp as Record<string, unknown>).status)
        : "unknown error";
      broadcast(
        statusMsg("FAILED", `${label} — order rejected: ${errMsg}`, {
          error: errMsg,
          ...tradeExtra,
        }),
      );
      log("ERROR", `Order rejected: ${errMsg}`);

      // Check if it's a balance error
      if (errMsg.toLowerCase().includes("balance") || errMsg.toLowerCase().includes("insufficient")) {
        activateCircuitBreaker();
      }
    }
  } catch (err) {
    const errMsg = (err as Error).message;
    broadcast(
      statusMsg("FAILED", `${label} — order error: ${errMsg}`, {
        error: errMsg,
        ...tradeExtra,
      }),
    );
    log("ERROR", `Order execution error: ${errMsg}`);

    // Check if it's a balance error
    if (errMsg.toLowerCase().includes("balance") || errMsg.toLowerCase().includes("insufficient")) {
      activateCircuitBreaker();
    }
  }
}

// ---------------------------------------------------------------------------
// CLOB client initialization
// ---------------------------------------------------------------------------

async function initClobClient(): Promise<void> {
  if (!PRIVATE_KEY) {
    log("WARN", "PRIVATE_KEY not set — server will start but cannot place orders");
    return;
  }

  try {
    const wallet = new ethers.Wallet(PRIVATE_KEY);
    walletAddress = PROXY_ADDRESS || wallet.address;

    log("INFO", `Wallet: ${wallet.address}`);
    log("INFO", `Proxy/Funder: ${walletAddress}`);

    // Derive API credentials
    const tempClient = new ClobClient(CLOB_HOST, Chain.POLYGON, wallet);
    const creds = (await tempClient.createOrDeriveApiKey()) as ApiCreds;
    log("INFO", "API credentials derived successfully");

    // Resolve signature type
    let sigType: SignatureType;
    switch (SIGNATURE_TYPE_RAW) {
      case 1:
        sigType = SignatureType.POLY_PROXY;
        break;
      case 2:
        sigType = SignatureType.POLY_GNOSIS_SAFE;
        break;
      default:
        sigType = SignatureType.EOA;
    }

    // Full client with credentials
    clobClient = new ClobClient(
      CLOB_HOST,
      Chain.POLYGON,
      wallet,
      creds,
      sigType,
      PROXY_ADDRESS || undefined,
    );

    log("INFO", "CLOB client initialized");

    // Fetch initial balance
    const bal = await fetchBalance(walletAddress);
    lastBalance = bal;
    log("INFO", `USDC.e balance: $${bal.toFixed(2)}`);

    if (bal < CIRCUIT_BREAKER_THRESHOLD) {
      activateCircuitBreaker();
    }
  } catch (err) {
    log("ERROR", `CLOB client init failed: ${(err as Error).message}`);
    log("WARN", "Server running without order execution capability");
  }
}

// ---------------------------------------------------------------------------
// WebSocket message handler
// ---------------------------------------------------------------------------

function handleMessage(ws: WebSocket, raw: string): void {
  let parsed: IncomingMessage;
  try {
    parsed = JSON.parse(raw) as IncomingMessage;
  } catch {
    log("WARN", `Invalid JSON received: ${raw.slice(0, 200)}`);
    return;
  }

  if (parsed.type !== "copy_trade") {
    log("WARN", `Unknown message type: ${parsed.type}`);
    return;
  }

  if (!parsed.trade || !parsed.config) {
    log("WARN", "Message missing trade or config");
    return;
  }

  // Validate config ranges
  const config = parsed.config;
  config.multiplier = Math.max(0.01, Math.min(10, config.multiplier || 0.5));
  config.maxSingleTrade = Math.max(0.5, Math.min(10000, config.maxSingleTrade || 1));
  config.priceImprovementPct = Math.max(0, Math.min(0.10, config.priceImprovementPct || 0.02));

  // Validate trade fields
  const trade = parsed.trade;
  if (!trade.conditionId || !trade.outcome || !trade.side ||
      !isFinite(trade.price) || trade.price <= 0 ||
      !isFinite(trade.size) || trade.size <= 0) {
    log("WARN", "Invalid trade data received");
    return;
  }

  // Fire and forget — don't block the WS handler
  executeCopyTrade(trade, config).catch((err) => {
    log("ERROR", `Unhandled error in executeCopyTrade: ${(err as Error).message}`);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log("INFO", "=== Polymarket Copy-Trade Server ===");

  // Initialize CLOB client (non-blocking if no key)
  await initClobClient();

  // Start WebSocket server
  const wss = new WebSocketServer({ port: WS_PORT });

  wss.on("listening", () => {
    log("INFO", `WebSocket server listening on ws://localhost:${WS_PORT}`);
    broadcast({
      type: "engine",
      status: enginePaused ? "PAUSED" : "ACTIVE",
      message: enginePaused
        ? "Copy-trade engine paused (insufficient balance)"
        : "Copy-trade engine running",
    });
  });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://localhost:${WS_PORT}`);
    const token = url.searchParams.get("token");
    const expectedToken = process.env.WS_AUTH_TOKEN;

    if (expectedToken && token !== expectedToken) {
      ws.close(4001, "Unauthorized");
      log("WARN", `Rejected connection: invalid token`);
      return;
    }

    const remote = req.socket.remoteAddress ?? "unknown";
    log("INFO", `Client connected from ${remote}`);
    clients.add(ws);

    // Send current state to the new client
    ws.send(
      JSON.stringify({
        type: "engine",
        status: enginePaused ? "PAUSED" : "ACTIVE",
        message: enginePaused
          ? "Copy-trade engine paused (insufficient balance)"
          : "Copy-trade engine running",
      } satisfies EngineMessage),
    );

    if (lastBalance >= 0) {
      ws.send(
        JSON.stringify({
          type: "balance",
          usdce: lastBalance,
          timestamp: now(),
        } satisfies BalanceMessage),
      );
    }

    ws.on("message", (data) => {
      handleMessage(ws, data.toString());
    });

    ws.on("close", () => {
      clients.delete(ws);
      log("INFO", `Client disconnected (${remote})`);
    });

    ws.on("error", (err) => {
      log("ERROR", `WebSocket error from ${remote}: ${err.message}`);
      clients.delete(ws);
    });
  });

  // Start balance polling (every 30s) if we have a wallet
  if (walletAddress && !enginePaused) {
    balanceTimerId = setInterval(broadcastBalance, BALANCE_POLL_INTERVAL_MS);
  }

  // Graceful shutdown
  const shutdown = (): void => {
    log("INFO", "Shutting down...");

    if (balanceTimerId) clearInterval(balanceTimerId);
    if (circuitTimerId) clearInterval(circuitTimerId);

    for (const ws of clients) {
      ws.close(1001, "Server shutting down");
    }
    clients.clear();

    wss.close(() => {
      log("INFO", "Server stopped");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log("ERROR", `Fatal: ${(err as Error).message}`);
  process.exit(1);
});

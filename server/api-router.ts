/**
 * Express router with all REST API endpoints.
 * Mounted at /api/v1 on the HTTP server.
 */

import { Router, type Request, type Response } from "express";
import {
  fetchPositionsDirect,
  fetchBalanceDirect,
  fetchLeaderboardDirect,
  fetchPortfolioValueDirect,
  fetchMarketMetadata,
} from "./polymarket-api-direct";
import { parsePosition } from "../lib/shared/parse";
import {
  filterTrades,
  filterPositions,
  parseTradeFilterFromQuery,
  parsePositionFilterFromQuery,
} from "../lib/shared/filters";
import { getAllKnownTags } from "../lib/shared/tags";
import type { TradeCache } from "./trade-cache";
import type { TagStore } from "./tag-store";
import type { PresetStore } from "./preset-store";
import type { ServerRtdsClient } from "./rtds-client";

// Express 5 params can be string | string[]; this helper normalizes.
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : String(val ?? "");
}

// ---------------------------------------------------------------------------
// Shared server state (injected at creation)
// ---------------------------------------------------------------------------

export interface ApiDeps {
  tradeCache: TradeCache;
  tagStore: TagStore;
  presetStore: PresetStore;
  rtdsClient: ServerRtdsClient;
  getTrackedWallets: () => Array<{ address: string; label: string }>;
  getEngineState: () => {
    paused: boolean;
    balance: number;
    walletAddress: string;
  };
  getOrderHistory: () => Array<Record<string, unknown>>;
}

export function createApiRouter(deps: ApiDeps): Router {
  const router = Router();

  // -----------------------------------------------------------------------
  // GET /wallets — list tracked wallets
  // -----------------------------------------------------------------------
  router.get("/wallets", (_req: Request, res: Response) => {
    res.json(deps.getTrackedWallets());
  });

  // -----------------------------------------------------------------------
  // GET /trades — filtered trades from cache + optional historical
  // -----------------------------------------------------------------------
  router.get("/trades", async (req: Request, res: Response) => {
    try {
      const params = new URL(req.url, "http://localhost").searchParams;
      const walletsParam = params.get("wallets");
      const wallets = walletsParam
        ? walletsParam.split(",").map((w) => w.trim().toLowerCase())
        : deps.getTrackedWallets().map((w) => w.address.toLowerCase());

      // Get trades from cache
      let trades = deps.tradeCache.getMultiple(wallets);

      // Apply filters
      const filter = parseTradeFilterFromQuery(params);
      const tagOverrides = deps.tagStore.getAll();
      trades = filterTrades(trades, filter, tagOverrides);

      // Limit results
      const limit = parseInt(params.get("limit") ?? "100", 10);
      if (trades.length > limit) {
        trades = trades.slice(0, limit);
      }

      res.json(trades);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // -----------------------------------------------------------------------
  // GET /positions/:wallet — filtered positions (live from Data API)
  // -----------------------------------------------------------------------
  router.get("/positions/:wallet", async (req: Request, res: Response) => {
    try {
      const wallet = param(req, "wallet");
      const params = new URL(req.url, "http://localhost").searchParams;

      const rawPositions = await fetchPositionsDirect(wallet);
      let positions = rawPositions
        .map(parsePosition)
        .filter((p) => p.size > 0.01);

      // Apply filters
      const filter = parsePositionFilterFromQuery(params);
      const tagOverrides = deps.tagStore.getAll();
      positions = filterPositions(positions, filter, tagOverrides);

      res.json(positions);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // -----------------------------------------------------------------------
  // GET /balance/:wallet — USDC.e balance
  // -----------------------------------------------------------------------
  router.get("/balance/:wallet", async (req: Request, res: Response) => {
    try {
      const wallet = param(req, "wallet");
      const balance = await fetchBalanceDirect(wallet);
      res.json({ address: wallet, balance });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // -----------------------------------------------------------------------
  // GET /leaderboard/:wallet — leaderboard stats
  // -----------------------------------------------------------------------
  router.get("/leaderboard/:wallet", async (req: Request, res: Response) => {
    try {
      const wallet = param(req, "wallet");
      const data = await fetchLeaderboardDirect(wallet);
      if (!data) {
        res.status(404).json({ error: "Wallet not found on leaderboard" });
        return;
      }
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // -----------------------------------------------------------------------
  // GET /portfolio-value/:wallet — portfolio value
  // -----------------------------------------------------------------------
  router.get(
    "/portfolio-value/:wallet",
    async (req: Request, res: Response) => {
      try {
        const wallet = param(req, "wallet");
        const value = await fetchPortfolioValueDirect(wallet);
        res.json({ address: wallet, value });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  // -----------------------------------------------------------------------
  // GET /status — system status
  // -----------------------------------------------------------------------
  router.get("/status", (_req: Request, res: Response) => {
    const engine = deps.getEngineState();
    const cacheStats = deps.tradeCache.stats();
    res.json({
      engine: {
        status: engine.paused ? "PAUSED" : "ACTIVE",
        balance: engine.balance,
        walletAddress: engine.walletAddress,
      },
      rtds: {
        connected: deps.rtdsClient.isConnected(),
      },
      cache: cacheStats,
      trackedWallets: deps.getTrackedWallets().length,
    });
  });

  // -----------------------------------------------------------------------
  // GET /orders — copy-trade order history
  // -----------------------------------------------------------------------
  router.get("/orders", (req: Request, res: Response) => {
    const params = new URL(req.url, "http://localhost").searchParams;
    let orders = deps.getOrderHistory();

    const status = params.get("status");
    if (status) {
      orders = orders.filter((o) => o.status === status);
    }

    const walletLabel = params.get("walletLabel");
    if (walletLabel) {
      orders = orders.filter((o) => o.walletLabel === walletLabel);
    }

    res.json(orders);
  });

  // -----------------------------------------------------------------------
  // GET /tags — all known tags + overrides
  // -----------------------------------------------------------------------
  router.get("/tags", (_req: Request, res: Response) => {
    // Gather all titles from cached trades
    const titles: string[] = [];
    for (const wallet of deps.tradeCache.wallets()) {
      for (const trade of deps.tradeCache.get(wallet)) {
        titles.push(trade.title);
      }
    }

    const overrides = deps.tagStore.getAll();
    const allTags = getAllKnownTags(titles, overrides);

    res.json({
      tags: allTags,
      overrides: deps.tagStore.getAllArray(),
    });
  });

  // -----------------------------------------------------------------------
  // PUT /tags/:conditionId — set manual tag override
  // -----------------------------------------------------------------------
  router.put("/tags/:conditionId", (req: Request, res: Response) => {
    const conditionId = param(req, "conditionId");
    const { addTags, removeTags } = req.body as {
      addTags?: string[];
      removeTags?: string[];
    };

    deps.tagStore.set(conditionId, addTags ?? [], removeTags ?? []);

    res.json({
      conditionId,
      override: deps.tagStore.get(conditionId),
    });
  });

  // -----------------------------------------------------------------------
  // GET /presets — list saved filter presets
  // -----------------------------------------------------------------------
  router.get("/presets", (_req: Request, res: Response) => {
    res.json(deps.presetStore.getAll());
  });

  // -----------------------------------------------------------------------
  // PUT /presets/:id — create/update preset
  // -----------------------------------------------------------------------
  router.put("/presets/:id", (req: Request, res: Response) => {
    const id = param(req, "id");
    const preset = { ...req.body, id };
    deps.presetStore.set(preset);
    res.json(preset);
  });

  // -----------------------------------------------------------------------
  // DELETE /presets/:id — delete preset
  // -----------------------------------------------------------------------
  router.delete("/presets/:id", (req: Request, res: Response) => {
    const id = param(req, "id");
    const deleted = deps.presetStore.delete(id);
    if (!deleted) {
      res.status(404).json({ error: "Preset not found" });
      return;
    }
    res.json({ deleted: true });
  });

  // -----------------------------------------------------------------------
  // GET /market/:conditionId — market metadata
  // -----------------------------------------------------------------------
  router.get("/market/:conditionId", async (req: Request, res: Response) => {
    try {
      const conditionId = param(req, "conditionId");
      const data = await fetchMarketMetadata(conditionId);
      if (!data) {
        res.status(404).json({ error: "Market not found" });
        return;
      }
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}

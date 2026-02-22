import type { Trade, Position } from "./types";
import { detectTags, type TagOverride, resolveTags } from "./tags";
import { parseCloseTimeFromTitle } from "./format";

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

export type TradeSortField = "time" | "endTime" | "size" | "price" | "title";
export type PositionSortField = "marketValue" | "endDate" | "unrealizedPnl" | "percentPnl";
export type SortDirection = "asc" | "desc";

export interface TradeSort {
  field: TradeSortField;
  direction: SortDirection;
}

export interface PositionSort {
  field: PositionSortField;
  direction: SortDirection;
}

export const DEFAULT_TRADE_SORT: TradeSort = { field: "time", direction: "desc" };
export const DEFAULT_POSITION_SORT: PositionSort = { field: "marketValue", direction: "desc" };

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface TradeFilter {
  side?: ("BUY" | "SELL")[];
  minSize?: number;
  maxSize?: number;
  minPrice?: number;
  maxPrice?: number;
  titleSearch?: string;
  outcome?: string;
  tags?: string[];
  source?: ("WS" | "POLL")[];
  since?: number;
  until?: number;
  conditionId?: string;
}

export interface PositionFilter {
  status?: string[];                 // "open" | "resolving" | "won" | "lost"
  minShares?: number;
  maxShares?: number;
  minValue?: number;
  maxValue?: number;
  minPnl?: number;
  maxPnl?: number;
  minReturn?: number;
  maxReturn?: number;
  titleSearch?: string;
  tags?: string[];
  conditionId?: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  scope: "trades" | "positions";
  filters: TradeFilter | PositionFilter;
  wallets?: string[];
}

// ---------------------------------------------------------------------------
// Position status helper (matching format.ts logic without className)
// ---------------------------------------------------------------------------

function positionStatusLabel(redeemable: boolean, curPrice: number, title: string): string {
  if (!redeemable) {
    const closeTime = parseCloseTimeFromTitle(title);
    if (closeTime) {
      const end = new Date(closeTime).getTime();
      if (!isNaN(end) && end < Date.now()) return "resolving";
    }
    return "open";
  }
  if (curPrice >= 0.95) return "won";
  if (curPrice <= 0.05) return "lost";
  return "resolving";
}

// ---------------------------------------------------------------------------
// Filter application
// ---------------------------------------------------------------------------

export function filterTrades(
  trades: Trade[],
  filter: TradeFilter,
  tagOverrides?: Map<string, TagOverride>,
): Trade[] {
  return trades.filter((t) => {
    if (filter.side?.length && !filter.side.includes(t.side)) return false;

    if (filter.minSize !== undefined && t.size < filter.minSize) return false;
    if (filter.maxSize !== undefined && t.size > filter.maxSize) return false;

    if (filter.minPrice !== undefined && t.price < filter.minPrice) return false;
    if (filter.maxPrice !== undefined && t.price > filter.maxPrice) return false;

    if (filter.titleSearch) {
      const search = filter.titleSearch.toLowerCase();
      if (!t.title.toLowerCase().includes(search)) return false;
    }

    if (filter.outcome) {
      const search = filter.outcome.toLowerCase();
      if (!t.outcome.toLowerCase().includes(search)) return false;
    }

    if (filter.source?.length && !filter.source.includes(t.source)) return false;

    if (filter.since !== undefined && t.timestamp < filter.since) return false;
    if (filter.until !== undefined && t.timestamp > filter.until) return false;

    if (filter.conditionId && t.conditionId !== filter.conditionId) return false;

    if (filter.tags?.length) {
      const override = tagOverrides?.get(t.conditionId);
      const tradeTags = override
        ? resolveTags(t.title, override)
        : detectTags(t.title);
      if (!filter.tags.some((ft) => tradeTags.includes(ft))) return false;
    }

    return true;
  });
}

export function filterPositions(
  positions: Position[],
  filter: PositionFilter,
  tagOverrides?: Map<string, TagOverride>,
): Position[] {
  return positions.filter((p) => {
    if (filter.status?.length) {
      const label = positionStatusLabel(p.redeemable, p.curPrice, p.title);
      if (!filter.status.includes(label)) return false;
    }

    if (filter.minShares !== undefined && p.size < filter.minShares) return false;
    if (filter.maxShares !== undefined && p.size > filter.maxShares) return false;

    if (filter.minValue !== undefined && p.marketValue < filter.minValue) return false;
    if (filter.maxValue !== undefined && p.marketValue > filter.maxValue) return false;

    if (filter.minPnl !== undefined && p.unrealizedPnl < filter.minPnl) return false;
    if (filter.maxPnl !== undefined && p.unrealizedPnl > filter.maxPnl) return false;

    if (filter.minReturn !== undefined && p.percentPnl < filter.minReturn) return false;
    if (filter.maxReturn !== undefined && p.percentPnl > filter.maxReturn) return false;

    if (filter.titleSearch) {
      const search = filter.titleSearch.toLowerCase();
      if (!p.title.toLowerCase().includes(search)) return false;
    }

    if (filter.conditionId && p.conditionId !== filter.conditionId) return false;

    if (filter.tags?.length) {
      const override = tagOverrides?.get(p.conditionId);
      const posTags = override
        ? resolveTags(p.title, override)
        : detectTags(p.title);
      if (!filter.tags.some((ft) => posTags.includes(ft))) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Sort application
// ---------------------------------------------------------------------------

function parseEndTimeMs(title: string): number {
  const ct = parseCloseTimeFromTitle(title);
  if (!ct) return 0;
  const t = new Date(ct).getTime();
  return isNaN(t) ? 0 : t;
}

export function sortTrades(trades: Trade[], sort: TradeSort): Trade[] {
  return [...trades].sort((a, b) => {
    let cmp = 0;
    switch (sort.field) {
      case "time":
        cmp = a.timestamp - b.timestamp;
        break;
      case "endTime":
        cmp = parseEndTimeMs(a.title) - parseEndTimeMs(b.title);
        break;
      case "size":
        cmp = a.size - b.size;
        break;
      case "price":
        cmp = a.price - b.price;
        break;
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
    }
    return sort.direction === "desc" ? -cmp : cmp;
  });
}

function parseEndDateMs(
  pos: Position,
  endDateOverrides?: Record<string, string>,
): number {
  // 1. Gamma API endDate override (most accurate — per-market with time)
  if (endDateOverrides && pos.slug && endDateOverrides[pos.slug]) {
    const t = new Date(endDateOverrides[pos.slug]).getTime();
    if (!isNaN(t)) return t;
  }
  // 2. Parse close time from title (includes actual time, e.g. "3PM ET")
  const ct = parseCloseTimeFromTitle(pos.title);
  if (ct) {
    const t = new Date(ct).getTime();
    if (!isNaN(t)) return t;
  }
  // 3. Fall back to event-level endDate from position data (date only, no time)
  if (!pos.endDate) return 0;
  const t = new Date(pos.endDate).getTime();
  return isNaN(t) ? 0 : t;
}

export function sortPositions(
  positions: Position[],
  sort: PositionSort,
  endDateOverrides?: Record<string, string>,
): Position[] {
  return [...positions].sort((a, b) => {
    let cmp = 0;
    switch (sort.field) {
      case "marketValue":
        cmp = a.marketValue - b.marketValue;
        break;
      case "endDate": {
        const aMs = parseEndDateMs(a, endDateOverrides);
        const bMs = parseEndDateMs(b, endDateOverrides);
        // Push positions without any end date to the bottom
        if (aMs === 0 && bMs === 0) cmp = 0;
        else if (aMs === 0) cmp = sort.direction === "desc" ? 1 : -1;
        else if (bMs === 0) cmp = sort.direction === "desc" ? -1 : 1;
        else cmp = aMs - bMs;
        break;
      }
      case "unrealizedPnl":
        cmp = a.unrealizedPnl - b.unrealizedPnl;
        break;
      case "percentPnl":
        cmp = a.percentPnl - b.percentPnl;
        break;
    }
    return sort.direction === "desc" ? -cmp : cmp;
  });
}

// ---------------------------------------------------------------------------
// Query string parsing (for REST API)
// ---------------------------------------------------------------------------

function splitComma(val: string | null): string[] {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseNum(val: string | null): number | undefined {
  if (!val) return undefined;
  const n = parseFloat(val);
  return isFinite(n) ? n : undefined;
}

export function parseTradeFilterFromQuery(params: URLSearchParams): TradeFilter {
  const filter: TradeFilter = {};

  const sides = splitComma(params.get("side"));
  if (sides.length) filter.side = sides as ("BUY" | "SELL")[];

  filter.minSize = parseNum(params.get("minSize"));
  filter.maxSize = parseNum(params.get("maxSize"));
  filter.minPrice = parseNum(params.get("minPrice"));
  filter.maxPrice = parseNum(params.get("maxPrice"));

  const titleSearch = params.get("titleSearch");
  if (titleSearch) filter.titleSearch = titleSearch;

  const outcome = params.get("outcome");
  if (outcome) filter.outcome = outcome;

  const tags = splitComma(params.get("tags"));
  if (tags.length) filter.tags = tags;

  const sources = splitComma(params.get("source"));
  if (sources.length) filter.source = sources as ("WS" | "POLL")[];

  filter.since = parseNum(params.get("since"));
  filter.until = parseNum(params.get("until"));

  const conditionId = params.get("conditionId");
  if (conditionId) filter.conditionId = conditionId;

  return filter;
}

const VALID_TRADE_SORT_FIELDS: TradeSortField[] = ["time", "endTime", "size", "price", "title"];

export function parseTradeSortFromQuery(params: URLSearchParams): TradeSort {
  const field = params.get("sortBy") as TradeSortField | null;
  const dir = params.get("sortDir") as SortDirection | null;
  return {
    field: field && VALID_TRADE_SORT_FIELDS.includes(field) ? field : DEFAULT_TRADE_SORT.field,
    direction: dir === "asc" || dir === "desc" ? dir : DEFAULT_TRADE_SORT.direction,
  };
}

export function parsePositionFilterFromQuery(params: URLSearchParams): PositionFilter {
  const filter: PositionFilter = {};

  const statuses = splitComma(params.get("status"));
  if (statuses.length) filter.status = statuses;

  filter.minShares = parseNum(params.get("minShares"));
  filter.maxShares = parseNum(params.get("maxShares"));
  filter.minValue = parseNum(params.get("minValue"));
  filter.maxValue = parseNum(params.get("maxValue"));
  filter.minPnl = parseNum(params.get("minPnl"));
  filter.maxPnl = parseNum(params.get("maxPnl"));
  filter.minReturn = parseNum(params.get("minReturn"));
  filter.maxReturn = parseNum(params.get("maxReturn"));

  const titleSearch = params.get("titleSearch");
  if (titleSearch) filter.titleSearch = titleSearch;

  const tags = splitComma(params.get("tags"));
  if (tags.length) filter.tags = tags;

  const conditionId = params.get("conditionId");
  if (conditionId) filter.conditionId = conditionId;

  return filter;
}

const VALID_POSITION_SORT_FIELDS: PositionSortField[] = ["marketValue", "endDate", "unrealizedPnl", "percentPnl"];

export function parsePositionSortFromQuery(params: URLSearchParams): PositionSort {
  const field = params.get("sortBy") as PositionSortField | null;
  const dir = params.get("sortDir") as SortDirection | null;
  return {
    field: field && VALID_POSITION_SORT_FIELDS.includes(field) ? field : DEFAULT_POSITION_SORT.field,
    direction: dir === "asc" || dir === "desc" ? dir : DEFAULT_POSITION_SORT.direction,
  };
}

// ---------------------------------------------------------------------------
// Market close time parser
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/**
 * Parse the actual market close time from the title.
 * Titles follow patterns like:
 *   "Bitcoin Up or Down - February 20, 3PM ET"
 *   "Bitcoin Up or Down - February 20, 4:15PM-4:30PM ET"
 * For ranges, the end time is the close time.
 * Returns an ISO string or null if unparseable.
 */
export function parseCloseTimeFromTitle(title: string): string | null {
  const m = title.match(
    /(\w+)\s+(\d{1,2}),\s*(\d{1,2}(?::\d{2})?)(AM|PM)(?:\s*-\s*(\d{1,2}(?::\d{2})?)(AM|PM))?\s*(ET|EST|EDT)/i,
  );
  if (!m) return null;

  const monthIdx = MONTH_MAP[m[1].toLowerCase()];
  if (monthIdx === undefined) return null;
  const day = parseInt(m[2]);

  // Use the end time if range, otherwise the single time
  const timeStr = m[5] ?? m[3];
  const ampm = (m[6] ?? m[4]).toUpperCase();

  const timeParts = timeStr.split(":");
  let hour = parseInt(timeParts[0]);
  const minute = timeParts.length > 1 ? parseInt(timeParts[1]) : 0;

  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  // ET offset: EST = UTC-5, EDT = UTC-4
  const tz = (m[7] ?? "ET").toUpperCase();
  const utcOffset = tz === "EDT" ? 4 : 5;

  const year = new Date().getFullYear();
  const utcMs = Date.UTC(year, monthIdx, day, hour + utcOffset, minute);
  return new Date(utcMs).toISOString();
}

// ---------------------------------------------------------------------------
// Date/time formatters
// ---------------------------------------------------------------------------

const TZ = "America/Sao_Paulo";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: TZ,
});

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TZ,
});

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function makeUsdFmt(decimals: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function makeNumFmt(decimals: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** "14:23:45" in GMT-3 */
export function formatTime(timestamp: number): string {
  return timeFmt.format(new Date(timestamp * 1000));
}

/** "14:23:45 (2m ago)" in GMT-3 */
export function formatTimeWithAge(timestamp: number, now: number): string {
  const time = timeFmt.format(new Date(timestamp * 1000));
  const diffS = Math.max(0, Math.floor((now - timestamp * 1000) / 1000));

  let age: string;
  if (diffS < 60) age = `${diffS}s ago`;
  else if (diffS < 3600) age = `${Math.floor(diffS / 60)}m ago`;
  else age = `${Math.floor(diffS / 3600)}h ago`;

  return `${time} (${age})`;
}

/** "Feb 20, 14:23" in GMT-3 */
export function formatDateTime(timestamp: number): string {
  return dateTimeFmt.format(new Date(timestamp * 1000));
}

/** "$1,234.50" */
export function formatUSD(value: number, decimals?: number): string {
  if (decimals !== undefined && decimals !== 2) {
    return makeUsdFmt(decimals).format(value);
  }
  return usdFmt.format(value);
}

/** "119,066,610.25" */
export function formatNumber(value: number, decimals: number = 2): string {
  return makeNumFmt(decimals).format(value);
}

/** "0.653" for prediction market prices */
export function formatPrice(value: number): string {
  return value.toFixed(3);
}

/**
 * Polymarket-consistent position status label.
 * - Open: market still accepting orders (closeTime in future or unknown)
 * - Resolving: market closed (closeTime passed) but not yet resolved, OR redeemable with ambiguous price
 * - Won: market resolved, this outcome won (curPrice ~= 1.0)
 * - Lost: market resolved, this outcome lost (curPrice ~= 0.0)
 *
 * @param closeTime — the actual market close time (ISO string), parsed from title or API.
 *   Do NOT pass the event-level endDate from the positions API (it's the same for all sub-markets).
 */
export function positionStatus(redeemable: boolean, curPrice: number, closeTime?: string): {
  label: string;
  className: string;
} {
  if (!redeemable) {
    if (closeTime) {
      const end = new Date(closeTime).getTime();
      if (!isNaN(end) && end < Date.now()) {
        return {
          label: "Resolving",
          className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        };
      }
    }
    return {
      label: "Open",
      className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    };
  }
  if (curPrice >= 0.95) {
    return {
      label: "Won",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    };
  }
  if (curPrice <= 0.05) {
    return {
      label: "Lost",
      className: "border-red-500/30 bg-red-500/10 text-red-400",
    };
  }
  return {
    label: "Resolving",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  };
}

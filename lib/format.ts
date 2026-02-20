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

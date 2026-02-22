/**
 * Parse predicted price threshold from a Polymarket directional market title or description.
 *
 * Examples:
 *   "Will Bitcoin be above $97,500 on February 20?" → 97500
 *   "Bitcoin Up or Down - Feb 20, 3PM ET — $98,000 threshold" → 98000
 *   "Will ETH be above $2,750.50 at 3PM ET?" → 2750.50
 */

const PRICE_PATTERN = /\$([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]+)?)/g;

/**
 * Extract the price threshold from a market description or title.
 * Returns the first dollar amount found, or null if none.
 */
export function parsePriceThreshold(text: string): number | null {
  const matches = text.matchAll(PRICE_PATTERN);
  for (const match of matches) {
    const raw = match[1].replace(/,/g, "");
    const value = parseFloat(raw);
    if (!isNaN(value) && value > 0) {
      return value;
    }
  }
  return null;
}


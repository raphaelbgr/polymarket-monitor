// ---------------------------------------------------------------------------
// Auto-detection keyword map
// ---------------------------------------------------------------------------

const KEYWORD_TAG_MAP: Record<string, string[]> = {
  // Crypto
  bitcoin: ["crypto", "btc"],
  btc: ["crypto", "btc"],
  ethereum: ["crypto", "eth"],
  eth: ["crypto", "eth"],
  solana: ["crypto", "sol"],
  xrp: ["crypto", "xrp"],
  dogecoin: ["crypto", "doge"],
  doge: ["crypto", "doge"],
  crypto: ["crypto"],
  blockchain: ["crypto"],

  // Politics
  trump: ["politics"],
  biden: ["politics"],
  election: ["politics"],
  president: ["politics"],
  congress: ["politics"],
  senate: ["politics"],
  democrat: ["politics"],
  republican: ["politics"],
  governor: ["politics"],
  vote: ["politics"],
  primary: ["politics"],

  // Sports
  nba: ["sports", "basketball"],
  nfl: ["sports", "football"],
  mlb: ["sports", "baseball"],
  nhl: ["sports", "hockey"],
  soccer: ["sports", "soccer"],
  premier: ["sports", "soccer"],
  "champions league": ["sports", "soccer"],
  ufc: ["sports", "mma"],
  tennis: ["sports", "tennis"],
  "super bowl": ["sports"],
  "superbowl": ["sports"],
  playoff: ["sports"],
  championship: ["sports"],

  // Market structure
  "up or down": ["directional"],
  "above or below": ["directional"],
  "higher or lower": ["directional"],
  "over or under": ["directional"],
  "5-minute": ["short-term"],
  "5 minute": ["short-term"],
  "1-minute": ["short-term"],
  "1 minute": ["short-term"],
  "hourly": ["short-term"],
  "daily": ["medium-term"],
  "weekly": ["medium-term"],
  "monthly": ["long-term"],

  // Economy / Finance
  "fed": ["economy"],
  "interest rate": ["economy"],
  "inflation": ["economy"],
  "gdp": ["economy"],
  "stock market": ["economy", "stocks"],
  "stock price": ["economy", "stocks"],
  "s&p": ["economy", "stocks"],
  "nasdaq": ["economy", "stocks"],
  "dow jones": ["economy", "stocks"],

  // Entertainment
  "oscar": ["entertainment"],
  "grammy": ["entertainment"],
  "emmy": ["entertainment"],
  "movie": ["entertainment"],
  "box office": ["entertainment"],

  // Science / Tech
  "ai": ["tech"],
  "spacex": ["tech", "space"],
  "nasa": ["tech", "space"],
  "launch": ["tech", "space"],

  // Weather
  "hurricane": ["weather"],
  "temperature": ["weather"],
  "weather": ["weather"],
};

// Sort keywords by length (longest first) for greedy matching
const SORTED_KEYWORDS = Object.keys(KEYWORD_TAG_MAP).sort(
  (a, b) => b.length - a.length,
);

/**
 * Auto-detect tags from a market title.
 * Scans the title against the keyword map and returns unique tags.
 */
export function detectTags(title: string): string[] {
  const lower = title.toLowerCase();
  const tags = new Set<string>();

  for (const keyword of SORTED_KEYWORDS) {
    if (lower.includes(keyword)) {
      for (const tag of KEYWORD_TAG_MAP[keyword]) {
        tags.add(tag);
      }
    }
  }

  return Array.from(tags);
}

// ---------------------------------------------------------------------------
// Manual overrides
// ---------------------------------------------------------------------------

export interface TagOverride {
  conditionId: string;
  addTags: string[];
  removeTags: string[];
}

/**
 * Resolve final tags for a market by combining auto-detected tags with manual overrides.
 * finalTags = (autoDetected - removeTags) + addTags
 */
export function resolveTags(
  title: string,
  override?: TagOverride,
): string[] {
  const auto = detectTags(title);

  if (!override) return auto;

  const removeSet = new Set(override.removeTags);
  const filtered = auto.filter((t) => !removeSet.has(t));
  const addSet = new Set(override.addTags);

  // Add manual tags that aren't already present
  for (const tag of addSet) {
    if (!filtered.includes(tag)) {
      filtered.push(tag);
    }
  }

  return filtered;
}

/**
 * Get all unique tags that exist across a set of titles + overrides.
 */
export function getAllKnownTags(
  titles: string[],
  overrides: Map<string, TagOverride>,
): string[] {
  const all = new Set<string>();

  for (const title of titles) {
    for (const tag of detectTags(title)) {
      all.add(tag);
    }
  }

  for (const override of overrides.values()) {
    for (const tag of override.addTags) {
      all.add(tag);
    }
  }

  return Array.from(all).sort();
}

import { useQuery } from "@tanstack/react-query";

/**
 * Fetches the per-market endDate from the Gamma API using the market slug.
 * This returns the actual close time (e.g. "2026-02-20T21:00:00Z") rather than
 * the event-level date that Data API / CLOB API provide.
 */
export function useMarketEndDate(slug: string | undefined) {
  return useQuery({
    queryKey: ["market-enddate", slug],
    queryFn: async () => {
      const res = await fetch(`/api/market?slug=${encodeURIComponent(slug!)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return (data.endDate as string) || null;
    },
    enabled: !!slug,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}

/**
 * Batch-fetches per-market endDates from the Gamma API for multiple slugs.
 * Uses the batch endpoint: /markets?slug=X&slug=Y&slug=Z
 * Returns a map of slug → ISO endDate string.
 */
export function useMarketEndDates(slugs: string[]) {
  const key = slugs.join(",");
  return useQuery({
    queryKey: ["market-enddates-batch", key],
    queryFn: async () => {
      const map: Record<string, string> = {};
      // Batch in chunks of 40 to stay within URL limits
      for (let i = 0; i < slugs.length; i += 40) {
        const chunk = slugs.slice(i, i + 40);
        const param = chunk.map((s) => encodeURIComponent(s)).join(",");
        const res = await fetch(`/api/market?slugs=${param}`);
        if (res.ok) {
          const data = await res.json();
          const markets = Array.isArray(data) ? data : [data];
          for (const m of markets) {
            if (m.slug && m.endDate) map[m.slug] = m.endDate;
          }
        }
      }
      return map;
    },
    enabled: slugs.length > 0,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}

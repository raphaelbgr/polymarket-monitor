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

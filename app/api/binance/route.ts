import { NextRequest, NextResponse } from "next/server";
import { BINANCE_REST_BASE } from "@/lib/chart/constants";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const interval = request.nextUrl.searchParams.get("interval");
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") || "500", 10);
  const limit = String(Math.min(Math.max(isNaN(rawLimit) ? 500 : rawLimit, 1), 1500));

  if (!symbol || !interval) {
    return NextResponse.json(
      { error: "symbol and interval required" },
      { status: 400 },
    );
  }

  try {
    const url = `${BINANCE_REST_BASE}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${encodeURIComponent(limit)}`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Binance API returned ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

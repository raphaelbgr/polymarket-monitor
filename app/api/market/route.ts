import { NextRequest, NextResponse } from "next/server";
import { CLOB_API_BASE, GAMMA_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const conditionId = request.nextUrl.searchParams.get("conditionId");
  const slug = request.nextUrl.searchParams.get("slug");
  const source = request.nextUrl.searchParams.get("source") || "clob";

  if (!conditionId && !slug) {
    return NextResponse.json(
      { error: "conditionId or slug required" },
      { status: 400 }
    );
  }

  try {
    let url: string;
    if (slug) {
      // Gamma API by slug — returns per-market endDate with actual close time
      url = `${GAMMA_API_BASE}/markets/slug/${slug}`;
    } else if (source === "gamma") {
      url = `${GAMMA_API_BASE}/markets?conditionId=${conditionId}&limit=1`;
    } else {
      url = `${CLOB_API_BASE}/markets/${conditionId}`;
    }

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

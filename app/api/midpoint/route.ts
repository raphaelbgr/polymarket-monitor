import { NextRequest, NextResponse } from "next/server";
import { CLOB_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const tokenId = request.nextUrl.searchParams.get("token_id");

  if (!tokenId) {
    return NextResponse.json({ error: "token_id required" }, { status: 400 });
  }

  try {
    const url = `${CLOB_API_BASE}/midpoint?token_id=${tokenId}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `CLOB API returned ${res.status}` },
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

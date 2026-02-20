import { NextRequest, NextResponse } from "next/server";
import { DATA_API_BASE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const limit = request.nextUrl.searchParams.get("limit") || "50";

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  try {
    const url = `${DATA_API_BASE}/trades?user=${address}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Data API returned ${res.status}` },
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

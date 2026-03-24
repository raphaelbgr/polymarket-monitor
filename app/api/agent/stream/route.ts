import { NextRequest } from "next/server";

const AGENT_SERVICE = process.env.AGENT_SERVICE_URL ?? "http://localhost:8770";

/** SSE proxy — streams events from the Python agent service to the browser. */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "default";
  const url = `${AGENT_SERVICE}/api/activity/stream?session_id=${encodeURIComponent(sessionId)}`;

  try {
    const upstream = await fetch(url, {
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return new Response(
        JSON.stringify({ error: `Agent service returned ${upstream.status}` }),
        { status: upstream.status, headers: { "Content-Type": "application/json" } },
      );
    }

    // Pipe upstream SSE stream directly to the client
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}

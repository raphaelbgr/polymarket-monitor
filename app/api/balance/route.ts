import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { polygon } from "viem/chains";
import {
  USDC_E_ADDRESS,
  POLYGON_RPC_URL,
  POLYGON_RPC_FALLBACK,
} from "@/lib/constants";

const client = createPublicClient({
  chain: polygon,
  transport: http(POLYGON_RPC_URL),
});

const fallbackClient = createPublicClient({
  chain: polygon,
  transport: http(POLYGON_RPC_FALLBACK),
});

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  try {
    let balance: bigint;
    try {
      balance = await client.readContract({
        address: USDC_E_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
    } catch {
      balance = await fallbackClient.readContract({
        address: USDC_E_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
    }

    const formatted = parseFloat(formatUnits(balance, 6));
    return NextResponse.json({ balance: formatted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

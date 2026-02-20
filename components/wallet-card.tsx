"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WalletHeader } from "@/components/wallet-header";
import { CopyTradeToggle } from "@/components/copy-trade-toggle";
import { PositionsTable } from "@/components/positions-table";
import { TradesFeed } from "@/components/trades-feed";
import { OrderLifecycle } from "@/components/order-lifecycle";
import type { TrackedWallet } from "@/lib/types";

export function WalletCard({ wallet }: { wallet: TrackedWallet }) {
  return (
    <Card className="bg-[#111111] border-[#222]">
      <CardHeader>
        <WalletHeader wallet={wallet} />
        <CopyTradeToggle wallet={wallet} />
      </CardHeader>
      <CardContent className="space-y-3">
        <PositionsTable address={wallet.address} />
        <Separator className="bg-[#222]" />
        <TradesFeed address={wallet.address} />
        <OrderLifecycle walletLabel={wallet.label} />
      </CardContent>
    </Card>
  );
}

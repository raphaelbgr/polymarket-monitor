import { notFound } from "next/navigation";
import { SUPPORTED_ASSETS, ASSET_CONFIG } from "@/lib/chart/constants";
import { WhaleChart } from "@/components/chart/whale-chart";

interface Props {
  params: Promise<{ asset: string }>;
}

export function generateStaticParams() {
  return SUPPORTED_ASSETS.map((asset) => ({ asset }));
}

export async function generateMetadata({ params }: Props) {
  const { asset } = await params;
  const config = ASSET_CONFIG[asset];
  if (!config) return {};
  return {
    title: `${config.label} Whale Chart — Polymarket Monitor`,
  };
}

export default async function ChartPage({ params }: Props) {
  const { asset } = await params;

  if (!SUPPORTED_ASSETS.includes(asset)) {
    notFound();
  }

  return <WhaleChart asset={asset} />;
}

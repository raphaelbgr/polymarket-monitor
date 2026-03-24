/**
 * Compute confidence cone data points for AI prediction bands.
 *
 * The band starts narrow at the prediction creation time and widens
 * toward the target time. Width = (1 - confidence) * price * SCALE_FACTOR.
 */

import { useMemo } from "react";
import type { AIPrediction } from "./types";

export interface BandPoint {
  time: number; // Unix seconds
  upper: number;
  lower: number;
}

const SCALE_FACTOR = 0.02; // Max 2% of price at lowest confidence
const BAND_STEPS = 20;

export function usePredictionBands(
  predictions: AIPrediction[],
  showBand: boolean,
): { upperBand: BandPoint[]; lowerBand: BandPoint[] } {
  return useMemo(() => {
    if (!showBand || predictions.length === 0) {
      return { upperBand: [], lowerBand: [] };
    }

    // Only show band for the most recent unresolved prediction
    const active = predictions.find((p) => !p.resolved);
    if (!active) return { upperBand: [], lowerBand: [] };

    const startTime = Math.floor(new Date(active.created_at).getTime() / 1000);
    const endTime = Math.floor(new Date(active.target_time).getTime() / 1000);
    const duration = endTime - startTime;

    if (duration <= 0) return { upperBand: [], lowerBand: [] };

    const maxSpread = (1 - active.confidence) * active.predicted_price * SCALE_FACTOR;
    const upperBand: BandPoint[] = [];
    const lowerBand: BandPoint[] = [];

    for (let i = 0; i <= BAND_STEPS; i++) {
      const t = i / BAND_STEPS;
      const time = startTime + Math.floor(duration * t);
      // Linearly interpolate price from current to predicted
      const midPrice = active.current_price + (active.predicted_price - active.current_price) * t;
      // Spread widens linearly from 0 to maxSpread
      const spread = maxSpread * t;

      upperBand.push({ time, upper: midPrice + spread, lower: midPrice });
      lowerBand.push({ time, upper: midPrice, lower: midPrice - spread });
    }

    return { upperBand, lowerBand };
  }, [predictions, showBand]);
}

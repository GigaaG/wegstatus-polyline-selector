import type { LineString } from "geojson";
import type { SegmentInput } from "../src/polyline";

interface SegmentOverrides {
  fromNodeId?: number | null;
  toNodeId?: number | null;
  isAtoB?: boolean;
  isBtoA?: boolean;
  geometry?: LineString;
}

export function segment(
  id: number,
  fromNodeId: number | null,
  toNodeId: number | null,
  coordinates: number[][],
  overrides: SegmentOverrides = {},
): SegmentInput {
  return {
    id,
    fromNodeId: overrides.fromNodeId ?? fromNodeId,
    toNodeId: overrides.toNodeId ?? toNodeId,
    isAtoB: overrides.isAtoB ?? true,
    isBtoA: overrides.isBtoA ?? true,
    geometry: overrides.geometry ?? { type: "LineString", coordinates },
  };
}

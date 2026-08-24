import type { Segment, WmeSDK } from "wme-sdk-typings";
import type { SegmentInput } from "./polyline";

export type SelectionResult =
  | { kind: "none" }
  | { kind: "other" }
  | { kind: "segments"; ids: number[]; segments: SegmentInput[]; missingIds: number[] };

export interface WmeSdkPort {
  getSelection: () => SelectionResult;
  onSelectionChanged: (handler: () => void) => void;
  onFeatureEditorOpened: (handler: () => void) => void;
}

export function createSdkPort(sdk: WmeSDK): WmeSdkPort {
  return {
    getSelection: () => {
      const selection = sdk.Editing.getSelection();
      if (!selection) {
        return { kind: "none" };
      }
      if (selection.objectType !== "segment") {
        return { kind: "other" };
      }

      const ids = selection.ids;
      const segments: SegmentInput[] = [];
      const missingIds: number[] = [];
      for (const segmentId of ids) {
        const segment = sdk.DataModel.Segments.getById({ segmentId });
        if (!segment) {
          missingIds.push(segmentId);
        } else {
          segments.push(toSegmentInput(segment));
        }
      }

      return { kind: "segments", ids, segments, missingIds };
    },
    onSelectionChanged: (handler) => {
      sdk.Events.on({ eventName: "wme-selection-changed", eventHandler: handler });
    },
    onFeatureEditorOpened: (handler) => {
      sdk.Events.on({ eventName: "wme-feature-editor-opened", eventHandler: handler });
    },
  };
}

function toSegmentInput(segment: Segment): SegmentInput {
  return {
    id: segment.id,
    fromNodeId: segment.fromNodeId,
    toNodeId: segment.toNodeId,
    isAtoB: segment.isAtoB,
    isBtoA: segment.isBtoA,
    geometry: segment.geometry,
  };
}

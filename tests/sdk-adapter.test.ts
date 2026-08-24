import { describe, expect, it, vi } from "vitest";
import type { WmeSDK } from "wme-sdk-typings";
import { createSdkPort } from "../src/sdk-adapter";
import { segment } from "./fixtures";

function fakeSdk(
  selection: unknown,
  segments: Map<number, ReturnType<typeof segment>> = new Map(),
): WmeSDK {
  return {
    Editing: { getSelection: vi.fn(() => selection) },
    DataModel: {
      Segments: { getById: vi.fn(({ segmentId }: { segmentId: number }) => segments.get(segmentId) ?? null) },
    },
    Events: { on: vi.fn() },
  } as unknown as WmeSDK;
}

describe("createSdkPort", () => {
  it("onderscheidt geen selectie en een niet-segmentselectie", () => {
    expect(createSdkPort(fakeSdk(null)).getSelection()).toEqual({ kind: "none" });
    expect(createSdkPort(fakeSdk({ objectType: "venue", ids: ["venue-id"] })).getSelection())
      .toEqual({ kind: "other" });
  });

  it("haalt geselecteerde segmenten via de SDK op en rapporteert ontbrekende ids", () => {
    const available = segment(1, 10, 11, [[4, 52], [5, 53]]);
    const port = createSdkPort(fakeSdk(
      { objectType: "segment", ids: [1, 2], localizedTypeName: "Segmenten" },
      new Map([[1, available]]),
    ));

    expect(port.getSelection()).toEqual({
      kind: "segments",
      ids: [1, 2],
      segments: [available],
      missingIds: [2],
    });
  });

  it("registreert de twee gebruikte officiële WME-events", () => {
    const sdk = fakeSdk(null);
    const port = createSdkPort(sdk);
    const handler = vi.fn();
    port.onSelectionChanged(handler);
    port.onFeatureEditorOpened(handler);

    expect(sdk.Events.on).toHaveBeenCalledWith({
      eventName: "wme-selection-changed",
      eventHandler: handler,
    });
    expect(sdk.Events.on).toHaveBeenCalledWith({
      eventName: "wme-feature-editor-opened",
      eventHandler: handler,
    });
  });
});

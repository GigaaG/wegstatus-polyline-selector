import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolylineController } from "../src/controller";
import type { SelectionResult, WmeSdkPort } from "../src/sdk-adapter";
import { segment } from "./fixtures";

class FakeSdkPort implements WmeSdkPort {
  public selection: SelectionResult = { kind: "none" };
  private selectionHandlers: Array<() => void> = [];
  private editorHandlers: Array<() => void> = [];

  public getSelection = (): SelectionResult => this.selection;
  public onSelectionChanged = (handler: () => void): void => { this.selectionHandlers.push(handler); };
  public onFeatureEditorOpened = (handler: () => void): void => { this.editorHandlers.push(handler); };
  public emitSelectionChanged(): void { this.selectionHandlers.forEach((handler) => handler()); }
  public emitEditorOpened(): void { this.editorHandlers.forEach((handler) => handler()); }
}

function createScheduler(): {
  schedule: (callback: () => void, delay: number) => number;
  cancel: (timer: number) => void;
  flush: () => void;
} {
  const callbacks = new Map<number, () => void>();
  let nextId = 1;
  return {
    schedule: (callback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancel: (timer) => { callbacks.delete(timer); },
    flush: () => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback());
    },
  };
}

describe("PolylineController", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = '<div id="segment-edit-general"></div>';
  });

  it("reageert op selectie-events en verwijdert de bediening voor niet-segmenten", () => {
    const sdk = new FakeSdkPort();
    const scheduler = createScheduler();
    sdk.selection = {
      kind: "segments",
      ids: [1],
      segments: [segment(1, 1, 2, [[4, 52], [5, 53]])],
      missingIds: [],
    };
    const controller = new PolylineController(sdk, {
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancel,
    });

    controller.init();
    scheduler.flush();
    expect(document.body.textContent).toContain("1 segment klaar");

    sdk.selection = { kind: "other" };
    sdk.emitSelectionChanged();
    expect(document.querySelector("#wegstatus-polyline-selector")).toBeNull();
  });

  it("leest de selectie opnieuw wanneer de segmenteditor opent", () => {
    const sdk = new FakeSdkPort();
    const scheduler = createScheduler();
    new PolylineController(sdk, {
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancel,
    }).init();

    sdk.selection = {
      kind: "segments",
      ids: [1],
      segments: [segment(1, 1, 2, [[4, 52], [5, 53]])],
      missingIds: [],
    };
    sdk.emitEditorOpened();
    scheduler.flush();

    expect(document.querySelector("#wsps-copy-polyline")).not.toBeNull();
    expect(document.body.textContent).toContain("1 segment klaar");
  });

  it("kopieert de berekende lijn en kan de richting omkeren", async () => {
    const sdk = new FakeSdkPort();
    const scheduler = createScheduler();
    const copy = vi.fn().mockResolvedValue(undefined);
    sdk.selection = {
      kind: "segments",
      ids: [1],
      segments: [segment(1, 1, 2, [[4, 52], [5, 53]])],
      missingIds: [],
    };
    new PolylineController(sdk, {
      copy,
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancel,
    }).init();
    scheduler.flush();

    (document.querySelector("#wsps-reverse-polyline") as HTMLButtonElement).click();
    (document.querySelector("#wsps-copy-polyline") as HTMLButtonElement).click();
    await Promise.resolve();

    expect(copy).toHaveBeenCalledWith("53 5 52 4");
    expect(document.body.textContent).toContain("Polyline gekopieerd");
  });

  it("toont ontbrekende segmenten als fout en schakelt acties uit", () => {
    const sdk = new FakeSdkPort();
    const scheduler = createScheduler();
    sdk.selection = { kind: "segments", ids: [99], segments: [], missingIds: [99] };
    new PolylineController(sdk, {
      schedule: scheduler.schedule,
      cancelSchedule: scheduler.cancel,
    }).init();
    scheduler.flush();

    expect(document.body.textContent).toContain("Segment 99 is niet beschikbaar");
    expect(document.querySelector("#wsps-copy-polyline")).toHaveProperty("disabled", true);
  });
});

import { copyText } from "./clipboard";
import {
  buildPolyline,
  formatWegstatusPolyline,
  reversePolyline,
  type PolylineSuccess,
} from "./polyline";
import type { SelectionResult, WmeSdkPort } from "./sdk-adapter";
import { PolylinePanel, type PanelState } from "./ui";

const PANEL_HOST_SELECTOR = "#segment-edit-general";
const MOUNT_RETRY_DELAYS = [0, 50, 150, 300, 600, 1_200, 2_000] as const;

export interface ControllerDependencies {
  pageDocument?: Document;
  copy?: (text: string) => Promise<void>;
  schedule?: (callback: () => void, delay: number) => number;
  cancelSchedule?: (timer: number) => void;
}

export class PolylineController {
  private readonly pageDocument: Document;
  private readonly panel: PolylinePanel;
  private readonly copy: (text: string) => Promise<void>;
  private readonly schedule: (callback: () => void, delay: number) => number;
  private readonly cancelSchedule: (timer: number) => void;
  private currentPolyline: PolylineSuccess | null = null;
  private pendingState: PanelState | null = null;
  private selectedSegmentCount = 0;
  private copyFeedbackTimer: number | null = null;
  private mountTimers: number[] = [];

  public constructor(
    private readonly sdk: WmeSdkPort,
    dependencies: ControllerDependencies = {},
  ) {
    this.pageDocument = dependencies.pageDocument ?? document;
    this.copy = dependencies.copy ?? copyText;
    this.schedule = dependencies.schedule ?? ((callback, delay) => window.setTimeout(callback, delay));
    this.cancelSchedule = dependencies.cancelSchedule ?? ((timer) => window.clearTimeout(timer));
    this.panel = new PolylinePanel(
      {
        onCopy: () => void this.copyCurrentPolyline(),
        onReverse: () => this.reverseCurrentPolyline(),
      },
      this.pageDocument,
    );
  }

  public init(): void {
    this.sdk.onSelectionChanged(() => this.refresh());
    this.sdk.onFeatureEditorOpened(() => this.refresh());
    this.refresh();
  }

  public refresh(): void {
    this.clearCopyFeedback();
    const selection = this.sdk.getSelection();

    if (selection.kind !== "segments" || selection.ids.length === 0) {
      this.currentPolyline = null;
      this.pendingState = null;
      this.selectedSegmentCount = 0;
      this.cancelMountAttempts();
      this.panel.unmount();
      return;
    }

    this.selectedSegmentCount = selection.ids.length;
    this.pendingState = null;
    this.currentPolyline = this.calculatePolyline(selection);
    this.scheduleMountAttempts();
  }

  private calculatePolyline(selection: Extract<SelectionResult, { kind: "segments" }>): PolylineSuccess | null {
    if (selection.missingIds.length > 0) {
      this.renderState({
        status: `Segment ${selection.missingIds.join(", ")} is niet beschikbaar in het WME-datamodel.`,
        tone: "error",
        canUsePolyline: false,
      });
      return null;
    }

    const result = buildPolyline(selection.segments);
    if (!result.ok) {
      this.renderState({ status: result.error, tone: "error", canUsePolyline: false });
      return null;
    }
    return result;
  }

  private scheduleMountAttempts(): void {
    this.cancelMountAttempts();
    this.mountTimers = MOUNT_RETRY_DELAYS.map((delay) =>
      this.schedule(() => this.mountAndRender(), delay),
    );
  }

  private cancelMountAttempts(): void {
    this.mountTimers.forEach((timer) => this.cancelSchedule(timer));
    this.mountTimers = [];
  }

  private mountAndRender(): void {
    const host = this.pageDocument.querySelector<HTMLElement>(PANEL_HOST_SELECTOR);
    if (!host) {
      return;
    }
    this.cancelMountAttempts();
    this.panel.mount(host);

    if (!this.currentPolyline) {
      this.renderState(this.pendingState ?? {
        status: `${this.selectedSegmentCount} geselecteerde segmenten vormen geen geldige polyline.`,
        tone: "error",
        canUsePolyline: false,
      });
      return;
    }

    this.renderReadyState();
  }

  private renderReadyState(prefix?: string): void {
    if (!this.currentPolyline) {
      return;
    }
    const segmentLabel = this.selectedSegmentCount === 1 ? "segment" : "segmenten";
    const readyMessage = `${this.selectedSegmentCount} ${segmentLabel} klaar om te kopiëren.`;
    const status = [prefix, readyMessage, this.currentPolyline.warning].filter(Boolean).join(" ");
    this.renderState({
      status,
      tone: this.currentPolyline.warning ? "warning" : "neutral",
      canUsePolyline: true,
    });
  }

  private reverseCurrentPolyline(): void {
    if (!this.currentPolyline) {
      return;
    }
    this.currentPolyline = {
      ...this.currentPolyline,
      coordinates: reversePolyline(this.currentPolyline.coordinates),
    };
    this.renderReadyState("Richting omgekeerd.");
  }

  private async copyCurrentPolyline(): Promise<void> {
    if (!this.currentPolyline) {
      return;
    }

    try {
      await this.copy(formatWegstatusPolyline(this.currentPolyline.coordinates));
      this.renderState({
        status: "Polyline gekopieerd naar het klembord.",
        tone: "success",
        canUsePolyline: true,
        copyLabel: "Gekopieerd",
      });
      this.copyFeedbackTimer = this.schedule(() => this.renderReadyState(), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kopiëren is mislukt.";
      this.renderState({ status: message, tone: "error", canUsePolyline: true });
    }
  }

  private renderState(state: PanelState): void {
    this.pendingState = state;
    this.panel.render(state);
  }

  private clearCopyFeedback(): void {
    if (this.copyFeedbackTimer !== null) {
      this.cancelSchedule(this.copyFeedbackTimer);
      this.copyFeedbackTimer = null;
    }
  }
}

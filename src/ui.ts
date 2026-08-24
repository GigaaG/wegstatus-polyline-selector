export type StatusTone = "neutral" | "success" | "warning" | "error";

export interface PanelState {
  status: string;
  tone: StatusTone;
  canUsePolyline: boolean;
  copyLabel?: string;
}

export interface PanelActions {
  onCopy: () => void;
  onReverse: () => void;
}

const ROOT_ID = "wegstatus-polyline-selector";
const STYLE_ID = "wegstatus-polyline-selector-styles";

export class PolylinePanel {
  private root: HTMLElement | null = null;
  private statusElement: HTMLElement | null = null;
  private copyButton: HTMLElement | null = null;
  private reverseButton: HTMLElement | null = null;

  public constructor(
    private readonly actions: PanelActions,
    private readonly pageDocument: Document = document,
  ) {}

  public mount(host: HTMLElement): void {
    const existing = this.pageDocument.getElementById(ROOT_ID);
    if (existing) {
      this.captureElements(existing);
      return;
    }

    this.installStyles();
    const root = this.pageDocument.createElement("section");
    root.id = ROOT_ID;
    root.className = "wsps-panel";
    root.setAttribute("aria-label", "Wegstatus Polyline Selector");

    const heading = this.pageDocument.createElement("div");
    heading.className = "wsps-panel__heading";
    heading.textContent = "Wegstatus polyline";

    const status = this.pageDocument.createElement("p");
    status.className = "wsps-panel__status";
    status.dataset.tone = "neutral";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const actions = this.pageDocument.createElement("div");
    actions.className = "wsps-panel__actions";

    const copyButton = this.createButton("Polyline kopiëren", "wsps-copy-polyline");
    copyButton.classList.add("wsps-panel__primary");
    copyButton.addEventListener("click", this.actions.onCopy);

    const reverseButton = this.createButton("Richting omkeren", "wsps-reverse-polyline");
    reverseButton.classList.add("wsps-panel__secondary");
    reverseButton.addEventListener("click", this.actions.onReverse);

    actions.append(copyButton, reverseButton);
    root.append(heading, status, actions);
    host.append(root);

    this.root = root;
    this.statusElement = status;
    this.copyButton = copyButton;
    this.reverseButton = reverseButton;
  }

  public unmount(): void {
    this.root?.remove();
    this.root = null;
    this.statusElement = null;
    this.copyButton = null;
    this.reverseButton = null;
  }

  public render(state: PanelState): void {
    if (!this.root || !this.statusElement || !this.copyButton || !this.reverseButton) {
      return;
    }

    this.statusElement.textContent = state.status;
    this.statusElement.dataset.tone = state.tone;
    this.copyButton.textContent = state.copyLabel ?? "Polyline kopiëren";
    setDisabled(this.copyButton, !state.canUsePolyline);
    setDisabled(this.reverseButton, !state.canUsePolyline);
  }

  public get isMounted(): boolean {
    return this.root?.isConnected ?? false;
  }

  private createButton(label: string, id: string): HTMLElement {
    const supportsWazeButton = this.pageDocument.defaultView?.customElements.get("wz-button");
    const button = this.pageDocument.createElement(supportsWazeButton ? "wz-button" : "button");
    button.id = id;
    button.textContent = label;
    button.setAttribute("type", "button");
    if (button instanceof HTMLButtonElement) {
      button.className = "wsps-button-fallback";
    }
    return button;
  }

  private captureElements(root: HTMLElement): void {
    this.root = root;
    this.statusElement = root.querySelector<HTMLElement>(".wsps-panel__status");
    this.copyButton = root.querySelector<HTMLElement>("#wsps-copy-polyline");
    this.reverseButton = root.querySelector<HTMLElement>("#wsps-reverse-polyline");
  }

  private installStyles(): void {
    if (this.pageDocument.getElementById(STYLE_ID)) {
      return;
    }

    const style = this.pageDocument.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}.wsps-panel {
        border-top: 1px solid var(--wz-color-divider, #d6d8da);
        display: grid;
        gap: 8px;
        margin-top: 16px;
        padding: 16px 0 4px;
      }
      #${ROOT_ID} .wsps-panel__heading {
        color: var(--wz-color-text-primary, #202124);
        font-size: 14px;
        font-weight: 600;
      }
      #${ROOT_ID} .wsps-panel__status {
        color: var(--wz-color-text-secondary, #5f6368);
        font-size: 12px;
        line-height: 1.4;
        margin: 0;
      }
      #${ROOT_ID} .wsps-panel__status[data-tone="success"] { color: #137333; }
      #${ROOT_ID} .wsps-panel__status[data-tone="warning"] { color: #9a6700; }
      #${ROOT_ID} .wsps-panel__status[data-tone="error"] { color: #b3261e; }
      #${ROOT_ID} .wsps-panel__actions {
        display: grid;
        gap: 8px;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
      #${ROOT_ID} wz-button { width: 100%; }
      #${ROOT_ID} .wsps-button-fallback {
        border: 1px solid #0088cc;
        border-radius: 4px;
        cursor: pointer;
        font: inherit;
        min-height: 34px;
        padding: 6px 10px;
      }
      #${ROOT_ID} .wsps-panel__primary.wsps-button-fallback {
        background: #0088cc;
        color: #fff;
      }
      #${ROOT_ID} .wsps-panel__secondary.wsps-button-fallback {
        background: #fff;
        color: #006b9f;
      }
      #${ROOT_ID} .wsps-button-fallback:disabled,
      #${ROOT_ID} wz-button[disabled] {
        cursor: not-allowed;
        opacity: 0.5;
      }
    `;
    this.pageDocument.head.append(style);
  }
}

function setDisabled(element: HTMLElement, disabled: boolean): void {
  element.toggleAttribute("disabled", disabled);
  element.setAttribute("aria-disabled", String(disabled));
  if (element instanceof HTMLButtonElement) {
    element.disabled = disabled;
  }
}

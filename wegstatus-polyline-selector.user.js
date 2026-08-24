// ==UserScript==
// @name         Wegstatus Polyline Selector
// @namespace    https://wegstatus.nl
// @version      2026.08.24.03
// @description  Copies selected WME segments as one Wegstatus polyline.
// @author       Xander "Xanland" Hoogland & Sjors "GigaaG" Luyckx
// @include      /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor([^\/]?.*)?$/
// @grant        none
// @run-at       document-idle
// ==/UserScript==
"use strict";
(() => {
  // src/bootstrap.ts
  function readSdkGlobals(pageWindow) {
    if (!pageWindow.SDK_INITIALIZED || !pageWindow.getWmeSdk) {
      return null;
    }
    return {
      initialized: pageWindow.SDK_INITIALIZED,
      getWmeSdk: pageWindow.getWmeSdk
    };
  }
  async function waitForDomContentLoaded(pageDocument) {
    if (pageDocument.readyState !== "loading") {
      return;
    }
    await new Promise((resolve) => {
      pageDocument.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });
  }
  async function waitForSdkGlobals(options = {}) {
    const pageWindow = options.pageWindow ?? window;
    const pageDocument = options.pageDocument ?? document;
    const timeoutMs = options.timeoutMs ?? 3e4;
    const pollIntervalMs = options.pollIntervalMs ?? 50;
    await waitForDomContentLoaded(pageDocument);
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const globals = readSdkGlobals(pageWindow);
      if (globals) {
        return globals;
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        break;
      }
      await new Promise((resolve) => {
        pageWindow.setTimeout(resolve, Math.min(pollIntervalMs, remainingMs));
      });
    }
    throw new Error(
      "De WME SDK is na 30 seconden nog niet beschikbaar. Controleer of het script met @grant none in WME draait."
    );
  }

  // src/clipboard.ts
  async function copyText(text, environment = { navigator, document }) {
    try {
      if (environment.navigator.clipboard?.writeText) {
        await environment.navigator.clipboard.writeText(text);
        return;
      }
    } catch {
    }
    const textarea = environment.document.createElement("textarea");
    textarea.value = text;
    textarea.readOnly = true;
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    environment.document.body.append(textarea);
    textarea.select();
    const copied = environment.document.execCommand?.("copy") ?? false;
    textarea.remove();
    if (!copied) {
      throw new Error("De polyline kon niet naar het klembord worden gekopieerd.");
    }
  }

  // src/polyline.ts
  var CONFLICTING_DIRECTIONS_WARNING = "De selectie bevat tegenstrijdige eenrichtingssegmenten. Controleer de richting.";
  function buildPolyline(segments) {
    if (segments.length === 0) {
      return failure("Selecteer minimaal één segment.");
    }
    const seenIds = /* @__PURE__ */ new Set();
    const edges = [];
    for (const segment of segments) {
      if (seenIds.has(segment.id)) {
        return failure(`Segment ${segment.id} komt meer dan één keer voor.`);
      }
      seenIds.add(segment.id);
      const coordinates2 = validateCoordinates(segment);
      if (!coordinates2) {
        return failure(`Segment ${segment.id} heeft geen geldige LineString-geometrie.`);
      }
      edges.push({
        segment,
        startKey: endpointKey(segment.fromNodeId, coordinates2[0]),
        endKey: endpointKey(segment.toNodeId, coordinates2.at(-1)),
        coordinates: coordinates2
      });
    }
    if (edges.length === 1) {
      return buildSingleSegment(edges[0]);
    }
    const adjacency = buildAdjacency(edges);
    const degreeOneNodes = [];
    for (const [nodeKey, connectedEdges] of adjacency) {
      if (connectedEdges.length > 2) {
        return failure("De selectie bevat een vertakking en kan niet één polyline vormen.");
      }
      if (connectedEdges.length === 1) {
        degreeOneNodes.push(nodeKey);
      }
    }
    if (!isConnected(edges, adjacency)) {
      return failure("De geselecteerde segmenten vormen meerdere losse delen.");
    }
    const isClosed = degreeOneNodes.length === 0;
    if (!isClosed && degreeOneNodes.length !== 2) {
      return failure("De geselecteerde segmenten vormen geen doorlopende keten of gesloten lus.");
    }
    const candidates = isClosed ? buildCycleCandidates(edges, adjacency) : degreeOneNodes.map((nodeKey) => traverse(edges, adjacency, nodeKey));
    if (candidates.some((candidate) => candidate === null)) {
      return failure("De geselecteerde segmenten konden niet doorlopend worden geordend.");
    }
    const traversals = candidates;
    const selected = chooseTraversal(traversals, edges[0]);
    const coordinates = concatenateCoordinates(selected.steps, isClosed);
    const hasOneWayConflict = !traversals.some((candidate) => candidate.respectsOneWays);
    return {
      ok: true,
      coordinates,
      isClosed,
      ...hasOneWayConflict ? { warning: CONFLICTING_DIRECTIONS_WARNING } : {}
    };
  }
  function reversePolyline(coordinates) {
    return [...coordinates].reverse().map(([longitude, latitude]) => [longitude, latitude]);
  }
  function formatCoordinate(value) {
    const rounded = Number(value.toFixed(6));
    return Object.is(rounded, -0) ? "0" : String(rounded);
  }
  function formatWegstatusPolyline(coordinates) {
    return coordinates.flatMap(([longitude, latitude]) => [formatCoordinate(latitude), formatCoordinate(longitude)]).join(" ");
  }
  function buildSingleSegment(edge) {
    const preferReverse = edge.segment.isBtoA && !edge.segment.isAtoB;
    const coordinates = preferReverse ? reversePolyline(edge.coordinates) : edge.coordinates.map(([longitude, latitude]) => [longitude, latitude]);
    const isClosed = edge.startKey === edge.endKey || coordinateEquals(coordinates[0], coordinates.at(-1));
    if (isClosed && !coordinateEquals(coordinates[0], coordinates.at(-1))) {
      coordinates.push([coordinates[0][0], coordinates[0][1]]);
    }
    return {
      ok: true,
      coordinates,
      isClosed
    };
  }
  function validateCoordinates(segment) {
    if (segment.geometry.type !== "LineString" || segment.geometry.coordinates.length < 2) {
      return null;
    }
    const coordinates = [];
    for (const position of segment.geometry.coordinates) {
      if (!isCoordinate(position)) {
        return null;
      }
      coordinates.push([position[0], position[1]]);
    }
    return coordinates;
  }
  function isCoordinate(position) {
    return position.length >= 2 && typeof position[0] === "number" && Number.isFinite(position[0]) && typeof position[1] === "number" && Number.isFinite(position[1]);
  }
  function endpointKey(nodeId, coordinate) {
    return nodeId === null ? `coordinate:${coordinate[0]},${coordinate[1]}` : `node:${nodeId}`;
  }
  function buildAdjacency(edges) {
    const adjacency = /* @__PURE__ */ new Map();
    edges.forEach((edge, edgeIndex) => {
      addAdjacentEdge(adjacency, edge.startKey, edgeIndex);
      addAdjacentEdge(adjacency, edge.endKey, edgeIndex);
    });
    return adjacency;
  }
  function addAdjacentEdge(adjacency, key, edgeIndex) {
    const connectedEdges = adjacency.get(key) ?? [];
    connectedEdges.push(edgeIndex);
    adjacency.set(key, connectedEdges);
  }
  function isConnected(edges, adjacency) {
    const visited = /* @__PURE__ */ new Set();
    const pending = [0];
    while (pending.length > 0) {
      const edgeIndex = pending.pop();
      if (visited.has(edgeIndex)) {
        continue;
      }
      visited.add(edgeIndex);
      const edge = edges[edgeIndex];
      for (const nodeKey of [edge.startKey, edge.endKey]) {
        for (const adjacentEdge of adjacency.get(nodeKey) ?? []) {
          if (!visited.has(adjacentEdge)) {
            pending.push(adjacentEdge);
          }
        }
      }
    }
    return visited.size === edges.length;
  }
  function buildCycleCandidates(edges, adjacency) {
    const anchor = edges[0];
    if (anchor.startKey === anchor.endKey) {
      const forward = traverse(edges, adjacency, anchor.startKey, 0);
      if (!forward) {
        return [null];
      }
      return [forward, reverseTraversal(forward)];
    }
    return [
      traverse(edges, adjacency, anchor.startKey, 0),
      traverse(edges, adjacency, anchor.endKey, 0)
    ];
  }
  function traverse(edges, adjacency, startKey, forcedFirstEdge) {
    const usedEdges = /* @__PURE__ */ new Set();
    const steps = [];
    let currentKey = startKey;
    while (steps.length < edges.length) {
      const candidates = (adjacency.get(currentKey) ?? []).filter(
        (edgeIndex2) => !usedEdges.has(edgeIndex2)
      );
      const edgeIndex = steps.length === 0 && forcedFirstEdge !== void 0 ? candidates.includes(forcedFirstEdge) ? forcedFirstEdge : void 0 : candidates[0];
      if (edgeIndex === void 0) {
        return null;
      }
      const edge = edges[edgeIndex];
      const forward = edge.startKey === currentKey;
      steps.push({ edge, forward });
      usedEdges.add(edgeIndex);
      currentKey = forward ? edge.endKey : edge.startKey;
    }
    if (usedEdges.size !== edges.length) {
      return null;
    }
    return {
      steps,
      respectsOneWays: steps.every(respectsOneWayDirection)
    };
  }
  function reverseTraversal(traversal) {
    const steps = [...traversal.steps].reverse().map(({ edge, forward }) => ({ edge, forward: !forward }));
    return {
      steps,
      respectsOneWays: steps.every(respectsOneWayDirection)
    };
  }
  function chooseTraversal(candidates, anchor) {
    const respectingCandidates = candidates.filter((candidate) => candidate.respectsOneWays);
    if (respectingCandidates.length === 1) {
      return respectingCandidates[0];
    }
    const anchorPreferredForward = !(anchor.segment.isBtoA && !anchor.segment.isAtoB);
    const pool = respectingCandidates.length > 0 ? respectingCandidates : candidates;
    return pool.find((candidate) => {
      const anchorStep = candidate.steps.find(({ edge }) => edge.segment.id === anchor.segment.id);
      return anchorStep?.forward === anchorPreferredForward;
    }) ?? pool[0];
  }
  function respectsOneWayDirection({ edge, forward }) {
    if (edge.segment.isAtoB && !edge.segment.isBtoA) {
      return forward;
    }
    if (edge.segment.isBtoA && !edge.segment.isAtoB) {
      return !forward;
    }
    return true;
  }
  function concatenateCoordinates(steps, isClosed) {
    const coordinates = [];
    steps.forEach(({ edge, forward }, index) => {
      const orientedCoordinates = forward ? edge.coordinates : reversePolyline(edge.coordinates);
      const coordinatesToAdd = index === 0 ? orientedCoordinates : orientedCoordinates.slice(1);
      coordinates.push(
        ...coordinatesToAdd.map(
          ([longitude, latitude]) => [longitude, latitude]
        )
      );
    });
    if (isClosed) {
      const first = coordinates[0];
      while (coordinates.length > 2 && coordinateEquals(coordinates.at(-1), first) && coordinateEquals(coordinates.at(-2), first)) {
        coordinates.pop();
      }
      if (!coordinateEquals(coordinates.at(-1), first)) {
        coordinates.push([first[0], first[1]]);
      }
    }
    return coordinates;
  }
  function coordinateEquals(left, right) {
    return left[0] === right[0] && left[1] === right[1];
  }
  function failure(error) {
    return { ok: false, error };
  }

  // src/ui.ts
  var ROOT_ID = "wegstatus-polyline-selector";
  var STYLE_ID = "wegstatus-polyline-selector-styles";
  var PolylinePanel = class {
    constructor(actions, pageDocument = document) {
      this.actions = actions;
      this.pageDocument = pageDocument;
    }
    root = null;
    statusElement = null;
    copyButton = null;
    reverseButton = null;
    mount(host) {
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
    unmount() {
      this.root?.remove();
      this.root = null;
      this.statusElement = null;
      this.copyButton = null;
      this.reverseButton = null;
    }
    render(state) {
      if (!this.root || !this.statusElement || !this.copyButton || !this.reverseButton) {
        return;
      }
      this.statusElement.textContent = state.status;
      this.statusElement.dataset.tone = state.tone;
      this.copyButton.textContent = state.copyLabel ?? "Polyline kopiëren";
      setDisabled(this.copyButton, !state.canUsePolyline);
      setDisabled(this.reverseButton, !state.canUsePolyline);
    }
    get isMounted() {
      return this.root?.isConnected ?? false;
    }
    createButton(label, id) {
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
    captureElements(root) {
      this.root = root;
      this.statusElement = root.querySelector(".wsps-panel__status");
      this.copyButton = root.querySelector("#wsps-copy-polyline");
      this.reverseButton = root.querySelector("#wsps-reverse-polyline");
    }
    installStyles() {
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
  };
  function setDisabled(element, disabled) {
    element.toggleAttribute("disabled", disabled);
    element.setAttribute("aria-disabled", String(disabled));
    if (element instanceof HTMLButtonElement) {
      element.disabled = disabled;
    }
  }

  // src/controller.ts
  var PANEL_HOST_SELECTOR = "#segment-edit-general";
  var MOUNT_RETRY_DELAYS = [0, 50, 150, 300, 600, 1200, 2e3];
  var PolylineController = class {
    constructor(sdk, dependencies = {}) {
      this.sdk = sdk;
      this.pageDocument = dependencies.pageDocument ?? document;
      this.copy = dependencies.copy ?? copyText;
      this.schedule = dependencies.schedule ?? ((callback, delay) => window.setTimeout(callback, delay));
      this.cancelSchedule = dependencies.cancelSchedule ?? ((timer) => window.clearTimeout(timer));
      this.panel = new PolylinePanel(
        {
          onCopy: () => void this.copyCurrentPolyline(),
          onReverse: () => this.reverseCurrentPolyline()
        },
        this.pageDocument
      );
    }
    pageDocument;
    panel;
    copy;
    schedule;
    cancelSchedule;
    currentPolyline = null;
    pendingState = null;
    selectedSegmentCount = 0;
    copyFeedbackTimer = null;
    mountTimers = [];
    init() {
      this.sdk.onSelectionChanged(() => this.refresh());
      this.sdk.onFeatureEditorOpened(() => this.refresh());
      this.refresh();
    }
    refresh() {
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
    calculatePolyline(selection) {
      if (selection.missingIds.length > 0) {
        this.renderState({
          status: `Segment ${selection.missingIds.join(", ")} is niet beschikbaar in het WME-datamodel.`,
          tone: "error",
          canUsePolyline: false
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
    scheduleMountAttempts() {
      this.cancelMountAttempts();
      this.mountTimers = MOUNT_RETRY_DELAYS.map(
        (delay) => this.schedule(() => this.mountAndRender(), delay)
      );
    }
    cancelMountAttempts() {
      this.mountTimers.forEach((timer) => this.cancelSchedule(timer));
      this.mountTimers = [];
    }
    mountAndRender() {
      const host = this.pageDocument.querySelector(PANEL_HOST_SELECTOR);
      if (!host) {
        return;
      }
      this.cancelMountAttempts();
      this.panel.mount(host);
      if (!this.currentPolyline) {
        this.renderState(this.pendingState ?? {
          status: `${this.selectedSegmentCount} geselecteerde segmenten vormen geen geldige polyline.`,
          tone: "error",
          canUsePolyline: false
        });
        return;
      }
      this.renderReadyState();
    }
    renderReadyState(prefix) {
      if (!this.currentPolyline) {
        return;
      }
      const segmentLabel = this.selectedSegmentCount === 1 ? "segment" : "segmenten";
      const readyMessage = `${this.selectedSegmentCount} ${segmentLabel} klaar om te kopiëren.`;
      const status = [prefix, readyMessage, this.currentPolyline.warning].filter(Boolean).join(" ");
      this.renderState({
        status,
        tone: this.currentPolyline.warning ? "warning" : "neutral",
        canUsePolyline: true
      });
    }
    reverseCurrentPolyline() {
      if (!this.currentPolyline) {
        return;
      }
      this.currentPolyline = {
        ...this.currentPolyline,
        coordinates: reversePolyline(this.currentPolyline.coordinates)
      };
      this.renderReadyState("Richting omgekeerd.");
    }
    async copyCurrentPolyline() {
      if (!this.currentPolyline) {
        return;
      }
      try {
        await this.copy(formatWegstatusPolyline(this.currentPolyline.coordinates));
        this.renderState({
          status: "Polyline gekopieerd naar het klembord.",
          tone: "success",
          canUsePolyline: true,
          copyLabel: "Gekopieerd"
        });
        this.copyFeedbackTimer = this.schedule(() => this.renderReadyState(), 3e3);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Kopiëren is mislukt.";
        this.renderState({ status: message, tone: "error", canUsePolyline: true });
      }
    }
    renderState(state) {
      this.pendingState = state;
      this.panel.render(state);
    }
    clearCopyFeedback() {
      if (this.copyFeedbackTimer !== null) {
        this.cancelSchedule(this.copyFeedbackTimer);
        this.copyFeedbackTimer = null;
      }
    }
  };

  // src/sdk-adapter.ts
  function createSdkPort(sdk) {
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
        const segments = [];
        const missingIds = [];
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
      }
    };
  }
  function toSegmentInput(segment) {
    return {
      id: segment.id,
      fromNodeId: segment.fromNodeId,
      toNodeId: segment.toNodeId,
      isAtoB: segment.isAtoB,
      isBtoA: segment.isBtoA,
      geometry: segment.geometry
    };
  }

  // src/main.ts
  async function start() {
    const { initialized, getWmeSdk } = await waitForSdkGlobals();
    await initialized;
    const sdk = getWmeSdk({
      scriptId: "wegstatus-polyline-selector",
      scriptName: "Wegstatus Polyline Selector"
    });
    new PolylineController(createSdkPort(sdk)).init();
  }
  void start().catch((error) => {
    console.error("[Wegstatus Polyline Selector] Initialisatie mislukt.", error);
  });
})();

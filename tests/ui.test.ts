import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolylinePanel } from "../src/ui";

describe("PolylinePanel", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("monteert één compacte bediening en verwerkt acties", () => {
    const onCopy = vi.fn();
    const onReverse = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const panel = new PolylinePanel({ onCopy, onReverse });

    panel.mount(host);
    panel.mount(host);
    panel.render({ status: "2 segmenten klaar.", tone: "neutral", canUsePolyline: true });

    expect(host.querySelectorAll("#wegstatus-polyline-selector")).toHaveLength(1);
    expect(host.textContent).toContain("2 segmenten klaar.");
    (host.querySelector("#wsps-copy-polyline") as HTMLButtonElement).click();
    (host.querySelector("#wsps-reverse-polyline") as HTMLButtonElement).click();
    expect(onCopy).toHaveBeenCalledOnce();
    expect(onReverse).toHaveBeenCalledOnce();
  });

  it("schakelt beide knoppen uit bij een ongeldige selectie", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const panel = new PolylinePanel({ onCopy: vi.fn(), onReverse: vi.fn() });

    panel.mount(host);
    panel.render({ status: "Losse delen.", tone: "error", canUsePolyline: false });

    expect(host.querySelector("#wsps-copy-polyline")).toHaveProperty("disabled", true);
    expect(host.querySelector("#wsps-reverse-polyline")).toHaveProperty("disabled", true);
    expect(host.querySelector("[role=status]")?.getAttribute("data-tone")).toBe("error");
  });
});

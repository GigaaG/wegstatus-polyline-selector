import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("gegenereerd userscript", () => {
  const userscript = readFileSync(resolve("wegstatus-polyline-selector.user.js"), "utf8");

  it("bevat de verwachte metadata en is direct installeerbaar", () => {
    expect(userscript.startsWith("// ==UserScript==")).toBe(true);
    expect(userscript).toContain("// @version      2026.08.24.03");
    expect(userscript).toContain("// @grant        none");
    expect(userscript).toContain("// @run-at       document-idle");
    expect(userscript).toContain("// ==/UserScript==");
  });

  it("bevat geen runtime-imports of legacy WME API's", () => {
    expect(userscript).not.toMatch(/^\s*import\s/m);
    expect(userscript).not.toContain("W.selectionManager");
    expect(userscript).not.toContain("OpenLayers");
    expect(userscript).not.toMatch(/\$\s*\(/);
  });
});

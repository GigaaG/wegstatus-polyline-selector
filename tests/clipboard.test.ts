import { describe, expect, it, vi } from "vitest";
import { copyText } from "../src/clipboard";

describe("copyText", () => {
  it("gebruikt de moderne Clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await copyText("polyline", {
      navigator: { clipboard: { writeText } },
      document,
    });

    expect(writeText).toHaveBeenCalledWith("polyline");
  });

  it("valt terug op een tijdelijke textarea wanneer de Clipboard API faalt", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });

    await copyText("polyline", {
      navigator: { clipboard: { writeText } },
      document,
    });

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("rapporteert een fout als beide kopieermethoden falen", async () => {
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });

    await expect(copyText("polyline", {
      navigator: {},
      document,
    })).rejects.toThrow("klembord");
  });
});

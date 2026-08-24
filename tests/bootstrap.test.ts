import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForSdkGlobals } from "../src/bootstrap";

describe("WME SDK-bootstrap", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("wacht wanneer WME de SDK-globals pas na het userscript publiceert", async () => {
    vi.useFakeTimers();
    const pageWindow: {
      SDK_INITIALIZED?: Promise<undefined>;
      getWmeSdk?: NonNullable<Window["getWmeSdk"]>;
      setTimeout: Window["setTimeout"];
    } = {
      setTimeout: window.setTimeout.bind(window),
    };
    const initialized = Promise.resolve(undefined);
    const getWmeSdk = vi.fn() as unknown as NonNullable<Window["getWmeSdk"]>;

    const pending = waitForSdkGlobals({
      pageWindow,
      pageDocument: document,
      timeoutMs: 1_000,
      pollIntervalMs: 50,
    });
    pageWindow.SDK_INITIALIZED = initialized;
    pageWindow.getWmeSdk = getWmeSdk;
    await vi.advanceTimersByTimeAsync(50);

    await expect(pending).resolves.toEqual({ initialized, getWmeSdk });
  });

  it("geeft na de wachttijd een bruikbare foutmelding", async () => {
    vi.useFakeTimers();
    const pending = waitForSdkGlobals({
      pageWindow: {
        setTimeout: window.setTimeout.bind(window),
      },
      pageDocument: document,
      timeoutMs: 100,
      pollIntervalMs: 25,
    });
    const assertion = expect(pending).rejects.toThrow("@grant none");

    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
});

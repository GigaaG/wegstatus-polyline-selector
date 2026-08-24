type GetWmeSdk = NonNullable<Window["getWmeSdk"]>;

interface RuntimeWindow {
  SDK_INITIALIZED?: Promise<undefined>;
  getWmeSdk?: GetWmeSdk;
  setTimeout(callback: () => void, delay: number): number;
}

export interface SdkGlobals {
  initialized: Promise<undefined>;
  getWmeSdk: GetWmeSdk;
}

export interface SdkWaitOptions {
  pageWindow?: RuntimeWindow;
  pageDocument?: Pick<Document, "readyState" | "addEventListener">;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

function readSdkGlobals(pageWindow: RuntimeWindow): SdkGlobals | null {
  if (!pageWindow.SDK_INITIALIZED || !pageWindow.getWmeSdk) {
    return null;
  }

  return {
    initialized: pageWindow.SDK_INITIALIZED,
    getWmeSdk: pageWindow.getWmeSdk,
  };
}

async function waitForDomContentLoaded(
  pageDocument: Pick<Document, "readyState" | "addEventListener">,
): Promise<void> {
  if (pageDocument.readyState !== "loading") {
    return;
  }

  await new Promise<void>((resolve) => {
    pageDocument.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
  });
}

export async function waitForSdkGlobals(options: SdkWaitOptions = {}): Promise<SdkGlobals> {
  const pageWindow = options.pageWindow ?? window;
  const pageDocument = options.pageDocument ?? document;
  const timeoutMs = options.timeoutMs ?? 30_000;
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

    await new Promise<void>((resolve) => {
      pageWindow.setTimeout(resolve, Math.min(pollIntervalMs, remainingMs));
    });
  }

  throw new Error(
    "De WME SDK is na 30 seconden nog niet beschikbaar. Controleer of het script met @grant none in WME draait.",
  );
}

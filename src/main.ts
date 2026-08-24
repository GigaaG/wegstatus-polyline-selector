import type { WmeSDK } from "wme-sdk-typings";
import { waitForSdkGlobals } from "./bootstrap";
import { PolylineController } from "./controller";
import { createSdkPort } from "./sdk-adapter";

async function start(): Promise<void> {
  const { initialized, getWmeSdk } = await waitForSdkGlobals();
  await initialized;
  const sdk: WmeSDK = getWmeSdk({
    scriptId: "wegstatus-polyline-selector",
    scriptName: "Wegstatus Polyline Selector",
  });

  new PolylineController(createSdkPort(sdk)).init();
}

void start().catch((error: unknown) => {
  console.error("[Wegstatus Polyline Selector] Initialisatie mislukt.", error);
});

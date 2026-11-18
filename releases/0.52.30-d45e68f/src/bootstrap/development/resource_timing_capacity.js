import { getBrowserStartupEnvironment } from "../../platform/browser/runtime/browser_startup_environment.js";

// Spec 157 R9: browsers keep 250 Resource Timing entries by default and drop the rest, while dev.html loads about 800
// files before the game starts. The DEV entry calls this before it imports the startup graph, so the startup overlay
// sees every request. Production does not need it: the measurer sets the buffer before the page's scripts run.
export const DEV_RESOURCE_TIMING_CAPACITY = 4000;

export function enlargeResourceTimingBuffer() {
  const { windowTarget } = getBrowserStartupEnvironment();
  windowTarget.performance?.setResourceTimingBufferSize?.(DEV_RESOURCE_TIMING_CAPACITY);
}

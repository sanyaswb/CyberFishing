import { startBrowserStartupLoadMeter } from "../../platform/browser/ui/startup_load_meter.js";
import { STARTUP_LABELS } from "../../game/presentation/hud/startup_labels.js";

// Spec 157 D5: the startup screen's progress, started by the release's boot module before the game's bundle arrives.
export function startStartupLoadMeter() {
  return startBrowserStartupLoadMeter(STARTUP_LABELS);
}

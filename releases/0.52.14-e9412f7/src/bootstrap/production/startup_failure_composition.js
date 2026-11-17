import { showBrowserStartupFailure } from "../../platform/browser/ui/startup_failure_screen.js";
import { STARTUP_LABELS } from "../../game/presentation/hud/startup_labels.js";

// Spec 157 R3: the start failed: the startup screen shows the error text and a retry button. Called by the game's
// startup and, for a bundle that could not load at all, by the release's boot module (through the meter's entry).
export function showStartupFailure() {
  return showBrowserStartupFailure(STARTUP_LABELS);
}

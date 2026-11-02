import { UiHintRenderer } from "../../game/presentation/ui/ui_hint_renderer.js";
import { UI_HINT_CONFIG } from "../../game/presentation/ui/ui_hint_config.js";
import { HintSheetController } from "../../platform/browser/dom/hint_sheet_controller.js";
import { BrowserTimeoutScheduler } from "../../platform/browser/time/browser_timeout_scheduler.js";

export function composeHintRenderer({ domFactory, uiSurface = null, timers = null, inlineDurationMs = UI_HINT_CONFIG.durationMs }) {
  return new UiHintRenderer({ domFactory, sheetController: new HintSheetController({ uiSurface, inlineDurationMs,
    timers: timers || new BrowserTimeoutScheduler(domFactory.view), config: UI_HINT_CONFIG,
    motionPreference: domFactory.view?.matchMedia?.("(prefers-reduced-motion: reduce)") }) });
}

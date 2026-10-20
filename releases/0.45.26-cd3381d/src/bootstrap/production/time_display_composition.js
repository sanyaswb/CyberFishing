import { TimeDisplay } from "../../platform/browser/ui/time_display.js";
import { DoubleActivationController } from "../../platform/browser/dom/double_activation_controller.js";
import { BrowserTimeoutScheduler } from "../../platform/browser/time/browser_timeout_scheduler.js";
import { BrowserWallClock } from "../../platform/browser/time/browser_wall_clock.js";
import { GAME_TIME_CONFIG } from "../../game/config/raw/time/game_time_config.js";
import { HUD_LABELS } from "../../game/presentation/hud/hud_labels.js";

export function composeTimeDisplay({ documentRef, mount, clock, onActivate = null, onDoubleActivate = null,
  timers = null, nowMs = null }) {
  if (!onActivate && !onDoubleActivate) return new TimeDisplay({ documentRef, mount, labels: HUD_LABELS });
  const wallClock = new BrowserWallClock();
  return new TimeDisplay({ documentRef, mount, labels: HUD_LABELS, onActivate, onDoubleActivate,
    activationController: new DoubleActivationController({ timers: timers || new BrowserTimeoutScheduler(documentRef.defaultView),
      nowMs: nowMs || (() => wallClock.nowMs()), config: GAME_TIME_CONFIG.activation }) });
}

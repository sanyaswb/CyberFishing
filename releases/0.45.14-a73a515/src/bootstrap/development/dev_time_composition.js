import { composeTimeDisplay } from "../production/time_display_composition.js";
import { TimePhaseControl } from "../../game/application/world/time_phase_control.js";
import { GAME_TIME_CONFIG } from "../../game/config/raw/time/game_time_config.js";
import { DevTimeControl } from "../../dev/time/dev_time_control.js";

export function composeDevTimeDisplay({ documentRef, mount, clock, config, uiSurface, timers = null, nowMs = null }) {
  let control;
  const phase = new TimePhaseControl({ clock, phaseHours: GAME_TIME_CONFIG.phaseHours });
  const view = composeTimeDisplay({ documentRef, mount, clock, timers, nowMs,
    onActivate: () => control.advance(), onDoubleActivate: () => control.advancePhase() });
  control = new DevTimeControl({ clock, view, isEnabled: () => config.debug?.timeAccelerationEnabled === true,
    changePhase: () => phase.advance(),
    baseScale: () => config.debug?.timeScale || 1,
    reserveWidth: expanded => uiSurface?.mountRoot.parentNode.classList.toggle("ui-surface--time-accelerated", expanded) });
  return control;
}

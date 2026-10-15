import { TimeDisplay } from "../../platform/browser/ui/time_display.js";
import { HUD_LABELS } from "../../game/presentation/hud/hud_labels.js";
import { DevTimeControl } from "../../dev/time/dev_time_control.js";

export function composeDevTimeDisplay({ documentRef, mount, clock, config, uiSurface }) {
  let control;
  const view = new TimeDisplay({ documentRef, mount, labels: HUD_LABELS, onActivate: () => control.advance() });
  control = new DevTimeControl({ clock, view, isEnabled: () => config.debug?.timeAccelerationEnabled === true,
    baseScale: () => config.debug?.timeScale || 1,
    reserveWidth: expanded => uiSurface?.mountRoot.parentNode.classList.toggle("ui-surface--time-accelerated", expanded) });
  return control;
}

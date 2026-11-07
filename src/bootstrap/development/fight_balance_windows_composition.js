import { ActiveFishWindowContent } from "../../dev/overlay/windows/active_fish_window_content.js";
import { ActiveRodWindowContent } from "../../dev/overlay/windows/active_rod_window_content.js";
import { FightBalanceParameterSchema } from "../../dev/overlay/windows/fight_balance_parameter_schema.js";
import { FightBalanceWindows } from "../../dev/overlay/windows/fight_balance_windows.js";
import { OverlayScaleControls } from "../../dev/overlay/dom/overlay_scale_controls.js";
import { OverlayToolWindow } from "../../dev/overlay/windows/overlay_tool_window.js";
import { OverlayUpdateLoop } from "../../dev/overlay/core/overlay_update_loop.js";
import { OverlayWindowDragController } from "../../dev/overlay/dom/overlay_window_drag_controller.js";

// Spec 168: the DEV overlay windows «🐟 ACTIVE FISH» and «🎣 ACTIVE ROD» (switches activeFish / activeRod in the overlay
// settings). Every edit goes through updateConfig (DevTools.updateConfig); the windows start at once and ask for the live
// data only while one of them is on.
export function composeFightBalanceWindows({ documentTarget, windowTarget, mountNode, uiSurface, settingsStore, storageCache,
  config, baseConfig, fishes, items, updateConfig }) {
  const schema = new FightBalanceParameterSchema();
  const toolWindow = (id, modifier, title) => new OverlayToolWindow({ documentTarget, mountNode, title, modifier,
    createScaleControls: (options) => new OverlayScaleControls(options),
    createDragController: (element) => new OverlayWindowDragController({ element, config, id,
      windowTarget, cache: storageCache, uiSurface }) });
  const windows = new FightBalanceWindows({ documentTarget, settingsStore, cache: storageCache,
    createUpdateLoop: (callback) => new OverlayUpdateLoop({ callback, intervalMs: Number(config.debug?.overlayUpdateMs) || 150 }),
    windows: [
      { key: "activeFish", window: toolWindow("overlay_active_fish", "debug-overlay--active-fish", "🐟 ACTIVE FISH"),
        content: new ActiveFishWindowContent({ config, fishes, schema, updateConfig }) },
      { key: "activeRod", window: toolWindow("overlay_active_rod", "debug-overlay--active-rod", "🎣 ACTIVE ROD"),
        content: new ActiveRodWindowContent({ config, baseConfig, items, schema, updateConfig }) },
    ] });
  windows.start();
  return windows;
}

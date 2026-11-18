import { ScreenHost } from "../../engine/screens/screen_host.js";
import { HouseEntryControl } from "../../platform/browser/ui/house_entry_control.js";
import { HUD_LABELS } from "../../game/presentation/hud/hud_labels.js";

// Spec 179 D12 (TK-371): the house over the game page (spec 084's screen). The HUD's house button asks the game
// whether the tackle is put away; opening the screen puts the player in the house (the world goes on, the location's
// effects on the player stop), closing it brings them back. createHouseScreen is the screen's lazy factory
// ({ close }) → { dispose() } (production: the stylesheet and the house's code load on the first visit).
// Returns { open (the HUD's checked entry), openDirect (DEV: no check), dispose }.
export function composeHouseVisit({ documentTarget, uiSurface, game, createHouseScreen, logger }) {
  const screens = new ScreenHost({
    base: { suspend: () => game.enterHouse(), resume: () => game.leaveHouse() },
    factories: { house: createHouseScreen },
  });
  const report = (error) => logger.error(error);
  const openDirect = () => screens.open("house").catch(report);
  const open = () => (game.requestHouseEntry() ? openDirect() : Promise.resolve());
  const control = new HouseEntryControl({ documentRef: documentTarget, mountNode: uiSurface.mountRoot,
    label: HUD_LABELS.house, onEnter: () => void open() });
  return Object.freeze({
    open,
    openDirect,
    dispose() {
      control.dispose();
      screens.dispose();
    },
  });
}

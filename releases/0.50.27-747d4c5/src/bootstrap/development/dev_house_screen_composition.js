import { composeDevTimeDisplay } from "./dev_time_composition.js";

// The DEV House screen factory for ScreenHost (spec 084). The House runs over the session's services; the DEV clock
// rate moves from the game's time control to the House's on open and back on close, in memory (formerly a page
// handoff), and the House header gets a DevTools toggle.
export function createDevHouseScreenFactory({ documentTarget, windowTarget, uiSurface, config, getSessionServices,
  getGameTimeControl, getDevTools, loadHouseScreen = () => import("../production/house_screen_composition.js") }) {
  return async ({ close }) => {
    const { composeHouseScreen } = await loadHouseScreen();
    const gameTimeControl = getGameTimeControl();
    const rate = gameTimeControl?.suspend();
    let houseTimeControl = null;
    const house = composeHouseScreen({ documentTarget, windowTarget, uiSurface, ...getSessionServices(), onExit: close,
      createTimeDisplay: (options) => {
        houseTimeControl = composeDevTimeDisplay({ ...options, config });
        houseTimeControl.resume(rate);
        return houseTimeControl;
      },
      mountHeaderControl: (mountNode) => getDevTools()?.mountScreenToggle(mountNode) ?? null });
    return { dispose: () => {
      const back = houseTimeControl?.suspend();
      house.dispose();
      gameTimeControl?.resume(back);
    } };
  };
}

import { getBrowserStartupEnvironment } from "../../platform/browser/runtime/browser_startup_environment.js";
import { startDevelopmentGame } from "./development_game_startup.js";
import { startDevelopmentHouse } from "./development_house_startup.js";

export function startDevelopmentPage() {
  const { windowTarget } = getBrowserStartupEnvironment();
  const page = new windowTarget.URLSearchParams(windowTarget.location.search).get("page");
  return page === "house" ? startDevelopmentHouse() : startDevelopmentGame();
}

import { CONFIG } from "../../game/config/runtime/game_config.js";
import { PROJECT_VERSION_CONFIG } from "../../game/presentation/version/project_version.js";
import { BrowserGameLifecycle } from "../../platform/browser/runtime/browser_game_lifecycle.js";
import { InactiveDevFlags } from "../../game/application/session/inactive_dev_flags.js";
import { ActiveGameLoopGuard } from "../../platform/browser/runtime/active_game_loop_guard.js";
import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";
import { activateBrowserStartupInterface, getBrowserStartupEnvironment, publishBrowserStartupConfig } from "../../platform/browser/runtime/browser_startup_environment.js";
import { createProductionConfigContext } from "./game_config_composition.js";
import { GameVersionBadge } from "./game_version_badge.js";
import { GameCompositionRoot } from "./game_composition_root.js";
import { Game } from "./game.js";

let startup;
// One loop guard per page, shared by every game this realm starts.
let gameLoopGuard;

// One startup per ESM realm, including concurrent calls from the same entry module.
export function startProductionGame() {
  if (startup) return startup;
  const requested = startGame();
  startup = requested;
  requested.catch(() => { if (startup === requested) startup = null; });
  return requested;
}

async function startGame() {
  const { windowTarget, documentTarget } = getBrowserStartupEnvironment();
  const configRuntime = createProductionConfigContext();
  publishBrowserStartupConfig(windowTarget, configRuntime, PROJECT_VERSION_CONFIG);
  const disposeInterface = activateBrowserStartupInterface(documentTarget, () => GameVersionBadge.mountById());
  const browserLifecycle = new BrowserGameLifecycle(windowTarget);
  browserLifecycle.cleanupPreviousGame();
  gameLoopGuard ??= new ActiveGameLoopGuard({ logger: new ConsoleLogger(), warningTarget: windowTarget });
  const compositionRoot = new GameCompositionRoot(CONFIG, {
    loadRandomInventoryId: () => import("../../platform/browser/inventory/random_inventory_id.js"),
    loadBrowserEventTargetAdapter: () => import("../../platform/browser/runtime/browser_event_target_adapter.js"),
    loadBrowserTimeoutScheduler: () => import("../../platform/browser/time/browser_timeout_scheduler.js"),
    loadInventoryAssemblyProfileConfig: () => import("../../game/config/inventory/inventory_composition_config.js"),
    documentTarget,
    windowTarget,
    gameLoopGuard,
    createDevFlags: () => new InactiveDevFlags(),
  });
  const game = new Game("gameCanvas", compositionRoot);
  browserLifecycle.publishGame(game);
  browserLifecycle.publishWatchdog(null);

  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    browserLifecycle.removePagehideListener(cleanup);
    game.dispose();
    disposeInterface?.();
    browserLifecycle.clearPublishedHandles(game, null, cleanup);
  };
  browserLifecycle.installPagehideCleanup(cleanup);
  try {
  await game.ready;
  if (disposed) { game.dispose(); return game; }
  const started = await game.start();
  if (disposed) return game;
  if (!started) {
    new ConsoleLogger().error(new Error("[Bootstrap] CyberFishing game loop did not start."));
  }
  return game;
  } catch (error) { cleanup(); throw error; }
}

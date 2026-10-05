import { CONFIG } from "../../game/config/runtime/game_config.js";
import { PROJECT_VERSION_CONFIG } from "../../game/presentation/version/project_version.js";
import { FixedCatchFishFactory } from "../../game/application/fishing/fixed_catch_fish_factory.js";
import { GameplayOverrideReader } from "../../game/application/fishing/gameplay_override_reader.js";
import { BrowserGameLifecycle } from "../../platform/browser/runtime/browser_game_lifecycle.js";
import { DevFlagsProvider } from "../../platform/browser/runtime/legacy_runtime_adapters.js";
import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";
import { activateBrowserStartupInterface, getBrowserStartupEnvironment, publishBrowserStartupConfig } from "../../platform/browser/runtime/browser_startup_environment.js";
import { createProductionConfigContext } from "./game_config_composition.js";
import { GameVersionBadge } from "./game_version_badge.js";
import { GameCompositionRoot } from "./game_composition_root.js";
import { Game } from "./game.js";

let startup;

// One startup per ESM realm, including concurrent calls from the same entry module.
export function startProductionGame() {
  return startup ??= startGame();
}

async function startGame() {
  const { windowTarget, documentTarget } = getBrowserStartupEnvironment();
  const configRuntime = createProductionConfigContext();
  publishBrowserStartupConfig(windowTarget, configRuntime, PROJECT_VERSION_CONFIG);
  activateBrowserStartupInterface(documentTarget, () => GameVersionBadge.mountById());
  const browserLifecycle = new BrowserGameLifecycle(windowTarget);
  browserLifecycle.cleanupPreviousGame();
  const overrides = new GameplayOverrideReader(CONFIG);
  const compositionRoot = new GameCompositionRoot(CONFIG, {
    loadRandomInventoryId: () => import("../../platform/browser/inventory/random_inventory_id.js"),
    loadBrowserEventTargetAdapter: () => import("../../platform/browser/runtime/legacy_runtime_adapters.js"),
    loadBrowserTimeoutScheduler: () => import("../../platform/browser/time/browser_timeout_scheduler.js"),
    loadInventoryAssemblyProfileConfig: () => import("../../game/config/inventory/inventory_composition_config.js"),
    documentTarget,
    windowTarget,
    createDevFlags: config => new DevFlagsProvider({ config, godModeSource: () => overrides }),
    createFixedCatchFishFactory: options => new FixedCatchFishFactory(options),
  });
  const game = new Game("gameCanvas", compositionRoot);
  browserLifecycle.publishGame(game);
  const started = await game.start();
  browserLifecycle.publishWatchdog(null);

  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    browserLifecycle.removePagehideListener(cleanup);
    game.dispose();
    browserLifecycle.clearPublishedHandles(game, null);
  };
  browserLifecycle.installPagehideCleanup(cleanup);
  if (!started) {
    new ConsoleLogger().error(new Error("[Bootstrap] CyberFishing game loop did not start."));
  }
  compositionRoot.printStorageUsage();
  return game;
}

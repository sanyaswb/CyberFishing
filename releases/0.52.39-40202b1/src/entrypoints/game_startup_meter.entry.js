import { startStartupLoadMeter } from "../bootstrap/production/startup_load_meter_composition.js";

// Spec 157 D5: the release's boot module of each game page imports this first (a small bundle of its own).
startStartupLoadMeter();

// Spec 157 R3: the boot module's answer to a game bundle that could not load.
export { showStartupFailure } from "../bootstrap/production/startup_failure_composition.js";

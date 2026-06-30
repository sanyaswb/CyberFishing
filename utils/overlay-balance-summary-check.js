const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({
  console,
  CONFIG: {
    physics: {
      fight: {
        directionForce: {
          towardPlayerMultiplier: 0,
          sideMultiplier: 1,
          awayMultiplier: 2.5,
        },
      },
    },
  },
  window: {},
});

const files = [
  "src/debug/overlay/config/overlay_modules_config.js",
  "src/debug/overlay/services/overlay_settings_store.js",
  "src/debug/overlay/services/overlay_view_state_store.js",
  "src/debug/overlay/services/overlay_html_builder.js",
  "src/debug/overlay/services/overlay_value_formatter.js",
  "src/debug/overlay/core/overlay_module_base.js",
  "src/debug/overlay/modules/echo_overlay_module.js",
  "src/debug/overlay/modules/fish_balance/fish_live_force_summary_section.js",
  "src/debug/overlay/modules/fish_balance/fish_state_force_preview_section.js",
  "src/debug/overlay/modules/fish_balance/fish_summary_overlay_module.js",
  "src/debug/overlay/modules/fish_balance/fish_current_force_overlay_module.js",
  "src/debug/overlay/modules/fish_balance/fish_debuffs_summary_overlay_module.js",
  "src/debug/overlay/modules/fish_balance_overlay_module.js",
  "src/debug/overlay/modules/fight_summary/fight_summary_overlay_module.js",
  "src/debug/overlay/modules/fight_summary/line_and_drag_summary_overlay_module.js",
  "src/debug/overlay/modules/fight_summary/rod_control_summary_overlay_module.js",
  "src/debug/overlay/modules/fight_summary/fish_movement_summary_overlay_module.js",
];

for (const relativePath of files) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

const modules = context.window.OVERLAY_MODULES;
assertEquals(modules.fishBalance, true, "fishBalance enabled by default");
assertEquals(modules.fishSummary, false, "fishSummary optional disabled by default");
assertEquals(modules.fishCurrentForce, false, "fishCurrentForce optional disabled by default");
assertEquals(modules.fishDebuffsSummary, false, "fishDebuffsSummary optional disabled by default");
assertEquals(modules.fishBase, false, "fishBase balance disabled by default");
assert(!Object.prototype.hasOwnProperty.call(modules, "fishStates"), "fishStates legacy module is removed");
assertEquals(modules.debuffsLive, false, "debuffsLive balance disabled by default");
assertEquals(modules.fightSummary, false, "fightSummary balance disabled by default");
assertEquals(modules.lineAndDragSummary, false, "lineAndDragSummary balance disabled by default");
assertEquals(modules.rodControlSummary, false, "rodControlSummary optional by default");
assertEquals(modules.staminaBalance, false, "staminaBalance disabled by default");
assertEquals(modules.worstCase, false, "worstCase balance disabled by default");
assertEquals(modules.fightPhysics, false, "legacy fightPhysics remains advanced");

const groups = context.window.OVERLAY_MODULE_GROUPS;
assert(Array.isArray(groups), "overlay module groups exist");
assertIncludes(JSON.stringify(groups), "Balance", "Balance group exists");
assertIncludes(JSON.stringify(groups), "Advanced", "Advanced group exists");
assertIncludes(JSON.stringify(groups), "fightTension", "legacy fightTension listed in groups");
const balanceKeys = context.window.BALANCE_OVERLAY_MODULE_KEYS;
const advancedKeys = context.window.ADVANCED_OVERLAY_MODULE_KEYS;
for (const key of ["fishBase", "debuffsLive", "worstCase", "playerMax", "liveY", "liveX"]) {
  assertIncludes(JSON.stringify(balanceKeys), key, `${key} moved to Balance group`);
  assertExcludes(JSON.stringify(advancedKeys), key, `${key} removed from Advanced group`);
}
assertExcludes(JSON.stringify(context.window.OPTIONAL_OVERLAY_MODULE_KEYS), "worstCase", "worstCase removed from Optional group");
assertExcludes(JSON.stringify(groups), "fishStates", "fishStates duplicate hidden from grouped switchers");

const labels = context.window.OVERLAY_MODULE_LABELS;
assertEquals(labels.fishBase.label, "Базова сила риби", "fishBase Ukrainian label exists");
assertEquals(labels.fishBase.original, "fishBase", "fishBase original label remains available");
assertEquals(labels.debuffsLive.label, "Дебафи наживо", "debuffsLive Ukrainian label exists");
assertEquals(labels.playerMax.label, "Максимум гравця", "playerMax Ukrainian label exists");
assertEquals(labels.liveY.original, "liveY", "liveY original label remains available");
assertEquals(labels.liveX.original, "liveX", "liveX original label remains available");

const data = createDebugData();
const viewStateStore = new context.window.OverlayViewStateStore({
  fishStatesDirectionMode: "away",
});
const options = {
  viewStateStore,
  configSource: () => context.CONFIG,
};
const echo = new context.window.EchoModule(options);
assertEquals(echo.shouldRender({ gameState: "scouting" }), false, "Echo is hidden before cast");
assertEquals(echo.shouldRender({ gameState: "waiting" }), true, "Echo is visible after cast");
assertEquals(echo.shouldRender({ gameState: "scouting", isBoatSonar: true }), true, "Boat sonar can render during scouting");

const fishBalance = new context.window.FishBalanceModule(options);
let html = fishBalance.render(data);
assertIncludes(html, "FISH BALANCE", "FishBalance renders header");
assertIncludes(html, "ПОТОЧНА СИЛА", "FishBalance renders live force summary");
assertIncludes(html, "З множниками", "FishBalance renders current state max force with multipliers");
assertIncludes(html, "(-0.020 кг)", "FishBalance renders base force loss inline");
assertIncludes(html, "(-0.080 кг)", "FishBalance renders multiplied force loss inline");
assertExcludes(html, "Виснаження", "FishBalance no longer renders separate exhaustion force loss row");
assertIncludes(html, "STATE FORCE PREVIEW", "FishBalance renders state force preview");
assertExcludes(html, "FISH SUMMARY", "FishBalance no longer renders fish summary subsection");
assertExcludes(html, "CURRENT FORCE", "FishBalance no longer renders current force subsection");
assertExcludes(html, "DEBUFFS", "FishBalance no longer renders debuffs subsection");
assertIncludes(html, "AWAY", "FishBalance reuses direction tabs preview");
assertExcludes(html, "Random debuff", "FishBalance does not render random debuff summary by default");
assertEquals(data.fishRuntimeBehaviorStates.swim.forceMultiplier, 1, "FishBalance does not mutate behaviorProfile");


const fishSummary = new context.window.FishSummaryOverlayModule(options);
html = fishSummary.render(data);
assertIncludes(html, "FISH SUMMARY", "FishSummary optional module renders header");
assertIncludes(html, "Fish weight", "FishSummary renders weight");

const fishCurrentForce = new context.window.FishCurrentForceOverlayModule(options);
html = fishCurrentForce.render(data);
assertIncludes(html, "CURRENT FISH FORCE", "FishCurrentForce optional module renders header");
assertIncludes(html, "Fish opposition", "FishCurrentForce renders opposition");

const fishDebuffs = new context.window.FishDebuffsSummaryOverlayModule(options);
html = fishDebuffs.render(data);
assertIncludes(html, "FISH DEBUFFS", "FishDebuffs optional module renders header");
assertIncludes(html, "Random debuff", "FishDebuffs renders random debuff");

const fightSummary = new context.window.FightSummaryOverlayModule(options);
html = fightSummary.render(data);
assertIncludes(html, "FIGHT SUMMARY", "FightSummary renders header");
assertIncludes(html, "Fish opposition", "FightSummary renders fish opposition");
assertIncludes(html, "Player pressure", "FightSummary renders player pressure");
assertIncludes(html, "Break risk", "FightSummary renders break risk");

const lineDrag = new context.window.LineAndDragSummaryOverlayModule(options);
html = lineDrag.render(data);
assertIncludes(html, "LINE &amp; DRAG", "LineAndDrag renders header");
assertIncludes(html, "Remaining", "LineAndDrag renders remaining line");
assertIncludes(html, "Drag state", "LineAndDrag renders drag state");

const rodControl = new context.window.RodControlSummaryOverlayModule(options);
html = rodControl.render(data);
assertIncludes(html, "ROD CONTROL SUMMARY", "RodControlSummary renders header");
assertIncludes(html, "Hold", "RodControlSummary renders hold");
assertIncludes(html, "Blocked", "RodControlSummary renders blocked reason");

const fishMovement = new context.window.FishMovementSummaryOverlayModule(options);
html = fishMovement.render(data);
assertIncludes(html, "FISH MOVEMENT SUMMARY", "FishMovementSummary renders header");
assertIncludes(html, "Fish pressure", "FishMovementSummary renders pressure");
assertIncludes(html, "Actual move", "FishMovementSummary renders movement");

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const expected of [
  "src/debug/overlay/modules/fish_balance/fish_live_force_summary_section.js",
  "src/debug/overlay/modules/fish_balance/fish_state_force_preview_section.js",
  "src/debug/overlay/modules/fish_balance/fish_summary_overlay_module.js",
  "src/debug/overlay/modules/fish_balance/fish_current_force_overlay_module.js",
  "src/debug/overlay/modules/fish_balance/fish_debuffs_summary_overlay_module.js",
  "src/debug/overlay/modules/fish_balance_overlay_module.js",
  "src/debug/overlay/modules/fight_summary/fight_summary_overlay_module.js",
  "src/debug/overlay/modules/fight_summary/line_and_drag_summary_overlay_module.js",
  "src/debug/overlay/modules/fight_summary/rod_control_summary_overlay_module.js",
  "src/debug/overlay/modules/fight_summary/fish_movement_summary_overlay_module.js",
]) {
  assertIncludes(indexHtml, expected, `${expected} script is present`);
  assertScriptOrder(indexHtml, expected, "src/debug/overlay/overlay_bootstrap.js", `${expected} loads before bootstrap`);
}

const bootstrap = fs.readFileSync(path.join(root, "src/debug/overlay/overlay_bootstrap.js"), "utf8");
for (const expected of [
  "new FishBalanceModule",
  "new FishSummaryOverlayModule",
  "new FishCurrentForceOverlayModule",
  "new FishDebuffsSummaryOverlayModule",
  "new FightSummaryOverlayModule",
  "new LineAndDragSummaryOverlayModule",
  "new RodControlSummaryOverlayModule",
  "new FishMovementSummaryOverlayModule",
  "new FightPhysicsOverlayModule",
]) {
  assertIncludes(bootstrap, expected, `${expected} registered in bootstrap`);
}
assertExcludes(bootstrap, "new FishStatesModule", "FishStates legacy module is not registered");
assertExcludes(indexHtml, "src/debug/overlay/modules/fish_states_overlay_module.js", "FishStates legacy script is not loaded");

console.log("Overlay balance summary checks passed.");

function createDebugData() {
  return {
    gameState: "playing",
    fishWeightKg: 0.8,
    fishBasePower: 1,
    fishState: "swim",
    fishDirectionState: "away",
    directionResistanceMultiplier: 2.5,
    lastDashActive: false,
    fishPassiveKg: 0.16,
    fishActiveKg: 0.4,
    fishOppositionKg: 0.56,
    fishBaseForceCurrentKg: 0.16,
    fishBaseForceWithoutPowerDebuffKg: 0.18,
    fishBaseForcePowerLossKg: 0.02,
    fishCurrentStateMaxForceKg: 0.56,
    fishStateMaxForceWithoutPowerDebuffKg: 0.64,
    fishStateMaxForcePowerLossKg: 0.08,
    fishRuntimeForceMultiplier: 0.82,
    fishStateTargetForceMultiplier: 1,
    fishPowerRatio: 0.8888889,
    fishOppositionWithoutExhaustionKg: 0.64,
    fishOppositionExhaustionLossKg: 0.08,
    fishStateForceMultiplier: 0.82,
    activeDebuffName: "restWeight",
    isMasteryActive: false,
    masteryCurrentMult: 1,
    enduranceMovementDebuffActive: true,
    enduranceMovementDebuffProgress: 0.64,
    enduranceMovementDebuffPower: 0.64,
    enduranceEffectiveRadialMin: -0.42,
    enduranceEffectiveRadialMax: 0.52,
    fishRuntimeBehaviorStates: {
      idle: { forceMultiplier: 0.7, speedMultiplier: 1, weight: 25 },
      rest: { forceMultiplier: 0.3, speedMultiplier: 0.5, weight: 25 },
      swim: { forceMultiplier: 1, speedMultiplier: 1, weight: 25 },
      dash: { forceMultiplier: 1.2, speedMultiplier: 1.5, weight: 25 },
    },
    playerHoldTensionKg: 0.22,
    rodControlPlayerTensionKg: 0.08,
    totalTensionKg: 0.86,
    weakestTackleLimitKg: 1,
    netForceKg: -0.26,
    failureChance: 0,
    lineDebug: {
      totalLineMeters: 6,
      releasedLineMeters: 4.2,
      remainingLineMeters: 1.8,
      fullyExtended: false,
      hardLineLimit: false,
      lineReleasedThisFrameMeters: 0.02,
      lineRecoveredThisFrameMeters: 0,
    },
    dragRatio: 0.6,
    dragLimitKg: 0.6,
    shouldSlipDrag: false,
    dragBlockedForceKg: 0.24,
    rodPullForceKg: 0.25,
    rodHoldMaxKg: 1,
    rodStrokeUsed: 0.8,
    rodStrokeCapacity: 2,
    rodControlActive: true,
    rodControlInputDirectionX: 1,
    rodControlInputRatio: 0.64,
    rodControlLineAngleDeg: 32,
    rodControlDirectionFactor: 1,
    rodControlLoadReserveKg: 0.42,
    rodControlForceKg: 0.18,
    rodControlBlockedReason: "none",
    fishPressureRelation: "away_from_player",
    fishPressureRelationLabel: "від гравця",
    fishPressureStrengthKg: 0.56,
    fishPressureSpeedPxPerSec: 24,
    fishPressureDirectionLabel: "UP",
    fishMovementRelation: "sideways",
    fishMovementRelationLabel: "боком",
    fishMovementStrengthKg: 0.2,
    fishMovementActualSpeedPxPerSec: 12,
    fishMovementDirectionLabel: "RIGHT",
    fishActualBlockedReason: "none",
    fightMovementTargetSpeedPxPerSec: 20,
    fightMovementActualSpeedPxPerSec: 12,
    fishMovementMode: "free",
  };
}

function assert(value, label) {
  if (!value) throw new Error(label);
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`${label}: expected output to include "${expected}"`);
  }
}

function assertEquals(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertScriptOrder(html, first, second, label) {
  const firstIndex = html.indexOf(first);
  const secondIndex = html.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1 || firstIndex >= secondIndex) {
    throw new Error(`${label}: expected ${first} before ${second}`);
  }
}

function assertExcludes(value, expected, label) {
  if (value.includes(expected)) {
    throw new Error(`${label}: output unexpectedly includes "${expected}"`);
  }
}

// Startup stages (spec 157 R9): the page records one performance mark per stage, named STARTUP_MARK_PREFIX + stage,
// in this order. The DEV startup overlay and `npm run measure:startup` read the same names; "ready" is the
// moment the game can be played (stage A: the first frame after the loop started; later the minimal barrier of
// spec 083) and also sets the page's data-game-ready attribute.
export const STARTUP_MARK_PREFIX = "startup:";

export const STARTUP_STAGES = Object.freeze({
  entry: "entry",
  config: "config",
  location: "location",
  inventory: "inventory",
  scene: "scene",
  composition: "composition",
  loop: "loop",
  ready: "ready",
});

export const STARTUP_STAGE_ORDER = Object.freeze(Object.values(STARTUP_STAGES));

export const STARTUP_MARKS_METHODS = Object.freeze(["mark", "markReady"]);

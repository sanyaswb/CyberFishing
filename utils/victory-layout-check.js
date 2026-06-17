const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const context = vm.createContext({ console, Math, Number, Object });
vm.runInContext(
  fs.readFileSync(
    path.join(ROOT, "src/render/screens/victory_layout_resolver.js"),
    "utf8",
  ),
  context,
);
vm.runInContext(`
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
const resolver = new VictoryLayoutResolver();
const desktop = resolver.resolve({
  width: 800,
  height: 700,
  config: {},
  statCount: 3,
});
const claim = { ...desktop.claim };
const release = { ...desktop.release };
assert(claim.x + claim.width <= release.x, "Victory buttons do not overlap");
assert(claim.y === release.y, "Victory buttons share one layout row");
const reused = resolver.resolve({
  width: 360,
  height: 640,
  config: {},
  statCount: 7,
});
assert(reused === desktop, "Victory layout result is reused in place");
assert(reused.panel.width <= 360 - 16, "Victory layout responds to narrow viewports");
assert(reused.stats.rows === 3, "Victory layout supports extra victoryStats rows");
assert(
  reused.claim.y + reused.claim.height <= reused.panel.y + reused.panel.height,
  "Victory actions stay inside the responsive panel",
);
console.log("victory-layout-check passed:");
for (const message of checks) console.log("- " + message);
`, context);

const stateSource = fs.readFileSync(
  path.join(ROOT, "src/app/states.js"),
  "utf8",
);
const rendererSource = fs.readFileSync(
  path.join(ROOT, "src/render/screens/victory_renderer.js"),
  "utf8",
);
const bootstrapSource = fs.readFileSync(
  path.join(ROOT, "src/app/bootstrap.js"),
  "utf8",
);
if (
  !stateSource.includes("this.deps.victoryLayoutResolver.resolve({") ||
  !rendererSource.includes("const layout = model.layout;") ||
  !bootstrapSource.includes(
    "layoutResolver: runtime.rendering.victoryLayoutResolver",
  )
) {
  throw new Error("Victory renderer and hit-test do not share one resolver");
}
console.log("- renderer and VictoryState use the same injected layout resolver");

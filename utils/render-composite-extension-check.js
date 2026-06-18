const fs = require("node:fs");
const path = require("node:path");
const { RenderTestHarness } = require("./helpers/render_test_harness");

const ROOT = path.resolve(__dirname, "..");
const harness = new RenderTestHarness(ROOT);
const context = harness.createContext({ console, Object, Set, TypeError, Error });

harness.load(context, [
  "src/render/core/render_component.js",
  "src/render/core/composite_renderer.js",
]);

harness.run(context, `
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
const calls = [];
const renderer = (id) => ({ render(model) { calls.push(id + ":" + model.value); } });
const composite = new CompositeRenderer({
  components: [
    new RenderComponent({
      id: "late",
      order: 20,
      renderer: renderer("late"),
      selectModel: (model) => model.late,
    }),
    new RenderComponent({
      id: "early",
      order: 10,
      renderer: renderer("early"),
      selectModel: (model) => model.early,
    }),
    new RenderComponent({
      id: "hidden",
      order: 15,
      renderer: renderer("hidden"),
      selectModel: (model) => model.hidden,
      isVisible: (model) => model.visible,
    }),
  ],
});
composite.render({
  early: { value: 1 },
  hidden: { value: 2, visible: false },
  late: { value: 3 },
});
assert(calls.join("|") === "early:1|late:3", "composite renders registered components by order");
assert(composite.getComponentIdAt(0) === "early", "composite exposes safe component ids");
let duplicateFailed = false;
try {
  new CompositeRenderer({
    components: [
      new RenderComponent({ id: "x", renderer: renderer("a"), selectModel: (m) => m }),
      new RenderComponent({ id: "x", renderer: renderer("b"), selectModel: (m) => m }),
    ],
  });
} catch (error) {
  duplicateFailed = error.message.includes("Duplicate render component id");
}
assert(duplicateFailed, "duplicate component id fails during bootstrap");
let missingRendererFailed = false;
try {
  new RenderComponent({ id: "missing", renderer: {}, selectModel: (m) => m });
} catch (error) {
  missingRendererFailed = error.message.includes("renderer.render");
}
assert(missingRendererFailed, "missing renderer contract fails fast");
console.log("render-composite-extension-check passed:");
for (const message of checks) console.log("- " + message);
`, "utils/render-composite-extension-check.js#scenario");

const bootstrapSource = fs.readFileSync(path.join(ROOT, "src/app/bootstrap.js"), "utf8");
for (const marker of [
  "new FishingSceneRenderer({",
  "new FightHudRenderer({",
  "new WorldRenderPass({",
]) {
  if (!bootstrapSource.includes(marker)) {
    throw new Error(`Composition root missing ${marker}`);
  }
}
if ((bootstrapSource.match(/new RenderComponent/g) || []).length < 9) {
  throw new Error("Scene components must be registered in composition root");
}
console.log("- scene components are registered in composition root");

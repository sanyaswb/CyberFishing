const fs = require("node:fs");
const path = require("node:path");
const { RenderTestHarness } = require("./helpers/render_test_harness");

const ROOT = path.resolve(__dirname, "..");
const harness = new RenderTestHarness(ROOT);
const context = harness.createContext({
  console,
  Object,
  String,
  TypeError,
});

harness.load(context, ["src/app/core/dependency_contract_validator.js"]);

harness.run(context, `
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function expectContractError(action, expectedParts, message) {
  let error = null;
  try {
    action();
  } catch (caught) {
    error = caught;
  }
  assert(error instanceof TypeError, message + " throws TypeError");
  for (let index = 0; index < expectedParts.length; index += 1) {
    assert(error.message.includes(expectedParts[index]), message + " error includes " + expectedParts[index]);
  }
}
const validator = new DependencyContractValidator({
  stage: "bootstrap",
  consumer: "ContractCheck",
});
validator.requireMethods({ render() {} }, "renderer", ["render"]);
validator.requireProperties({ ready: true }, "asset", ["ready"]);
assert(true, "complete contracts pass");
expectContractError(
  () => validator.requireMethods({}, "renderer", ["render"]),
  ["bootstrap", "ContractCheck", "renderer.render"],
  "incomplete renderer contract",
);
expectContractError(
  () => validator.requireMethods({ id: "pass" }, "renderPass", ["render"]),
  ["bootstrap", "ContractCheck", "renderPass.render"],
  "incomplete render pass contract",
);
expectContractError(
  () => validator.requireMethods({ getTension() { return 0; } }, "tensionPresentationSource", [
    "getTension",
    "getTensionKg",
    "getEffectiveMaxTackleLoadKg",
    "getStressRatio",
    "getBreakReason",
    "getDebugFrame",
  ]),
  ["bootstrap", "ContractCheck", "tensionPresentationSource.getTensionKg"],
  "incomplete presentation source contract",
);
expectContractError(
  () => validator.requireProperties({}, "layoutResult", ["panel"]),
  ["bootstrap", "ContractCheck", "layoutResult.panel"],
  "incomplete property contract",
);
console.log("dependency-contract-check runtime passed:");
for (const message of checks) console.log("- " + message);
`, "utils/dependency-contract-check.js#runtime");

const bootstrapSource = fs.readFileSync(path.join(ROOT, "src/app/bootstrap.js"), "utf8");
if (!bootstrapSource.includes("new DependencyContractValidator")) {
  throw new Error("GameCompositionRoot must create DependencyContractValidator during bootstrap");
}
if (!bootstrapSource.includes("requireMethods(imageAssets")) {
  throw new Error("GameCompositionRoot must validate asset provider contract");
}
if (!bootstrapSource.includes("#validateRenderContracts")) {
  throw new Error("GameCompositionRoot must validate renderer contracts");
}
if (!bootstrapSource.includes("#validateFrameBuilderContracts")) {
  throw new Error("GameCompositionRoot must validate frame builder contracts");
}
console.log("- GameCompositionRoot validates required dependencies during bootstrap");

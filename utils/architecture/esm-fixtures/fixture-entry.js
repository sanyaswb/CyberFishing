import {
  FixtureAccumulator,
  doubleFixtureValue,
} from "./modules/static-math.js";

export const ESM_FIXTURE_KIND = "cyber-fishing-isolated-esm-fixture";

export async function runEsmFixture() {
  const accumulator = new FixtureAccumulator(2);
  const staticValue = doubleFixtureValue(accumulator.add(3));
  const {
    createDynamicFixtureValue,
  } = await import("./modules/dynamic-value.js");
  return Object.freeze({
    kind: ESM_FIXTURE_KIND,
    staticValue,
    dynamicValue: createDynamicFixtureValue(staticValue + 1),
  });
}

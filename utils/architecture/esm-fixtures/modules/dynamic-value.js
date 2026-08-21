export const DYNAMIC_FIXTURE_LABEL = "dynamic-import-ok";

export function createDynamicFixtureValue(value) {
  return Object.freeze({ value, source: DYNAMIC_FIXTURE_LABEL });
}

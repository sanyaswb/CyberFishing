const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const Assertion = CheckAssertion.create("Hook domain semantics check");

class HookDomainSemanticsCheck {
  #sourceRuntime;
  #runtime;

  constructor() {
    this.#sourceRuntime = new SourceRuntime();
    this.#sourceRuntime.loadMany([
      "src/config/databases/item_db.js",
      "src/core/items/quality/item_quality_grade_policy.js",
      "src/core/items/quality/hook_quality_modifier.js",
      "src/core/items/hook/hook_power_policy.js",
    ]).expose({
      DB: "ITEM_DB",
      PowerPolicy: "HookPowerPolicy",
    });
    this.#runtime = this.#sourceRuntime.context;
  }

  run() {
    const hook = this.#runtime.DB.hooks.hook_basic;
    Assertion.equal(hook.gameplayStats.hookSizeGrade, 1, "hook owns explicit size grade");
    Assertion.equal(hook.gameplayStats.hookPowerGrade, 1, "hook owns explicit power grade");
    Assertion.that(
      !("equipmentPowerLevel" in hook.gameplayStats),
      "hook no longer overloads equipmentPowerLevel",
    );
    Assertion.near(
      new this.#runtime.PowerPolicy().resolve({
        hookPowerGrade: hook.gameplayStats.hookPowerGrade,
        weight: hook.gameplayStats.weight,
        qualityGrade: hook.gameplayStats.quality,
      }),
      0.05,
      "hook power preserves the previous numeric balance",
    );

    const rules = this.#sourceRuntime.read("src/app/rules.js");
    const states = this.#sourceRuntime.read("src/app/states.js");
    const debug = this.#sourceRuntime.read("src/app/debug.js");
    const formatter = this.#sourceRuntime.read("src/debug/services/debug_formatters.js");
    Assertion.that(
      rules.includes("hookSizeGrade") &&
        states.includes("hookSizeGrade") &&
        debug.includes("hookSizeGrade"),
      "all hook-size consumers use the domain-specific field",
    );
    Assertion.that(
      formatter.includes("new HookPowerPolicy()") &&
        !formatter.includes("equipmentPowerLevel * weight"),
      "debug delegates hook power instead of duplicating the formula",
    );
    console.log("Hook domain semantics checks passed.");
  }
}

new HookDomainSemanticsCheck().run();

const { CheckAssertion } = require("../../testing/core/check_assertion");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const Assertion = CheckAssertion.create("Degradation color check");

class RuntimeLoader {
  load() {
    const runtime = new SourceRuntime();
    runtime.loadMany([
      "src/game/presentation/visual/degradation_color_config.js",
      "src/game/presentation/visual/degradation_color_config_validator.js",
      "src/game/presentation/styles/degradation_color_resolver.js",
    ]).expose({
      CONFIGURATION: "DEGRADATION_COLOR_CONFIG",
      Validator: "DegradationColorConfigValidator",
      Resolver: "DegradationColorResolver",
    });
    return runtime.context;
  }
}

class DegradationColorCheck {
  #runtime;
  #resolver;

  constructor(runtime) {
    this.#runtime = runtime;
    this.#resolver = new runtime.Resolver({
      configProvider: () => runtime.CONFIGURATION,
    });
  }

  run() {
    this.#checkConfiguration();
    this.#checkInterpolation();
    this.#checkWorseningProgress();
    this.#checkBounds();
    console.log("Degradation resolver passed: configuration validation, clamping, immutability and progress output.");
  }

  #checkConfiguration() {
    const validator = new this.#runtime.Validator();
    const issues = validator.validate(this.#runtime.CONFIGURATION);
    Assertion.equal(issues.length, 0, `production config: ${JSON.stringify(issues)}`);
    const invalid = JSON.parse(JSON.stringify(this.#runtime.CONFIGURATION));
    invalid.colorStops[1].position = invalid.colorStops[0].position;
    Assertion.that(
      validator.validate(invalid).some((issue) => issue.path.endsWith(".position")),
      "duplicate stop positions are rejected",
    );
  }

  #checkInterpolation() {
    const middle = this.#resolver.resolvePercent(50);

    Assertion.that(Object.isFrozen(middle) && Object.isFrozen(middle.color), "resolved color is immutable");
  }

  #checkBounds() {
    const below = this.#resolver.resolvePercent(-10);
    const above = this.#resolver.resolvePercent(120);
    Assertion.equal(below.percent, 0, "values below range clamp to 0%");
    Assertion.equal(below.outOfRange, "below", "below-range state is exposed");
    Assertion.equal(above.percent, 100, "values above range clamp to 100%");
    Assertion.equal(above.outOfRange, "above", "above-range state is exposed");
  }

  #checkWorseningProgress() {
    const initial = this.#resolver.resolveWorseningProgress(0);
    const complete = this.#resolver.resolveWorseningProgress(100);

    Assertion.that(
      initial.cssColor.startsWith("rgba(") &&
        complete.cssGlowColor.startsWith("rgba("),
      "interaction progress exposes reusable translucent fill and glow colors",
    );
  }

}

new DegradationColorCheck(new RuntimeLoader().load()).run();

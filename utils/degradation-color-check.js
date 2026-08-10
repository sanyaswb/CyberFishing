const fs = require("node:fs");
const path = require("node:path");
const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const ROOT = path.resolve(__dirname, "..");
const Assertion = CheckAssertion.create("Degradation color check");

class RuntimeLoader {
  load() {
    const runtime = new SourceRuntime();
    runtime.loadMany([
      "src/config/visual/degradation_color_config.js",
      "src/config/validation/degradation_color_config_validator.js",
      "src/ui/styles/degradation_color_resolver.js",
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
    this.#checkAnchors();
    this.#checkInterpolation();
    this.#checkBounds();
    this.#checkCapacityIntegration();
    console.log("Degradation color config, resolver and Capacity integration passed.");
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

  #checkAnchors() {
    Assertion.equal(this.#resolver.resolvePercent(0).cssColor, "rgb(255, 0, 0)", "0% is red");
    Assertion.equal(this.#resolver.resolvePercent(1).cssColor, "rgb(255, 0, 0)", "1% is red");
    Assertion.equal(this.#resolver.resolvePercent(34).cssColor, "rgb(255, 128, 0)", "34% is orange");
    Assertion.equal(this.#resolver.resolvePercent(67).cssColor, "rgb(255, 255, 0)", "67% is yellow");
    Assertion.equal(this.#resolver.resolvePercent(100).cssColor, "rgb(0, 255, 128)", "100% is green");
  }

  #checkInterpolation() {
    const low = this.#resolver.resolvePercent(20);
    const middle = this.#resolver.resolvePercent(50);
    const high = this.#resolver.resolvePercent(80);
    Assertion.that(low.color[1] < middle.color[1], "green channel rises while recovering");
    Assertion.that(high.color[0] < middle.color[0], "red channel falls near full value");
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

  #checkCapacityIntegration() {
    const source = fs.readFileSync(
      path.join(ROOT, "src/ui/progression/item_progression_visual_resolver.js"),
      "utf8",
    );
    const css = fs.readFileSync(
      path.join(ROOT, "src/ui/styles/style.css"),
      "utf8",
    );
    Assertion.that(
      source.includes("this.#degradationColorResolver.resolvePercent(") &&
        source.includes("progression.capacity.percent"),
      "Capacity delegates color selection to the degradation system",
    );
    Assertion.that(
      css.includes("background: var(--item-capacity-color)"),
      "Capacity loaders use the resolved solid degradation color",
    );
  }
}

new DegradationColorCheck(new RuntimeLoader().load()).run();

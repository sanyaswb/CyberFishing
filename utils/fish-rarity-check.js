const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

class Assertion {
  static that(condition, message) {
    if (!condition) throw new Error(`Fish rarity check failed: ${message}`);
  }

  static equal(actual, expected, message) {
    this.that(
      actual === expected,
      `${message}; expected ${expected}, received ${actual}`,
    );
  }
}

class RuntimeLoader {
  loadClass(relativePath, className) {
    const context = vm.createContext({ console });
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    vm.runInContext(
      `${source}\nglobalThis.${className} = ${className};`,
      context,
      { filename: relativePath },
    );
    return context[className];
  }
}

class FishRarityFixture {
  constructor() {
    this.weightConfig = {
      maxLevel: 6,
      levelWeightRanges: [
        { level: 1, min: 0.05, max: 0.25 },
        { level: 2, min: 0.251, max: 0.75 },
        { level: 3, min: 0.751, max: 1.5 },
        { level: 4, min: 1.501, max: 2.5 },
        { level: 5, min: 2.501, max: 3.5 },
        { level: 6, min: 3.501, max: 5.0 },
      ],
    };
  }

  input(level, weightKg, overrides = {}) {
    return {
      level,
      weightKg,
      weightConfig: this.weightConfig,
      anomaly: "none",
      isUnique: false,
      ...overrides,
    };
  }
}

class FishRarityCheck {
  constructor(Calculator) {
    this.calculator = new Calculator({
      weightBandsPerLevel: 7,
      weightUnitsPerKg: 1000,
      maxHalfSteps: 12,
      maxStars: 6,
      noneAnomalyIds: ["", "none"],
    });
    this.fixture = new FishRarityFixture();
  }

  run() {
    this.#checkEveryLevelRange();
    this.#checkCrucianExamples();
    this.#checkHalfStarResolution();
    this.#checkRarestAnomalyThemeGate();
    this.#checkDerivedLevelRange();
  }

  #checkEveryLevelRange() {
    for (const range of this.fixture.weightConfig.levelWeightRanges) {
      const atMin = this.calculator.calculate(
        this.fixture.input(range.level, range.min),
      );
      const atMax = this.calculator.calculate(
        this.fixture.input(range.level, range.max),
      );
      Assertion.equal(
        atMin.halfSteps,
        range.level,
        `level ${range.level} minimum rarity`,
      );
      Assertion.equal(
        atMax.halfSteps,
        Math.min(12, range.level + 6),
        `level ${range.level} maximum rarity`,
      );
    }
  }

  #checkCrucianExamples() {
    const fourPointTwo = this.calculator.calculate(
      this.fixture.input(6, 4.2, { isUnique: true }),
    );
    Assertion.equal(fourPointTwo.halfSteps, 9, "4.200kg rarity score");
    Assertion.equal(fourPointTwo.stars, 4.5, "4.200kg visual stars");

    const fourPointEight = this.calculator.calculate(
      this.fixture.input(6, 4.8, { isUnique: true }),
    );
    Assertion.equal(fourPointEight.halfSteps, 12, "4.800kg rarity score");
    Assertion.equal(fourPointEight.stars, 6, "4.800kg visual stars");
    Assertion.that(fourPointEight.isCrown, "4.800kg catch should have crown");
    Assertion.that(
      fourPointEight.isRarest,
      "4.800kg unique catch should get the rarest theme",
    );

    Assertion.equal(
      this.calculator.calculate(this.fixture.input(6, 3.715)).halfSteps,
      6,
      "3.715kg remains in rarity 6",
    );
    Assertion.equal(
      this.calculator.calculate(this.fixture.input(6, 3.716)).halfSteps,
      7,
      "3.716kg starts rarity 7",
    );
    Assertion.equal(
      this.calculator.calculate(this.fixture.input(6, 3.93)).halfSteps,
      7,
      "3.930kg remains in rarity 7",
    );
    Assertion.equal(
      this.calculator.calculate(this.fixture.input(6, 3.931)).halfSteps,
      8,
      "3.931kg starts rarity 8",
    );
  }

  #checkHalfStarResolution() {
    const rarity = this.calculator.calculate(this.fixture.input(1, 0.05));
    Assertion.equal(rarity.halfSteps, 1, "first rarity half-step");
    Assertion.equal(rarity.stars, 0.5, "one half-filled star");
  }

  #checkRarestAnomalyThemeGate() {
    const ordinary = this.calculator.calculate(this.fixture.input(6, 5));
    Assertion.that(ordinary.isCrown, "maximum score should keep its crown");
    Assertion.that(
      !ordinary.isRarest,
      "ordinary fish should not get anomalous gold theme",
    );

    const anomalous = this.calculator.calculate(
      this.fixture.input(6, 5, { anomaly: "inside" }),
    );
    Assertion.that(
      anomalous.isRarest,
      "maximum-score anomalous fish should get gold theme",
    );
  }

  #checkDerivedLevelRange() {
    const rarity = this.calculator.calculate({
      level: 3,
      weightKg: 1.6568,
      weightConfig: { maxLevel: 5 },
      depthConfig: {
        minWeightAtMinDepth: 0.125,
        maxWeightAtMaxDepth: 2.678,
      },
    });
    Assertion.equal(rarity.halfSteps, 6, "derived range middle band");
    Assertion.equal(rarity.stars, 3, "derived range visual stars");
  }
}

const Calculator = new RuntimeLoader().loadClass(
  "src/core/fish/fish_rarity_calculator.js",
  "FishRarityCalculator",
);
new FishRarityCheck(Calculator).run();
console.log("Fish rarity checks passed.");

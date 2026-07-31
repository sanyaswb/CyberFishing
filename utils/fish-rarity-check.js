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
  loadClasses(definitions) {
    const context = vm.createContext({ console });
    for (const { relativePath, classNames } of definitions) {
      const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
      const exports = classNames
        .map((className) => `globalThis.${className} = ${className};`)
        .join("\n");
      vm.runInContext(`${source}\n${exports}`, context, {
        filename: relativePath,
      });
    }
    return context;
  }
}

class FishRarityFixture {
  constructor() {
    this.rarityProfile = {
      uniqueAtHalfSteps: 12,
      uniqueAnomalyId: "inside",
    };
    this.weightConfig = {
      rarityCurve: 1,
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
      rarityProfile: null,
      ...overrides,
    };
  }
}

class FishRarityCheck {
  constructor(
    Resolver,
    BiteSystem,
    RarityVisualResolver,
    VictoryThemeResolver,
    RarityConfigValidator,
    OutcomeRenderFrameBuilder,
    GameRenderFrame,
  ) {
    this.resolver = new Resolver({
      scale: {
        fishWeightBands: 7,
        weightUnitsPerKg: 1000,
        maxUnits: 12,
        unitsPerStar: 2,
      },
      fish: { noneAnomalyIds: ["", "none"] },
    });
    this.BiteSystem = BiteSystem;
    this.RarityVisualResolver = RarityVisualResolver;
    this.VictoryThemeResolver = VictoryThemeResolver;
    this.RarityConfigValidator = RarityConfigValidator;
    this.OutcomeRenderFrameBuilder = OutcomeRenderFrameBuilder;
    this.GameRenderFrame = GameRenderFrame;
    this.fixture = new FishRarityFixture();
  }

  run() {
    this.#checkGapLevelResolution();
    this.#checkBiteSystemGapIntegration();
    this.#checkEveryLevelRange();
    this.#checkCrucianExamples();
    this.#checkHalfStarResolution();
    this.#checkRarestAnomalyThemeGate();
    this.#checkDerivedLevelRange();
    this.#checkVisualScaleDistribution();
    this.#checkRarityConfigValidation();
    this.#checkVictoryRarityTransfer();
  }

  #checkEveryLevelRange() {
    for (const range of this.fixture.weightConfig.levelWeightRanges) {
      const atMin = this.resolver.resolveRarity(
        this.fixture.input(range.level, range.min),
      );
      const atMax = this.resolver.resolveRarity(
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
    const fourPointTwo = this.resolver.resolveRarity(
      this.fixture.input(6, 4.2, {
        rarityProfile: this.fixture.rarityProfile,
      }),
    );
    Assertion.equal(fourPointTwo.halfSteps, 9, "4.200kg rarity score");
    Assertion.equal(fourPointTwo.stars, 4.5, "4.200kg visual stars");
    Assertion.that(
      !fourPointTwo.isRarest,
      "non-maximum level-6 fish must not be unique",
    );

    const fourPointEight = this.resolver.resolveRarity(
      this.fixture.input(6, 4.8, {
        rarityProfile: this.fixture.rarityProfile,
      }),
    );
    Assertion.equal(fourPointEight.halfSteps, 12, "4.800kg rarity score");
    Assertion.equal(fourPointEight.stars, 6, "4.800kg visual stars");
    Assertion.that(
      fourPointEight.isMaximum,
      "4.800kg catch should have maximum rarity",
    );
    Assertion.that(
      fourPointEight.isRarest,
      "4.800kg unique catch should get the rarest theme",
    );

    Assertion.equal(
      this.resolver.resolveRarity(this.fixture.input(6, 3.715)).halfSteps,
      6,
      "3.715kg remains in rarity 6",
    );
    Assertion.equal(
      this.resolver.resolveRarity(this.fixture.input(6, 3.716)).halfSteps,
      7,
      "3.716kg starts rarity 7",
    );
    Assertion.equal(
      this.resolver.resolveRarity(this.fixture.input(6, 3.93)).halfSteps,
      7,
      "3.930kg remains in rarity 7",
    );
    Assertion.equal(
      this.resolver.resolveRarity(this.fixture.input(6, 3.931)).halfSteps,
      8,
      "3.931kg starts rarity 8",
    );
  }

  #checkHalfStarResolution() {
    const rarity = this.resolver.resolveRarity(this.fixture.input(1, 0.05));
    Assertion.equal(rarity.halfSteps, 1, "first rarity half-step");
    Assertion.equal(rarity.stars, 0.5, "one half-filled star");
  }

  #checkRarestAnomalyThemeGate() {
    const ordinary = this.resolver.resolveRarity(this.fixture.input(6, 5));
    Assertion.that(
      ordinary.isMaximum,
      "maximum score should keep its maximum marker",
    );
    Assertion.that(
      !ordinary.isRarest,
      "ordinary fish should not get anomalous gold theme",
    );

    const anomalous = this.resolver.resolveRarity(
      this.fixture.input(6, 5, {
        rarityProfile: this.fixture.rarityProfile,
      }),
    );
    Assertion.that(
      anomalous.isRarest,
      "maximum-score anomalous fish should get gold theme",
    );
  }

  #checkDerivedLevelRange() {
    const rarity = this.resolver.resolveRarity({
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

  #checkGapLevelResolution() {
    const profile = this.resolver.resolve({
      weightKg: 0.2505,
      weightConfig: this.fixture.weightConfig,
      rarityProfile: this.fixture.rarityProfile,
    });
    Assertion.equal(profile.level, 2, "0.2505kg gap weight level");
    Assertion.equal(profile.maxLevel, 6, "gap weight maximum level");
    Assertion.that(!profile.isUnique, "gap weight must not be unique");
    Assertion.equal(profile.rarity.halfSteps, 2, "gap weight rarity score");

    const belowMidpoint = this.resolver.resolve({
      weightKg: 0.2504,
      weightConfig: this.fixture.weightConfig,
      rarityProfile: this.fixture.rarityProfile,
    });
    Assertion.equal(
      belowMidpoint.level,
      1,
      "0.2504kg rounds to the lower gram range",
    );

    const invalidWeight = this.resolver.resolve({
      weightKg: NaN,
      weightConfig: this.fixture.weightConfig,
      rarityProfile: this.fixture.rarityProfile,
    });
    Assertion.equal(invalidWeight.level, 1, "invalid weight safe level");
    Assertion.that(!invalidWeight.isUnique, "invalid weight must not be unique");

    const noUniqueThreshold = this.resolver.resolve({
      weightKg: 5,
      weightConfig: this.fixture.weightConfig,
    });
    Assertion.that(
      !noUniqueThreshold.isUnique,
      "missing unique threshold must not mark a fish unique",
    );

    const imagePath =
      "assets/fish/crucian_stalker/crucian_stalker--{level}.webp".replace(
        "{level}",
        profile.level,
      );
    Assertion.equal(
      imagePath,
      "assets/fish/crucian_stalker/crucian_stalker--2.webp",
      "gap weight image level",
    );
  }

  #checkBiteSystemGapIntegration() {
    const fish = {
      id: "crucian_stalker",
      name: "Crucian Stalker",
      baseChance: 1,
      maxHookSize: 6,
      baitMultipliers: { test_bait: 1 },
      timeMultipliers: { day: 1 },
      dayMultipliers: { 1: 1 },
      weatherMultipliers: {},
      depthConfig: {
        minDepth: 0,
        maxDepth: 1,
        minWeightAtMinDepth: 0.2505,
        minWeightAtMaxDepth: 0.2505,
        maxWeightAtMinDepth: 0.2505,
        maxWeightAtMaxDepth: 0.2505,
      },
      weightConfig: this.fixture.weightConfig,
      visual: {
        imagePattern:
          "assets/fish/crucian_stalker/crucian_stalker--{level}.webp",
        uniqueImagePath:
          "assets/fish/crucian_stalker/crucian_stalker--unique.webp",
      },
      rarityProfile: this.fixture.rarityProfile,
      physics: {},
    };
    const rng = { next: () => 0, int: () => 0 };
    const biteSystem = new this.BiteSystem(
      [fish],
      { fightPhysicsConfig: {}, ui: { line: {} } },
      rng,
      null,
      this.resolver,
    );
    const environment = {
      hookDepth: 0.5,
      timePhase: "day",
      dayOfWeek: 1,
      zoneBonus: 1,
      chumBonus: 1,
      chumTargets: [],
      isRaining: false,
      isFoggy: false,
      castSpamMultiplier: 1,
      lineLength: 1,
      bottomDepth: 2,
    };
    const gear = {
      hookSize: 1,
      baits: ["test_bait"],
      baitTypes: ["float"],
      isPulling: false,
    };
    const caught = biteSystem.evaluateBite(
      1000,
      environment,
      gear,
    );

    Assertion.that(caught, "gap-weight fish should be generated");
    Assertion.equal(caught.level, 2, "generated gap-weight fish level");
    Assertion.that(!caught.isUnique, "generated gap-weight fish uniqueness");
    Assertion.equal(
      caught.imagePath,
      "assets/fish/crucian_stalker/crucian_stalker--2.webp",
      "generated gap-weight fish image",
    );
    Assertion.equal(
      caught.rarity.halfSteps,
      2,
      "generated gap-weight fish rarity",
    );

    fish.depthConfig = {
      minDepth: 0,
      maxDepth: 1,
      minWeightAtMinDepth: 5,
      minWeightAtMaxDepth: 5,
      maxWeightAtMinDepth: 5,
      maxWeightAtMaxDepth: 5,
    };
    const uniqueBiteSystem = new this.BiteSystem(
      [fish],
      { fightPhysicsConfig: {}, ui: { line: {} } },
      rng,
      null,
      this.resolver,
    );
    const uniqueCatch = uniqueBiteSystem.evaluateBite(
      1000,
      environment,
      gear,
    );
    Assertion.that(uniqueCatch.isUnique, "12/12 generated fish is unique");
    Assertion.equal(uniqueCatch.anomaly, "inside", "unique anomaly policy");
    Assertion.equal(
      uniqueCatch.imagePath,
      "assets/fish/crucian_stalker/crucian_stalker--unique.webp",
      "unique image contract",
    );
  }

  #checkVisualScaleDistribution() {
    const config = {
      preMaximumPosition: 0.8,
      colorStops: [
        { id: "common", position: 0, color: [145, 150, 160] },
        { id: "uncommon", position: 0.2, color: [0, 210, 120] },
        { id: "rare", position: 0.4, color: [0, 160, 255] },
        { id: "epic", position: 0.6, color: [170, 100, 255] },
        { id: "legendary", position: 0.8, color: [255, 70, 70] },
        { id: "unique", position: 1, color: [255, 205, 55] },
      ],
    };
    const visualResolver = new this.RarityVisualResolver({
      configProvider: () => config,
    });
    const themeResolver = new this.VictoryThemeResolver({
      rarityVisualResolver: visualResolver,
    });
    const levelFour = themeResolver.resolve({
      level: 4,
      maxLevel: 5,
      rarity: { isRarest: false },
    });
    Assertion.equal(levelFour.color[0], 170, "max-level-5 level 4 red channel");
    Assertion.equal(levelFour.color[1], 100, "max-level-5 level 4 green channel");
    const levelFive = themeResolver.resolve({
      level: 5,
      maxLevel: 5,
      rarity: { isRarest: false },
    });
    Assertion.equal(levelFive.color[0], 255, "ordinary maximum level is red");
    Assertion.equal(levelFive.color[1], 70, "ordinary maximum level is not gold");
    const unique = themeResolver.resolve({
      level: 5,
      maxLevel: 5,
      rarity: { isRarest: true },
    });
    Assertion.equal(unique.color[0], 255, "unique theme red channel");
    Assertion.equal(unique.color[1], 205, "unique theme gold channel");

    for (const maxLevel of [6, 9, 12]) {
      const first = visualResolver.resolveLevel(1, maxLevel, true);
      const last = visualResolver.resolveLevel(maxLevel, maxLevel, true);
      Assertion.equal(first.position, 0, `${maxLevel}-level scale start`);
      Assertion.equal(last.position, 0.8, `${maxLevel}-level scale end`);
    }
  }

  #checkRarityConfigValidation() {
    const rarityConfig = {
      scale: {
        maxUnits: 12,
        unitsPerStar: 2,
        fishWeightBands: 7,
        weightUnitsPerKg: 1000,
      },
      fish: { noneAnomalyIds: ["", "none"] },
      visual: {
        preMaximumPosition: 0.8,
        colorStops: [
          { id: "common", position: 0, color: [145, 150, 160] },
          { id: "unique", position: 1, color: [255, 205, 55] },
        ],
      },
    };
    const fish = {
      id: "fixture",
      rarityProfile: this.fixture.rarityProfile,
      weightConfig: this.fixture.weightConfig,
      visual: {},
    };
    const validator = new this.RarityConfigValidator();
    Assertion.equal(
      validator.validate({ rarityConfig, fishDb: [fish] }).length,
      0,
      "valid rarity config",
    );

    const gapFish = JSON.parse(JSON.stringify(fish));
    gapFish.weightConfig.levelWeightRanges[1].min = 0.252;
    const gapErrors = validator.validate({ rarityConfig, fishDb: [gapFish] });
    Assertion.that(
      gapErrors.some((issue) => issue.message.includes("gap")),
      "config validator detects normalized weight gaps",
    );

    const earlyUniqueFish = JSON.parse(JSON.stringify(fish));
    earlyUniqueFish.rarityProfile.uniqueAtHalfSteps = 6;
    const uniqueErrors = validator.validate({
      rarityConfig,
      fishDb: [earlyUniqueFish],
    });
    Assertion.that(
      uniqueErrors.some((issue) => issue.path.includes("uniqueAtHalfSteps")),
      "config validator rejects non-maximum unique threshold",
    );
  }

  #checkVictoryRarityTransfer() {
    const builder = new this.OutcomeRenderFrameBuilder({
      canvasMetrics: { width: 800, height: 600 },
      clock: { realNow: 100 },
      styleResolver: { resolveVictory: () => ({}) },
      layoutResolver: { resolve: () => ({}) },
    });
    const frame = new this.GameRenderFrame();
    const resolved = this.resolver.resolve({
      weightKg: 4.2,
      weightConfig: this.fixture.weightConfig,
      rarityProfile: this.fixture.rarityProfile,
    }).rarity;
    builder.buildInto({
      target: frame.outcome,
      intent: {
        visible: true,
        mode: "victory",
        fish: { id: "fixture", level: 6, maxLevel: 6, weight: 4.2, rarity: resolved },
      },
    });
    Assertion.equal(
      frame.outcome.victory.fish.rarity.halfSteps,
      9,
      "Victory preserves resolved rarity",
    );

    frame.reset();
    builder.buildInto({
      target: frame.outcome,
      intent: {
        visible: true,
        mode: "victory",
        fish: { id: "fixture", level: 6, maxLevel: 6, weight: 4.2 },
      },
    });
    Assertion.that(
      frame.outcome.victory.fish.rarity.isResolved === false,
      "Victory uses an unknown descriptor when domain rarity is missing",
    );
  }
}

const runtime = new RuntimeLoader().loadClasses([
  {
    relativePath: "src/core/fish/fish_rarity_resolver.js",
    classNames: ["FishRarityResolver"],
  },
  {
    relativePath: "src/systems/bite_system.js",
    classNames: ["BiteSystem"],
  },
  {
    relativePath: "src/ui/styles/rarity_visual_resolver.js",
    classNames: ["RarityVisualResolver"],
  },
  {
    relativePath: "src/render/screens/victory_theme_resolver.js",
    classNames: ["VictoryThemeResolver"],
  },
  {
    relativePath: "src/config/validation/rarity_config_validator.js",
    classNames: ["RarityConfigValidator"],
  },
  {
    relativePath: "src/render/core/image_asset_provider.js",
    classNames: ["ImageAssetProvider"],
  },
  {
    relativePath: "src/render/core/render_frame_buffer.js",
    classNames: ["GameRenderFrame"],
  },
  {
    relativePath: "src/app/rendering/outcome_render_frame_builder.js",
    classNames: ["OutcomeRenderFrameBuilder"],
  },
]);
new FishRarityCheck(
  runtime.FishRarityResolver,
  runtime.BiteSystem,
  runtime.RarityVisualResolver,
  runtime.VictoryThemeResolver,
  runtime.RarityConfigValidator,
  runtime.OutcomeRenderFrameBuilder,
  runtime.GameRenderFrame,
).run();
console.log("Fish rarity checks passed.");

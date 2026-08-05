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
    FishAnomalyVariantResolver,
    FishVisualVariantResolver,
    FixedCatchFishFactory,
    HookedFishProfileSynchronizer,
    RarityAnimationResolver,
  ) {
    const rarityScale = Object.freeze({
      fishWeightBands: 7,
      weightUnitsPerKg: 1000,
      maxUnits: 12,
      unitsPerStar: 2,
    });
    this.resolver = new Resolver({
      scale: rarityScale,
      fish: { noneAnomalyIds: ["", "none"] },
    });
    this.visualVariantResolver = new FishVisualVariantResolver({
      noneAnomalyIds: ["", "none"],
    });
    this.anomalyVariantResolver = new FishAnomalyVariantResolver();
    this.fixedCatchFishFactory = new FixedCatchFishFactory({
      fishRarityResolver: this.resolver,
      fishAnomalyVariantResolver: this.anomalyVariantResolver,
      fishVisualVariantResolver: this.visualVariantResolver,
    });
    this.hookedFishProfileSynchronizer =
      new HookedFishProfileSynchronizer({
        fishRarityResolver: this.resolver,
        fishVisualVariantResolver: this.visualVariantResolver,
      });
    this.BiteSystem = BiteSystem;
    this.RarityVisualResolver = RarityVisualResolver;
    this.VictoryThemeResolver = VictoryThemeResolver;
    this.RarityConfigValidator = RarityConfigValidator;
    this.OutcomeRenderFrameBuilder = OutcomeRenderFrameBuilder;
    this.GameRenderFrame = GameRenderFrame;
    this.RarityAnimationResolver = RarityAnimationResolver;
    this.fixture = new FishRarityFixture();
  }

  run() {
    this.#checkGapLevelResolution();
    this.#checkBiteSystemGapIntegration();
    this.#checkEveryLevelRange();
    this.#checkCrucianExamples();
    this.#checkHalfStarResolution();
    this.#checkUniqueAnomalyThemeGate();
    this.#checkAnomalyVariantSelection();
    this.#checkDerivedLevelRange();
    this.#checkVisualScaleDistribution();
    this.#checkRarityConfigValidation();
    this.#checkFixedCatchRarity();
    this.#checkDevToolsWeightSynchronization();
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
    const fourPointTwoProfile = this.resolver.resolve(
      this.fixture.input(6, 4.2),
    );
    const fourPointTwo = fourPointTwoProfile.rarity;
    Assertion.equal(fourPointTwo.halfSteps, 9, "4.200kg rarity score");
    Assertion.equal(fourPointTwo.stars, 4.5, "4.200kg visual stars");
    Assertion.that(
      !fourPointTwoProfile.isUnique,
      "non-maximum level-6 fish must not be unique",
    );

    const fourPointEightProfile = this.resolver.resolve(
      this.fixture.input(6, 4.8),
    );
    const fourPointEight = fourPointEightProfile.rarity;
    Assertion.equal(fourPointEight.halfSteps, 12, "4.800kg rarity score");
    Assertion.equal(fourPointEight.stars, 6, "4.800kg visual stars");
    Assertion.that(
      fourPointEight.isMaximum,
      "4.800kg catch should have maximum rarity",
    );
    Assertion.that(
      !fourPointEightProfile.isUnique,
      "maximum weight without anomaly remains ordinary",
    );

    const anomalousFourPointTwoProfile = this.resolver.resolve(
      this.fixture.input(6, 4.2, {
        baseAnomaly: "inside",
      }),
    );
    const anomalousFourPointTwo = anomalousFourPointTwoProfile.rarity;
    Assertion.equal(
      anomalousFourPointTwo.halfSteps,
      9,
      "anomaly does not alter weight rarity",
    );
    Assertion.that(
      anomalousFourPointTwoProfile.isUnique,
      "anomaly makes a non-maximum fish unique",
    );
    Assertion.that(
      !("isRarest" in anomalousFourPointTwo),
      "weight rarity must not expose an anomaly-derived isRarest flag",
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

  #checkUniqueAnomalyThemeGate() {
    const ordinary = this.resolver.resolve(this.fixture.input(6, 5));
    Assertion.that(
      ordinary.rarity.isMaximum,
      "maximum score should keep its maximum marker",
    );
    Assertion.that(
      !ordinary.isUnique,
      "ordinary fish should not get anomalous gold theme",
    );

    const anomalous = this.resolver.resolve(
      this.fixture.input(1, 0.05, {
        baseAnomaly: "inside",
      }),
    );
    Assertion.that(
      anomalous.isUnique,
      "minimum-weight anomalous fish should be unique",
    );
    Assertion.equal(
      anomalous.rarity.stars,
      0.5,
      "unique fish keeps its independent minimum weight rarity",
    );
    Assertion.that(
      !anomalous.rarity.isMaximum,
      "unique fish does not imply maximum weight rarity",
    );

    const visual = {
      imagePattern: "assets/fish/fixture/fixture--{level}.webp",
      uniqueImagePattern: "assets/fish/fixture/fixture--{level}-uniq.webp",
    };
    Assertion.equal(
      this.visualVariantResolver.resolveImagePath({
        visual,
        fishId: "fixture",
        level: 6,
        isUnique: true,
        anomaly: "none",
      }),
      "assets/fish/fixture/fixture--6.webp",
      "unique image also requires the anomaly policy",
    );
  }

  #checkAnomalyVariantSelection() {
    const config = {
      enabled: true,
      anomalyId: "inside",
      chance: 0.01,
      locationIds: ["test"],
    };
    const selected = this.anomalyVariantResolver.resolve({
      config,
      locationId: "test",
      roll: 0.009,
    });
    Assertion.that(selected.hasAnomaly, "anomaly roll below chance succeeds");
    Assertion.equal(selected.anomalyId, "inside", "selected anomaly id");

    const missed = this.anomalyVariantResolver.resolve({
      config,
      locationId: "test",
      roll: 0.01,
    });
    Assertion.that(!missed.hasAnomaly, "anomaly chance uses an exclusive roll");

    const wrongLocation = this.anomalyVariantResolver.resolve({
      config,
      locationId: "other",
      roll: 0,
      chanceOverride: 1,
    });
    Assertion.that(
      !wrongLocation.hasAnomaly,
      "100% chance override preserves configured locations",
    );

    const forced = this.anomalyVariantResolver.resolve({
      config,
      locationId: "test",
      roll: 0.999,
      chanceOverride: 1,
    });
    Assertion.that(
      forced.hasAnomaly,
      "100% chance override succeeds at a normally failing roll",
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
    });
    Assertion.equal(profile.level, 2, "0.2505kg gap weight level");
    Assertion.equal(profile.maxLevel, 6, "gap weight maximum level");
    Assertion.that(!profile.isUnique, "gap weight must not be unique");
    Assertion.equal(profile.rarity.halfSteps, 2, "gap weight rarity score");

    const belowMidpoint = this.resolver.resolve({
      weightKg: 0.2504,
      weightConfig: this.fixture.weightConfig,
    });
    Assertion.equal(
      belowMidpoint.level,
      1,
      "0.2504kg rounds to the lower gram range",
    );

    const invalidWeight = this.resolver.resolve({
      weightKg: NaN,
      weightConfig: this.fixture.weightConfig,
    });
    Assertion.equal(invalidWeight.level, 1, "invalid weight safe level");
    Assertion.that(!invalidWeight.isUnique, "invalid weight must not be unique");

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
        uniqueImagePattern:
          "assets/fish/crucian_stalker/crucian_stalker--{level}-uniq.webp",
      },
      physics: {},
    };
    const rng = { next: () => 0, int: () => 0 };
    const biteSystem = new this.BiteSystem(
      [fish],
      { fightPhysicsConfig: {}, ui: { line: {} } },
      rng,
      null,
      this.resolver,
      this.anomalyVariantResolver,
      this.visualVariantResolver,
    );
    const environment = {
      locationId: "test",
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
    fish.anomalyVariant = {
      enabled: true,
      anomalyId: "inside",
      chance: 1,
      locationIds: ["test"],
    };
    const uniqueBiteSystem = new this.BiteSystem(
      [fish],
      { fightPhysicsConfig: {}, ui: { line: {} } },
      rng,
      null,
      this.resolver,
      this.anomalyVariantResolver,
      this.visualVariantResolver,
    );
    const uniqueCatch = uniqueBiteSystem.evaluateBite(
      1000,
      environment,
      gear,
    );
    Assertion.that(uniqueCatch.hasAnomaly, "generated anomaly flag is true");
    Assertion.that(uniqueCatch.isUnique, "generated anomalous fish is unique");
    Assertion.equal(uniqueCatch.anomaly, "inside", "unique anomaly policy");
    Assertion.equal(
      uniqueCatch.imagePath,
      "assets/fish/crucian_stalker/crucian_stalker--6-uniq.webp",
      "unique image contract",
    );

    fish.anomalyVariant.chance = 0.01;
    const highRollRng = { next: () => 0.999, int: () => 0 };
    const ordinaryBiteSystem = new this.BiteSystem(
      [fish],
      { fightPhysicsConfig: {}, ui: { line: {} } },
      highRollRng,
      null,
      this.resolver,
      this.anomalyVariantResolver,
      this.visualVariantResolver,
    );
    const ordinaryHighRollCatch = ordinaryBiteSystem.evaluateBite(
      1000,
      environment,
      gear,
    );
    Assertion.that(
      !ordinaryHighRollCatch.isUnique,
      "configured anomaly chance normally fails at a high roll",
    );

    const godModeBiteSystem = new this.BiteSystem(
      [fish],
      {
        fightPhysicsConfig: {},
        ui: { line: {} },
        debug: {
          godMode: {
            enabled: true,
            fixedBiteChanceEnabled: false,
            forceAnomalyChance: true,
          },
        },
      },
      highRollRng,
      null,
      this.resolver,
      this.anomalyVariantResolver,
      this.visualVariantResolver,
    );
    const forcedAnomalyCatch = godModeBiteSystem.evaluateBite(
      1000,
      environment,
      gear,
    );
    Assertion.that(
      forcedAnomalyCatch.hasAnomaly && forcedAnomalyCatch.isUnique,
      "God Mode forces eligible anomaly chance to 100%",
    );
    Assertion.equal(
      forcedAnomalyCatch.imagePath,
      "assets/fish/crucian_stalker/crucian_stalker--6-uniq.webp",
      "God Mode forced anomaly uses the unique level skin",
    );
  }

  #checkVisualScaleDistribution() {
    const config = {
      colorStops: [
        { id: "common", position: 0, color: [145, 150, 160] },
        { id: "uncommon", position: 0.2, color: [0, 210, 120] },
        { id: "rare", position: 0.4, color: [0, 160, 255] },
        { id: "epic", position: 0.6, color: [170, 100, 255] },
        { id: "legendary", position: 0.8, color: [255, 70, 70] },
        { id: "unique", position: 1, color: [255, 205, 55] },
      ],
      frame: {
        borderWidth: 1.5,
        backgroundAlpha: 0.15,
        panelGlow: 20,
        panelGlowAlpha: 0.35,
        strokeAlpha: 0.75,
      },
      uniqueEffects: {
        pulseDurationMs: 1200,
        frameDash: [12, 7],
        frameDashSpeedPxPerSecond: 22.222,
        borderWidthMin: 2.5,
        borderWidthMax: 3.5,
        panelGlowMin: 30,
        panelGlowMax: 52,
        panelGlowAlpha: 0.35,
        imageGlowMin: 14,
        imageGlowMax: 32,
        imageGlowAlpha: 0.95,
        backgroundAlphaMin: 0.18,
        backgroundAlphaMax: 0.3,
        strokeAlpha: 0.75,
      },
    };
    const visualResolver = new this.RarityVisualResolver({
      configProvider: () => config,
      animationResolver: new this.RarityAnimationResolver(),
    });
    const themeResolver = new this.VictoryThemeResolver({
      rarityVisualResolver: visualResolver,
    });
    const levelFour = themeResolver.resolve({
      level: 4,
      maxLevel: 5,
      isUnique: false,
    });
    Assertion.equal(levelFour.color[0], 170, "max-level-5 level 4 red channel");
    Assertion.equal(levelFour.color[1], 100, "max-level-5 level 4 green channel");
    const levelFive = themeResolver.resolve({
      level: 5,
      maxLevel: 5,
      isUnique: false,
    });
    Assertion.equal(levelFive.color[0], 255, "ordinary maximum level is red");
    Assertion.equal(levelFive.color[1], 70, "ordinary maximum level is not gold");
    const ordinaryLowRarity = themeResolver.resolve({
      level: 1,
      maxLevel: 5,
      isUnique: false,
      rarity: { stars: 0.5, isMaximum: false },
    });
    const unique = themeResolver.resolve({
      level: 1,
      maxLevel: 5,
      isUnique: true,
      rarity: { stars: 0.5, isMaximum: false },
    });
    Assertion.equal(
      ordinaryLowRarity.color[0],
      145,
      "ordinary half-star fish keeps the common theme",
    );
    Assertion.that(
      !ordinaryLowRarity.isAnimated,
      "ordinary half-star fish is not animated",
    );
    Assertion.equal(unique.color[0], 255, "low-rarity unique theme red channel");
    Assertion.equal(unique.color[1], 205, "low-rarity unique theme gold channel");
    Assertion.that(
      unique.isAnimated,
      "low-rarity unique descriptor is animated",
    );
    Assertion.equal(
      unique.frameDash.join(","),
      config.uniqueEffects.frameDash.join(","),
      "unique descriptor uses configured frame dash",
    );
    Assertion.equal(
      unique.glow.panelAlpha,
      config.uniqueEffects.panelGlowAlpha,
      "unique descriptor uses configured panel glow",
    );
    Assertion.equal(
      levelFive.borderWidth,
      config.frame.borderWidth,
      "ordinary descriptor uses configured border width",
    );
    Assertion.equal(
      levelFive.background.alpha,
      config.frame.backgroundAlpha,
      "ordinary descriptor uses configured background alpha",
    );

    for (const maxLevel of [6, 9, 12]) {
      const first = visualResolver.resolveLevel(1, maxLevel);
      const last = visualResolver.resolveLevel(maxLevel, maxLevel);
      Assertion.equal(first.position, 0, `${maxLevel}-level scale start`);
      Assertion.equal(
        last.position,
        0.8,
        `${maxLevel}-level ordinary scale ends before unique`,
      );
    }
    Assertion.equal(
      visualResolver.preMaximumPosition,
      0.8,
      "ordinary maximum derives from penultimate color stop",
    );
  }

  #checkRarityConfigValidation() {
    const rarityConfig = {
      scale: Object.freeze({
        maxUnits: 12,
        unitsPerStar: 2,
        fishWeightBands: 7,
        weightUnitsPerKg: 1000,
      }),
      fish: { noneAnomalyIds: ["", "none"] },
      visual: {
        colorStops: [
          { id: "common", position: 0, color: [145, 150, 160] },
          { id: "uncommon", position: 0.2, color: [0, 210, 120] },
          { id: "rare", position: 0.4, color: [0, 160, 255] },
          { id: "epic", position: 0.6, color: [170, 100, 255] },
          { id: "legendary", position: 0.8, color: [255, 70, 70] },
          { id: "unique", position: 1, color: [255, 205, 55] },
        ],
        frame: {
          borderWidth: 1.5,
          backgroundAlpha: 0.15,
          panelGlow: 20,
          panelGlowAlpha: 0.35,
          strokeAlpha: 0.75,
        },
        uniqueEffects: {
          pulseDurationMs: 1200,
          frameDash: [12, 7],
          frameDashSpeedPxPerSecond: 22.222,
          borderWidthMin: 2.5,
          borderWidthMax: 3.5,
          panelGlowMin: 30,
          panelGlowMax: 52,
          panelGlowAlpha: 0.35,
          imageGlowMin: 14,
          imageGlowMax: 32,
          imageGlowAlpha: 0.95,
          backgroundAlphaMin: 0.18,
          backgroundAlphaMax: 0.3,
          strokeAlpha: 0.75,
        },
      },
    };
    const fish = {
      id: "fixture",
      anomalyVariant: {
        enabled: true,
        anomalyId: "inside",
        chance: 0.01,
        locationIds: ["test"],
      },
      weightConfig: this.fixture.weightConfig,
      visual: {
        imagePattern: "assets/fish/fixture/fixture--{level}.webp",
        uniqueImagePattern: "assets/fish/fixture/fixture--{level}-uniq.webp",
      },
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

    const unknownLocationFish = JSON.parse(JSON.stringify(fish));
    unknownLocationFish.anomalyVariant.locationIds = ["missing"];
    const unknownLocationErrors = validator.validate({
      rarityConfig,
      fishDb: [unknownLocationFish],
      mapDb: { test: {} },
    });
    Assertion.that(
      unknownLocationErrors.some((issue) =>
        issue.message.includes("unknown location id"),
      ),
      "config validator detects unknown anomaly locations",
    );

    const wrongMaxLevelFish = JSON.parse(JSON.stringify(fish));
    wrongMaxLevelFish.weightConfig.maxLevel = 5;
    const maxLevelErrors = validator.validate({
      rarityConfig,
      fishDb: [wrongMaxLevelFish],
    });
    Assertion.that(
      maxLevelErrors.some((issue) =>
        issue.message.includes("last configured weight-range level"),
      ),
      "config validator detects wrong maxLevel",
    );

    const clampedFish = JSON.parse(JSON.stringify(fish));
    clampedFish.weightConfig.maxLevel = 7;
    clampedFish.weightConfig.levelWeightRanges.push({
      level: 7,
      min: 5.001,
      max: 6,
    });
    const clampedErrors = validator.validate({
      rarityConfig,
      fishDb: [clampedFish],
    });
    Assertion.that(
      clampedErrors.some((issue) => issue.message.includes("would clamp")),
      "config validator rejects multiple maximum bands",
    );

    const mutableScaleConfig = {
      ...rarityConfig,
      scale: { ...rarityConfig.scale },
    };
    const mutableScaleErrors = validator.validate({
      rarityConfig: mutableScaleConfig,
      fishDb: [fish],
    });
    Assertion.that(
      mutableScaleErrors.some((issue) =>
        issue.message.includes("scale must be immutable"),
      ),
      "config validator rejects mutable rarity scale",
    );

    const overlapFish = JSON.parse(JSON.stringify(fish));
    overlapFish.weightConfig.levelWeightRanges[1].min = 0.25;
    const overlapErrors = validator.validate({
      rarityConfig,
      fishDb: [overlapFish],
    });
    Assertion.that(
      overlapErrors.some((issue) => issue.message.includes("overlap")),
      "config validator detects normalized weight overlaps",
    );

    const duplicateStops = {
      ...rarityConfig,
      visual: {
        ...rarityConfig.visual,
        colorStops: [
          rarityConfig.visual.colorStops[0],
          { id: "common", position: 0.5, color: [0, 0, 0] },
          rarityConfig.visual.colorStops[1],
        ],
      },
    };
    const duplicateStopErrors = validator.validate({
      rarityConfig: duplicateStops,
      fishDb: [fish],
    });
    Assertion.that(
      duplicateStopErrors.some((issue) =>
        issue.message.includes("duplicate color stop"),
      ),
      "config validator detects duplicate color stops",
    );

    const unorderedStops = {
      ...rarityConfig,
      visual: {
        ...rarityConfig.visual,
        colorStops: [
          rarityConfig.visual.colorStops[1],
          rarityConfig.visual.colorStops[0],
        ],
      },
    };
    const unorderedStopErrors = validator.validate({
      rarityConfig: unorderedStops,
      fishDb: [fish],
    });
    Assertion.that(
      unorderedStopErrors.some((issue) =>
        issue.message.includes("strictly increasing"),
      ),
      "config validator detects unordered color stops",
    );
  }

  #checkFixedCatchRarity() {
    const template = this.#createCatchTemplate();
    const ordinary = this.fixedCatchFishFactory.create({
      template,
      weightKg: 4.2,
      biteSequence: ["test"],
    });
    Assertion.equal(ordinary.rarity.halfSteps, 9, "fixed catch 4.2kg rarity");
    Assertion.that(!ordinary.isUnique, "fixed catch 4.2kg is ordinary");
    Assertion.equal(
      ordinary.imagePath,
      "assets/fish/crucian_stalker/crucian_stalker--6.webp",
      "fixed catch ordinary image",
    );

    const godForced = this.fixedCatchFishFactory.create({
      template,
      weightKg: 4.2,
      biteSequence: ["test"],
      anomalyChanceOverride: 1,
      locationId: "test",
    });
    Assertion.that(
      godForced.hasAnomaly && godForced.isUnique,
      "God Mode anomaly override applies to an eligible fixed catch",
    );
    Assertion.equal(
      godForced.imagePath,
      "assets/fish/crucian_stalker/crucian_stalker--6-uniq.webp",
      "God Mode fixed catch uses the unique level skin",
    );

    const wrongLocation = this.fixedCatchFishFactory.create({
      template,
      weightKg: 4.2,
      biteSequence: ["test"],
      anomalyChanceOverride: 1,
      locationId: "missing",
    });
    Assertion.that(
      !wrongLocation.hasAnomaly && !wrongLocation.isUnique,
      "God Mode fixed catch preserves anomaly location restrictions",
    );

    for (const range of this.fixture.weightConfig.levelWeightRanges) {
      const unique = this.fixedCatchFishFactory.create({
        template,
        weightKg: range.min,
        biteSequence: ["test"],
        anomalyChanceOverride: 1,
        locationId: "test",
      });
      Assertion.that(
        unique.hasAnomaly,
        `fixed catch level ${range.level} anomaly flag`,
      );
      Assertion.that(
        unique.isUnique,
        `fixed catch level ${range.level} is unique`,
      );
      Assertion.equal(
        unique.imagePath,
        `assets/fish/crucian_stalker/crucian_stalker--${range.level}-uniq.webp`,
        `fixed catch level ${range.level} unique image routing`,
      );
    }
  }

  #checkDevToolsWeightSynchronization() {
    const template = this.#createCatchTemplate();
    const fish = {
      id: template.id,
      weight: 0.2505,
      level: 6,
    };
    this.hookedFishProfileSynchronizer.synchronize({
      fish,
      template,
      changedKey: "weight",
    });
    Assertion.equal(fish.level, 2, "DevTools gap weight resolves level 2");
    Assertion.that(!fish.isUnique, "DevTools gap weight is not unique");
    Assertion.equal(
      fish.imagePath,
      "assets/fish/crucian_stalker/crucian_stalker--2.webp",
      "DevTools gap weight image",
    );

    fish.hasAnomaly = true;
    this.hookedFishProfileSynchronizer.synchronize({
      fish,
      template,
      changedKey: "hasAnomaly",
    });
    Assertion.equal(fish.anomaly, "inside", "DevTools anomaly toggle id");
    Assertion.that(fish.isUnique, "DevTools anomaly toggle makes fish unique");
    Assertion.equal(
      fish.imagePath,
      "assets/fish/crucian_stalker/crucian_stalker--2-uniq.webp",
      "DevTools anomaly toggle applies level skin",
    );

    fish.weight = 5;
    this.hookedFishProfileSynchronizer.synchronize({
      fish,
      template,
      changedKey: "weight",
    });
    Assertion.equal(fish.rarity.halfSteps, 12, "DevTools maximum rarity");
    Assertion.that(fish.hasAnomaly, "DevTools preserves the anomaly flag");
    Assertion.that(fish.isUnique, "DevTools anomalous fish is unique");
    Assertion.equal(
      fish.imagePath,
      "assets/fish/crucian_stalker/crucian_stalker--6-uniq.webp",
      "DevTools unique image routing",
    );
  }

  #createCatchTemplate() {
    return {
      id: "crucian_stalker",
      name: "Crucian Stalker",
      trophyWeightKg: 1,
      depthConfig: {
        minWeightAtMinDepth: 0.05,
        maxWeightAtMaxDepth: 5,
      },
      weightConfig: this.fixture.weightConfig,
      anomalyVariant: {
        enabled: true,
        anomalyId: "inside",
        chance: 0.01,
        locationIds: ["test"],
      },
      visual: {
        imagePattern:
          "assets/fish/crucian_stalker/crucian_stalker--{level}.webp",
        uniqueImagePattern:
          "assets/fish/crucian_stalker/crucian_stalker--{level}-uniq.webp",
      },
      physics: {},
    };
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
    });
    builder.buildInto({
      target: frame.outcome,
      intent: {
        visible: true,
        mode: "victory",
        fish: {
          id: "fixture",
          level: 6,
          maxLevel: 6,
          weight: 4.2,
          isUnique: resolved.isUnique,
          rarity: resolved.rarity,
        },
      },
    });
    Assertion.equal(
      frame.outcome.victory.fish.rarity.halfSteps,
      9,
      "Victory preserves resolved rarity",
    );
    Assertion.that(
      !frame.outcome.victory.fish.isUnique,
      "Victory preserves ordinary fish identity separately from rarity",
    );

    const uniqueHalfStar = this.resolver.resolve({
      weightKg: 0.05,
      weightConfig: this.fixture.weightConfig,
      baseAnomaly: "inside",
    });
    frame.reset();
    builder.buildInto({
      target: frame.outcome,
      intent: {
        visible: true,
        mode: "victory",
        fish: {
          id: "fixture",
          level: 1,
          maxLevel: 6,
          weight: 0.05,
          isUnique: uniqueHalfStar.isUnique,
          rarity: uniqueHalfStar.rarity,
        },
      },
    });
    Assertion.that(
      frame.outcome.victory.fish.isUnique,
      "Victory preserves unique fish identity",
    );
    Assertion.equal(
      frame.outcome.victory.fish.rarity.stars,
      0.5,
      "Victory preserves independent half-star rarity for a unique fish",
    );
    Assertion.that(
      !frame.outcome.victory.fish.rarity.isMaximum,
      "Victory unique identity does not alter maximum rarity",
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
    relativePath: "src/core/fish/fish_anomaly_variant_resolver.js",
    classNames: ["FishAnomalyVariantResolver"],
  },
  {
    relativePath: "src/core/fish/fish_visual_variant_resolver.js",
    classNames: ["FishVisualVariantResolver"],
  },
  {
    relativePath: "src/systems/bite_system.js",
    classNames: ["BiteSystem"],
  },
  {
    relativePath: "src/render/screens/rarity_animation_resolver.js",
    classNames: ["RarityAnimationResolver"],
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
    relativePath: "src/config/validation/item_rarity_config_validator.js",
    classNames: ["ItemRarityConfigValidator"],
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
  {
    relativePath: "src/app/fixed_catch_fish_factory.js",
    classNames: ["FixedCatchFishFactory"],
  },
  {
    relativePath: "src/debug/services/hooked_fish_profile_synchronizer.js",
    classNames: ["HookedFishProfileSynchronizer"],
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
  runtime.FishAnomalyVariantResolver,
  runtime.FishVisualVariantResolver,
  runtime.FixedCatchFishFactory,
  runtime.HookedFishProfileSynchronizer,
  runtime.RarityAnimationResolver,
).run();
console.log("Fish rarity checks passed.");

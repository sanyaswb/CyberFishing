const fs = require("node:fs");
const path = require("node:path");
const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const ROOT = path.resolve(__dirname, "..");
const Assertion = CheckAssertion.create("Item progression check");

class RuntimeLoader {
  load() {
    const runtime = new SourceRuntime();
    const scripts = [
      "src/config/rarity/rarity_visual_config.js",
      "src/config/visual/degradation_color_config.js",
      "src/config/items/item_progression_config.js",
      "src/config/items/item_stat_override_config.js",
      "src/config/databases/item_db.js",
      "src/config/validation/item_progression_config_validator.js",
      "src/core/items/item_stat_override_policy.js",
      "src/core/items/effective_item_stats_resolver.js",
      "src/core/items/progression/item_metric_strategy.js",
      "src/core/items/progression/numeric_stat_metric_strategy.js",
      "src/core/items/progression/derived_stat_metric_strategy.js",
      "src/core/items/progression/target_range_metric_strategy.js",
      "src/core/items/progression/composite_metric_strategy.js",
      "src/core/items/progression/item_metric_strategy_registry.js",
      "src/core/items/progression/item_catalog_baseline_registry.js",
      "src/core/items/progression/item_rating_resolver.js",
      "src/core/items/progression/item_rating_tier_resolver.js",
      "src/core/items/progression/item_quality_resolver.js",
      "src/core/items/progression/item_capacity_resolver.js",
      "src/core/items/progression/item_progression_descriptor.js",
      "src/core/items/progression/item_progression_resolver.js",
      "src/core/items/freshness/item_freshness_state_policy.js",
      "src/infrastructure/storage/legacy_item_state_migration.js",
      "src/core/items/quality/item_quality_grade_policy.js",
      "src/core/items/quality/hook_quality_modifier.js",
      "src/core/items/quality/net_quality_modifier.js",
      "src/core/items/quality/environmental_compensation_modifier.js",
      "src/core/inventory/inventory_item_stacking_policy.js",
      "src/core/items/rarity/item_rarity_descriptor.js",
      "src/core/items/rarity/item_rarity_strategy.js",
      "src/core/items/rarity/authored_item_rarity_strategy.js",
      "src/core/items/rarity/item_rarity_strategy_registry.js",
      "src/core/items/rarity/item_rarity_resolver.js",
      "src/core/items/rarity/effective_item_rarity_resolver.js",
      "src/systems/inventory_item_factory.js",
      "src/systems/inventory_item_view_factory.js",
      "src/render/screens/rarity_animation_resolver.js",
      "src/ui/styles/rarity_visual_resolver.js",
      "src/ui/styles/degradation_color_resolver.js",
      "src/ui/progression/item_progression_visual_resolver.js",
    ];
    runtime.loadMany(scripts).expose({
      DB: "ITEM_DB",
      CONFIGURATION: "ITEM_PROGRESSION_CONFIG",
      VISUAL_CONFIG: "RARITY_VISUAL_CONFIG",
      DEGRADATION_CONFIG: "DEGRADATION_COLOR_CONFIG",
      Validator: "ItemProgressionConfigValidator",
      MetricBase: "ItemMetricStrategy",
      Numeric: "NumericStatMetricStrategy",
      Derived: "DerivedStatMetricStrategy",
      Target: "TargetRangeMetricStrategy",
      Composite: "CompositeMetricStrategy",
      Registry: "ItemMetricStrategyRegistry",
      Baselines: "ItemCatalogBaselineRegistry",
      Rating: "ItemRatingResolver",
      RatingTier: "ItemRatingTierResolver",
      Quality: "ItemQualityResolver",
      Capacity: "ItemCapacityResolver",
      Progression: "ItemProgressionResolver",
      EffectiveStats: "EffectiveItemStatsResolver",
      QualityGrade: "ItemQualityGradePolicy",
      HookQuality: "HookQualityModifier",
      NetQuality: "NetQualityModifier",
      EnvironmentalQuality: "EnvironmentalCompensationModifier",
      SemanticMigration: "LegacyItemStateMigration",
      Stacking: "InventoryItemStackingPolicy",
      RawFactory: "InventoryItemFactory",
      ViewFactory: "InventoryItemViewFactory",
      RarityAnimation: "RarityAnimationResolver",
      RarityVisual: "RarityVisualResolver",
      DegradationVisual: "DegradationColorResolver",
      ProgressionVisual: "ItemProgressionVisualResolver",
    });
    return runtime.context;
  }
}

class ItemProgressionCheck {
  #runtime;

  constructor(runtime) {
    this.#runtime = runtime;
  }

  run() {
    this.#checkProductionValidation();
    this.#checkNormalizationStrategies();
    this.#checkBaselinesAndBounds();
    this.#checkRatingTierBoundaries();
    this.#checkQuality();
    this.#checkQualityModifiersAndEffectiveStats();
    this.#checkCapacity();
    this.#checkProductionReadModels();
    this.#checkInventoryLifecycle();
    this.#checkLegacySemanticMigration();
    this.#checkVisualContract();
    this.#checkInvalidConfiguration();
    console.log(
      "Item progression domain, lifecycle, visual and production checks passed.",
    );
  }

  #checkProductionValidation() {
    const issues = new this.#runtime.Validator().validate({
      progressionConfig: this.#runtime.CONFIGURATION,
      itemDb: this.#runtime.DB,
    });
    Assertion.equal(issues.length, 0, `production validation: ${JSON.stringify(issues)}`);

    let gameplay = 0;
    let technical = 0;
    for (const category of Object.values(this.#runtime.DB)) {
      for (const item of Object.values(category || {})) {
        if (item.progressionProfile === null) technical += 1;
        else if (item.progressionProfile) gameplay += 1;
        Assertion.that(
          !Object.prototype.hasOwnProperty.call(item.gameplayStats || {}, "level"),
          `${item.id} does not author a generic gameplay level`,
        );
        Assertion.that(
          !Object.prototype.hasOwnProperty.call(item, "type") &&
            !Object.prototype.hasOwnProperty.call(item, "engineStats"),
          `${item.id} uses canonical itemType and gameplayStats`,
        );
        Assertion.that(Boolean(item.itemType), `${item.id} has an itemType`);
      }
    }
    Assertion.equal(gameplay, 21, "all gameplay items migrated");
    Assertion.equal(technical, 3, "all technical records explicitly excluded");
    for (const [groupId, group] of Object.entries(
      this.#runtime.CONFIGURATION.groups,
    )) {
      Assertion.that(
        !Object.prototype.hasOwnProperty.call(group, "power") &&
          !Object.prototype.hasOwnProperty.call(group, "progressionLevel"),
        `${groupId} uses explicit metric capabilities without generic power or level`,
      );
    }
    Assertion.that(
      !Object.prototype.hasOwnProperty.call(
        this.#runtime.CONFIGURATION,
        "progressionLevelScale",
      ),
      "production config has no global automatic level scale",
    );
    for (const groupId of [
      "bait.natural",
      "rig.feeder",
      "lure.spinner",
      "lure.wobbler",
      "lure.jig",
      "float.day",
    ]) {
      Assertion.that(
        !("rating" in this.#runtime.CONFIGURATION.groups[groupId]),
        `${groupId} has no unconfirmed global rating`,
      );
    }
    Assertion.that(
      Object.values(this.#runtime.CONFIGURATION.groups).every(
        (group) => !("ratingTier" in group),
      ),
      "ratingTier remains disabled in production",
    );
    Assertion.that(
      this.#runtime.CONFIGURATION.groups["bait.natural"].freshness
        ?.gameplayConsumer === "BaitEffectivenessResolver",
      "freshness is enabled only with a confirmed gameplay consumer",
    );
  }

  #checkNormalizationStrategies() {
    Assertion.near(
      this.#runtime.MetricBase.normalizeValue(5, 0, 10, "higher_is_better"),
      0.5,
      "higher-is-better midpoint",
    );
    Assertion.near(
      this.#runtime.MetricBase.normalizeValue(2, 0, 10, "lower_is_better"),
      0.8,
      "lower-is-better normalization",
    );

    const target = new this.#runtime.Target();
    const targetConfig = {
      statPath: "effectiveStats.value",
      targetRange: {
        falloffMinimum: 0,
        minimum: 6,
        maximum: 8,
        falloffMaximum: 10,
      },
    };
    Assertion.equal(
      target.evaluate({
        item: { effectiveStats: { value: 7 } },
        ratingConfig: targetConfig,
      }).normalized,
      1,
      "target-range peak",
    );
    Assertion.near(
      target.evaluate({
        item: { effectiveStats: { value: 9 } },
        ratingConfig: targetConfig,
      }).normalized,
      0.5,
      "target-range falloff",
    );

    const compositeConfig = {
      revision: 1,
      groups: {
        composite: {
          rating: {
            strategyId: "composite",
            components: [
              {
                strategyId: "numeric_stat",
                statPath: "effectiveStats.a",
                direction: "higher_is_better",
                weight: 0.5,
                baseline: { mode: "fixed", minimum: 0, maximum: 10 },
              },
              {
                strategyId: "numeric_stat",
                statPath: "effectiveStats.b",
                direction: "higher_is_better",
                weight: 0.5,
                baseline: { mode: "fixed", minimum: 0, maximum: 10 },
              },
            ],
          },
          quality: { statPath: "effectiveStats.quality", min: 1, maxSections: 10 },
        },
      },
    };
    const composite = this.#createResolver(compositeConfig, {});
    const descriptor = composite.resolve({
      progressionProfile: { groupId: "composite" },
      effectiveStats: { a: 5, b: 10, quality: 7 },
    });
    Assertion.near(
      descriptor.rating.normalized,
      0.75,
      "composite normalization",
    );
    Assertion.equal(
      descriptor.rating.breakdown.length,
      2,
      "composite breakdown",
    );
  }

  #checkBaselinesAndBounds() {
    const config = {
      revision: 1,
      groups: {
        fixed: {
          rating: {
            strategyId: "numeric_stat",
            statPath: "effectiveStats.value",
            direction: "higher_is_better",
            baseline: { mode: "fixed", minimum: 1, maximum: 5 },
          },
          quality: { statPath: "effectiveStats.quality", min: 1, maxSections: 10 },
        },
      },
    };
    const resolver = this.#createResolver(config, {});
    const resolve = (value) => resolver.resolve({
      progressionProfile: { groupId: "fixed" },
      effectiveStats: { value, quality: 7 },
    }).rating;
    Assertion.equal(resolve(1).percent, 0, "minimum maps to zero percent");
    Assertion.equal(resolve(3).percent, 50, "midpoint maps to 50 percent");
    Assertion.equal(resolve(5).percent, 100, "maximum maps to 100 percent");
    Assertion.equal(resolve(0).outOfRange, "below", "below baseline status");
    Assertion.equal(resolve(8).outOfRange, "above", "above baseline status");

    const equalConfig = JSON.parse(JSON.stringify(config));
    equalConfig.groups.fixed.rating.baseline = { mode: "catalog" };
    const equalDb = {
      items: {
        one: {
          id: "one",
          progressionProfile: { groupId: "fixed" },
          gameplayStats: { value: 3, quality: 7 },
        },
      },
    };
    const equal = this.#createResolver(equalConfig, equalDb).resolve({
      progressionProfile: { groupId: "fixed" },
      effectiveStats: { value: 3, quality: 7 },
    });
    Assertion.that(
      !equal.rating.available,
      "equal catalog baseline is unavailable",
    );
    Assertion.equal(
      equal.rating.reason,
      "baseline_has_no_range",
      "equal baseline reason",
    );

    const missing = resolver.resolve({
      progressionProfile: { groupId: "fixed" },
      effectiveStats: { quality: 7 },
    });
    Assertion.equal(
      missing.rating.reason,
      "metric_missing",
      "missing metric fallback",
    );
  }

  #checkRatingTierBoundaries() {
    const resolver = new this.#runtime.RatingTier();
    const scale = {
      source: "rating.normalized",
      distribution: "equal_segments",
      minimum: 1,
      segments: 6,
    };
    const ratingTier = (normalized) => resolver.resolve(
      { available: true, normalized },
      scale,
    ).current;
    Assertion.equal(ratingTier(0), 1, "zero rating maps to tier 1");
    Assertion.equal(
      ratingTier(1 / 6 - 1e-8),
      1,
      "value below first boundary stays at rating tier 1",
    );
    Assertion.equal(ratingTier(1 / 6), 2, "first sixth starts tier 2");
    Assertion.equal(ratingTier(0.5), 4, "rating midpoint starts tier 4");
    Assertion.equal(
      ratingTier(5 / 6 - 1e-8),
      5,
      "value below final boundary stays at rating tier 5",
    );
    Assertion.equal(ratingTier(5 / 6), 6, "final sixth starts tier 6");
    Assertion.equal(ratingTier(1), 6, "maximum rating maps to tier 6");
    Assertion.equal(
      resolver.resolve({ available: false, reason: "metric_missing" }, scale).reason,
      "metric_missing",
      "unavailable rating keeps rating tier unavailable",
    );
  }

  #checkQuality() {
    const resolver = new this.#runtime.Quality();
    const config = { statPath: "effectiveStats.quality", min: 1, maxSections: 10 };
    for (const value of [1, 7, 10]) {
      const quality = resolver.resolve({
        item: { effectiveStats: { quality: value, durability: 20 } },
        qualityConfig: config,
      });
      Assertion.equal(quality.value, value, `quality ${value}/10`);
      Assertion.equal(quality.filledSections, value, `quality sections ${value}`);
    }
    const overridden = resolver.resolve({
      item: { effectiveStats: { quality: 8, durability: 1 } },
      qualityConfig: config,
    });
    Assertion.equal(overridden.value, 8, "runtime quality override wins");
    const invalid = resolver.resolve({
      item: { effectiveStats: { quality: 11 } },
      qualityConfig: config,
    });
    Assertion.equal(invalid.reason, "quality_out_of_range", "invalid quality rejected");
  }

  #checkQualityModifiersAndEffectiveStats() {
    const hookModifier = new this.#runtime.HookQuality();
    const netModifier = new this.#runtime.NetQuality();
    const environmentalModifier = new this.#runtime.EnvironmentalQuality();
    Assertion.near(
      hookModifier.getPowerBonus(6),
      0.06,
      "hook quality modifier preserves the former power contribution",
    );
    Assertion.equal(
      netModifier.getCatchChanceBonusPercent(7),
      60,
      "net quality modifier preserves the former chance bonus",
    );
    Assertion.near(
      environmentalModifier.getCoefficient(8, [0.1, 1]),
      0.8,
      "environmental quality modifier preserves interpolation",
    );

    const effectiveStats = new this.#runtime.EffectiveStats().resolve({
      definition: {
        gameplayStats: {
          maxLoadKg: 1,
          quality: 5,
          nested: { enabled: true },
        },
      },
      instanceState: {
        statOverrides: {
          quality: 8,
        },
      },
    });
    Assertion.equal(effectiveStats.maxLoadKg, 1, "immutable authored stats stay unchanged");
    Assertion.equal(effectiveStats.quality, 8, "effective quality has one value");
    Assertion.that(
      Object.isFrozen(effectiveStats) && Object.isFrozen(effectiveStats.nested),
      "effective stats snapshot is deeply immutable",
    );
    Assertion.throws(
      () => new this.#runtime.EffectiveStats().resolve({
        definition: { gameplayStats: { maxLoadKg: 1 } },
        instanceState: { statOverrides: { maxLoadKg: { add: 0.15 } } },
      }),
      "immutable maxLoadKg override is rejected",
    );
    Assertion.throws(
      () => new this.#runtime.EffectiveStats().resolve({
        definition: { gameplayStats: { maxLoadKg: 1 } },
        instanceState: { statOverrides: { maxloadKg: 999, ghostStat: 123 } },
      }),
      "unknown and misspelled overrides are rejected",
    );

    const strictStats = new this.#runtime.EffectiveStats().resolve({
      definition: {
        gameplayStats: { quality: 5 },
        engineStats: { quality: 9 },
      },
      instanceState: { engineStats: { quality: 10 } },
    });
    Assertion.equal(
      strictStats.quality,
      5,
      "runtime effective stats ignore legacy definition and instance containers",
    );
  }

  #checkCapacity() {
    const resolver = new this.#runtime.Capacity();
    const capacityConfig = {
      strategyId: "line_capacity",
      statPath: "effectiveStats.lengthMeters",
      metricLabel: "Ємність",
      metricSuffix: "м",
    };
    const item = {
      instanceId: "equipped-line",
      effectiveStats: { lengthMeters: 20 },
    };
    const catalogItem = { gameplayStats: { lengthMeters: 25 } };
    const full = resolver.resolve({
      item,
      capacityConfig,
      context: {
        catalogItem,
        lineCapacity: {
          equippedLineInstanceId: "equipped-line",
          reelCapacityMeters: 20,
        },
      },
    });
    Assertion.equal(full.percent, 100, "20m on a 20m reel is full capacity");

    const used = resolver.resolve({
      item,
      capacityConfig,
      context: {
        catalogItem,
        lineCapacity: {
          equippedLineInstanceId: "equipped-line",
          reelCapacityMeters: 20,
          activeState: {
            lineInstanceId: "equipped-line",
            hasReel: true,
            remainingMeters: 15,
          },
        },
      },
    });
    Assertion.equal(used.current, 15, "five used meters leave 15m on reel");
    Assertion.equal(used.maximum, 20, "reel capacity remains 20m");
    Assertion.equal(used.used, 5, "used capacity exposes five meters");
    Assertion.equal(used.percent, 75, "15m of 20m maps to 75 percent");
    Assertion.equal(used.source, "active_reel", "active line state is authoritative");

    const inventoryRemainder = resolver.resolve({
      item: { instanceId: "remainder", effectiveStats: { lengthMeters: 5 } },
      capacityConfig,
      context: { catalogItem },
    });
    Assertion.equal(
      inventoryRemainder.percent,
      20,
      "five meters remaining from a 25m spool maps to 20 percent",
    );
  }

  #checkProductionReadModels() {
    const resolver = this.#createResolver(
      this.#runtime.CONFIGURATION,
      this.#runtime.DB,
    );
    const items = this.#gameplayItems();
    for (const item of items) {
      const progression = resolver.resolve(this.#hydrateBase(item));
      const profile = this.#runtime.CONFIGURATION.groups[
        item.progressionProfile.groupId
      ];
      Assertion.that(Object.isFrozen(progression), `${item.id} descriptor is immutable`);
      Assertion.equal(
        Object.prototype.hasOwnProperty.call(progression, "rating"),
        Boolean(profile.rating),
        `${item.id} creates rating only when configured`,
      );
      Assertion.equal(
        Object.prototype.hasOwnProperty.call(progression, "ratingTier"),
        Boolean(profile.ratingTier),
        `${item.id} creates ratingTier only when configured`,
      );
      Assertion.equal(
        Object.prototype.hasOwnProperty.call(progression, "quality"),
        Boolean(profile.quality),
        `${item.id} creates quality only when configured`,
      );
      Assertion.equal(
        Object.prototype.hasOwnProperty.call(progression, "capacity"),
        Boolean(profile.capacity),
        `${item.id} creates capacity only when configured`,
      );
    }

    const bait = resolver.resolve(
      this.#hydrateBase(this.#runtime.DB.baits.oil_worm),
    );
    Assertion.that(
      !bait.available &&
        !("rating" in bait) &&
        !("quality" in bait) &&
        !("ratingTier" in bait),
      "natural bait has no forced global metrics",
    );

    const uniqueRod = resolver.resolve(
      this.#hydrateBase(this.#runtime.DB.rods.rod_test_float),
    );
    Assertion.equal(
      uniqueRod.rating.percent,
      20,
      "unique rarity does not force maximum rating",
    );
    const spinningRod = resolver.resolve(
      this.#hydrateBase(this.#runtime.DB.rods.rod_test_spin),
    );
    Assertion.equal(spinningRod.rating.percent, 20, "rod rating remains 20%");
    Assertion.that(
      !("ratingTier" in spinningRod),
      "rod rating does not create a global tier automatically",
    );

    const line2 = this.#hydrateBase(this.#runtime.DB.lines.line_test_2);
    const line3 = this.#hydrateBase(this.#runtime.DB.lines.line_test_3);
    const line2Progression = resolver.resolve(line2);
    const line3Progression = resolver.resolve(line3);
    Assertion.equal(
      line2Progression.rating.percent,
      line3Progression.rating.percent,
      "line length does not affect rating",
    );
    const shortenedLine = resolver.resolve(
      {
        ...line2,
        effectiveStats: Object.freeze({
          ...line2.effectiveStats,
          lengthMeters: 1,
          durability: 2,
        }),
      },
      { catalogItem: this.#runtime.DB.lines.line_test_2 },
    );
    Assertion.equal(
      line2Progression.rating.percent,
      shortenedLine.rating.percent,
      "remaining length does not affect nominal line rating",
    );
    Assertion.equal(
      shortenedLine.capacity.percent,
      10,
      "remaining length updates line capacity independently",
    );

    const boat = this.#hydrateBase(this.#runtime.DB.deliveryMethods.boat_lvl3);
    const upgradeLevel3 = resolver.resolve(boat);
    const upgradeLevel1 = resolver.resolve({
      ...boat,
      effectiveStats: Object.freeze({
        ...boat.effectiveStats,
        upgradeLevel: 1,
      }),
    });
    Assertion.that(
      upgradeLevel3.rating.percent > upgradeLevel1.rating.percent,
      "boat upgrade level changes nominal rating",
    );
    Assertion.equal(
      upgradeLevel3.rating.percent,
      75,
      "boat upgrade level 3 produces a 75% category rating",
    );
    Assertion.that(
      !("ratingTier" in upgradeLevel3),
      "boat upgradeLevel stays independent and does not create ratingTier",
    );
  }

  #checkInventoryLifecycle() {
    const sourceDefinition = this.#runtime.DB.lines.line_test_1;
    const lineDefinition = {
      ...sourceDefinition,
      itemType: "fishing_line",
      gameplayStats: { ...sourceDefinition.gameplayStats },
    };
    delete lineDefinition.type;
    delete lineDefinition.engineStats;
    const rawFactory = new this.#runtime.RawFactory({
      itemDatabase: {
        getItemData: () => lineDefinition,
      },
      itemRarityResolver: { resolve: (value) => Object.freeze({ ...value }) },
    });
    const raw = rawFactory.create({
      instanceId: "legacy",
      itemId: "line_test_1",
      statOverrides: { quality: 9 },
      progression: { stale: true },
      progressionLevel: 88,
      powerLevel: 99,
      capacityPercent: 12,
      condition: { stale: true },
    });
    Assertion.that(!("progression" in raw), "derived progression is stripped from save data");
    Assertion.that(
      !("progressionLevel" in raw),
      "derived progression level is stripped from save data",
    );
    Assertion.that(
      !("powerLevel" in raw),
      "legacy derived power level is stripped from save data",
    );
    Assertion.that(
      !("capacityPercent" in raw),
      "derived capacity is stripped from save data",
    );
    Assertion.that(!("condition" in raw), "derived condition is stripped from save data");
    Assertion.equal(
      raw.statOverrides.quality,
      9,
      "canonical runtime quality override is retained",
    );
    Assertion.that(!("quality" in raw), "runtime quality has one canonical path");

    const progressionResolver = this.#createResolver(
      this.#runtime.CONFIGURATION,
      this.#runtime.DB,
    );
    const baseLine = lineDefinition;
    const viewFactory = new this.#runtime.ViewFactory({
      itemDatabase: { getItemData: () => baseLine },
      progressionResolver,
    });
    const view = viewFactory.create(raw);
    Assertion.equal(
      view.effectiveStats.quality,
      9,
      "runtime quality remains an effective gameplay stat",
    );
    Assertion.that(
      !("quality" in view.progression),
      "line UI does not create quality without the capability",
    );
    const activeViewFactory = new this.#runtime.ViewFactory({
      itemDatabase: { getItemData: () => baseLine },
      progressionResolver,
      runtimeContextProvider: () => ({
        lineCapacity: {
          equippedLineInstanceId: "legacy",
          reelCapacityMeters: 20,
          activeState: {
            lineInstanceId: "legacy",
            hasReel: true,
            remainingMeters: 15,
          },
        },
      }),
    });
    const activeView = activeViewFactory.create(raw);
    Assertion.equal(
      activeView.progression.capacity.percent,
      75,
      "hydrated equipped line exposes active reel capacity",
    );

    const stacking = new this.#runtime.Stacking();
    const base = { itemId: "hook_basic", quality: 7, rarity: { tier: 1 } };
    Assertion.that(
      stacking.canStack(
        { ...base, progression: { object: 1 } },
        { ...base, progression: { object: 2 } },
      ),
      "derived descriptors do not affect stacking",
    );
    Assertion.that(
      !stacking.canStack(base, { ...base, quality: 8 }),
      "different canonical quality blocks stacking",
    );
  }

  #checkVisualContract() {
    const rarityVisual = new this.#runtime.RarityVisual({
      configProvider: () => this.#runtime.VISUAL_CONFIG,
      animationResolver: new this.#runtime.RarityAnimation(),
    });
    const visualResolver = new this.#runtime.ProgressionVisual({
      rarityVisualResolver: rarityVisual,
      degradationColorResolver: new this.#runtime.DegradationVisual({
        configProvider: () => this.#runtime.DEGRADATION_CONFIG,
      }),
    });
    const progressionResolver = this.#createResolver(
      this.#runtime.CONFIGURATION,
      this.#runtime.DB,
    );
    const progression = progressionResolver.resolve(
      this.#hydrateBase(this.#runtime.DB.rods.rod_test_float),
    );
    const visual = visualResolver.resolve(progression);
    Assertion.that(visual.gradient.includes("linear-gradient"), "ordinary gradient built");
    Assertion.that(
      !visual.gradient.includes("255, 205, 55"),
      "gold unique stop is excluded from progression gradient",
    );
    Assertion.that(
      !visual.ratingTier.available && !("ratingTier" in progression),
      "rating does not create a rating tier without an explicit capability",
    );
    const tierConfig = JSON.parse(JSON.stringify(this.#runtime.CONFIGURATION));
    tierConfig.groups["rod.float"].ratingTier = {
      source: "rating.normalized",
      distribution: "equal_segments",
      minimum: 1,
      segments: 6,
    };
    const tierProgression = this.#createResolver(
      tierConfig,
      this.#runtime.DB,
    ).resolve(this.#hydrateBase(this.#runtime.DB.rods.rod_test_float));
    const tierVisual = visualResolver.resolve(tierProgression);
    Assertion.that(
      tierProgression.ratingTier.available &&
        tierVisual.ratingTier.available &&
        tierVisual.ratingTier.cssColor === "",
      "explicit ratingTier is supported as rating segmentation",
    );
    const lineProgression = progressionResolver.resolve(
      this.#hydrateBase(this.#runtime.DB.lines.line_test_1),
      { catalogItem: this.#runtime.DB.lines.line_test_1 },
    );
    const lineVisual = visualResolver.resolve(lineProgression);
    Assertion.equal(
      lineVisual.capacity.cssColor,
      "rgb(0, 255, 128)",
      "full Capacity uses the safe degradation color",
    );

    const css = fs.readFileSync(
      path.join(ROOT, "src/ui/styles/style.css"),
      "utf8",
    );
    for (const stop of this.#runtime.VISUAL_CONFIG.colorStops) {
      const channels = stop.color.join(", ");
      const hex = `#${stop.color
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`;
      Assertion.that(
        !css.includes(channels) && !css.toLowerCase().includes(hex.toLowerCase()),
        `${stop.id} color is not duplicated in CSS`,
      );
    }
    for (const selector of [
      ".inv-slot__rating-tier-badge",
      ".inv-tooltip__rating-scale",
      ".inv-tooltip__rating-fill",
      ".inv-slot__capacity-bar",
      ".inv-tooltip__capacity-scale",
      ".inv-tooltip__capacity-fill",
      ".inv-tooltip__quality-scale",
    ]) {
      Assertion.that(css.includes(selector), `${selector} is styled`);
    }
    const adapter = fs.readFileSync(
      path.join(ROOT, "src/ui/progression/item_progression_dom_adapter.js"),
      "utf8",
    );
    Assertion.that(
      !adapter.includes('className = "inv-slot__rating-bar"') &&
        !adapter.includes('className = "inv-slot__quality-bar"'),
      "Rating and Quality scales are absent from item thumbnails",
    );
    Assertion.that(
      adapter.includes("section.appendChild(this.#createTooltipRatingScale(") &&
        adapter.includes("section.appendChild(this.#createTooltipQualityScale("),
      "Rating and Quality scales are appended to the detailed tooltip",
    );
    Assertion.that(
      adapter.includes('className = "inv-slot__capacity-bar"') &&
        adapter.includes("section.appendChild(this.#createTooltipCapacityScale("),
      "line capacity is rendered in thumbnails and detailed tooltips",
    );
    Assertion.that(
      adapter.includes('className = "inv-tooltip__rating-fill"') &&
        !adapter.includes('className = "inv-tooltip__rating-marker"'),
      "Rating uses loader-style fill instead of a marker",
    );
    Assertion.that(
      css.includes("background: var(--item-rating-color)") &&
        !css.includes("background-image: var(--item-rating-gradient)"),
      "Rating fill uses one color resolved at the current rating position",
    );
    Assertion.that(
      css.includes("background: var(--item-capacity-color)") &&
        !css.includes("background-image: var(--item-capacity-gradient)"),
      "Capacity fills use one color resolved at the current Capacity position",
    );
    Assertion.that(
      adapter.includes(
        "badge.textContent = String(ratingTier.current)",
      ) &&
        !adapter.includes(
          'badge.textContent = `L${ratingTier.current}`',
        ),
      "thumbnail rating-tier badge is numeric without an L prefix",
    );
    Assertion.that(
      adapter.includes("Клас рейтингу") &&
        !adapter.includes("Прогресійний рівень"),
      "rating segmentation is no longer named as a generic level",
    );
    Assertion.that(
      css.includes("solid var(--rarity-color)") &&
        css.includes("color: var(--rarity-color)") &&
        !css.includes("--item-level-color") &&
        !adapter.includes("--item-level-color"),
      "rating-tier badge inherits the item rarity frame color",
    );
    Assertion.that(
      css.includes(".inv-slot.has-rarity::before") &&
        css.includes(".inv-slot.selected::after"),
      "rarity and interaction layers remain independent",
    );
  }

  #checkLegacySemanticMigration() {
    const migration = new this.#runtime.SemanticMigration();
    const boat = migration.migrate(
      { itemId: "legacy-boat", level: 2 },
      {
        itemType: "boat",
        gameplayStats: { statsByLevel: { 1: {}, 2: {} } },
      },
    );
    Assertion.equal(
      boat.statOverrides,
      undefined,
      "legacy authored boat level is not pinned as an instance override",
    );
    Assertion.that(!("level" in boat), "boat migration removes generic level");

    const rod = migration.migrate(
      { itemId: "legacy-rod", engineStats: { level: 4 } },
      { itemType: "rod", variant: "spinning", gameplayStats: {} },
    );
    Assertion.equal(
      rod.statOverrides,
      undefined,
      "legacy authored rod level is not pinned as an instance override",
    );
    Assertion.that(
      !("engineStats" in rod),
      "equipment migration removes the legacy engine stats container",
    );
  }

  #checkInvalidConfiguration() {
    const invalidDb = JSON.parse(JSON.stringify(this.#runtime.DB));
    delete invalidDb.hooks.hook_basic.progressionProfile;
    const issues = new this.#runtime.Validator().validate({
      progressionConfig: this.#runtime.CONFIGURATION,
      itemDb: invalidDb,
    });
    Assertion.that(
      issues.some((issue) => issue.message.includes("missing explicit")),
      "missing progression profile is rejected",
    );
    const invalidRatingTierConfig = JSON.parse(
      JSON.stringify(this.#runtime.CONFIGURATION),
    );
    invalidRatingTierConfig.groups["rod.spinning"].ratingTier = {
      source: "rating.normalized",
      distribution: "equal_segments",
      minimum: 1,
      segments: 0,
    };
    const ratingTierIssues = new this.#runtime.Validator().validate({
      progressionConfig: invalidRatingTierConfig,
      itemDb: this.#runtime.DB,
    });
    Assertion.that(
      ratingTierIssues.some((issue) =>
        issue.path.endsWith("ratingTier.segments"),
      ),
      "configured ratingTier requires at least one segment",
    );

    const missingRatingConfig = JSON.parse(
      JSON.stringify(this.#runtime.CONFIGURATION),
    );
    missingRatingConfig.groups["bait.natural"].ratingTier = {
      source: "rating.normalized",
      distribution: "equal_segments",
      minimum: 1,
      segments: 6,
    };
    const missingRatingIssues = new this.#runtime.Validator().validate({
      progressionConfig: missingRatingConfig,
      itemDb: this.#runtime.DB,
    });
    Assertion.that(
      missingRatingIssues.some((issue) =>
        issue.message.includes("requires a rating capability"),
      ),
      "ratingTier cannot exist without rating",
    );

    const unconfirmedCapability = JSON.parse(
      JSON.stringify(this.#runtime.CONFIGURATION),
    );
    unconfirmedCapability.groups["bait.natural"].rating = {
      strategyId: "numeric_stat",
      statPath: "effectiveStats.attractionPower",
      direction: "higher_is_better",
      baseline: { mode: "fixed", minimum: 0.5, maximum: 3 },
    };
    const unconfirmedIssues = new this.#runtime.Validator().validate({
      progressionConfig: unconfirmedCapability,
      itemDb: this.#runtime.DB,
    });
    Assertion.that(
      unconfirmedIssues.some((issue) =>
        issue.message.includes("confirmed gameplay consumer"),
      ),
      "yellow matrix capabilities require explicit gameplay-consumer evidence",
    );
  }

  #createResolver(config, itemDb) {
    const registry = new this.#runtime.Registry([
      new this.#runtime.Numeric(),
      new this.#runtime.Derived(),
      new this.#runtime.Target(),
      new this.#runtime.Composite(),
    ]);
    const baselines = new this.#runtime.Baselines({
      itemDb,
      strategyRegistry: registry,
      logger: { warn() {} },
    });
    return new this.#runtime.Progression({
      configProvider: () => config,
      ratingResolver: new this.#runtime.Rating({
        strategyRegistry: registry,
        baselineRegistry: baselines,
      }),
      ratingTierResolver: new this.#runtime.RatingTier(),
      qualityResolver: new this.#runtime.Quality(),
      capacityResolver: new this.#runtime.Capacity(),
      baselineRegistry: baselines,
    });
  }

  #gameplayItems() {
    const items = [];
    for (const category of Object.values(this.#runtime.DB)) {
      for (const item of Object.values(category || {})) {
        if (item.progressionProfile) items.push(item);
      }
    }
    return items;
  }

  #hydrateBase(item) {
    return {
      ...item,
      effectiveStats: new this.#runtime.EffectiveStats().resolve({
        definition: item,
      }),
    };
  }
}

new ItemProgressionCheck(new RuntimeLoader().load()).run();

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
      "src/config/databases/item_db.js",
      "src/config/validation/item_progression_config_validator.js",
      "src/core/items/effective_item_stats_resolver.js",
      "src/core/items/progression/item_metric_strategy.js",
      "src/core/items/progression/numeric_stat_metric_strategy.js",
      "src/core/items/progression/derived_stat_metric_strategy.js",
      "src/core/items/progression/target_range_metric_strategy.js",
      "src/core/items/progression/composite_metric_strategy.js",
      "src/core/items/progression/item_metric_strategy_registry.js",
      "src/core/items/progression/item_catalog_baseline_registry.js",
      "src/core/items/progression/item_rating_resolver.js",
      "src/core/items/progression/item_progression_level_resolver.js",
      "src/core/items/progression/item_quality_resolver.js",
      "src/core/items/progression/item_capacity_resolver.js",
      "src/core/items/progression/item_progression_descriptor.js",
      "src/core/items/progression/item_progression_resolver.js",
      "src/infrastructure/storage/legacy_item_state_migration.js",
      "src/core/items/quality/item_quality_grade_policy.js",
      "src/core/items/quality/hook_quality_modifier.js",
      "src/core/items/quality/net_quality_modifier.js",
      "src/core/items/quality/environmental_compensation_modifier.js",
      "src/core/inventory/inventory_item_stacking_policy.js",
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
      ProgressionLevel: "ItemProgressionLevelResolver",
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
    this.#checkProgressionLevelBoundaries();
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
        group.rating && !Object.prototype.hasOwnProperty.call(group, "power"),
        `${groupId} owns rating instead of progression power`,
      );
    }
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
      progressionLevelScale: {
        source: "rating.normalized",
        distribution: "equal_segments",
        minimum: 1,
        segments: 6,
      },
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
      progressionLevelScale: {
        source: "rating.normalized",
        distribution: "equal_segments",
        minimum: 1,
        segments: 6,
      },
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

  #checkProgressionLevelBoundaries() {
    const resolver = new this.#runtime.ProgressionLevel();
    const scale = {
      source: "rating.normalized",
      distribution: "equal_segments",
      minimum: 1,
      segments: 6,
    };
    const progressionLevel = (normalized) => resolver.resolve(
      { available: true, normalized },
      scale,
    ).current;
    Assertion.equal(progressionLevel(0), 1, "zero rating maps to level 1");
    Assertion.equal(
      progressionLevel(1 / 6 - 1e-8),
      1,
      "value below first boundary stays at progression level 1",
    );
    Assertion.equal(progressionLevel(1 / 6), 2, "first sixth starts level 2");
    Assertion.equal(progressionLevel(0.5), 4, "rating midpoint starts level 4");
    Assertion.equal(
      progressionLevel(5 / 6 - 1e-8),
      5,
      "value below final boundary stays at progression level 5",
    );
    Assertion.equal(progressionLevel(5 / 6), 6, "final sixth starts level 6");
    Assertion.equal(progressionLevel(1), 6, "maximum rating maps to level 6");
    Assertion.equal(
      resolver.resolve({ available: false, reason: "metric_missing" }, scale).reason,
      "metric_missing",
      "unavailable rating keeps progression level unavailable",
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
          maxLoadKg: { add: 0.15 },
          quality: 8,
        },
      },
    });
    Assertion.near(
      effectiveStats.maxLoadKg,
      1.15,
      "additive stat override produces the effective max load",
    );
    Assertion.equal(effectiveStats.quality, 8, "effective quality has one value");
    Assertion.that(
      Object.isFrozen(effectiveStats) && Object.isFrozen(effectiveStats.nested),
      "effective stats snapshot is deeply immutable",
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
      Assertion.that(Object.isFrozen(progression), `${item.id} descriptor is immutable`);
      Assertion.that(
        progression.rating.available,
        `${item.id} rating is available`,
      );
      const scale = this.#runtime.CONFIGURATION.progressionLevelScale;
      const expectedProgressionLevel = scale.minimum + Math.min(
        scale.segments - 1,
        Math.floor(progression.rating.normalized * scale.segments),
      );
      Assertion.equal(
        progression.progressionLevel.current,
        expectedProgressionLevel,
        `${item.id} progression level follows its rating segment`,
      );
      Assertion.that(
        !Object.prototype.hasOwnProperty.call(
          item.progressionProfile,
          "progressionLevel",
        ),
        `${item.id} does not require a manually authored progression level`,
      );
      Assertion.that(progression.quality.available, `${item.id} quality is available`);
      Assertion.equal(
        progression.capacity.available,
        item.itemType === "fishing_line",
        `${item.id} capacity availability matches item type`,
      );
    }

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
    Assertion.equal(
      spinningRod.progressionLevel.current,
      2,
      "rod rating maps to progression level 2 independently of equipment power",
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
    const ignoredManualProgressionLevel = resolver.resolve({
      ...boat,
      progressionProfile: {
        ...boat.progressionProfile,
        progressionLevel: 1,
      },
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
    Assertion.equal(
      upgradeLevel3.progressionLevel.current,
      5,
      "boat upgrade level 3 remains distinct from progression level 5",
    );
    Assertion.that(
      upgradeLevel3.progressionLevel.current >
        upgradeLevel1.progressionLevel.current,
      "higher rating automatically produces a higher progression level",
    );
    Assertion.equal(
      upgradeLevel3.rating.percent,
      ignoredManualProgressionLevel.rating.percent,
      "manual progression level does not change rating",
    );
    Assertion.equal(
      ignoredManualProgressionLevel.progressionLevel.current,
      upgradeLevel3.progressionLevel.current,
      "manual progression level is ignored in favor of the rating segment",
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
    Assertion.equal(view.progression.quality.value, 9, "legacy view gets runtime progression");
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
      visual.progressionLevel.available &&
        visual.progressionLevel.cssColor === "",
      "rating-derived progression level has no separate gradient color",
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
      ".inv-slot__level-badge",
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
        "badge.textContent = String(progressionLevel.current)",
      ) &&
        !adapter.includes(
          'badge.textContent = `L${progressionLevel.current}`',
        ),
      "thumbnail progression-level badge is numeric without an L prefix",
    );
    Assertion.that(
      adapter.includes("Прогресійний рівень") &&
        !adapter.includes("Рівень сили"),
      "progression level is labeled independently from gameplay power",
    );
    Assertion.that(
      css.includes("solid var(--rarity-color)") &&
        css.includes("color: var(--rarity-color)") &&
        !css.includes("--item-level-color") &&
        !adapter.includes("--item-level-color"),
      "progression-level badge inherits the item rarity frame color",
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
      boat.statOverrides.upgradeLevel,
      2,
      "boat level migrates to upgrade level override",
    );
    Assertion.that(!("level" in boat), "boat migration removes generic level");

    const rod = migration.migrate(
      { itemId: "legacy-rod", engineStats: { level: 4 } },
      { itemType: "rod", variant: "spinning", gameplayStats: {} },
    );
    Assertion.equal(
      rod.statOverrides.equipmentPowerLevel,
      4,
      "rod level migrates to equipment power level",
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
    const invalidProgressionLevelConfig = JSON.parse(
      JSON.stringify(this.#runtime.CONFIGURATION),
    );
    invalidProgressionLevelConfig.progressionLevelScale.segments = 0;
    const progressionLevelIssues = new this.#runtime.Validator().validate({
      progressionConfig: invalidProgressionLevelConfig,
      itemDb: this.#runtime.DB,
    });
    Assertion.that(
      progressionLevelIssues.some((issue) =>
        issue.path.endsWith("progressionLevelScale.segments"),
      ),
      "progression-level scale requires at least one configured segment",
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
      progressionLevelResolver: new this.#runtime.ProgressionLevel(),
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

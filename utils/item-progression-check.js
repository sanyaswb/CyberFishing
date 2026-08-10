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
      "src/core/items/progression/item_metric_strategy.js",
      "src/core/items/progression/numeric_stat_metric_strategy.js",
      "src/core/items/progression/derived_stat_metric_strategy.js",
      "src/core/items/progression/target_range_metric_strategy.js",
      "src/core/items/progression/composite_metric_strategy.js",
      "src/core/items/progression/item_metric_strategy_registry.js",
      "src/core/items/progression/item_catalog_baseline_registry.js",
      "src/core/items/progression/item_power_resolver.js",
      "src/core/items/progression/item_level_resolver.js",
      "src/core/items/progression/item_quality_resolver.js",
      "src/core/items/progression/item_capacity_resolver.js",
      "src/core/items/progression/item_progression_descriptor.js",
      "src/core/items/progression/item_progression_resolver.js",
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
      Power: "ItemPowerResolver",
      Level: "ItemLevelResolver",
      Quality: "ItemQualityResolver",
      Capacity: "ItemCapacityResolver",
      Progression: "ItemProgressionResolver",
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
    this.#checkLevelBoundaries();
    this.#checkQuality();
    this.#checkCapacity();
    this.#checkProductionReadModels();
    this.#checkInventoryLifecycle();
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
      }
    }
    Assertion.equal(gameplay, 21, "all gameplay items migrated");
    Assertion.equal(technical, 3, "all technical records explicitly excluded");
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
      statPath: "engineStats.value",
      targetRange: {
        falloffMinimum: 0,
        minimum: 6,
        maximum: 8,
        falloffMaximum: 10,
      },
    };
    Assertion.equal(
      target.evaluate({
        item: { engineStats: { value: 7 } },
        powerConfig: targetConfig,
      }).normalized,
      1,
      "target-range peak",
    );
    Assertion.near(
      target.evaluate({
        item: { engineStats: { value: 9 } },
        powerConfig: targetConfig,
      }).normalized,
      0.5,
      "target-range falloff",
    );

    const compositeConfig = {
      revision: 1,
      levelScale: {
        source: "power.normalized",
        distribution: "equal_segments",
        minimum: 1,
        segments: 6,
      },
      groups: {
        composite: {
          power: {
            strategyId: "composite",
            components: [
              {
                strategyId: "numeric_stat",
                statPath: "engineStats.a",
                direction: "higher_is_better",
                weight: 0.5,
                baseline: { mode: "fixed", minimum: 0, maximum: 10 },
              },
              {
                strategyId: "numeric_stat",
                statPath: "engineStats.b",
                direction: "higher_is_better",
                weight: 0.5,
                baseline: { mode: "fixed", minimum: 0, maximum: 10 },
              },
            ],
          },
          quality: { statPath: "engineStats.quality", min: 1, maxSections: 10 },
        },
      },
    };
    const composite = this.#createResolver(compositeConfig, {});
    const descriptor = composite.resolve({
      progressionProfile: { groupId: "composite" },
      engineStats: { a: 5, b: 10, quality: 7 },
    });
    Assertion.near(descriptor.power.normalized, 0.75, "composite normalization");
    Assertion.equal(descriptor.power.breakdown.length, 2, "composite breakdown");
  }

  #checkBaselinesAndBounds() {
    const config = {
      revision: 1,
      levelScale: {
        source: "power.normalized",
        distribution: "equal_segments",
        minimum: 1,
        segments: 6,
      },
      groups: {
        fixed: {
          power: {
            strategyId: "numeric_stat",
            statPath: "engineStats.value",
            direction: "higher_is_better",
            baseline: { mode: "fixed", minimum: 1, maximum: 5 },
          },
          quality: { statPath: "engineStats.quality", min: 1, maxSections: 10 },
        },
      },
    };
    const resolver = this.#createResolver(config, {});
    const resolve = (value) => resolver.resolve({
      progressionProfile: { groupId: "fixed" },
      engineStats: { value, quality: 7 },
    }).power;
    Assertion.equal(resolve(1).percent, 0, "minimum maps to zero percent");
    Assertion.equal(resolve(3).percent, 50, "midpoint maps to 50 percent");
    Assertion.equal(resolve(5).percent, 100, "maximum maps to 100 percent");
    Assertion.equal(resolve(0).outOfRange, "below", "below baseline status");
    Assertion.equal(resolve(8).outOfRange, "above", "above baseline status");

    const equalConfig = JSON.parse(JSON.stringify(config));
    equalConfig.groups.fixed.power.baseline = { mode: "catalog" };
    const equalDb = {
      items: {
        one: {
          id: "one",
          progressionProfile: { groupId: "fixed" },
          engineStats: { value: 3, quality: 7 },
        },
      },
    };
    const equal = this.#createResolver(equalConfig, equalDb).resolve({
      progressionProfile: { groupId: "fixed" },
      engineStats: { value: 3, quality: 7 },
    });
    Assertion.that(!equal.power.available, "equal catalog baseline is unavailable");
    Assertion.equal(
      equal.power.reason,
      "baseline_has_no_range",
      "equal baseline reason",
    );

    const missing = resolver.resolve({
      progressionProfile: { groupId: "fixed" },
      engineStats: { quality: 7 },
    });
    Assertion.equal(missing.power.reason, "metric_missing", "missing metric fallback");
  }

  #checkLevelBoundaries() {
    const resolver = new this.#runtime.Level();
    const scale = {
      source: "power.normalized",
      distribution: "equal_segments",
      minimum: 1,
      segments: 6,
    };
    const level = (normalized) => resolver.resolve(
      { available: true, normalized },
      scale,
    ).current;
    Assertion.equal(level(0), 1, "zero Power maps to Level 1");
    Assertion.equal(level(1 / 6 - 1e-8), 1, "value below first boundary stays Level 1");
    Assertion.equal(level(1 / 6), 2, "first sixth starts Level 2");
    Assertion.equal(level(0.5), 4, "Power midpoint starts Level 4");
    Assertion.equal(level(5 / 6 - 1e-8), 5, "value below final boundary stays Level 5");
    Assertion.equal(level(5 / 6), 6, "final sixth starts Level 6");
    Assertion.equal(level(1), 6, "maximum Power maps to Level 6");
    Assertion.equal(
      resolver.resolve({ available: false, reason: "metric_missing" }, scale).reason,
      "metric_missing",
      "unavailable Power keeps Level unavailable",
    );
  }

  #checkQuality() {
    const resolver = new this.#runtime.Quality();
    const config = { statPath: "engineStats.quality", min: 1, maxSections: 10 };
    for (const value of [1, 7, 10]) {
      const quality = resolver.resolve({
        item: { engineStats: { quality: value, durability: 20 } },
        qualityConfig: config,
      });
      Assertion.equal(quality.value, value, `quality ${value}/10`);
      Assertion.equal(quality.filledSections, value, `quality sections ${value}`);
    }
    const overridden = resolver.resolve({
      item: { quality: 8, engineStats: { quality: 2, durability: 1 } },
      qualityConfig: config,
    });
    Assertion.equal(overridden.value, 8, "runtime quality override wins");
    const invalid = resolver.resolve({
      item: { engineStats: { quality: 11 } },
      qualityConfig: config,
    });
    Assertion.equal(invalid.reason, "quality_out_of_range", "invalid quality rejected");
  }

  #checkCapacity() {
    const resolver = new this.#runtime.Capacity();
    const capacityConfig = {
      strategyId: "line_capacity",
      statPath: "engineStats.lengthMeters",
      metricLabel: "Ємність",
      metricSuffix: "м",
    };
    const item = {
      instanceId: "equipped-line",
      engineStats: { lengthMeters: 20 },
    };
    const catalogItem = { engineStats: { lengthMeters: 25 } };
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
      item: { instanceId: "remainder", engineStats: { lengthMeters: 5 } },
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
      Assertion.that(progression.power.available, `${item.id} power is available`);
      const scale = this.#runtime.CONFIGURATION.levelScale;
      const expectedLevel = scale.minimum + Math.min(
        scale.segments - 1,
        Math.floor(progression.power.normalized * scale.segments),
      );
      Assertion.equal(
        progression.level.current,
        expectedLevel,
        `${item.id} Level follows its Power segment`,
      );
      Assertion.that(
        !Object.prototype.hasOwnProperty.call(item.progressionProfile, "level"),
        `${item.id} does not require a manually authored Level`,
      );
      Assertion.that(progression.quality.available, `${item.id} quality is available`);
      Assertion.equal(
        progression.capacity.available,
        item.type === "fishing_line",
        `${item.id} capacity availability matches item type`,
      );
    }

    const uniqueRod = resolver.resolve(
      this.#hydrateBase(this.#runtime.DB.rods.rod_test_float),
    );
    Assertion.equal(uniqueRod.power.percent, 20, "unique rarity does not force max Power");

    const line2 = this.#hydrateBase(this.#runtime.DB.lines.line_test_2);
    const line3 = this.#hydrateBase(this.#runtime.DB.lines.line_test_3);
    const line2Progression = resolver.resolve(line2);
    const line3Progression = resolver.resolve(line3);
    Assertion.equal(
      line2Progression.power.percent,
      line3Progression.power.percent,
      "line length does not affect Power",
    );
    const shortenedLine = resolver.resolve(
      {
        ...line2,
        lengthMeters: 1,
        durability: 2,
        engineStats: { ...line2.engineStats, lengthMeters: 1, durability: 2 },
      },
      { catalogItem: this.#runtime.DB.lines.line_test_2 },
    );
    Assertion.equal(
      line2Progression.power.percent,
      shortenedLine.power.percent,
      "remaining length does not affect nominal line Power",
    );
    Assertion.equal(
      shortenedLine.capacity.percent,
      10,
      "remaining length updates line capacity independently",
    );

    const boat = this.#hydrateBase(this.#runtime.DB.deliveryMethods.boat_lvl3);
    const level3 = resolver.resolve(boat);
    const level1 = resolver.resolve({
      ...boat,
      level: 1,
      engineStats: { ...boat.engineStats, level: 1 },
    });
    const ignoredManualLevel = resolver.resolve({
      ...boat,
      progressionProfile: { ...boat.progressionProfile, level: 1 },
    });
    Assertion.that(
      level3.power.percent > level1.power.percent,
      "boat upgrade level changes nominal Power",
    );
    Assertion.that(
      level3.level.current > level1.level.current,
      "higher Power automatically produces a higher Level",
    );
    Assertion.equal(
      level3.power.percent,
      ignoredManualLevel.power.percent,
      "legacy manual Level does not change Power",
    );
    Assertion.equal(
      ignoredManualLevel.level.current,
      level3.level.current,
      "legacy manual Level is ignored in favor of the Power segment",
    );
  }

  #checkInventoryLifecycle() {
    const rawFactory = new this.#runtime.RawFactory({
      itemDatabase: {
        getItemData: () => ({ rarityProfile: { tier: 1, maxTier: 5 } }),
      },
      itemRarityResolver: { resolve: (value) => Object.freeze({ ...value }) },
    });
    const raw = rawFactory.create({
      instanceId: "legacy",
      itemId: "line_test_1",
      quality: 9,
      progression: { stale: true },
      powerLevel: 99,
      capacityPercent: 12,
      condition: { stale: true },
    });
    Assertion.that(!("progression" in raw), "derived progression is stripped from save data");
    Assertion.that(!("powerLevel" in raw), "derived power level is stripped from save data");
    Assertion.that(
      !("capacityPercent" in raw),
      "derived capacity is stripped from save data",
    );
    Assertion.that(!("condition" in raw), "derived condition is stripped from save data");
    Assertion.equal(raw.quality, 9, "canonical runtime quality is retained");

    const progressionResolver = this.#createResolver(
      this.#runtime.CONFIGURATION,
      this.#runtime.DB,
    );
    const baseLine = this.#hydrateBase(this.#runtime.DB.lines.line_test_1);
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
      visual.level.available && visual.level.cssColor === "",
      "Power-derived Level does not resolve its own gradient color",
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
      ".inv-tooltip__power-scale",
      ".inv-tooltip__power-fill",
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
      !adapter.includes('className = "inv-slot__power-bar"') &&
        !adapter.includes('className = "inv-slot__quality-bar"'),
      "Power and Quality scales are absent from item thumbnails",
    );
    Assertion.that(
      adapter.includes("section.appendChild(this.#createTooltipPowerScale(") &&
        adapter.includes("section.appendChild(this.#createTooltipQualityScale("),
      "Power and Quality scales are appended to the detailed tooltip",
    );
    Assertion.that(
      adapter.includes('className = "inv-slot__capacity-bar"') &&
        adapter.includes("section.appendChild(this.#createTooltipCapacityScale("),
      "line capacity is rendered in thumbnails and detailed tooltips",
    );
    Assertion.that(
      adapter.includes('className = "inv-tooltip__power-fill"') &&
        !adapter.includes('className = "inv-tooltip__power-marker"'),
      "Power uses loader-style fill instead of a marker",
    );
    Assertion.that(
      css.includes("background: var(--item-power-color)") &&
        !css.includes("background-image: var(--item-power-gradient)"),
      "Power fill uses one color resolved at the current Power position",
    );
    Assertion.that(
      css.includes("background: var(--item-capacity-color)") &&
        !css.includes("background-image: var(--item-capacity-gradient)"),
      "Capacity fills use one color resolved at the current Capacity position",
    );
    Assertion.that(
      adapter.includes('badge.textContent = String(level.current)') &&
        !adapter.includes('badge.textContent = `L${level.current}`'),
      "thumbnail level badge is numeric without an L prefix",
    );
    Assertion.that(
      adapter.includes("Рівень предмета") && !adapter.includes("Рівень сили"),
      "Level is labeled as an independent item parameter",
    );
    Assertion.that(
      css.includes("solid var(--rarity-color)") &&
        css.includes("color: var(--rarity-color)") &&
        !css.includes("--item-level-color") &&
        !adapter.includes("--item-level-color"),
      "Level badge always inherits the item rarity frame color",
    );
    Assertion.that(
      css.includes(".inv-slot.has-rarity::before") &&
        css.includes(".inv-slot.selected::after"),
      "rarity and interaction layers remain independent",
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
    const invalidLevelConfig = JSON.parse(
      JSON.stringify(this.#runtime.CONFIGURATION),
    );
    invalidLevelConfig.levelScale.segments = 0;
    const levelIssues = new this.#runtime.Validator().validate({
      progressionConfig: invalidLevelConfig,
      itemDb: this.#runtime.DB,
    });
    Assertion.that(
      levelIssues.some((issue) => issue.path.endsWith("levelScale.segments")),
      "Level scale requires at least one configured segment",
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
      powerResolver: new this.#runtime.Power({
        strategyRegistry: registry,
        baselineRegistry: baselines,
      }),
      levelResolver: new this.#runtime.Level(),
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
      ...(item.engineStats || {}),
      engineStats: { ...(item.engineStats || {}) },
    };
  }
}

new ItemProgressionCheck(new RuntimeLoader().load()).run();

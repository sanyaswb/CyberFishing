const { readPageCss } = require("./testing/styles/page_stylesheet_reader");
const fs = require("node:fs");
const path = require("node:path");
const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");
const { ItemStatTestComposition } = require("./testing/runtime/item_stat_test_composition");
const { installDescriptorFactories } = require("./testing/runtime/constructor_defaults");

const ROOT = path.resolve(__dirname, "..");
const Assertion = CheckAssertion.create("Item condition check");

class RuntimeLoader {
  load() {
    const runtime = new SourceRuntime();
    runtime.loadMany([
      "src/game/config/items/item_progression_config.js",
      "src/game/config/raw/items/item_stat_overrides.js",
      "src/game/config/raw/items/item_database.js",
      "src/game/domain/items/item_stat_override_policy.js",
      "src/game/domain/items/effective_item_stats_resolver.js",
      "src/game/config/validation/item_progression_config_validator.js",
      "src/game/domain/items/metrics/item_bounded_metric_resolver.js",
      "src/game/presentation/inventory/item_condition_descriptor.js",
      "src/game/domain/items/condition/item_condition_resolver.js",
      "src/game/presentation/inventory/item_freshness_descriptor.js",
      "src/game/domain/items/freshness/item_freshness_state_policy.js",
      "src/game/domain/items/freshness/bait_freshness_decay_policy.js",
      "src/game/domain/items/freshness/item_freshness_resolver.js",
      "src/platform/browser/dom/item_condition_dom_adapter.js",
    ]).expose({
      CONFIGURATION: "ITEM_PROGRESSION_CONFIG",
      DB: "ITEM_DB",
      Validator: "ItemProgressionConfigValidator",
      Resolver: "ItemConditionResolver",
      FreshnessResolver: "ItemFreshnessResolver",
      Adapter: "ItemConditionDomAdapter",
    });
    new ItemStatTestComposition(runtime.context).install({ withResolver: ["Validator"] });
    installDescriptorFactories(runtime.context, { Resolver: "ItemConditionDescriptor", FreshnessResolver: "ItemFreshnessDescriptor" });
    return runtime.context;
  }
}

class FakeStyle {
  #values = new Map();

  setProperty(key, value) {
    this.#values.set(key, value);
  }

  removeProperty(key) {
    this.#values.delete(key);
  }

  getPropertyValue(key) {
    return this.#values.get(key) || "";
  }
}

class FakeClassList {
  #values = new Set();

  add(value) {
    this.#values.add(value);
  }

  remove(value) {
    this.#values.delete(value);
  }

  contains(value) {
    return this.#values.has(value);
  }
}

class ItemConditionCheck {
  #runtime;
  #resolver;
  #freshnessResolver;

  constructor(runtime) {
    this.#runtime = runtime;
    this.#resolver = new runtime.Resolver({
      profileProvider: (item) => {
        const groupId = item?.progressionProfile?.groupId;
        return runtime.CONFIGURATION.groups[groupId]?.condition;
      },
    });
    this.#freshnessResolver = new runtime.FreshnessResolver({
      profileProvider: (item) => {
        const groupId = item?.progressionProfile?.groupId;
        return runtime.CONFIGURATION.groups[groupId]?.freshness;
      },
    });
  }

  run() {
    this.#checkConfiguration();
    this.#checkResolution();
    this.#checkProductionItems();
    this.#checkFreshnessCapability();
    this.#checkDomContract();
    this.#checkCssContract();
    this.#checkLifecycleContract();
    console.log("Item condition domain, visual and production checks passed.");
  }

  #checkConfiguration() {
    const issues = new this.#runtime.Validator().validate({
      progressionConfig: this.#runtime.CONFIGURATION,
      itemDb: this.#runtime.DB,
    });
    Assertion.equal(issues.length, 0, `production config: ${JSON.stringify(issues)}`);
    const invalidConfig = JSON.parse(JSON.stringify(this.#runtime.CONFIGURATION));
    invalidConfig.groups["rod.spinning"].condition.maximum = 0;
    const invalid = new this.#runtime.Validator().validate({
      progressionConfig: invalidConfig,
      itemDb: this.#runtime.DB,
    });
    Assertion.that(invalid.length > 0, "invalid condition range is rejected");
  }

  #checkResolution() {
    const profile = { progressionProfile: { groupId: "rod.spinning" } };
    const full = this.#resolver.resolve({
      ...profile,
      effectiveStats: { durability: 100 },
    });
    Assertion.equal(full.percent, 100, "100 condition maps to full height");
    Assertion.equal(full.source, "authored", "catalog durability is authored");
    const worn = this.#resolver.resolve({
      ...profile,
      statOverrides: { durability: 20 },
      effectiveStats: { durability: 100 },
    });
    Assertion.equal(worn.percent, 20, "20 condition maps to 20 percent height");
    Assertion.equal(worn.source, "instance", "instance durability has priority");
    const clamped = this.#resolver.resolve({
      ...profile,
      statOverrides: { durability: -5 },
    });
    Assertion.equal(clamped.percent, 0, "condition is clamped below minimum");
    Assertion.equal(clamped.outOfRange, "below", "below-range state is exposed");
    const missing = this.#resolver.resolve(profile);
    Assertion.that(
      !missing.available && missing.reason === "condition_missing",
      "configured condition requires real state instead of a global default",
    );
    Assertion.equal(
      this.#resolver.resolve({ progressionProfile: { groupId: "bait.natural" } }),
      null,
      "items without condition capability create no descriptor",
    );
    Assertion.that(Object.isFrozen(worn), "condition descriptor is immutable");
  }

  #checkProductionItems() {
    let gameplayCount = 0;
    let authoredCount = 0;
    for (const category of Object.values(this.#runtime.DB)) {
      for (const item of Object.values(category || {})) {
        if (!item?.progressionProfile) continue;
        const profile = this.#runtime.CONFIGURATION.groups[
          item.progressionProfile.groupId
        ];
        if (!profile.condition) {
          Assertion.equal(
            this.#resolver.resolve({ ...item, effectiveStats: item.gameplayStats || {} }),
            null,
            `${item.id} has no forced condition descriptor`,
          );
          continue;
        }
        gameplayCount += 1;
        if (item.gameplayStats?.durability !== undefined) authoredCount += 1;
        const condition = this.#resolver.resolve({
          ...item,
          effectiveStats: item.gameplayStats || {},
        });
        Assertion.that(condition.available, `${item.id} condition is available`);
        Assertion.equal(condition.percent, 100, `${item.id} starts at full condition`);
      }
    }
    Assertion.equal(gameplayCount, 10, "only durability-backed item groups are covered");
    Assertion.equal(authoredCount, 10, "condition-enabled items author durability explicitly");
  }

  #checkFreshnessCapability() {
    const bait = {
      progressionProfile: { groupId: "bait.natural" },
      freshnessState: { percent: 82 },
    };
    const enabled = this.#freshnessResolver.resolve(bait);
    Assertion.that(
      enabled.available && enabled.percent === 82,
      "freshness descriptor is available for gameplay-backed natural bait",
    );
    Assertion.that(Object.isFrozen(enabled), "freshness descriptor is immutable");
  }

  #checkDomContract() {
    const element = {
      style: new FakeStyle(),
      classList: new FakeClassList(),
      dataset: {},
    };
    const condition = this.#resolver.resolve({
      progressionProfile: { groupId: "rod.spinning" },
      statOverrides: { durability: 20 },
    });
    new this.#runtime.Adapter().apply(element, condition);
    Assertion.that(
      element.classList.contains("has-item-condition"),
      "condition class is applied",
    );
    Assertion.equal(
      element.style.getPropertyValue("--item-condition-percent"),
      "20%",
      "condition percentage is passed to CSS",
    );
    Assertion.equal(element.dataset.conditionPercent, "20", "debug value is exposed");
  }

  #checkCssContract() {
    const css = readPageCss();
    Assertion.that(
      css.includes("border: var(--rarity-border-width, 2px) solid var(--rarity-color)"),
      "the item card rarity frame stays full and independent from condition",
    );
  }

  #checkLifecycleContract() {
    const factory = new SourceRuntime().readAuthoredSource(
      "src/game/presentation/inventory/inventory_item_view_factory.js",
    );
    const inventoryFactory = fs.readFileSync(
      path.join(ROOT, "src/game/application/inventory/inventory_item_factory.js"),
      "utf8",
    );
    const ui = fs.readFileSync(path.join(ROOT, "src/game/presentation/inventory/inventory_item_card_renderer.js"), "utf8");
    Assertion.that(
      factory.includes("const condition = this.#conditionResolver?.resolve(hydrated)") &&
        factory.includes("if (condition) hydrated.condition = condition"),
      "condition is derived during item hydration",
    );
    Assertion.that(
      inventoryFactory.includes('"condition"'),
      "derived condition is excluded from persistent item data",
    );
    Assertion.that(
      ui.includes("this.#conditionDomAdapter.apply(card, item.condition)"),
      "condition is applied to item thumbnails",
    );
  }
}

new ItemConditionCheck(new RuntimeLoader().load()).run();

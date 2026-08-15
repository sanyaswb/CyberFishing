const fs = require("node:fs");
const path = require("node:path");
const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const ROOT = path.resolve(__dirname, "..");
const Assertion = CheckAssertion.create("Item condition check");

class RuntimeLoader {
  load() {
    const runtime = new SourceRuntime();
    runtime.loadMany([
      "src/config/items/item_progression_config.js",
      "src/config/items/item_stat_override_config.js",
      "src/config/databases/item_db.js",
      "src/core/items/item_stat_override_policy.js",
      "src/core/items/effective_item_stats_resolver.js",
      "src/config/validation/item_progression_config_validator.js",
      "src/core/items/metrics/item_bounded_metric_resolver.js",
      "src/core/items/condition/item_condition_descriptor.js",
      "src/core/items/condition/item_condition_resolver.js",
      "src/core/items/freshness/item_freshness_descriptor.js",
      "src/core/items/freshness/item_freshness_resolver.js",
      "src/ui/condition/item_condition_dom_adapter.js",
    ]).expose({
      CONFIGURATION: "ITEM_PROGRESSION_CONFIG",
      DB: "ITEM_DB",
      Validator: "ItemProgressionConfigValidator",
      Resolver: "ItemConditionResolver",
      FreshnessResolver: "ItemFreshnessResolver",
      Adapter: "ItemConditionDomAdapter",
    });
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
    Assertion.equal(worn.source, "runtime", "runtime durability has priority");
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
    Assertion.equal(
      this.#freshnessResolver.resolve(bait),
      null,
      "freshness remains disabled without a confirmed gameplay capability",
    );
    const enabled = this.#freshnessResolver.resolve(bait, {
      statPath: "freshnessState.percent",
      minimum: 0,
      maximum: 100,
      metricLabel: "Свіжість",
    });
    Assertion.that(
      enabled.available && enabled.percent === 82,
      "freshness descriptor is available when an explicit capability is configured",
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
    const css = fs.readFileSync(
      path.join(ROOT, "src/ui/styles/style.css"),
      "utf8",
    );
    Assertion.that(
      css.includes("background-position: bottom") &&
        css.includes("background-size: 100% var(--item-condition-percent, 100%)"),
      "rarity background fills vertically from the bottom",
    );
    Assertion.that(
      css.includes("border: var(--rarity-border-width) solid var(--rarity-color)"),
      "rarity frame remains full and independent from fill height",
    );
  }

  #checkLifecycleContract() {
    const factory = fs.readFileSync(
      path.join(ROOT, "src/systems/inventory_item_view_factory.js"),
      "utf8",
    );
    const inventoryFactory = fs.readFileSync(
      path.join(ROOT, "src/systems/inventory_item_factory.js"),
      "utf8",
    );
    const ui = fs.readFileSync(path.join(ROOT, "src/ui/ui.js"), "utf8");
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
      ui.includes("this.#conditionDomAdapter?.apply(slotDiv, item.condition)"),
      "condition is applied to item thumbnails",
    );
  }
}

new ItemConditionCheck(new RuntimeLoader().load()).run();

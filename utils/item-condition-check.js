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
      "src/config/items/item_condition_config.js",
      "src/config/databases/item_db.js",
      "src/config/validation/item_condition_config_validator.js",
      "src/core/items/condition/item_condition_descriptor.js",
      "src/core/items/condition/item_condition_resolver.js",
      "src/ui/condition/item_condition_dom_adapter.js",
    ]).expose({
      CONFIGURATION: "ITEM_CONDITION_CONFIG",
      DB: "ITEM_DB",
      Validator: "ItemConditionConfigValidator",
      Resolver: "ItemConditionResolver",
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

  constructor(runtime) {
    this.#runtime = runtime;
    this.#resolver = new runtime.Resolver({
      configProvider: () => runtime.CONFIGURATION,
    });
  }

  run() {
    this.#checkConfiguration();
    this.#checkResolution();
    this.#checkProductionItems();
    this.#checkDomContract();
    this.#checkCssContract();
    this.#checkLifecycleContract();
    console.log("Item condition domain, visual and production checks passed.");
  }

  #checkConfiguration() {
    const issues = new this.#runtime.Validator().validate({
      conditionConfig: this.#runtime.CONFIGURATION,
      itemDb: this.#runtime.DB,
    });
    Assertion.equal(issues.length, 0, `production config: ${JSON.stringify(issues)}`);
    const invalid = new this.#runtime.Validator().validate({
      conditionConfig: { ...this.#runtime.CONFIGURATION, maximum: 0 },
      itemDb: this.#runtime.DB,
    });
    Assertion.that(invalid.length > 0, "invalid condition range is rejected");
  }

  #checkResolution() {
    const full = this.#resolver.resolve({ engineStats: { durability: 100 } });
    Assertion.equal(full.percent, 100, "100 condition maps to full height");
    Assertion.equal(full.source, "authored", "catalog durability is authored");
    const worn = this.#resolver.resolve({
      durability: 20,
      engineStats: { durability: 100 },
    });
    Assertion.equal(worn.percent, 20, "20 condition maps to 20 percent height");
    Assertion.equal(worn.source, "runtime", "runtime durability has priority");
    const clamped = this.#resolver.resolve({ durability: -5 });
    Assertion.equal(clamped.percent, 0, "condition is clamped below minimum");
    Assertion.equal(clamped.outOfRange, "below", "below-range state is exposed");
    const fallback = this.#resolver.resolve({});
    Assertion.equal(fallback.percent, 100, "items without wear data start full");
    Assertion.equal(fallback.source, "default", "default source remains explicit");
    Assertion.that(Object.isFrozen(worn), "condition descriptor is immutable");
  }

  #checkProductionItems() {
    let gameplayCount = 0;
    let authoredCount = 0;
    for (const category of Object.values(this.#runtime.DB)) {
      for (const item of Object.values(category || {})) {
        if (!item?.progressionProfile) continue;
        gameplayCount += 1;
        if (item.engineStats?.durability !== undefined) authoredCount += 1;
        const condition = this.#resolver.resolve(item);
        Assertion.that(condition.available, `${item.id} condition is available`);
        Assertion.equal(condition.percent, 100, `${item.id} starts at full condition`);
      }
    }
    Assertion.equal(gameplayCount, 21, "all gameplay items are covered");
    Assertion.equal(authoredCount, 9, "existing durability-enabled items stay authored");
  }

  #checkDomContract() {
    const element = {
      style: new FakeStyle(),
      classList: new FakeClassList(),
      dataset: {},
    };
    const condition = this.#resolver.resolve({ durability: 20 });
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
      factory.includes("hydrated.condition = this.#conditionResolver?.resolve(hydrated)"),
      "condition is derived during item hydration",
    );
    Assertion.that(
      inventoryFactory.includes('"condition"') && factory.includes('"condition"'),
      "derived condition is excluded from persistent item data",
    );
    Assertion.that(
      ui.includes("this.#conditionDomAdapter?.apply(slotDiv, item.condition)"),
      "condition is applied to item thumbnails",
    );
  }
}

new ItemConditionCheck(new RuntimeLoader().load()).run();

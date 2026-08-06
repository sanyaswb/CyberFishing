const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

class Assertion {
  static that(condition, message) {
    if (!condition) throw new Error(`Item rarity check failed: ${message}`);
  }

  static equal(actual, expected, message) {
    this.that(
      Object.is(actual, expected),
      `${message}; expected ${expected}, received ${actual}`,
    );
  }

  static jsonEqual(actual, expected, message) {
    this.equal(JSON.stringify(actual), JSON.stringify(expected), message);
  }
}

class ItemRarityRuntimeLoader {
  load() {
    const context = vm.createContext({ console });
    const scripts = [
      "src/config/rarity/rarity_visual_config.js",
      "src/config/databases/item_db.js",
      "src/config/validation/item_rarity_config_validator.js",
      "src/core/items/rarity/item_rarity_descriptor.js",
      "src/core/items/rarity/item_rarity_strategy.js",
      "src/core/items/rarity/authored_item_rarity_strategy.js",
      "src/core/items/rarity/item_rarity_strategy_registry.js",
      "src/core/items/rarity/item_rarity_resolver.js",
      "src/core/inventory/inventory_item_stacking_policy.js",
      "src/systems/inventory_item_factory.js",
      "src/ui/styles/rarity_visual_resolver.js",
      "src/ui/rarity/item_rarity_dom_adapter.js",
    ];
    for (const relativePath of scripts) {
      vm.runInContext(this.#read(relativePath), context, {
        filename: relativePath,
      });
    }
    vm.runInContext(
      [
        "globalThis.__ITEM_DB__ = ITEM_DB;",
        "globalThis.__VISUAL_CONFIG__ = RARITY_VISUAL_CONFIG;",
        "globalThis.__ITEM_VALIDATOR__ = ItemRarityConfigValidator;",
        "globalThis.__ITEM_RESOLVER__ = ItemRarityResolver;",
        "globalThis.__STACKING_POLICY__ = InventoryItemStackingPolicy;",
        "globalThis.__ITEM_FACTORY__ = InventoryItemFactory;",
        "globalThis.__VISUAL_RESOLVER__ = RarityVisualResolver;",
        "globalThis.__DOM_ADAPTER__ = ItemRarityDomAdapter;",
      ].join("\n"),
      context,
    );
    return context;
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  }
}

class StyleProbe {
  values = new Map();

  setProperty(name, value) {
    this.values.set(name, value);
  }

  removeProperty(name) {
    this.values.delete(name);
  }
}

class ClassListProbe {
  values = new Set();

  add(...names) {
    for (const name of names) this.values.add(name);
  }

  remove(...names) {
    for (const name of names) this.values.delete(name);
  }

  toggle(name, force) {
    if (force) this.values.add(name);
    else this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class ItemRarityCheck {
  #runtime;
  #itemDb;
  #domainResolver;
  #visualResolver;

  constructor(runtime) {
    this.#runtime = runtime;
    this.#itemDb = runtime.__ITEM_DB__;
    this.#domainResolver = new runtime.__ITEM_RESOLVER__();
    this.#visualResolver = this.#createVisualResolver(
      runtime.__VISUAL_CONFIG__,
    );
  }

  run() {
    this.#checkProductionProfiles();
    this.#checkDomainResolution();
    this.#checkVisualScale();
    this.#checkFactoryLifecycle();
    this.#checkStackingPolicy();
    this.#checkDomAdapter();
    this.#checkCssLayering();
    this.#checkInvalidProfiles();
    console.log("Item rarity domain, inventory, visuals and CSS checks passed.");
  }

  #checkProductionProfiles() {
    const Validator = this.#runtime.__ITEM_VALIDATOR__;
    const issues = new Validator().validate({ itemDb: this.#itemDb });
    Assertion.equal(issues.length, 0, "production item profiles are valid");
  }

  #checkDomainResolution() {
    const rare = this.#domainResolver.resolve({
      mode: "authored",
      tier: 3,
      maxTier: 5,
      isUnique: false,
    });
    Assertion.equal(rare.normalized, 0.5, "domain tier normalization");
    Assertion.that(Object.isFrozen(rare), "domain descriptor is immutable");
    Assertion.equal(rare.uniqueId, null, "ordinary descriptor has no unique id");

    const unique = this.#domainResolver.resolve({
      mode: "authored",
      tier: 5,
      maxTier: 5,
      isUnique: true,
      uniqueId: "test_unique",
    });
    Assertion.equal(unique.normalized, 1, "unique domain normalization");
    Assertion.equal(unique.uniqueId, "test_unique", "unique id is retained");
  }

  #checkVisualScale() {
    const expected = [
      ["common", [145, 150, 160]],
      ["uncommon", [0, 210, 120]],
      ["rare", [0, 160, 255]],
      ["epic", [170, 100, 255]],
      ["legendary", [255, 70, 70]],
    ];
    for (let tier = 1; tier <= expected.length; tier += 1) {
      const visual = this.#visualResolver.resolve({
        tier,
        maxTier: 5,
        isUnique: false,
      });
      Assertion.equal(visual.id, expected[tier - 1][0], `tier ${tier} visual id`);
      Assertion.jsonEqual(
        visual.color,
        expected[tier - 1][1],
        `tier ${tier} visual color`,
      );
      Assertion.that(!visual.glow.enabled, `tier ${tier} has no rarity glow`);
    }

    const unique = this.#visualResolver.resolve({
      tier: 1,
      maxTier: 12,
      isUnique: true,
    });
    Assertion.equal(unique.id, "unique", "unique visual id");
    Assertion.jsonEqual(unique.color, [255, 205, 55], "unique gold color");
    Assertion.that(!unique.glow.enabled, "unique item glow is config-disabled");
    Assertion.equal(unique.glow.blur, 0, "disabled item glow has no blur");
    Assertion.that(unique.animation.enabled, "unique animation is enabled");

    const glowEnabledConfig = {
      ...this.#runtime.__VISUAL_CONFIG__,
      uniqueEffects: {
        ...this.#runtime.__VISUAL_CONFIG__.uniqueEffects,
        itemGlowEnabled: true,
      },
    };
    const glowEnabledVisual = this.#createVisualResolver(
      glowEnabledConfig,
    ).resolve({ tier: 1, maxTier: 12, isUnique: true });
    Assertion.that(
      glowEnabledVisual.glow.enabled,
      "unique item glow can be re-enabled from config",
    );

    for (const maxTier of [5, 6, 9, 12]) {
      let previous = -1;
      for (let tier = 1; tier <= maxTier; tier += 1) {
        const visual = this.#visualResolver.resolve({
          tier,
          maxTier,
          isUnique: false,
        });
        Assertion.that(
          visual.normalized > previous,
          `${maxTier}-tier scale increases at tier ${tier}`,
        );
        previous = visual.normalized;
      }
      Assertion.equal(previous, 0.8, `${maxTier}-tier scale ends at legendary`);
    }

    const itemRarity = this.#domainResolver.resolve({
      mode: "authored",
      tier: 4,
      maxTier: 5,
      isUnique: false,
    });
    const itemVisual = this.#visualResolver.resolve(itemRarity);
    const fishVisual = this.#visualResolver.resolve({
      tier: 4,
      maxTier: 5,
      isUnique: false,
    });
    Assertion.equal(
      itemVisual,
      fishVisual,
      "equivalent fish and item descriptors share one cached visual",
    );
  }

  #checkFactoryLifecycle() {
    const Factory = this.#runtime.__ITEM_FACTORY__;
    const database = {
      getItemData: (itemId) => this.#findItem(itemId),
    };
    const factory = new Factory({
      itemDatabase: database,
      itemRarityResolver: this.#domainResolver,
    });
    const base = {
      instanceId: "line-instance",
      itemId: "line_test_1",
      quantity: 1,
      durability: 1,
      lengthMeters: 25,
    };
    const first = factory.create(base);
    const changedRuntimeState = factory.create({
      ...base,
      quantity: 30,
      durability: 0.2,
      lengthMeters: 4,
    });
    Assertion.equal(
      first.rarity,
      changedRuntimeState.rarity,
      "runtime state resolves to the same cached authored descriptor",
    );
    Assertion.jsonEqual(
      first.rarity,
      changedRuntimeState.rarity,
      "quantity, durability and remaining line do not alter rarity",
    );

    const preserved = factory.create({
      ...base,
      rarity: {
        mode: "authored",
        tier: 4,
        maxTier: 5,
        normalized: 0.75,
        isUnique: false,
        uniqueId: null,
      },
    });
    Assertion.equal(preserved.rarity.tier, 4, "existing instance rarity is preserved");
    Assertion.that(Object.isFrozen(preserved.rarity), "migrated rarity is immutable");
  }

  #checkStackingPolicy() {
    const policy = new this.#runtime.__STACKING_POLICY__();
    const common = this.#domainResolver.resolve({
      mode: "authored",
      tier: 1,
      maxTier: 5,
      isUnique: false,
    });
    const rare = this.#domainResolver.resolve({
      mode: "authored",
      tier: 3,
      maxTier: 5,
      isUnique: false,
    });
    const unique = this.#domainResolver.resolve({
      mode: "authored",
      tier: 5,
      maxTier: 5,
      isUnique: true,
      uniqueId: "stack_unique",
    });
    const base = { instanceId: "a", itemId: "bait", quantity: 1 };
    Assertion.that(
      policy.canStack({ ...base, rarity: common }, { ...base, rarity: common }),
      "identical rarity can stack",
    );
    Assertion.that(
      !policy.canStack({ ...base, rarity: common }, { ...base, rarity: rare }),
      "different ordinary rarity cannot stack",
    );
    Assertion.that(
      !policy.canStack({ ...base, rarity: common }, { ...base, rarity: unique }),
      "unique item cannot stack with ordinary item",
    );
  }

  #checkDomAdapter() {
    const Adapter = this.#runtime.__DOM_ADAPTER__;
    const adapter = new Adapter({ visualResolver: this.#visualResolver });
    const element = {
      style: new StyleProbe(),
      classList: new ClassListProbe(),
      dataset: {},
    };
    const unique = this.#domainResolver.resolve({
      mode: "authored",
      tier: 5,
      maxTier: 5,
      isUnique: true,
      uniqueId: "dom_unique",
    });
    adapter.apply(element, unique);
    Assertion.equal(element.style.values.size, 6, "adapter writes six CSS variables");
    Assertion.that(element.classList.contains("has-rarity"), "rarity frame class");
    Assertion.that(element.classList.contains("rarity-unique"), "unique class");
    Assertion.that(
      !element.classList.contains("rarity-glow"),
      "disabled glow does not add a DOM glow class",
    );
    adapter.clear(element);
    Assertion.equal(element.style.values.size, 0, "adapter clears CSS variables");
    Assertion.that(
      !element.classList.contains("rarity-glow"),
      "adapter clears the DOM glow class",
    );
  }

  #checkCssLayering() {
    const css = fs.readFileSync(
      path.join(ROOT, "src/ui/styles/style.css"),
      "utf8",
    );
    Assertion.that(
      css.includes(".inv-slot.has-rarity::before"),
      "rarity uses the slot before layer",
    );
    Assertion.that(
      css.includes(".inv-slot.has-rarity.rarity-glow::before"),
      "item glow CSS is gated by the config-driven class",
    );
    Assertion.that(
      css.includes(".inv-tooltip.rarity-unique.rarity-glow"),
      "tooltip glow CSS is gated by the config-driven class",
    );
    const pulseStart = css.indexOf("@keyframes inventory-rarity-pulse");
    const pulseEnd = css.indexOf(".inv-slot.equipped::after", pulseStart);
    const pulseCss = css.slice(pulseStart, pulseEnd);
    Assertion.that(
      pulseStart >= 0 && pulseEnd > pulseStart && !pulseCss.includes("box-shadow"),
      "unique item pulse keeps opacity animation independent from glow",
    );
    for (const state of [
      "equipped",
      "selected",
      "highlight-target",
      "highlight-compatible",
    ]) {
      Assertion.that(
        css.includes(`.inv-slot.${state}::after`),
        `${state} uses the interaction after layer`,
      );
    }
    Assertion.that(
      css.includes("@media (prefers-reduced-motion: reduce)"),
      "reduced motion disables unique pulse",
    );
    for (const color of this.#runtime.__VISUAL_CONFIG__.colorStops) {
      const channels = color.color;
      const hex = `#${channels
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`;
      Assertion.that(
        !css.includes(channels.join(", ")) &&
          !css.toLowerCase().includes(hex.toLowerCase()),
        `${color.id} RGB is not duplicated in CSS`,
      );
    }
  }

  #checkInvalidProfiles() {
    const Validator = this.#runtime.__ITEM_VALIDATOR__;
    const invalidDb = {
      items: {
        missing: { id: "missing", name: "Missing", type: "bait" },
        invalid: {
          id: "invalid",
          name: "Invalid",
          type: "bait",
          color: [1, 2, 3],
          rarityProfile: {
            mode: "authored",
            tier: 6,
            maxTier: 5,
            isUnique: false,
          },
        },
        uniqueA: {
          id: "uniqueA",
          name: "Unique A",
          type: "bait",
          rarityProfile: {
            mode: "authored",
            tier: 5,
            maxTier: 5,
            isUnique: true,
            uniqueId: "duplicate",
          },
        },
        uniqueB: {
          id: "uniqueB",
          name: "Unique B",
          type: "bait",
          rarityProfile: {
            mode: "authored",
            tier: 5,
            maxTier: 5,
            isUnique: true,
            uniqueId: "duplicate",
          },
        },
      },
    };
    const issues = new Validator().validate({ itemDb: invalidDb });
    const messages = issues.map((issue) => `${issue.path}:${issue.message}`);
    Assertion.that(
      messages.some((message) => message.includes("missing explicit")),
      "missing rarity profile is rejected",
    );
    Assertion.that(
      messages.some((message) => message.includes("must not exceed")),
      "out-of-range tier is rejected",
    );
    Assertion.that(
      messages.some((message) => message.includes("hardcoded rarity color")),
      "item hardcoded color is rejected",
    );
    Assertion.that(
      messages.some((message) => message.includes("duplicate uniqueId")),
      "duplicate unique id is rejected",
    );
  }

  #findItem(itemId) {
    for (const category of Object.values(this.#itemDb)) {
      if (category?.[itemId]) return category[itemId];
    }
    return null;
  }

  #createVisualResolver(config) {
    return new this.#runtime.__VISUAL_RESOLVER__({
      configProvider: () => config,
      animationResolver: { resolvePulse: () => 0 },
    });
  }
}

const runtime = new ItemRarityRuntimeLoader().load();
new ItemRarityCheck(runtime).run();

const { readPageCss } = require("../../testing/styles/page_stylesheet_reader");
const { CheckAssertion } = require("../../testing/core/check_assertion");
const { SourceRuntime } = require("../../testing/core/source_runtime");
const { composeItemRarityResolver } = require("../../testing/runtime/item_rarity_test_composition");

const Assertion = CheckAssertion.create("Item rarity check");

class ItemRarityRuntimeLoader {
  load() {
    const runtime = new SourceRuntime();
    const scripts = [
      "src/game/presentation/rarity/rarity_visual_config.js",
      "src/game/config/raw/items/item_database.js",
      "src/game/config/raw/items/item_stat_overrides.js",
      "src/game/config/validation/item_rarity_config_validator.js",
      "src/game/domain/items/item_stat_override_policy.js",
      "src/game/domain/items/rarity/item_rarity_descriptor.js",
      "src/game/domain/items/rarity/item_rarity_strategy.js",
      "src/game/domain/items/rarity/authored_item_rarity_strategy.js",
      "src/game/domain/items/rarity/item_rarity_strategy_registry.js",
      "src/game/domain/items/rarity/item_rarity_resolver.js",
      "src/game/domain/items/effective_item_stats_resolver.js",
      "src/game/application/inventory/inventory_item_factory.js",
      "src/game/presentation/styles/rarity_visual_resolver.js",
      "src/platform/browser/dom/item_rarity_dom_adapter.js",
    ];
    runtime.loadMany(scripts).expose({
      __ITEM_DB__: "ITEM_DB",
      __VISUAL_CONFIG__: "RARITY_VISUAL_CONFIG",
      __ITEM_VALIDATOR__: "ItemRarityConfigValidator",
      __ITEM_RESOLVER__: "ItemRarityResolver",
      __ITEM_FACTORY__: "InventoryItemFactory",
      __VISUAL_RESOLVER__: "RarityVisualResolver",
      __DOM_ADAPTER__: "ItemRarityDomAdapter",
    });
    return runtime.context;
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
    this.#domainResolver = composeItemRarityResolver(runtime);
    this.#visualResolver = this.#createVisualResolver(
      runtime.__VISUAL_CONFIG__,
    );
  }

  run() {
    this.#checkProductionProfiles();
    this.#checkDomainResolution();
    this.#checkVisualScale();
    this.#checkFactoryLifecycle();
    this.#checkDomAdapter();
    this.#checkCssOwnership();
    this.#checkInvalidProfiles();
    console.log("Item rarity passed: resolution, config overrides, caching, hydration, adapter lifecycle and palette ownership.");
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

    const pulseEnabledConfig = {
      ...this.#runtime.__VISUAL_CONFIG__,
      uniqueEffects: {
        ...this.#runtime.__VISUAL_CONFIG__.uniqueEffects,
        itemPulseEnabled: true,
      },
    };
    const pulseEnabledVisual = this.#createVisualResolver(
      pulseEnabledConfig,
    ).resolve({ tier: 1, maxTier: 12, isUnique: true });
    Assertion.that(
      pulseEnabledVisual.animation.enabled,
      "unique item pulse can be re-enabled from config",
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
    Assertion.that(element.style.values.size > 0, "adapter supplies its resolved variables");
    Assertion.that(element.classList.contains("item-rarity"), "rarity frame class");
    Assertion.that(element.classList.contains("item-rarity--unique"), "unique class");
    Assertion.that(
      element.classList.contains("item-rarity--glow") === this.#visualResolver.resolve(unique).glow.enabled,
      "adapter follows configured glow availability",
    );
    Assertion.that(
      element.classList.contains("item-rarity--pulse") === this.#visualResolver.resolve(unique).animation.enabled,
      "adapter follows configured pulse availability",
    );
    adapter.clear(element);
    Assertion.equal(element.style.values.size, 0, "adapter clears CSS variables");
    Assertion.that(
      !element.classList.contains("item-rarity--glow"),
      "adapter clears the DOM glow class",
    );
    Assertion.that(
      !element.classList.contains("item-rarity--pulse"),
      "adapter clears the DOM pulse class",
    );
  }

  #checkCssOwnership() {
    const css = readPageCss();
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

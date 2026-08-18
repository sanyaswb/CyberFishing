const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const Assertion = CheckAssertion.create("Item rarity round-trip check");

class StyleProbe {
  values = new Map();

  setProperty(name, value) {
    this.values.set(name, String(value));
  }

  removeProperty(name) {
    this.values.delete(name);
  }
}

class ClassListProbe {
  values = new Set();

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    if (force) this.values.add(name);
    else this.values.delete(name);
  }
}

class ItemRarityRoundTripCheck {
  #runtime;
  #definitions;
  #database;
  #viewFactory;
  #snapshotMapper;

  constructor() {
    const sourceRuntime = new SourceRuntime();
    sourceRuntime.loadMany([
      "src/config/rarity/rarity_visual_config.js",
      "src/config/inventory/inventory_v2_sort_config.js",
      "src/config/inventory/inventory_v2_item_parameter_config.js",
      "src/config/items/item_stat_override_config.js",
      "src/core/items/item_stat_override_policy.js",
      "src/core/items/effective_item_stats_resolver.js",
      "src/core/items/rarity/item_rarity_descriptor.js",
      "src/core/items/rarity/item_rarity_strategy.js",
      "src/core/items/rarity/authored_item_rarity_strategy.js",
      "src/core/items/rarity/item_rarity_strategy_registry.js",
      "src/core/items/rarity/item_rarity_resolver.js",
      "src/core/items/rarity/effective_item_rarity_resolver.js",
      "src/core/items/freshness/item_freshness_state_policy.js",
      "src/infrastructure/storage/inventory_item_snapshot_mapper.js",
      "src/systems/inventory_item_view_factory.js",
      "src/application/inventory/inventory_v2_item_order_resolver.js",
      "src/ui/styles/rarity_visual_resolver.js",
      "src/ui/rarity/item_rarity_dom_adapter.js",
      "src/ui/inventory/inventory_v2_item_parameters_resolver.js",
    ]).expose({
      RarityConfig: "RARITY_VISUAL_CONFIG",
      SortConfig: "INVENTORY_V2_SORT_CONFIG",
      RarityResolver: "ItemRarityResolver",
      EffectiveRarityResolver: "EffectiveItemRarityResolver",
      ViewFactory: "InventoryItemViewFactory",
      SnapshotMapper: "InventoryItemSnapshotMapper",
      OrderResolver: "InventoryV2ItemOrderResolver",
      VisualResolver: "RarityVisualResolver",
      DomAdapter: "ItemRarityDomAdapter",
      ParametersResolver: "InventoryV2ItemParametersResolver",
    });
    this.#runtime = sourceRuntime.context;
    this.#definitions = this.#createDefinitions();
    this.#database = {
      getItemData: (itemId) => this.#definitions[itemId] || null,
    };
    const itemRarityResolver = new this.#runtime.RarityResolver();
    const effectiveRarityResolver = new this.#runtime.EffectiveRarityResolver({
      itemRarityResolver,
    });
    this.#viewFactory = new this.#runtime.ViewFactory({
      itemDatabase: this.#database,
      progressionResolver: { resolve: () => null },
      effectiveRarityResolver,
    });
    this.#snapshotMapper = new this.#runtime.SnapshotMapper({
      itemDefinitionResolver: this.#database,
      freshnessCapabilityProvider: () => null,
    });
  }

  run() {
    const restored = this.#checkAuthoredRoundTrip();
    this.#checkInstanceOverride();
    this.#checkMissingProfile();
    this.#checkDefaultSortingAndFiltering(restored);
    this.#checkVisualProjection(restored.rare);
    console.log("Item rarity snapshot, sorting, filtering and UI checks passed.");
  }

  #checkAuthoredRoundTrip() {
    const initialViews = {
      commonA: this.#view("common", "common-a"),
      legendary: this.#view("legendary", "legendary"),
      rare: this.#view("rare", "rare"),
      commonB: this.#view("common", "common-b"),
    };
    const restored = {};
    for (const [key, view] of Object.entries(initialViews)) {
      const snapshot = this.#snapshotMapper.toSnapshot(view);
      Assertion.that(
        !Object.prototype.hasOwnProperty.call(snapshot, "rarity"),
        `${key} snapshot omits authored rarity`,
      );
      restored[key] = this.#viewFactory.create(snapshot);
      Assertion.equal(
        restored[key].rarity,
        view.rarity,
        `${key} restores the cached authored rarity descriptor`,
      );
      Assertion.that(
        Object.isFrozen(restored[key].rarity),
        `${key} restored rarity is immutable`,
      );
    }
    return restored;
  }

  #checkInstanceOverride() {
    const override = {
      mode: "authored",
      tier: 4,
      maxTier: 5,
      isUnique: false,
    };
    const view = this.#view("common", "override", { rarity: override });
    Assertion.equal(view.rarity.tier, 4, "instance rarity overrides authored tier");
    const snapshot = this.#snapshotMapper.toSnapshot(view);
    Assertion.equal(snapshot.rarity.tier, 4, "instance rarity persists in snapshot");
    const restored = this.#viewFactory.create(snapshot);
    Assertion.equal(restored.rarity.tier, 4, "instance rarity survives round-trip");
  }

  #checkMissingProfile() {
    const view = this.#viewFactory.create(this.#instance("technical", "technical"));
    Assertion.equal(view.rarity, null, "definition without rarity profile stays neutral");
  }

  #checkDefaultSortingAndFiltering(restored) {
    const resolver = new this.#runtime.OrderResolver({
      config: this.#runtime.SortConfig,
      rarityVisualConfig: this.#runtime.RarityConfig,
    });
    const source = [
      restored.commonA,
      restored.legendary,
      restored.rare,
      restored.commonB,
      this.#viewFactory.create(this.#instance("technical", "technical-sort")),
    ];
    const ordered = resolver.resolve(source);
    Assertion.deepEqual(
      ordered.map((item) => item.instanceId),
      ["legendary", "rare", "common-a", "common-b", "technical-sort"],
      "default order is rarity descending, stable inside equal rarity and puts ungraded items last",
    );
    const controls = resolver.createControls(source);
    Assertion.deepEqual(
      controls.criterionIds,
      ["rarity"],
      "default sorting uses only rarity",
    );
    Assertion.equal(
      controls.directionId,
      "descending",
      "default sorting direction is descending",
    );
    const filtered = resolver.resolve(source, { activeRarityIds: ["rare"] });
    Assertion.deepEqual(
      filtered.map((item) => item.instanceId),
      ["rare"],
      "rarity filter uses the restored effective descriptor",
    );
    const common = resolver.resolve(source, { activeRarityIds: ["common"] });
    Assertion.deepEqual(
      common.map((item) => item.instanceId),
      ["common-a", "common-b"],
      "common filter excludes technical items without a rarity capability",
    );
    const commonControl = controls.rarities.find(
      (rarity) => rarity.id === "common",
    );
    Assertion.equal(
      commonControl?.count,
      2,
      "common counter excludes items without a rarity descriptor",
    );
  }

  #checkVisualProjection(item) {
    const visualResolver = new this.#runtime.VisualResolver({
      configProvider: () => this.#runtime.RarityConfig,
      animationResolver: { resolvePulse: () => 0 },
    });
    const adapter = new this.#runtime.DomAdapter({ visualResolver });
    const card = {
      classList: new ClassListProbe(),
      style: new StyleProbe(),
      dataset: {},
    };
    adapter.apply(card, item.rarity);
    Assertion.that(card.classList.values.has("has-rarity"), "restored card has rarity frame");
    Assertion.equal(card.dataset.rarity, "rare", "restored card exposes rarity id");
    Assertion.that(
      card.style.values.has("--rarity-color") &&
        card.style.values.has("--rarity-background-color") &&
        card.style.values.has("--rarity-border-width"),
      "restored card receives rarity color, background and border variables",
    );

    const parametersResolver = new this.#runtime.ParametersResolver({
      resourceMeterResolver: { resolve: () => null },
      rarityVisualResolver: visualResolver,
      parameterConfig: {},
      parameterAliases: {},
    });
    const rarityParameter = parametersResolver
      .resolve(item)
      .find((parameter) => parameter.id === "rarity");
    Assertion.equal(
      rarityParameter?.value,
      "Рідкісний",
      "restored descriptor resolves the correct localized rarity label",
    );
    Assertion.equal(
      rarityParameter?.color,
      card.style.values.get("--rarity-color"),
      "parameter label and card frame use the same rarity color",
    );
  }

  #view(itemId, instanceId, extra = {}) {
    return this.#viewFactory.create(this.#instance(itemId, instanceId, extra));
  }

  #instance(itemId, instanceId, extra = {}) {
    return {
      instanceId,
      itemId,
      quantity: 1,
      location: { kind: "inventory" },
      ...extra,
    };
  }

  #createDefinitions() {
    const definition = (itemId, tier) => Object.freeze({
      id: itemId,
      name: itemId,
      itemType: "bait",
      variant: "natural",
      rarityProfile: tier === null
        ? null
        : Object.freeze({
            mode: "authored",
            tier,
            maxTier: 5,
            isUnique: false,
          }),
      progressionProfile: null,
      displayStats: Object.freeze({}),
      gameplayStats: Object.freeze({}),
    });
    return Object.freeze({
      common: definition("common", 1),
      rare: definition("rare", 3),
      legendary: definition("legendary", 5),
      technical: definition("technical", null),
    });
  }
}

new ItemRarityRoundTripCheck().run();

const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const Assertion = CheckAssertion.create("Bait effectiveness check");

class BaitEffectivenessCheck {
  #runtime;
  #sourceRuntime;

  constructor() {
    this.#sourceRuntime = new SourceRuntime();
    this.#sourceRuntime.loadMany([
      "src/config/databases/item_db.js",
      "src/config/databases/fish/species/peaceful_fish.js",
      "src/config/databases/fish/species/predator_fish.js",
      "src/config/databases/fish/species/rare_fish.js",
      "src/config/databases/fish/species/event_fish.js",
      "src/config/databases/fish/fish_categories.js",
      "src/config/databases/fish_db.js",
      "src/core/items/metrics/item_bounded_metric_resolver.js",
      "src/core/items/freshness/item_freshness_descriptor.js",
      "src/core/items/freshness/bait_freshness_decay_policy.js",
      "src/core/items/freshness/bait_freshness_modifier.js",
      "src/core/items/freshness/item_freshness_resolver.js",
      "src/core/items/bait/bait_effectiveness_descriptor.js",
      "src/core/items/bait/bait_effectiveness_match.js",
      "src/core/items/bait/bait_effectiveness_grade_policy.js",
      "src/core/items/bait/bait_effectiveness_knowledge_policy.js",
      "src/core/items/bait/bait_effectiveness_resolver.js",
      "src/core/items/bait/bait_effectiveness_catalog_resolver.js",
      "src/core/items/rarity/item_rarity_descriptor.js",
      "src/core/items/rarity/item_rarity_strategy.js",
      "src/core/items/rarity/authored_item_rarity_strategy.js",
      "src/core/items/rarity/item_rarity_strategy_registry.js",
      "src/core/items/rarity/item_rarity_resolver.js",
      "src/core/items/rarity/effective_item_rarity_resolver.js",
      "src/systems/inventory_item_view_factory.js",
      "src/ui/inventory/inventory_v2_item_parameters_resolver.js",
      "src/ui/inventory/inventory_v2_balance_parameter_resolver.js",
    ]).expose({
      ITEM_DATABASE: "ITEM_DB",
      FISH_DATABASE: "FISH_DB",
      EffectivenessResolver: "BaitEffectivenessResolver",
      CatalogResolver: "BaitEffectivenessCatalogResolver",
      ViewFactory: "InventoryItemViewFactory",
      ParametersResolver: "InventoryV2ItemParametersResolver",
      BalanceResolver: "InventoryV2BalanceParameterResolver",
    });
    this.#runtime = this.#sourceRuntime.context;
  }

  run() {
    this.#checkContextualMultipliers();
    this.#checkCatalogAndKnowledgePolicy();
    this.#checkInventoryReadModels();
    this.#checkSingleGameplaySource();
    console.log("Contextual bait effectiveness checks passed.");
  }

  #checkContextualMultipliers() {
    const resolver = new this.#runtime.EffectivenessResolver();
    const crucian = this.#fish("crucian_stalker");
    const perch = this.#fish("perch_radioactive");

    Assertion.equal(
      resolver.resolveMultiplier(crucian, "oil_worm"),
      1,
      "oil worm uses crucian affinity",
    );
    Assertion.equal(
      resolver.resolveMultiplier(perch, "oil_worm"),
      2,
      "oil worm uses perch affinity",
    );
    Assertion.equal(
      resolver.resolveMultiplier(perch, "bread"),
      0,
      "bread is incompatible with perch",
    );
    Assertion.equal(
      resolver.resolveBestMultiplier(perch, ["test_spinner", "oil_worm"]),
      2,
      "best equipped bait multiplier is resolved centrally",
    );

    const spinner = resolver.resolve(perch, "test_spinner");
    Assertion.equal(spinner.stars, 3, "half-strength lure receives three stars");
    Assertion.near(
      spinner.relativeEffectiveness,
      0.5,
      "stars are relative to the best bait for the same fish",
    );
    const worm = resolver.resolve(perch, "oil_worm");
    Assertion.equal(worm.stars, 5, "best bait receives five stars");
  }

  #checkCatalogAndKnowledgePolicy() {
    const hiddenResolver = new this.#runtime.EffectivenessResolver({
      knowledgePolicy: { isDiscovered: () => false },
    });
    const hiddenCatalog = new this.#runtime.CatalogResolver({
      fishDatabase: this.#runtime.FISH_DATABASE,
      resolver: hiddenResolver,
    });
    const hidden = hiddenCatalog.resolve({ itemId: "oil_worm", itemType: "bait" });
    Assertion.that(hidden.available, "bait has a contextual capability");
    Assertion.that(
      hidden.entries.every((entry) => !entry.discovered && entry.multiplier === null),
      "knowledge policy hides undiscovered coefficients",
    );
    Assertion.equal(
      hiddenResolver.resolveMultiplier(this.#fish("perch_radioactive"), "oil_worm"),
      2,
      "player knowledge never changes gameplay effectiveness",
    );

    const catalog = new this.#runtime.CatalogResolver({
      fishDatabase: this.#runtime.FISH_DATABASE,
      resolver: new this.#runtime.EffectivenessResolver(),
    });
    const unsupported = catalog.resolve({ itemId: "rod", itemType: "rod" });
    Assertion.that(!unsupported.available, "non-bait items have no capability");
  }

  #checkInventoryReadModels() {
    const catalog = new this.#runtime.CatalogResolver({
      fishDatabase: this.#runtime.FISH_DATABASE,
      resolver: new this.#runtime.EffectivenessResolver(),
    });
    const definition = this.#item("oil_worm");
    const viewFactory = new this.#runtime.ViewFactory({
      itemDatabase: { getItemData: (itemId) => this.#item(itemId) },
      progressionResolver: { resolve: () => Object.freeze({}) },
      effectiveStatsResolver: {
        resolve: ({ definition: source }) => Object.freeze({
          ...(source?.gameplayStats || {}),
        }),
      },
      baitEffectivenessCatalogResolver: catalog,
    });
    const view = viewFactory.create({
      instanceId: "bait-instance",
      itemId: definition.id,
      quantity: 1,
    });
    Assertion.that(view.baitEffectiveness?.available, "view exposes capability");
    Assertion.equal(
      view.baitEffectiveness.entries.length,
      this.#runtime.FISH_DATABASE.length,
      "view resolves one contextual entry per fish",
    );

    const parameters = new this.#runtime.ParametersResolver({
      resourceMeterResolver: { resolve: () => null },
      parameterConfig: {
        baitEffectiveness: { label: "Ефективність за видом риби" },
      },
    }).resolve(view);
    const effectiveness = parameters.find(
      (parameter) => parameter.id === "baitEffectiveness",
    );
    Assertion.equal(effectiveness?.kind, "effectiveness", "UI descriptor kind");
    Assertion.equal(
      effectiveness?.entries?.length,
      this.#runtime.FISH_DATABASE.length,
      "UI receives contextual entries without recalculation",
    );

    const sections = new this.#runtime.BalanceResolver({
      config: { stats: {}, ignoredEffectiveStatsPaths: [] },
      debugConfig: {},
    }).resolve(view);
    const section = sections.find((entry) => entry.id === "bait-effectiveness");
    Assertion.equal(
      section?.rows?.length,
      this.#runtime.FISH_DATABASE.length,
      "tooltip exposes contextual effectiveness section",
    );
  }

  #checkSingleGameplaySource() {
    const itemSource = this.#sourceRuntime.read("src/config/databases/item_db.js");
    const biteSource = this.#sourceRuntime.read("src/systems/bite_system.js");
    Assertion.that(
      !itemSource.includes("attractionPower") && !itemSource.includes("jigPower"),
      "fake global lure power stats are removed",
    );
    Assertion.that(
      !biteSource.includes("fish.baitMultipliers"),
      "BiteSystem delegates fish affinity lookup to the domain resolver",
    );
    Assertion.that(
      biteSource.includes("resolveBestMatch"),
      "BiteSystem consumes the shared resolver",
    );
  }

  #fish(fishId) {
    const fish = this.#runtime.FISH_DATABASE.find((entry) => entry.id === fishId);
    Assertion.that(fish, `fish fixture exists: ${fishId}`);
    return fish;
  }

  #item(itemId) {
    for (const category of Object.values(this.#runtime.ITEM_DATABASE)) {
      if (category?.[itemId]) return category[itemId];
    }
    return null;
  }
}

new BaitEffectivenessCheck().run();

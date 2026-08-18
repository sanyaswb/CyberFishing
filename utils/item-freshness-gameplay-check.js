const fs = require("node:fs");
const path = require("node:path");
const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const ROOT = path.resolve(__dirname, "..");
const Assertion = CheckAssertion.create("Item freshness gameplay check");

class ItemFreshnessGameplayCheck {
  #runtime;

  constructor() {
    const sourceRuntime = new SourceRuntime();
    sourceRuntime.loadMany([
      "src/config/items/item_progression_config.js",
      "src/config/items/item_stat_override_config.js",
      "src/config/databases/item_db.js",
      "src/core/items/item_stat_override_policy.js",
      "src/core/items/effective_item_stats_resolver.js",
      "src/core/items/metrics/item_bounded_metric_resolver.js",
      "src/core/items/freshness/item_freshness_descriptor.js",
      "src/core/items/freshness/item_freshness_state_policy.js",
      "src/core/items/freshness/bait_freshness_decay_policy.js",
      "src/core/items/freshness/bait_freshness_modifier.js",
      "src/core/items/freshness/item_freshness_resolver.js",
      "src/core/items/bait/bait_effectiveness_descriptor.js",
      "src/core/items/bait/bait_effectiveness_match.js",
      "src/core/items/bait/bait_effectiveness_grade_policy.js",
      "src/core/items/bait/bait_effectiveness_knowledge_policy.js",
      "src/core/items/bait/bait_effectiveness_resolver.js",
      "src/core/inventory/inventory_item_location.js",
      "src/core/inventory/flat_inventory_item_repository.js",
      "src/core/inventory/item_assembly_stacking_policy.js",
      "src/application/inventory/inventory_v2_item_hydrator.js",
      "src/application/inventory/refill_compatible_signature_policy.js",
      "src/application/inventory/freshest_refill_candidate_policy.js",
      "src/application/inventory/apply_bait_exposure_service.js",
      "src/application/inventory/inventory_v2_refill_ports.js",
      "src/infrastructure/storage/inventory_item_snapshot_mapper.js",
    ]).expose({
      CONFIGURATION: "ITEM_PROGRESSION_CONFIG",
      DB: "ITEM_DB",
      StatePolicy: "ItemFreshnessStatePolicy",
      DecayPolicy: "BaitFreshnessDecayPolicy",
      Modifier: "BaitFreshnessModifier",
      FreshnessResolver: "ItemFreshnessResolver",
      EffectivenessResolver: "BaitEffectivenessResolver",
      Location: "InventoryItemLocation",
      Repository: "FlatInventoryItemRepository",
      Hydrator: "InventoryV2ItemHydrator",
      ExposureService: "ApplyBaitExposureService",
      RefillSignature: "RefillCompatibleSignaturePolicy",
      FreshestPolicy: "FreshestRefillCandidatePolicy",
      RefillPort: "InventoryV2RefillInventoryPort",
      StackingPolicy: "ItemAssemblyStackingPolicy",
      SnapshotMapper: "InventoryItemSnapshotMapper",
    });
    this.#runtime = sourceRuntime.context;
  }

  run() {
    this.#checkPolicies();
    this.#checkContextualEffectiveness();
    this.#checkExposurePersistence();
    this.#checkStackingAndRefill();
    this.#checkProductionWiring();
    console.log("Item freshness gameplay checks passed.");
  }

  #checkProductionWiring() {
    const source = fs.readFileSync(
      path.join(ROOT, "src/systems/inventory_system.js"),
      "utf8",
    );
    Assertion.that(
      source.includes("itemFreshnessResolver: this.#itemFreshnessResolver"),
      "InventoryManager forwards its stored Freshness dependency to Inventory V2",
    );
  }

  #profileProvider(item) {
    const groupId = item?.progressionProfile?.groupId;
    return this.#runtime.CONFIGURATION.groups[groupId]?.freshness;
  }

  #freshnessResolver() {
    return new this.#runtime.FreshnessResolver({
      profileProvider: (item) => this.#profileProvider(item),
    });
  }

  #checkPolicies() {
    const statePolicy = new this.#runtime.StatePolicy();
    const decay = new this.#runtime.DecayPolicy();
    const modifier = new this.#runtime.Modifier();
    Assertion.equal(statePolicy.resolvePercent(), 100, "missing state defaults to 100");
    Assertion.equal(
      decay.resolve({ percent: 100, exposureMs: 600000, lossPerMinute: 5 }),
      50,
      "ten scaled minutes remove fifty percentage points",
    );
    Assertion.equal(
      decay.resolve({ percent: 100, exposureMs: 1200000, lossPerMinute: 5 }),
      0,
      "freshness clamps at zero",
    );
    Assertion.equal(
      modifier.resolve({ percent: 50, minimumMultiplier: 0.5 }),
      0.75,
      "half freshness produces the configured modifier",
    );
    Assertion.equal(
      modifier.resolve({ percent: 0, minimumMultiplier: 0.5 }),
      0.5,
      "stale bait remains usable at the configured floor",
    );
    Assertion.throws(
      () => statePolicy.normalize({ percent: 50, extra: true }),
      "freshness state rejects unknown fields",
    );
  }

  #checkContextualEffectiveness() {
    const freshnessResolver = this.#freshnessResolver();
    const resolver = new this.#runtime.EffectivenessResolver({
      freshnessResolver,
      freshnessModifier: new this.#runtime.Modifier(),
    });
    const fish = {
      id: "test_fish",
      name: "Test fish",
      baitMultipliers: { oil_worm: 2, bread: 1.2 },
    };
    const worm = {
      itemId: "oil_worm",
      instanceId: "worm",
      itemType: "bait",
      progressionProfile: { groupId: "bait.natural" },
    };
    const fresh = resolver.resolve(fish, worm);
    const aged = resolver.resolve(fish, worm, { exposureMs: 600000 });
    Assertion.equal(fresh.stars, aged.stars, "freshness does not change affinity stars");
    Assertion.equal(aged.freshnessPercent, 50, "descriptor exposes projected freshness");
    Assertion.equal(aged.effectiveMultiplier, 1.5, "affinity is modified by freshness");

    const staleWorm = { ...worm, freshnessState: { percent: 0 } };
    const bread = {
      itemId: "bread",
      instanceId: "bread",
      itemType: "bait",
      progressionProfile: { groupId: "bait.natural" },
    };
    const match = resolver.resolveBestMatch(fish, [staleWorm, bread]);
    Assertion.equal(match.baitId, "bread", "best candidate uses effective multiplier");
    Assertion.equal(match.effectiveMultiplier, 1.2, "fresh bait can beat stale affinity");
  }

  #checkExposurePersistence() {
    const runtime = this.#runtime;
    const repository = new runtime.Repository({
      items: [
        {
          instanceId: "hook",
          itemId: "hook_basic",
          quantity: 1,
          location: runtime.Location.inventory(),
        },
        {
          instanceId: "worm-attached",
          itemId: "oil_worm",
          quantity: 1,
          location: runtime.Location.attached("hook", "bait", 0),
        },
      ],
    });
    const hydrator = new runtime.Hydrator({ itemDefinitionResolver: runtime.DB });
    const service = new runtime.ExposureService({
      repository,
      hydrator,
      freshnessResolver: this.#freshnessResolver(),
    });
    const context = {
      instanceIds: ["worm-attached"],
      exposureMs: 600000,
      exposureToken: "cast:1",
    };
    service.apply(context);
    service.confirm(context);
    Assertion.equal(
      repository.get("worm-attached").freshnessState.percent,
      50,
      "retrieval persists projected freshness",
    );
    Assertion.equal(service.apply(context).length, 0, "same cast is not applied twice");

    const mapper = new runtime.SnapshotMapper({
      itemDefinitionResolver: (itemId) => hydrator.getDefinition(itemId),
    });
    const snapshot = mapper.toSnapshot(repository.get("worm-attached"));
    Assertion.equal(snapshot.freshnessState.percent, 50, "save keeps canonical state");
    const full = mapper.toSnapshot({
      ...repository.get("worm-attached"),
      freshnessState: { percent: 100 },
    });
    Assertion.that(!("freshnessState" in full), "default freshness is omitted");
    Assertion.throws(
      () => mapper.toSnapshot({
        ...repository.get("worm-attached"),
        freshnessState: { percent: 101 },
      }),
      "current schema rejects invalid freshness",
    );
  }

  #checkStackingAndRefill() {
    const runtime = this.#runtime;
    const base = {
      itemId: "oil_worm",
      quantity: 1,
      location: runtime.Location.inventory(),
    };
    const stale = { ...base, instanceId: "stale", freshnessState: { percent: 20 } };
    const fresh = { ...base, instanceId: "fresh", freshnessState: { percent: 80 } };
    const equallyFresh = {
      ...base,
      instanceId: "fresh-2",
      freshnessState: { percent: 80 },
    };
    const stacking = new runtime.StackingPolicy();
    Assertion.that(!stacking.canStack(stale, fresh), "different freshness stays split");
    Assertion.that(stacking.canStack(fresh, equallyFresh), "equal freshness can stack");

    const repository = new runtime.Repository({ items: [stale, fresh] });
    const signaturePolicy = new runtime.RefillSignature();
    const port = new runtime.RefillPort({
      repository,
      signaturePolicy,
      stackingPolicy: stacking,
      reservationPolicy: { isReserved: () => false },
      candidatePolicy: new runtime.FreshestPolicy(),
    });
    const selected = port.takeOneExact(signaturePolicy.create(stale));
    Assertion.equal(selected.instanceId, "fresh", "auto-refill selects freshest match");
  }
}

new ItemFreshnessGameplayCheck().run();

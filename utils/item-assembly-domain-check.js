const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { CheckAssertion } = require("./testing/core/check_assertion");

const ROOT = path.resolve(__dirname, "..");
const Assertion = CheckAssertion.create("Item assembly check");

class AssemblyRuntimeLoader {
  #context = vm.createContext({ console });

  load() {
    this.#load(
      "src/config/inventory/item_assembly_profile_config.js",
      ["ITEM_ASSEMBLY_PROFILE_IDS", "ITEM_ASSEMBLY_PROFILE_CONFIG"],
    );
    this.#load("src/core/inventory/inventory_item_location.js", [
      "InventoryItemLocationKind",
      "InventoryItemLocation",
    ]);
    this.#load("src/core/inventory/unlimited_assembly_capacity_policy.js", [
      "UnlimitedAssemblyCapacityPolicy",
    ]);
    this.#load("src/core/inventory/item_assembly_stacking_policy.js", [
      "ItemAssemblyStackingPolicy",
    ]);
    this.#load("src/core/inventory/flat_inventory_item_repository.js", [
      "FlatInventoryItemRepository",
    ]);
    this.#load("src/core/assemblies/assembly_state.js", [
      "AssemblyPreparationStatus",
      "AssemblyState",
    ]);
    this.#load("src/core/assemblies/assembly_state_repository.js", [
      "AssemblyStateRepository",
    ]);
    this.#load("src/core/assemblies/assembly_profile_registry.js", [
      "AssemblyProfileRegistry",
    ]);
    this.#load(
      "src/core/assemblies/exact_assembly_refill_signature_policy.js",
      ["ExactAssemblyRefillSignaturePolicy"],
    );
    this.#load("src/core/assemblies/item_assembly_reader.js", [
      "ItemAssemblyPath",
      "ItemAssemblyReader",
    ]);
    this.#load("src/core/assemblies/item_assembly_service.js", [
      "ItemAssemblyDomainError",
      "ItemAssemblyService",
    ]);
    return this.#context;
  }

  #load(relativePath, globalNames) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    const expose = globalNames
      .map((name) => `globalThis.${name} = ${name};`)
      .join("\n");
    vm.runInContext(`${source}\n${expose}`, this.#context, {
      filename: relativePath,
    });
  }
}

class DomainFixture {
  #runtime;
  #sequence = 0;

  constructor(runtime, { capacityPolicy = null, items = null } = {}) {
    this.#runtime = runtime;
    this.repository = new runtime.FlatInventoryItemRepository({
      items: items || this.#items(),
      instanceIdFactory: (source) => `${source.instanceId}-split-${++this.#sequence}`,
    });
    this.stateRepository = new runtime.AssemblyStateRepository();
    this.profileRegistry = new runtime.AssemblyProfileRegistry();
    this.reader = new runtime.ItemAssemblyReader({
      repository: this.repository,
      stateRepository: this.stateRepository,
      profileRegistry: this.profileRegistry,
    });
    this.signaturePolicy = new runtime.ExactAssemblyRefillSignaturePolicy();
    this.service = new runtime.ItemAssemblyService({
      repository: this.repository,
      stateRepository: this.stateRepository,
      profileRegistry: this.profileRegistry,
      reader: this.reader,
      capacityPolicy,
      signaturePolicy: this.signaturePolicy,
    });
  }

  inventory(instanceId, itemId, itemType, quantity = 1, extra = {}) {
    return {
      instanceId,
      itemId,
      itemType,
      quantity,
      location: this.#runtime.InventoryItemLocation.inventory(),
      ...extra,
    };
  }

  #items() {
    return [
      this.inventory("spring-stack", "spring-basic", "feeder_rig", 2, {
        effectiveStats: {
          assemblyProfileId: "feeder_spring_basic",
          hooksCount: 2,
          hasChumSlot: true,
        },
      }),
      this.inventory("hook-stack", "hook-basic", "hook", 3, {
        effectiveStats: { assemblyProfileId: "hook_standard" },
      }),
      this.inventory("bait-red", "worm", "bait", 5, {
        rarity: { tier: 2 },
        flavor: "oil",
      }),
      this.inventory("bait-blue", "worm", "bait", 2, {
        rarity: { tier: 3 },
        flavor: "ice",
      }),
      this.inventory("chum-stack", "carp-mix", "chum_mix", 3, {
        recipe: "carp-v1",
      }),
      this.inventory("reel-one", "reel-test", "reel", 1),
      this.inventory("line-stack", "line-basic", "fishing_line", 2, {
        effectiveStats: { lengthMeters: 25 },
      }),
      this.inventory("boat-one", "boat-lvl3", "boat", 1, {
        effectiveStats: { assemblyProfileId: "bait_boat", sections: 3 },
      }),
      this.inventory("hook-one", "hook-basic", "hook", 1),
    ];
  }
}

class ItemAssemblyDomainCheckSuite {
  #runtime;

  constructor(runtime) {
    this.#runtime = runtime;
  }

  run() {
    this.#checkCanonicalLocationsAndRepositoryGraph();
    this.#checkDraftTreeAndExactUnitAllocation();
    this.#checkPrepareReplaceDetachConsumeAndDisassemble();
    this.#checkProfilesPathsAndOptionalPreparation();
    this.#checkPreparedChildAssemblyCanBeAbsorbed();
    this.#checkInvalidOperationsAreAtomic();
    this.#checkCapacityHookAndSnapshotRoundTrip();
  }

  #checkCanonicalLocationsAndRepositoryGraph() {
    const kinds = this.#runtime.InventoryItemLocationKind;
    Assertion.deepEqual(
      Object.keys(kinds),
      ["INVENTORY", "ATTACHED", "LOADOUT"],
      "location kinds do not model EQUIPPED as custody",
    );

    Assertion.throws(
      () =>
        new this.#runtime.FlatInventoryItemRepository({
          items: [
            {
              instanceId: "a",
              itemId: "a",
              quantity: 1,
              location: this.#runtime.InventoryItemLocation.attached("b", "bait", 0),
            },
            {
              instanceId: "b",
              itemId: "b",
              quantity: 1,
              location: this.#runtime.InventoryItemLocation.attached("a", "bait", 0),
            },
          ],
        }),
      "repository rejects attachment cycles",
    );

    Assertion.throws(
      () =>
        new this.#runtime.FlatInventoryItemRepository({
          items: [
            { instanceId: "p", itemId: "p", quantity: 1 },
            {
              instanceId: "a",
              itemId: "a",
              quantity: 1,
              location: this.#runtime.InventoryItemLocation.attached("p", "bait", 0),
            },
            {
              instanceId: "b",
              itemId: "b",
              quantity: 1,
              location: this.#runtime.InventoryItemLocation.attached("p", "bait", 0),
            },
          ],
        }),
      "repository rejects two children in the same parent slot",
    );
  }

  #checkDraftTreeAndExactUnitAllocation() {
    const fixture = new DomainFixture(this.#runtime);
    const rootId = fixture.service.startAssembly("spring-stack");
    Assertion.that(rootId !== "spring-stack", "starting from quantity stack splits a root");
    Assertion.equal(
      fixture.repository.get("spring-stack").quantity,
      1,
      "root quantity stack loses exactly one unit",
    );
    Assertion.equal(
      fixture.repository.get(rootId).quantity,
      1,
      "assembly root always has quantity one",
    );
    Assertion.equal(
      fixture.reader.getAssemblyState(rootId).status,
      "DRAFT",
      "new root starts as draft",
    );

    const hookAttachment = fixture.service.attach({
      rootInstanceId: rootId,
      sourceInstanceId: "hook-stack",
      slotId: "hook",
      slotIndex: 0,
    });
    Assertion.equal(
      fixture.repository.get("hook-stack").quantity,
      2,
      "attaching a hook removes one unit",
    );
    const attachedHook = fixture.repository.get(hookAttachment.attachedInstanceId);
    Assertion.equal(attachedHook.quantity, 1, "attached hook quantity is one");
    Assertion.equal(
      attachedHook.location.parentInstanceId,
      rootId,
      "hook stores its parent link",
    );

    const baitAttachment = fixture.service.attach({
      rootInstanceId: rootId,
      parentInstanceId: attachedHook.instanceId,
      sourceInstanceId: "bait-red",
      slotId: "bait",
      slotIndex: 0,
    });
    Assertion.equal(
      baitAttachment.path,
      "hook[0].bait",
      "nested bait uses canonical indexed path",
    );
    Assertion.equal(
      fixture.reader.readPath(rootId, "hook[0].bait").instanceId,
      baitAttachment.attachedInstanceId,
      "reader resolves nested path",
    );
    Assertion.equal(
      fixture.reader.getChildren(rootId, "hook")[0].location.slotIndex,
      0,
      "reader exposes child slot index",
    );
    Assertion.equal(
      fixture.reader.getRootInstanceId(baitAttachment.attachedInstanceId),
      rootId,
      "reader resolves tree root",
    );
    const signature = fixture.reader.getRefillSignature(rootId, "hook[0].bait");
    Assertion.equal(signature.itemId, "worm", "refill remembers exact item id");
    Assertion.equal(
      signature.properties.rarity.tier,
      2,
      "refill remembers exact rarity",
    );
    Assertion.equal(
      fixture.repository.get("bait-red").quantity,
      4,
      "attaching bait moves exactly one consumable",
    );
  }

  #checkPrepareReplaceDetachConsumeAndDisassemble() {
    const fixture = new DomainFixture(this.#runtime);
    const rootId = fixture.service.startAssembly("spring-stack");
    const hook = fixture.service.attach({
      rootInstanceId: rootId,
      sourceInstanceId: "hook-stack",
      slotId: "hook",
      slotIndex: 0,
    });
    fixture.service.attach({
      rootInstanceId: rootId,
      parentInstanceId: hook.attachedInstanceId,
      sourceInstanceId: "bait-red",
      slotId: "bait",
      slotIndex: 0,
    });
    fixture.service.attach({
      rootInstanceId: rootId,
      sourceInstanceId: "chum-stack",
      slotId: "chum",
      slotIndex: 0,
    });
    fixture.service.prepare(rootId);

    fixture.service.replace({
      rootInstanceId: rootId,
      parentInstanceId: hook.attachedInstanceId,
      sourceInstanceId: "bait-blue",
      slotId: "bait",
      slotIndex: 0,
    });
    Assertion.equal(
      fixture.reader.readPath(rootId, "hook[0].bait").rarity.tier,
      3,
      "replace installs the requested exact variant",
    );
    Assertion.equal(
      fixture.repository.get("bait-red").quantity,
      5,
      "replace returns and merges the previous component",
    );
    Assertion.equal(
      fixture.reader.getAssemblyState(rootId).status,
      "PREPARED",
      "editing does not reset prepared state",
    );

    fixture.service.detach({
      rootInstanceId: rootId,
      parentInstanceId: hook.attachedInstanceId,
      slotId: "bait",
      slotIndex: 0,
    });
    Assertion.equal(
      fixture.reader.getRefillSignature(rootId, "hook[0].bait"),
      null,
      "manual detach clears refill preference",
    );
    Assertion.equal(
      fixture.repository.get("bait-blue").quantity,
      2,
      "manual detach restores and merges the component",
    );

    fixture.service.attach({
      rootInstanceId: rootId,
      parentInstanceId: hook.attachedInstanceId,
      sourceInstanceId: "bait-blue",
      slotId: "bait",
      slotIndex: 0,
    });
    const rememberedBeforeConsumption = fixture.reader.getRefillSignature(
      rootId,
      "hook[0].bait",
    );
    fixture.service.consume({
      rootInstanceId: rootId,
      parentInstanceId: hook.attachedInstanceId,
      slotId: "bait",
      slotIndex: 0,
    });
    Assertion.equal(
      fixture.reader.readPath(rootId, "hook[0].bait"),
      null,
      "consumption empties the physical slot",
    );
    Assertion.deepEqual(
      fixture.reader.getRefillSignature(rootId, "hook[0].bait"),
      rememberedBeforeConsumption,
      "consumption retains the exact refill preference",
    );

    const disassembled = fixture.service.disassemble(rootId);
    Assertion.that(
      !fixture.stateRepository.has(rootId),
      "disassembly removes root assembly metadata",
    );
    Assertion.equal(
      fixture.repository.get("spring-stack").quantity,
      2,
      "disassembly merges the root into its quantity stack",
    );
    Assertion.equal(
      fixture.repository.get("hook-stack").quantity,
      3,
      "disassembly restores and merges hooks",
    );
    Assertion.equal(
      fixture.repository.get("chum-stack").quantity,
      3,
      "disassembly restores and merges unused chum",
    );
    Assertion.equal(
      disassembled.returnedRootInstanceId,
      "spring-stack",
      "disassembly reports the surviving merged root id",
    );
  }

  #checkProfilesPathsAndOptionalPreparation() {
    const fixture = new DomainFixture(this.#runtime);
    const reelRoot = fixture.service.startAssembly("reel-one");
    Assertion.equal(
      fixture.reader.getAssemblyState(reelRoot).profileId,
      "reel_standard",
      "type fallback selects reel profile",
    );
    const line = fixture.service.attach({
      rootInstanceId: reelRoot,
      sourceInstanceId: "line-stack",
      slotId: "line",
      slotIndex: 0,
    });
    Assertion.equal(line.path, "line", "single reel line path omits index");
    Assertion.equal(
      fixture.reader.getSlotCapacity(reelRoot, "line"),
      1,
      "reader exposes slot capacity",
    );

    const hookRoot = fixture.service.startAssembly("hook-one");
    const bait = fixture.service.attach({
      rootInstanceId: hookRoot,
      sourceInstanceId: "bait-red",
      slotId: "bait",
      slotIndex: 0,
    });
    Assertion.equal(bait.path, "bait", "standalone hook supports bait path");

    const boatRoot = fixture.service.startAssembly("boat-one");
    const cargo = fixture.service.attach({
      rootInstanceId: boatRoot,
      sourceInstanceId: "chum-stack",
      slotId: "cargo",
      slotIndex: 2,
    });
    Assertion.equal(cargo.path, "cargo[2]", "boat cargo preserves section index");
    Assertion.equal(
      fixture.reader.getSlotCapacity(boatRoot, "cargo"),
      3,
      "boat cargo capacity comes from item characteristics",
    );

    const emptySpringRoot = fixture.service.startAssembly("spring-stack");
    const prepared = fixture.service.prepare(emptySpringRoot);
    Assertion.equal(
      prepared.status,
      "PREPARED",
      "all child slots are optional for preparation",
    );
  }

  #checkInvalidOperationsAreAtomic() {
    const fixture = new DomainFixture(this.#runtime);
    const rootId = fixture.service.startAssembly("spring-stack");
    const beforeInvalidSlot = fixture.repository.toSnapshot();
    Assertion.throwsCode(
      () =>
        fixture.service.attach({
          rootInstanceId: rootId,
          sourceInstanceId: "hook-stack",
          slotId: "not-a-slot",
          slotIndex: 0,
        }),
      "INVALID_SLOT",
      "undefined profile slot is rejected",
    );
    Assertion.deepEqual(
      fixture.repository.toSnapshot(),
      beforeInvalidSlot,
      "invalid slot leaves repository unchanged",
    );

    Assertion.throwsCode(
      () =>
        fixture.service.attach({
          rootInstanceId: rootId,
          sourceInstanceId: "bait-red",
          slotId: "hook",
          slotIndex: 0,
        }),
      "INCOMPATIBLE_COMPONENT",
      "slot rejects incompatible item type",
    );
    const hook = fixture.service.attach({
      rootInstanceId: rootId,
      sourceInstanceId: "hook-stack",
      slotId: "hook",
      slotIndex: 0,
    });
    Assertion.throwsCode(
      () =>
        fixture.service.attach({
          rootInstanceId: rootId,
          sourceInstanceId: "hook-stack",
          slotId: "hook",
          slotIndex: 0,
        }),
      "SLOT_OCCUPIED",
      "occupied parent slot rejects a second child",
    );
    Assertion.throwsCode(
      () =>
        fixture.service.attach({
          rootInstanceId: rootId,
          sourceInstanceId: hook.attachedInstanceId,
          slotId: "hook",
          slotIndex: 1,
        }),
      "SOURCE_NOT_AVAILABLE",
      "an attached item cannot receive a second parent",
    );
    Assertion.throwsCode(
      () =>
        fixture.service.attach({
          rootInstanceId: rootId,
          parentInstanceId: hook.attachedInstanceId,
          sourceInstanceId: rootId,
          slotId: "bait",
          slotIndex: 0,
        }),
      "ATTACHMENT_CYCLE",
      "root cannot be attached beneath its descendant",
    );
    Assertion.throwsCode(
      () =>
        fixture.service.attach({
          rootInstanceId: rootId,
          sourceInstanceId: "hook-stack",
          slotId: "hook",
          slotIndex: 2,
        }),
      "INVALID_SLOT_INDEX",
      "slot index cannot exceed profile capacity",
    );
  }

  #checkPreparedChildAssemblyCanBeAbsorbed() {
    const fixture = new DomainFixture(this.#runtime);
    const hookRoot = fixture.service.startAssembly("hook-stack");
    fixture.service.attach({
      rootInstanceId: hookRoot,
      sourceInstanceId: "bait-red",
      slotId: "bait",
      slotIndex: 0,
    });
    fixture.service.prepare(hookRoot);
    const nestedSignature = fixture.reader.getRefillSignature(
      hookRoot,
      "bait",
    );

    const springRoot = fixture.service.startAssembly("spring-stack");
    fixture.service.attach({
      rootInstanceId: springRoot,
      sourceInstanceId: hookRoot,
      slotId: "hook",
      slotIndex: 1,
    });

    Assertion.that(
      !fixture.stateRepository.has(hookRoot),
      "absorbed child no longer owns an independent assembly state",
    );
    Assertion.equal(
      fixture.reader.readPath(springRoot, "hook[1].bait").itemId,
      "worm",
      "prepared hook keeps its attached bait when absorbed",
    );
    Assertion.deepEqual(
      fixture.reader.getRefillSignature(springRoot, "hook[1].bait"),
      nestedSignature,
      "absorbed refill preference is rebased to the parent path",
    );
    Assertion.equal(
      fixture.reader.getRootInstanceId(hookRoot),
      springRoot,
      "absorbed hook becomes part of the spring tree",
    );
  }

  #checkCapacityHookAndSnapshotRoundTrip() {
    const capacityPolicy = {
      blockedOperations: new Set(),
      calls: [],
      canApply(context) {
        this.calls.push(context.operation);
        return this.blockedOperations.has(context.operation)
          ? { allowed: false, reason: "fixture capacity reached" }
          : { allowed: true };
      },
    };
    const fixture = new DomainFixture(this.#runtime, { capacityPolicy });
    const rootId = fixture.service.startAssembly("spring-stack");
    const hook = fixture.service.attach({
      rootInstanceId: rootId,
      sourceInstanceId: "hook-stack",
      slotId: "hook",
      slotIndex: 0,
    });
    fixture.service.attach({
      rootInstanceId: rootId,
      parentInstanceId: hook.attachedInstanceId,
      sourceInstanceId: "bait-red",
      slotId: "bait",
      slotIndex: 0,
    });
    fixture.service.prepare(rootId);
    capacityPolicy.blockedOperations.add("DETACH");
    const beforeBlockedDetach = fixture.repository.toSnapshot();
    Assertion.throwsCode(
      () =>
        fixture.service.detach({
          rootInstanceId: rootId,
          parentInstanceId: hook.attachedInstanceId,
          slotId: "bait",
          slotIndex: 0,
        }),
      "INVENTORY_CAPACITY_EXCEEDED",
      "capacity policy can block detach",
    );
    Assertion.deepEqual(
      fixture.repository.toSnapshot(),
      beforeBlockedDetach,
      "blocked detach is atomic",
    );

    const itemSnapshot = fixture.repository.toSnapshot();
    const assemblySnapshot = fixture.stateRepository.toSnapshot();
    const restored = new DomainFixture(this.#runtime, {
      items: itemSnapshot,
    });
    restored.stateRepository.restoreSnapshot(assemblySnapshot);
    Assertion.equal(
      restored.reader.readPath(rootId, "hook[0].bait").itemId,
      "worm",
      "flat item snapshot restores nested tree",
    );
    Assertion.equal(
      restored.reader.getAssemblyState(rootId).status,
      "PREPARED",
      "assembly metadata snapshot restores prepared state",
    );
    Assertion.that(
      restored.reader.getRefillSignature(rootId, "hook[0].bait") != null,
      "assembly metadata snapshot restores refill signature",
    );
  }
}

const runtime = new AssemblyRuntimeLoader().load();
new ItemAssemblyDomainCheckSuite(runtime).run();
console.log("Item assembly domain checks passed.");

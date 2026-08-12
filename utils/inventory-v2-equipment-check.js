const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { CheckAssertion } = require("./testing/core/check_assertion");

const ROOT = path.resolve(__dirname, "..");
const Assertion = CheckAssertion.create("Inventory-v2 equipment check");

class RuntimeLoader {
  load() {
    const context = vm.createContext({ console });
    this.#load(context, "src/config/inventory/equipment_slot_config.js", [
      "EquipmentSlotId",
      "EQUIPMENT_MAIN_SLOT_IDS",
      "EQUIPMENT_AUXILIARY_SLOT_IDS",
      "EQUIPMENT_ALL_SLOT_IDS",
      "EQUIPMENT_SLOT_CONFIG",
    ]);
    this.#load(context, "src/core/equipment/rod_capability_resolver.js", [
      "RodCapabilityResolver",
    ]);
    this.#load(context, "src/core/equipment/equipment_slot_visibility_policy.js", [
      "EquipmentSlotVisibilityPolicy",
    ]);
    this.#load(context, "src/core/equipment/terminal_line_slot_resolver.js", [
      "TerminalLineSlotResolver",
    ]);
    this.#load(context, "src/core/equipment/equipment_state.js", ["EquipmentState"]);
    this.#load(context, "src/core/equipment/equipment_slot_availability_policy.js", [
      "EquipmentSlotAvailabilityState",
      "EquipmentSlotWarningCode",
      "EquipmentSlotAvailabilityPolicy",
    ]);
    this.#load(context, "src/core/equipment/inventory_capacity_policy.js", [
      "InventoryCapacityPolicy",
      "UnlimitedInventoryCapacityPolicy",
      "DelegatingInventoryCapacityPolicy",
    ]);
    this.#load(context, "src/core/equipment/equipment_transition_planner.js", [
      "EquipmentTransitionPlan",
      "ManualRodChangePlanner",
    ]);
    this.#load(context, "src/application/inventory/equipment_transition_executor.js", [
      "EquipmentTransitionPort",
      "EquipmentTransitionExecutor",
    ]);
    this.#load(context, "src/core/loadouts/equipment_loadout.js", [
      "LOADOUT_DISPLAY_NAME",
      "EquipmentLoadout",
    ]);
    this.#load(context, "src/core/loadouts/loadout_equipment_transition_planner.js", [
      "LoadoutEquipmentTransitionPlanner",
    ]);
    this.#load(context, "src/application/inventory/loadout_application_service.js", [
      "LoadoutApplicationPort",
      "LoadoutApplicationService",
    ]);
    this.#load(context, "src/core/equipment/exact_item_signature_policy.js", [
      "ExactItemSignaturePolicy",
    ]);
    this.#load(context, "src/core/assemblies/exact_assembly_refill_signature_policy.js", [
      "ExactAssemblyRefillSignaturePolicy",
    ]);
    this.#load(context, "src/core/equipment/auto_refill_policy.js", [
      "AutoRefillTrigger",
      "AutoRefillScope",
      "AutoRefillSettings",
      "AutoRefillMemory",
      "AutoRefillPolicy",
    ]);
    this.#load(context, "src/application/inventory/equipment_auto_refill_target_provider.js", [
      "EquipmentAutoRefillTargetProvider",
    ]);
    this.#load(context, "src/application/inventory/auto_refill_coordinator.js", [
      "AutoRefillPort",
      "ExactInventoryAutoRefillPort",
      "AutoRefillCoordinator",
    ]);
    this.#load(context, "src/core/equipment/fishing_readiness_policy.js", [
      "FishingReadinessPolicy",
    ]);
    this.#load(context, "src/application/inventory/equipment_read_model_factory.js", [
      "EquipmentReadModelFactory",
    ]);
    return context;
  }

  #load(context, relativePath, names) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    const exports = names.map((name) => `${name}: typeof ${name} === "undefined" ? undefined : ${name}`).join(",");
    vm.runInContext(
      `${source}\nObject.assign(globalThis,{${exports}});`,
      context,
      { filename: relativePath },
    );
  }
}

class MemoryAssemblyReader {
  constructor(items) {
    this.items = items;
    this.children = new Map();
    this.states = new Map();
    this.capacities = new Map();
  }

  connect(parentId, slotId, slotIndex, childId) {
    this.children.set(`${parentId}|${slotId}|${slotIndex}`, childId);
  }

  disconnect(parentId, slotId, slotIndex) {
    this.children.delete(`${parentId}|${slotId}|${slotIndex}`);
  }

  getChild(parentId, slotId, slotIndex = 0) {
    return this.children.get(`${parentId}|${slotId}|${slotIndex}`) || null;
  }

  getChildren(parentId, slotId) {
    const result = [];
    for (const [key, childId] of this.children) {
      const [candidateParentId, candidateSlotId] = key.split("|");
      if (candidateParentId === parentId && candidateSlotId === slotId) {
        result.push(this.items.get(childId));
      }
    }
    return result.sort(
      (left, right) => left.location.slotIndex - right.location.slotIndex,
    );
  }

  readPath(rootId, path) {
    const direct = this.states.get(rootId)?.occupiedPaths?.[path];
    return direct ? this.items.get(direct) : null;
  }

  getAssemblyState(rootId) {
    return this.states.get(rootId) || { refillSignatures: {} };
  }

  getRefillSignature(rootId, path) {
    return this.getAssemblyState(rootId).refillSignatures?.[path] || null;
  }

  getSlotCapacity(parentId, slotId) {
    return this.capacities.get(`${parentId}|${slotId}`) || 0;
  }
}

class InventoryV2EquipmentCheck {
  #runtime;

  constructor(runtime) {
    this.#runtime = runtime;
  }

  run() {
    this.#checkStableSlotsAndVisibility();
    this.#checkAvailabilitySemantics();
    this.#checkRootOnlyEquipmentState();
    this.#checkManualRodTransition();
    this.#checkLoadoutBoundary();
    this.#checkCanonicalReadModel();
    this.#checkFishingReadiness();
    this.#checkExactAutoRefill();
  }

  #checkStableSlotsAndVisibility() {
    const r = this.#runtime;
    Assertion.equal(r.EQUIPMENT_MAIN_SLOT_IDS.join(","), "rod,reel,terminalLine,tackle,float", "five main slot ids are stable");
    Assertion.equal(r.EQUIPMENT_AUXILIARY_SLOT_IDS.join(","), "handChum,net,delivery,gasMask", "auxiliary slots are separate");

    const visibility = new r.EquipmentSlotVisibilityPolicy();
    const pole = { effectiveStats: { equipmentCapabilities: { supportsReel: false, supportsFloat: true } } };
    const feeder = { effectiveStats: { equipmentCapabilities: { supportsReel: true, supportsFloat: false } } };
    Assertion.equal(visibility.isVisible("reel", { rod: pole }), false, "pole hides reel by capability");
    Assertion.equal(visibility.isVisible("float", { rod: pole }), true, "pole shows float by capability");
    Assertion.equal(visibility.isVisible("reel", { rod: feeder }), true, "feeder shows reel by capability");
    Assertion.equal(visibility.isVisible("float", { rod: feeder }), false, "feeder hides float by capability");
    Assertion.equal(visibility.isVisible("tackle", { rod: feeder }), true, "tackle is immediately visible after rod selection");

    const resolver = new r.TerminalLineSlotResolver();
    Assertion.equal(resolver.resolve(pole).label, "Ліска", "pole terminal line is labelled line");
    Assertion.equal(resolver.resolve(feeder).label, "Поводок", "reel rod terminal line is labelled leader");
    Assertion.equal(resolver.resolve(feeder).acceptTypes[0], "leader_line", "reel rod accepts a leader");
  }

  #checkAvailabilitySemantics() {
    const r = this.#runtime;
    const policy = new r.EquipmentSlotAvailabilityPolicy();
    const rod = { effectiveStats: { equipmentCapabilities: { supportsReel: true, supportsFloat: false } } };
    const state = new r.EquipmentState({ rod: "rod-a" });
    const leader = {
      instanceId: "leader-a",
      itemType: "leader_line",
      quantity: 1,
      location: { kind: "INVENTORY" },
    };
    const empty = policy.resolve({ slotId: "terminalLine", equipmentState: state, rod, inventoryItems: [leader] });
    Assertion.equal(empty.state, r.EquipmentSlotAvailabilityState.EMPTY, "repository INVENTORY location yields an empty usable slot");
    Assertion.equal(empty.showCross, false, "missing reel dependency never draws a cross");

    leader.parentInstanceId = "assembly-a";
    leader.location = { kind: "attached", slotIndex: 0 };
    const missing = policy.resolve({ slotId: "terminalLine", equipmentState: state, rod, inventoryItems: [leader] });
    Assertion.equal(missing.state, r.EquipmentSlotAvailabilityState.NO_ACCESSIBLE_COMPATIBLE_ITEM, "attached items are not accessible inventory candidates");
    Assertion.equal(missing.showCross, false, "missing inventory items never imply a locked slot");
    Assertion.that(policy.getClickWarning(missing)?.includes("немає"), "an ordinary empty slot still explains the missing item on click");

    const locked = policy.resolve({ slotId: "gasMask", equipmentState: state, rod, inventoryItems: [] });
    Assertion.equal(locked.state, r.EquipmentSlotAvailabilityState.LOCKED, "gas mask is game-locked");
    Assertion.equal(locked.showCross, true, "locked content draws a cross");
    const hidden = policy.resolve({ slotId: "float", equipmentState: state, rod, inventoryItems: [] });
    Assertion.equal(hidden.visible, false, "unsupported slot is hidden rather than crossed");
  }

  #checkRootOnlyEquipmentState() {
    const r = this.#runtime;
    const state = new r.EquipmentState({ rod: "rod-a", delivery: "boat-a" });
    Assertion.equal(state.getRootInstanceId("rod"), "rod-a", "equipment stores root id");
    Assertion.equal(state.getRootInstanceId("delivery"), "boat-a", "auxiliary root is stored separately");
    Assertion.throws(
      () => state.setRootInstanceId("tackle", { instanceId: "tackle-a" }),
      "equipment rejects nested item objects",
    );
    Assertion.that(!Object.prototype.hasOwnProperty.call(state.snapshot(), "hooks"), "equipment has no child hook slot");
  }

  #checkManualRodTransition() {
    const r = this.#runtime;
    const state = new r.EquipmentState({
      rod: "rod-old",
      reel: "reel-old",
      terminalLine: "leader-old",
      tackle: "tackle-old",
      float: "float-old",
      handChum: "hand-chum",
      net: "net-a",
      delivery: "boat-a",
    });
    let capacityContext = null;
    const capacityPolicy = new r.DelegatingInventoryCapacityPolicy((context) => {
      capacityContext = context;
      return { allowed: true };
    });
    const planner = new r.ManualRodChangePlanner({ capacityPolicy });
    const plan = planner.plan({ equipmentState: state, nextRodInstanceId: "rod-new" });
    Assertion.equal(plan.after.rod, "rod-new", "new rod is planned");
    for (const slotId of ["reel", "terminalLine", "tackle", "float"]) {
      Assertion.equal(plan.after[slotId], null, `${slotId} always unequips on rod change`);
    }
    Assertion.equal(plan.after.delivery, "boat-a", "boat is untouched by rod change");
    Assertion.equal(plan.after.handChum, "hand-chum", "manual chum is untouched by rod change");
    Assertion.equal(capacityContext.incomingRootInstanceIds.length, 5, "capacity sees five returning roots");

    const movements = [];
    const port = {
      runAtomic: (operation) => operation(),
      moveRootToInventory: (instanceId, slotId) => movements.push(`out:${slotId}:${instanceId}`),
      moveRootToEquipment: (instanceId, slotId) => movements.push(`in:${slotId}:${instanceId}`),
      commitEquipmentState: () => movements.push("commit"),
    };
    const result = new r.EquipmentTransitionExecutor({ port }).execute({ plan, equipmentState: state });
    Assertion.equal(result.success, true, "allowed rod transition commits");
    Assertion.equal(state.getRootInstanceId("reel"), null, "state applies the whole plan once");
    Assertion.equal(movements.at(-1), "commit", "transition commits after movements");

    const denied = new r.ManualRodChangePlanner({
      capacityPolicy: new r.DelegatingInventoryCapacityPolicy(() => ({ allowed: false, warning: "full" })),
    }).plan({ equipmentState: state, nextRodInstanceId: "rod-third" });
    Assertion.equal(denied.allowed, false, "capacity can block a transition");
    Assertion.equal(denied.movements.length, 0, "blocked transition has no executable movements");
    Assertion.equal(denied.before.rod, denied.after.rod, "blocked transition preserves state");
  }

  #checkLoadoutBoundary() {
    const r = this.#runtime;
    const loadout = new r.EquipmentLoadout({
      loadoutId: "loadout-a",
      name: "Фідер",
      rootInstanceIds: {
        rod: "rod-a",
        reel: "reel-a",
        terminalLine: "leader-a",
        tackle: "tackle-a",
        float: null,
      },
    });
    Assertion.equal(loadout.displayType, "Комплект", "saved build is called Комплект");
    Assertion.equal(loadout.inventoryCellCost, 1, "a loadout occupies one conceptual cell");
    Assertion.equal(Object.keys(loadout.getRootInstanceIds()).length, 5, "loadout has only five semantic root slots");
    Assertion.throws(
      () => new r.EquipmentLoadout({ loadoutId: "bad", rootInstanceIds: { delivery: "boat-a" } }),
      "boat cannot be packaged into a loadout",
    );

    const state = new r.EquipmentState({ rod: "free-rod", delivery: "boat-a" });
    const planner = new r.LoadoutEquipmentTransitionPlanner({
      ownershipReader: () => ({ kind: "inventory" }),
    });
    const plan = planner.plan({ loadout, equipmentState: state });
    Assertion.equal(plan.after.rod, "rod-a", "loadout activates its rod root");
    Assertion.equal(plan.after.delivery, "boat-a", "loadout leaves auxiliary boat active");
  }

  #checkCanonicalReadModel() {
    const r = this.#runtime;
    const itemList = [
      { instanceId: "rod", itemId: "rod", itemType: "rod", variant: "feeder", effectiveStats: { equipmentCapabilities: { supportsReel: true, supportsFeederRig: true } } },
      { instanceId: "reel", itemId: "reel", itemType: "reel", variant: "spinning_reel", effectiveStats: {} },
      { instanceId: "reel-line", itemId: "line", itemType: "fishing_line", effectiveStats: {}, location: { slotIndex: 0 } },
      { instanceId: "leader", itemId: "leader", itemType: "leader_line", effectiveStats: {} },
      { instanceId: "rig", itemId: "rig", itemType: "feeder_rig", effectiveStats: { hooksCount: 2 } },
      { instanceId: "hook-0", itemId: "hook", itemType: "hook", effectiveStats: {}, location: { slotIndex: 0 } },
      { instanceId: "hook-1", itemId: "hook", itemType: "hook", effectiveStats: {}, location: { slotIndex: 1 } },
      { instanceId: "bait-0", itemId: "bait", itemType: "bait", effectiveStats: {}, location: { slotIndex: 0 } },
      { instanceId: "rig-chum", itemId: "chum", itemType: "chum_mix", effectiveStats: {}, location: { slotIndex: 0 } },
      { instanceId: "float", itemId: "float", itemType: "float", variant: "day", effectiveStats: {} },
      { instanceId: "net", itemId: "net", itemType: "net", effectiveStats: {} },
      { instanceId: "boat", itemId: "boat", itemType: "boat", effectiveStats: { sections: 3 } },
      { instanceId: "cargo-0", itemId: "chum-a", itemType: "chum_mix", effectiveStats: {}, location: { slotIndex: 0 } },
      { instanceId: "cargo-2", itemId: "chum-b", itemType: "chum_mix", effectiveStats: {}, location: { slotIndex: 2 } },
      { instanceId: "hand", itemId: "chum-hand", itemType: "chum_mix", effectiveStats: {} },
    ];
    const items = new Map(itemList.map((item) => [item.instanceId, item]));
    const assemblies = new MemoryAssemblyReader(items);
    assemblies.connect("reel", "line", 0, "reel-line");
    assemblies.connect("rig", "hook", 0, "hook-0");
    assemblies.connect("rig", "hook", 1, "hook-1");
    assemblies.connect("hook-0", "bait", 0, "bait-0");
    assemblies.connect("rig", "chum", 0, "rig-chum");
    assemblies.connect("boat", "cargo", 0, "cargo-0");
    assemblies.connect("boat", "cargo", 2, "cargo-2");
    assemblies.capacities.set("rig|hook", 2);
    assemblies.capacities.set("boat|cargo", 3);

    const state = new r.EquipmentState({
      rod: "rod",
      reel: "reel",
      terminalLine: "leader",
      tackle: "rig",
      float: "float",
      net: "net",
      delivery: "boat",
      handChum: "hand",
    });
    const readModel = new r.EquipmentReadModelFactory({
      itemReader: (id) => items.get(id),
      assemblyReader: assemblies,
    }).create(state);
    Assertion.equal(readModel.line.instanceId, "reel-line", "read model unfolds reel line");
    Assertion.equal(readModel.leader.instanceId, "leader", "read model maps terminal leader");
    Assertion.equal(readModel.feederRig.instanceId, "rig", "read model maps feeder tackle");
    Assertion.equal(readModel.hooks.length, 2, "read model unfolds indexed hooks");
    Assertion.equal(readModel.baits[0].instanceId, "bait-0", "read model binds bait to hook zero");
    Assertion.equal(readModel.baits[1], null, "read model preserves empty bait index");
    Assertion.equal(readModel.feederChum.instanceId, "rig-chum", "read model unfolds tackle chum");
    Assertion.equal(readModel.deliveryChums.length, 3, "read model preserves boat bay capacity");
    Assertion.equal(readModel.deliveryChums[1], null, "read model preserves an empty middle bay");
    Assertion.equal(readModel.deliveryChums[2].instanceId, "cargo-2", "read model preserves cargo index two");
    Assertion.equal(readModel.handChum.instanceId, "hand", "read model exposes manual chum independently");
    Assertion.that(
      !("type" in readModel.rod) && !("engineStats" in readModel.rod),
      "read model does not recreate legacy item fields",
    );
  }

  #checkFishingReadiness() {
    const r = this.#runtime;
    const items = new Map([
      ["rod", { instanceId: "rod", itemId: "rod", itemType: "rod", variant: "feeder", effectiveStats: { equipmentCapabilities: { supportsReel: true, supportsFeederRig: true } } }],
      ["reel", { instanceId: "reel", itemId: "reel", itemType: "reel", variant: "spinning_reel", effectiveStats: {} }],
      ["line", { instanceId: "line", itemId: "line", itemType: "fishing_line", effectiveStats: {}, location: { slotIndex: 0 } }],
      ["leader", { instanceId: "leader", itemId: "leader", itemType: "leader_line", effectiveStats: {} }],
      ["rig", { instanceId: "rig", itemId: "rig", itemType: "feeder_rig", effectiveStats: {} }],
      ["hook", { instanceId: "hook", itemId: "hook", itemType: "hook", effectiveStats: {}, location: { slotIndex: 0 } }],
    ]);
    const assemblies = new MemoryAssemblyReader(items);
    const state = new r.EquipmentState({ rod: "rod", reel: "reel", tackle: "rig" });
    const readiness = new r.FishingReadinessPolicy({
      itemReader: (id) => items.get(id),
      assemblyReader: assemblies,
    });
    Assertion.equal(readiness.validateEquip({ slotId: "reel", item: items.get("reel"), equipmentState: state }).isValid, true, "reel equips without line");
    Assertion.equal(readiness.evaluateCast({ equipmentState: state }).canCast, false, "cast is blocked without reel line");
    Assertion.equal(readiness.evaluateCast({ equipmentState: state }).shouldOpenInventory, true, "missing line opens inventory");
    Assertion.equal(readiness.validateEquip({ slotId: "terminalLine", item: items.get("leader"), equipmentState: state }).isValid, false, "leader requires reel line");
    assemblies.connect("reel", "line", 0, "line");
    Assertion.equal(readiness.evaluateCast({ equipmentState: state }).canCast, true, "cast is ready once line is attached");
    Assertion.equal(readiness.validateEquip({ slotId: "terminalLine", item: items.get("leader"), equipmentState: state }).isValid, true, "leader equips after reel line");
    Assertion.equal(readiness.evaluateBite({ equipmentState: state }).canBite, false, "empty feeder assembly equips but cannot bite");
    Assertion.equal(readiness.evaluateChumBonus({ equipmentState: state }).hasBonus, false, "missing chum only removes its bonus");
    assemblies.connect("rig", "hook", 0, "hook");
    Assertion.equal(readiness.evaluateBite({ equipmentState: state }).canBite, true, "feeder bite becomes eligible with a hook");
  }

  #checkExactAutoRefill() {
    const r = this.#runtime;
    const signaturePolicy = new r.ExactItemSignaturePolicy();
    const baitA1 = { instanceId: "a1", itemId: "worm", itemType: "bait", rarityProfile: { tier: 2 }, effectiveStats: { size: 1 }, quantity: 1, location: "inventory" };
    const baitA2 = { ...baitA1, instanceId: "a2" };
    const baitB = { ...baitA1, instanceId: "b", rarityProfile: { tier: 3 } };
    const signatureA = signaturePolicy.create(baitA1);
    const signatureB = signaturePolicy.create(baitB);
    const assemblySignature = new r.ExactAssemblyRefillSignaturePolicy().create(baitA1);
    Assertion.equal(JSON.stringify(signatureA), JSON.stringify(assemblySignature), "auto-refill and assembly readers share one exact signature format");
    Assertion.equal(signaturePolicy.matches(baitA2, signatureA), true, "instance id and quantity do not change exact variant signature");
    Assertion.equal(signaturePolicy.matches(baitB, signatureA), false, "rarity difference is never substituted");

    const settings = new r.AutoRefillSettings();
    const policy = new r.AutoRefillPolicy({ settings });
    Assertion.equal(policy.resolveScopes(r.AutoRefillTrigger.ROD_RETRIEVED).length, 0, "auto refill defaults off");
    settings.setAutoBait(true).setAutoChum(true);
    Assertion.equal(policy.resolveScopes(r.AutoRefillTrigger.ROD_RETRIEVED).join(","), "tackle-bait,tackle-chum", "rod retrieval refills bait and tackle chum");
    Assertion.equal(policy.resolveScopes(r.AutoRefillTrigger.HAND_CHUM_USED)[0], "hand-chum", "manual chum refills after use");
    Assertion.equal(policy.resolveScopes(r.AutoRefillTrigger.BOAT_RETURNED, { allBaysEmptied: true, hasReturnedToPlayer: false }).length, 0, "boat does not refill before returning");
    Assertion.equal(policy.resolveScopes(r.AutoRefillTrigger.BOAT_RETURNED, { allBaysEmptied: true, hasReturnedToPlayer: true })[0], "boat-chum", "boat refills only after all bays empty and return");

    const remaining = [baitA1, baitA2];
    const returned = [];
    const inventoryPort = {
      takeOneExact: (signature) => {
        const index = remaining.findIndex((item) => signaturePolicy.matches(item, signature));
        return index < 0 ? null : remaining.splice(index, 1)[0];
      },
      returnOne: (item) => returned.push(item),
    };
    const fillOrder = [];
    const refillPort = new r.ExactInventoryAutoRefillPort({
      inventoryPort,
      targetWriter: { fillTarget: (target) => fillOrder.push(target.path) !== 0 },
      signaturePolicy,
    });
    const targets = [
      { path: "hook[0].bait", signature: signatureA },
      { path: "hook[1].bait", signature: signatureB },
      { path: "hook[2].bait", signature: signatureA },
    ];
    let warningCount = 0;
    const coordinator = new r.AutoRefillCoordinator({
      policy,
      targetProvider: {
        listTargets: (scope) => scope === r.AutoRefillScope.TACKLE_BAIT ? targets : [],
      },
      port: refillPort,
      warningSink: () => warningCount++,
    });
    const report = coordinator.handle(r.AutoRefillTrigger.ROD_RETRIEVED);
    Assertion.equal(report.attempted, 3, "all remembered bait slots are attempted sequentially");
    Assertion.equal(report.filled, 2, "available exact variants are partially refilled");
    Assertion.equal(report.missing, 1, "unavailable exact variant remains empty");
    Assertion.equal(fillOrder.join(","), "hook[0].bait,hook[2].bait", "partial refill preserves deterministic slot order");
    Assertion.equal(warningCount, 1, "partial refill reports one warning");

    const equipment = new r.EquipmentState({ tackle: "rig", delivery: "boat" });
    const assemblies = new MemoryAssemblyReader(new Map());
    assemblies.states.set("rig", {
      refillSignatures: {
        "hook[1].bait": signatureB,
        "hook[0].bait": signatureA,
        chum: signatureA,
      },
      occupiedPaths: {},
    });
    assemblies.states.set("boat", {
      refillSignatures: { "cargo[1]": signatureB, "cargo[0]": signatureA },
      occupiedPaths: {},
    });
    const memory = new r.AutoRefillMemory({ handChum: signatureA });
    const targetProvider = new r.EquipmentAutoRefillTargetProvider({
      equipmentState: equipment,
      assemblyReader: assemblies,
      memory,
    });
    Assertion.equal(targetProvider.listTargets(r.AutoRefillScope.TACKLE_BAIT)[0].path, "hook[0].bait", "bait targets sort by hook index");
    Assertion.equal(targetProvider.listTargets(r.AutoRefillScope.TACKLE_CHUM)[0].path, "chum", "tackle chum is a separate refill scope");
    Assertion.equal(targetProvider.listTargets(r.AutoRefillScope.BOAT_CHUM)[1].path, "cargo[1]", "boat remembers exact signature per bay");
    Assertion.equal(targetProvider.listTargets(r.AutoRefillScope.HAND_CHUM).length, 1, "manual chum uses independent remembered signature");
  }
}

const runtime = new RuntimeLoader().load();
new InventoryV2EquipmentCheck(runtime).run();
console.log("Inventory-v2 equipment checks passed.");

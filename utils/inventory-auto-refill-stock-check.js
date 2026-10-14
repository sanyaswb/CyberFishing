const assert = require("node:assert/strict");

async function main() {
  const [{ FlatInventoryItemRepository }, { InventoryItemLocation }, { EquipmentState },
    { InventoryItemReservationPolicy }, { RefillCompatibleSignaturePolicy },
    { FreshestRefillCandidatePolicy }, { InventoryRefillInventoryPort },
    { InventoryAutoRefillStockReadModel }, { EquipmentAutoRefillTargetProvider },
    { AutoRefillMemory }, { AutoRefillScope }] = await Promise.all([
    import("../src/game/domain/inventory/flat_inventory_item_repository.js"),
    import("../src/game/domain/inventory/inventory_item_location.js"),
    import("../src/game/domain/equipment/equipment_state.js"),
    import("../src/game/domain/inventory/inventory_item_reservation_policy.js"),
    import("../src/game/domain/assemblies/refill_compatible_signature_policy.js"),
    import("../src/game/application/inventory/freshest_refill_candidate_policy.js"),
    import("../src/game/application/inventory/inventory_refill_inventory_port.js"),
    import("../src/game/application/inventory/inventory_auto_refill_stock_read_model.js"),
    import("../src/game/application/inventory/equipment_auto_refill_target_provider.js"),
    import("../src/game/domain/equipment/auto_refill_memory.js"),
    import("../src/game/domain/equipment/auto_refill_scope.js"),
  ]);
  const bait = { itemId: "worm", itemType: "bait", variant: "oil", level: 1 };
  const chum = { itemId: "mix", itemType: "chum_mix", level: 1 };
  const equipment = new EquipmentState({ tackle: "rig", delivery: "boat", handChum: "equipped" });
  const reservation = new InventoryItemReservationPolicy({ equipmentState: equipment,
    loadouts: { findByRootInstanceId: (id) => id === "saved" ? "saved-kit" : null } });
  let nextId = 0;
  const inventory = (instanceId, fields) => ({ instanceId, location: InventoryItemLocation.inventory(), ...fields });
  const repository = new FlatInventoryItemRepository({ reservationPolicy: reservation,
    instanceIdFactory: () => `split-${++nextId}`, items: [
      inventory("rig", { itemId: "hook", itemType: "hook" }),
      inventory("boat", { itemId: "boat", itemType: "boat" }),
      inventory("old", { ...bait, quantity: 2, freshnessState: { percent: 20 } }),
      inventory("fresh", { ...bait, quantity: 5, freshnessState: { percent: 90 } }),
      inventory("different", { ...bait, variant: "plain", quantity: 9 }),
      inventory("saved", bait),
      inventory("loaded", bait),
      { ...bait, instanceId: "on-hook", location: InventoryItemLocation.attached("rig", "bait", 0) },
      { instanceId: "child", itemId: "child", location: InventoryItemLocation.attached("loaded", "child", 0) },
      inventory("equipped", chum),
      inventory("groundbait", { ...chum, quantity: 4 }),
      { ...chum, instanceId: "in-boat", location: InventoryItemLocation.attached("boat", "cargo", 0) },
    ] });
  const signaturePolicy = new RefillCompatibleSignaturePolicy();
  const baitSignature = signaturePolicy.create(repository.get("on-hook"));
  const chumSignature = signaturePolicy.create(repository.get("equipped"));
  const states = {
    rig: { refillSignatures: { "hook[0].bait[0]": baitSignature, "hook[1].bait[0]": baitSignature, "chum[0]": chumSignature } },
    boat: { refillSignatures: { "cargo[0]": chumSignature } },
  };
  const memory = new AutoRefillMemory({ handChum: chumSignature });
  const targetProvider = new EquipmentAutoRefillTargetProvider({ equipmentState: equipment, memory,
    assemblyReader: { readPath: () => null, getAssemblyState: (id) => states[id] || {},
      getRefillSignature: (id, path) => states[id]?.refillSignatures[path] || null } });
  const inventoryPort = new InventoryRefillInventoryPort({ repository, signaturePolicy,
    reservationPolicy: reservation, stackingPolicy: { canStack: () => false },
    candidatePolicy: new FreshestRefillCandidatePolicy() });
  const stock = new InventoryAutoRefillStockReadModel({ repository, inventoryPort, signaturePolicy, targetProvider });
  const selected = { items: [{ instanceId: "on-hook", quantity: 999, name: "Projected name" },
    { instanceId: "on-hook" }], scopes: [AutoRefillScope.TACKLE_BAIT] };
  const before = JSON.stringify(repository.list());
  assert(stock.shareReserve([repository.get("old"), repository.get("fresh"), repository.get("on-hook")]),
    "quantity, custody and freshness do not create different bait reserve choices");
  assert(!stock.shareReserve([repository.get("on-hook"), repository.get("different")]),
    "different variants retain their separate item counts even with the same catalog ID");
  assert(!stock.shareReserve([]));
  assert(!stock.shareReserve([{ instanceId: "missing" }]));
  for (let i = 0; i < 25; i++) assert.equal(stock.count(selected), 7);
  assert.equal(JSON.stringify(repository.list()), before, "stock projection never splits, consumes or updates inventory");
  assert.equal(stock.count({ scopes: [AutoRefillScope.TACKLE_BAIT] }), 7,
    "remembered empty targets retain the reserve count without a current selected bait");
  assert.equal(stock.count({ items: [repository.get("equipped"), repository.get("in-boat")],
    scopes: [AutoRefillScope.TACKLE_CHUM, AutoRefillScope.HAND_CHUM, AutoRefillScope.BOAT_CHUM] }), 4,
    "hand, feeder and boat references to the same mix share one reserve count");
  assert.equal(stock.count(), 0, "no selected or remembered choice means zero, not all category stock");
  for (let remaining = 6; remaining >= 0; remaining--) {
    const taken = inventoryPort.takeOneExact(baitSignature);
    assert(taken, "every displayed reserve unit can be taken by the real refill port");
    if (remaining === 6) assert.equal(repository.get("fresh").quantity, 4, "freshest-first selection is preserved");
    repository.setLocation(taken.instanceId, InventoryItemLocation.attached("rig", "bait", 7 - remaining));
    assert.equal(stock.count(selected), remaining, "the reserve drops as eligible inventory is attached");
  }
  assert.equal(inventoryPort.takeOneExact(baitSignature), null);
  assert.equal(repository.get("different").quantity, 9);
  assert.equal(repository.get("saved").quantity, 1);
  assert.equal(repository.get("loaded").quantity, 1);
  assert.equal(repository.get("equipped").quantity, 1);
  console.log("Automatic refill stock passed: exact variants, stack units, reservations/attachments, remembered choices, deduplication, read-only counts and parity with real refill selection.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

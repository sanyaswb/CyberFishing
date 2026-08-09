const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console });
for (const relativePath of [
  "src/core/inventory/inventory_item_location.js",
  "src/core/inventory/flat_inventory_item_repository.js",
  "src/core/line/line_allocation_policy.js",
  "src/application/inventory/inventory_v2_line_allocation_service.js",
]) {
  vm.runInContext(
    fs.readFileSync(path.join(root, relativePath), "utf8"),
    context,
    { filename: relativePath },
  );
}

vm.runInContext(`(() => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  let sequence = 0;
  const repository = new FlatInventoryItemRepository({
    items: [{
      instanceId: "line-25",
      itemId: "line-basic",
      quantity: 1,
      lengthMeters: 25,
      diameterMm: 0.22,
      maxLoadKg: 1,
      durability: 100,
      quality: 5,
      rarity: { tier: 1 },
      location: InventoryItemLocation.inventory(),
    }],
  });
  const hydrate = (raw) => ({
    id: raw.itemId,
    type: "fishing_line",
    engineStats: { type: "fishing_line", lengthMeters: 25 },
    ...raw,
  });
  const service = new InventoryV2LineAllocationService({
    repository,
    itemReader: hydrate,
    lineConfig: { rodLengthReserveMultiplier: 2 },
    instanceIdFactory: () => "line-segment-" + (++sequence),
  });
  const rod = { type: "feeder", hasReel: true, lengthMeters: 3 };
  const reel = { type: "spinning_reel", lineCapacityMeters: 20 };

  const prepared = service.prepare({
    sourceInstanceId: "line-25",
    rod,
    reel,
  });
  assert(prepared.success, "25m line should be accepted by the 20m reel");
  assert(service.getLengthMeters(prepared.instanceId) === 20,
    "equipped line segment must be exactly 20m");
  assert(service.getLengthMeters("line-25") === 5,
    "the 5m remainder must stay in inventory");

})()`, context);

// Custody, merge and break behavior are verified with a real reel parent.
vm.runInContext(`(() => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  let sequence = 0;
  const repository = new FlatInventoryItemRepository({
    items: [
      { instanceId: "reel-root", itemId: "reel", quantity: 1,
        location: InventoryItemLocation.inventory() },
      { instanceId: "line-25", itemId: "line-basic", quantity: 1,
        lengthMeters: 25, diameterMm: 0.22, maxLoadKg: 1,
        durability: 100, quality: 5, rarity: { tier: 1 },
        location: InventoryItemLocation.inventory() },
    ],
  });
  const hydrate = (raw) => raw.itemId === "reel"
    ? { type: "spinning_reel", ...raw }
    : { id: raw.itemId, type: "fishing_line", engineStats: { type: "fishing_line" }, ...raw };
  const service = new InventoryV2LineAllocationService({
    repository,
    itemReader: hydrate,
    lineConfig: { rodLengthReserveMultiplier: 2 },
    instanceIdFactory: () => "line-segment-" + (++sequence),
  });
  const prepared = service.prepare({
    sourceInstanceId: "line-25",
    rod: { type: "feeder", hasReel: true, lengthMeters: 3 },
    reel: { type: "spinning_reel", lineCapacityMeters: 20 },
  });
  repository.setLocation(
    prepared.instanceId,
    InventoryItemLocation.attached("reel-root", "line", 0),
  );
  const released = service.release(prepared.instanceId);
  assert(released.merged, "detached segment should merge into its 5m source");
  assert(service.getLengthMeters("line-25") === 25,
    "release must restore the original 25m length");
  assert(!repository.has(prepared.instanceId),
    "merged segment must be removed");

  const preparedAgain = service.prepare({
    sourceInstanceId: "line-25",
    rod: { type: "feeder", hasReel: true, lengthMeters: 3 },
    reel: { type: "spinning_reel", lineCapacityMeters: 20 },
  });
  const damaged = service.break(preparedAgain.instanceId, 7.5);
  assert(damaged.success && !damaged.depleted,
    "partial line break should preserve the segment");
  assert(damaged.remainingLengthMeters === 12.5,
    "line break must subtract exact lost meters");
  const depleted = service.break(preparedAgain.instanceId, 99);
  assert(depleted.success && depleted.depleted,
    "full line loss must remove the segment");
  assert(!repository.has(preparedAgain.instanceId),
    "depleted segment must leave the repository");
})()`, context);

console.log("Inventory-v2 line allocation checks passed.");

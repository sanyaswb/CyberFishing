"use strict";

// Spec 142: the field radio receiver. Stage 1: a catalog item worn in its own auxiliary slot ("radio"), running on the
// battery in its own battery slot (spec 143), opened in the item editor like any assembly, its thumbnail showing the
// battery's charge; saves keep it, saves without the slot load with it empty. The auxiliary wells scroll along the
// axis their layout declares (HorizontalScrollController.resolveAxis).
const assert = require("node:assert/strict");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const runtime = new SourceRuntime();
const { ITEM_DB } = runtime.importModule("src/game/config/raw/items/item_database.js");
const { ItemDatabase } = runtime.importModule("src/game/application/inventory/item_database.js");
const { ITEM_STAT_OVERRIDE_CONFIG } = runtime.importModule("src/game/config/raw/items/item_stat_overrides.js");
const { ItemStatOverridePolicy } = runtime.importModule("src/game/domain/items/item_stat_override_policy.js");
const { EffectiveItemStatsResolver } = runtime.importModule("src/game/domain/items/effective_item_stats_resolver.js");
const { ITEM_ASSEMBLY_PROFILE_CONFIG } = runtime.importModule("src/game/config/raw/inventory/item_assembly_profiles.js");
const { InventoryCompositionRoot } = runtime.importModule("src/bootstrap/production/inventory_composition_root.js");
const { InventoryActionType } = runtime.importModule("src/game/presentation/inventory/inventory_action_type.js");
const { EQUIPMENT_SLOT_CONFIG } = runtime.importModule("src/game/domain/equipment/equipment_slot_catalog.js");
const { HorizontalScrollController } = runtime.importModule("src/platform/browser/dom/horizontal_scroll_controller.js");

const radio = ITEM_DB.devices.radio_receiver_basic;
assert.equal(radio.itemType, "radio");
assert.equal(radio.iconUrl, "assets/items/radio/radio-receiver.webp", "the radio shows the owner's art");
assert.equal(radio.gameplayStats.batteryUse.unitsPerSecond, 1, "1 unit/s: an ordinary battery plays 1 hour (D-P5)");
assert.equal(EQUIPMENT_SLOT_CONFIG.radio.group, "auxiliary");
assert.deepEqual([...EQUIPMENT_SLOT_CONFIG.radio.acceptTypes], ["radio"]);

const overridePolicy = new ItemStatOverridePolicy({ config: ITEM_STAT_OVERRIDE_CONFIG });
function compose(initialSnapshot, cacheData = new Map()) {
  const cache = { get: (key, fallback) => cacheData.has(key) ? JSON.parse(cacheData.get(key)) : fallback,
    set: (key, value) => cacheData.set(key, JSON.stringify(value)) };
  let sequence = 0;
  return { cacheData, inventory: InventoryCompositionRoot.compose({
    cache,
    initialSnapshot,
    itemDefinitionResolver: new ItemDatabase(ITEM_DB),
    itemStatOverridePolicy: overridePolicy,
    effectiveStatsResolver: new EffectiveItemStatsResolver({ overridePolicy }),
    assemblyProfileConfig: ITEM_ASSEMBLY_PROFILE_CONFIG,
    instanceIdFactory: () => `generated-${++sequence}`,
    now: () => 0,
  }) };
}
const item = (instanceId, itemId) => ({ instanceId, itemId, quantity: 1, location: { kind: "INVENTORY" } });
const { inventory, cacheData } = compose({ schemaVersion: 4, items: [item("radio", "radio_receiver_basic"),
  item("battery", "battery_basic")], assemblies: [], equipment: {}, loadouts: [], settings: {} });
const dispatch = (action) => inventory.facade.dispatch(action);

assert.equal(inventory.gameplayBridge.getEquipped().radio, null, "a save without the radio slot has it empty");
// The player's path: tap the empty radio well, then the radio; an assembly with an empty socket opens its editor, where
// the battery fills the battery socket, and «Спорядити» puts the radio on.
dispatch({ type: InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, slotId: "radio" });
dispatch({ type: InventoryActionType.INVENTORY_ITEM_ACTIVATE, instanceId: "radio" });
let view = inventory.facade.getViewModel();
assert.equal(view.panel.mode, "assembly", "the radio with an empty battery socket opens in its editor");
const editingRoot = view.panel.assembly.root?.instanceId;
assert.equal(editingRoot, "radio");
assert.equal(dispatch({ type: InventoryActionType.INVENTORY_ITEM_ACTIVATE, instanceId: "battery" }).success, true,
  "the battery fills the radio's battery socket");
if (!inventory.equipmentState.getRootInstanceId("radio")) {
  assert.equal(dispatch({ type: InventoryActionType.ASSEMBLY_EQUIP, rootInstanceId: editingRoot }).success, true);
}
const root = inventory.equipmentState.getRootInstanceId("radio");
assert(root, "the radio is equipped in its auxiliary slot");
assert.equal(inventory.gameplayBridge.getEquipped().radio.itemId, "radio_receiver_basic");
assert.equal(inventory.gameplayBridge.getEquipped().radioBattery?.itemId, "battery_basic",
  "the battery sits in the radio's battery slot");
assert.equal(inventory.gameplayBridge.attachedBattery(root)?.itemId, "battery_basic",
  "the power port finds the radio's battery");

// The editor opens on the radio like any equipped assembly: image, the battery socket.
dispatch({ type: InventoryActionType.EQUIPMENT_SLOT_ACTIVATE, slotId: "radio" });
const editor = inventory.facade.getViewModel();
assert.equal(editor.panel.mode, "assembly", "a tap on the radio opens its editor");
assert.equal(editor.panel.assembly.root?.itemId, "radio_receiver_basic");
assert.equal(editor.panel.assembly.root?.iconUrl, "assets/items/radio/radio-receiver.webp", "the editor shows the radio's art");
const sockets = JSON.stringify(editor.panel.assembly);
assert(sockets.includes("\"battery\""), "the editor offers the battery socket");

// The radio's thumbnail shows the battery's charge as a bar, without a battery cell (TK-095).
inventory.gameplayBridge.setDeviceChargeProvider((device) => {
  const battery = inventory.gameplayBridge.attachedBattery(device?.instanceId);
  return battery ? { current: 70, maximum: 100 } : null;
});
dispatch({ type: InventoryActionType.ASSEMBLY_BACK, rootInstanceId: root });
const radioWell = JSON.parse(JSON.stringify(inventory.facade.getViewModel().panel.loadout)).auxiliarySlots
  .find((slot) => slot.slotId === "radio");
assert(radioWell?.item, "the radio fills its auxiliary well");
assert.equal(radioWell.item.charge?.percent, 70, "the radio's thumbnail shows its battery's charge");
assert(!(radioWell.item.attachments || []).some((entry) => entry.kind === "battery"), "no battery cell on the radio");

// The save keeps the radio and its battery.
const saved = JSON.parse(cacheData.get("player_inventory_v2"));
assert.equal(saved.equipment.radio, root);
const reloaded = compose(null, new Map(cacheData)).inventory;
assert.equal(reloaded.gameplayBridge.getEquipped().radioBattery?.itemId, "battery_basic", "a reload keeps the radio set");

// The auxiliary wells: one controller scrolls a row along x and a column along y, read per gesture.
let axis = "x";
const scroller = new HorizontalScrollController({ resolveAxis: () => axis });
const listeners = {};
const element = { scrollLeft: 0, scrollTop: 0, scrollWidth: 400, clientWidth: 200, scrollHeight: 500, clientHeight: 250,
  classList: { add() {}, remove() {} }, addEventListener: (type, handler) => { listeners[type] = handler; },
  removeEventListener() {}, setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {} };
scroller.attach(element);
const drag = (dx, dy) => {
  listeners.pointerdown({ pointerId: 1, isPrimary: true, button: 0, pointerType: "mouse", clientX: 100, clientY: 100 });
  listeners.pointermove({ pointerId: 1, clientX: 100 + dx, clientY: 100 + dy, preventDefault() {} });
  listeners.pointerup({ pointerId: 1, type: "pointerup" });
};
drag(-60, 0);
assert.equal(element.scrollLeft, 60, "the row scrolls horizontally");
axis = "y";
drag(0, -80);
assert.equal(element.scrollTop, 80, "the same wells in a column scroll vertically");
assert.equal(element.scrollLeft, 60, "a column drag leaves the row offset alone");

console.log("Radio receiver passed: catalog item with art and 1 unit/s, its own auxiliary slot (empty in old saves), "
  + "equip, battery in its own slot found by the power port, editor with the battery socket, thumbnail charge bar "
  + "without a battery cell, save and reload, and the auxiliary wells scrolling along x in a row and y in a column.");

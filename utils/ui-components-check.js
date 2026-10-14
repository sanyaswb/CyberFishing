"use strict";

const assert = require("node:assert/strict");
const { TestDocument } = require("./testing/keepnet/test_document.js");
const { InventoryDomFactory } = require("../src/platform/browser/dom/inventory_dom_factory.js");
const { UiCloseButtonRenderer } = require("../src/game/presentation/ui/ui_close_button_renderer.js");
const { UiAutoSwitchRenderer } = require("../src/game/presentation/ui/ui_auto_switch_renderer.js");
const { InventoryResourceMeterRenderer } = require("../src/game/presentation/inventory/inventory_resource_meter_renderer.js");
const { HoldCharges } = require("../src/platform/browser/ui/hold_charges.js");
const { InventoryItemParametersRenderer } = require("../src/game/presentation/inventory/inventory_item_parameters_renderer.js");

const documentRef = new TestDocument();
const domFactory = new InventoryDomFactory(documentRef);
const closeButtons = new UiCloseButtonRenderer({ domFactory });
let closed = 0;
const close = closeButtons.create({ label: "Close example", className: "example__close", onClose: () => closed++ });
assert.equal(close.type, "button");
assert.equal(close.getAttribute("aria-label"), "Close example");
assert(close.classList.contains("ui-modal-close") && close.classList.contains("example__close"));
close.click(); assert.equal(closed, 1);
closeButtons.dispose(close); close.click(); assert.equal(closed, 1, "disposed close cannot call its old host");
assert.equal(close.listeners.get("click").size, 0);

const switches = new UiAutoSwitchRenderer({ domFactory });
let selected = null;
const toggle = switches.create({ id: "automatic", name: "Bait", modeLabel: "Automatic bait",
  placeholderUrl: "assets/ui/inventory/bait.svg", stock: 17, onChange: value => { selected = value; } });
documentRef.body.append(toggle);
const input = documentRef.byClass("inventory-toggle__input")[0];
const image = documentRef.byClass("inventory-toggle__placeholder")[0];
const count = documentRef.byClass("inventory-toggle__count")[0];
assert.equal(input.getAttribute("role"), "switch");
assert.equal(documentRef.byClass("inventory-toggle__thumb")[0].textContent, "A");
input.checked = true; input.fire("change"); assert.equal(selected, true);
switches.update(toggle, { checked: false, disabled: true, stock: 8 });
assert(!input.checked && input.disabled && toggle.classList.contains("inventory-toggle--disabled"));
assert.equal(count.textContent, "8");
assert.equal(documentRef.byClass("inventory-toggle__placeholder")[0], image, "stock updates retain artwork identity");
assert(input.getAttribute("aria-label").includes("8"));
switches.dispose(toggle); input.checked = false; input.fire("change"); assert.equal(selected, true);
assert.equal(input.listeners.get("change").size, 0);

const compact = switches.create({ variant: "control", name: "Feeder", modeLabel: "Automatic feeder", checked: true });
documentRef.body.append(compact);
assert.equal(compact.children.length, 2, "control variant contains the input and control without equipment or stock");
assert.equal(compact.children[0].getAttribute("aria-label"), "Automatic feeder");
switches.dispose(compact);
const meters = new InventoryResourceMeterRenderer({ domFactory });
for (const [raw, expected] of [[-10, 0], [134, 100], [NaN, 0], [undefined, 0], [67, 67]]) {
  const meter = meters.create({ id: "resource", percent: raw, label: `Reading ${raw}` });
  assert.equal(meter.style.getPropertyValue("--inventory-resource-percent"), `${expected}%`);
  assert.equal(meter.getAttribute("aria-valuenow"), String(expected));
  assert.equal(meter.getAttribute("aria-valuetext"), `Reading ${raw}`, "accessible text retains the authoritative reading");
}
const charges = new HoldCharges({ documentRef, labels: { holdActive: "Hold active" } });
const reading = { hasHold: true, max: 3, current: 3, isActive: false, restoring: [], restoreMaxTime: 10 };
charges.update(reading);
const chargeNodes = [...charges.circles];
assert(charges.circles.every(circle => circle.classList.contains("hold-charges__charge--available")));
reading.current = 0;
charges.update(reading);
assert(charges.circles.every(circle => circle.className === "hold-charges__charge"), "depleted reading clears old available presentation");
assert.deepEqual(charges.circles, chargeNodes, "numeric charge updates retain cached nodes");
reading.isActive = true; charges.update(reading);
assert(charges.circles[0].classList.contains("hold-charges__charge--active"));
reading.isActive = false; reading.restoring = [5]; charges.update(reading);
assert(charges.circles[0].classList.contains("hold-charges__charge--restoring"));
reading.restoring = []; charges.update(reading);
assert(charges.circles.every(circle => circle.className === "hold-charges__charge"));
charges.dispose();
const parameters = new InventoryItemParametersRenderer({ domFactory,
  resolver: { resolve: item => item?.empty ? [] : [{ label: "Parameter", value: 50, kind: "bar", percent: 50 }] } });
const sections = [1, 2, 3].map(value => ({ item: { instanceId: String(value) }, title: "Section" }));
const tiles = parameters.renderSections(sections);
assert(!tiles.classList.contains("inventory-item-parameters--single"));
assert(tiles.children[2].classList.contains("inventory-item-parameter-section--centered"));
assert(!tiles.children[0].classList.contains("inventory-item-parameter-section--centered"));
parameters.update(tiles.children[2], { instanceId: "3", empty: true });
assert.equal(tiles.children.length, 2);
assert(tiles.children.every(node => !node.classList.contains("inventory-item-parameter-section--centered")), "removing an odd tile resets container placement");
parameters.update(tiles.children[1], { instanceId: "2", empty: true });
assert(tiles.classList.contains("inventory-item-parameters--single"), "a single tile retains full width through explicit BEM state");
console.log("UI components passed: shared close/switch callbacks, semantic controls, host mixes, disabled/compact states, stable artwork and disposal.");

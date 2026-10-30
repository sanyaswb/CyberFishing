const assert = require("node:assert/strict");

async function checkItemDatabase() {
  const { ITEM_DB } = await import("../../../src/game/config/raw/items/item_database.js");
  const boat = ITEM_DB.deliveryMethods?.boat_lvl3;
  assert(boat, "boat_lvl3 must exist in item database");
  assert.equal(boat.iconUrl, "assets/items/boats/boat-lvl--3_no-bait.webp", "default boat iconUrl");
  assert(boat.skin, "boat must have skin definition");
  assert.equal(boat.skin.equipment?.noBait, "assets/items/boats/boat-lvl--3_no-bait.webp");
  assert.equal(boat.skin.equipment?.bait, "assets/items/boats/boat-lvl--3_bait.webp");
  assert(boat.skin.animation, "boat must have skin animation definition");
  assert.equal(boat.skin.animation.skeleton, "assets/animations/boats/boat-lvl--3.json");
  assert.equal(boat.skin.animation.atlas, "assets/animations/boats/boat-lvl--3.atlas");
  assert.equal(boat.skin.animation.skin, "skin_boat-lvl--3");
}

async function checkChumControls() {
  const { ChumControls } = await import("../../../src/platform/browser/ui/chum_controls.js");
  const fakeDoc = {
    createElement(tag) {
      return {
        tag,
        style: {},
        className: "",
        type: "",
        innerText: "",
        hidden: false,
        attrs: {},
        listeners: {},
        setAttribute(k, v) { this.attrs[k] = String(v); },
        addEventListener(event, fn) { this.listeners[event] = fn; },
        appendChild(child) { this.child = child; },
        replaceChildren(child) { this.child = child; },
        remove() {},
      };
    },
    body: { appendChild() {} },
  };

  let clicked = false;
  const controls = new ChumControls(() => { clicked = true; }, { documentRef: fakeDoc });
  
  // Hand mode keeps text emoji
  controls.setState("idle", "hand", 1);
  assert.equal(controls.button.innerText, "🍞");

  // Boat mode without 3 baits gets no-bait image
  controls.setState("idle", "boat", 3, false, true, "assets/items/boats/boat-lvl--3_no-bait.webp");
  assert(controls.button.child, "boat button has image element child");
  assert.equal(controls.button.child.src, "assets/items/boats/boat-lvl--3_no-bait.webp");

  // Boat mode with 3 baits gets bait image
  controls.setState("idle", "boat", 3, false, true, "assets/items/boats/boat-lvl--3_bait.webp");
  assert.equal(controls.button.child.src, "assets/items/boats/boat-lvl--3_bait.webp");

  // Moving state shows moving icon
  controls.setState("moving", "boat", 3, false, true, "assets/items/boats/boat-lvl--3_bait.webp");
  assert.equal(controls.button.innerText, "⏩");

  // Empty state for boat stays active with no-bait image, boat-empty class, and allows clicking
  controls.setState("empty", "boat", 3, false, true, "assets/items/boats/boat-lvl--3_no-bait.webp");
  assert.equal(controls.button.child.src, "assets/items/boats/boat-lvl--3_no-bait.webp");
  assert.ok(controls.button.className.includes("chum-control--boat-empty"), "empty boat button has boat-empty class");
  controls.button.listeners.click({});
  assert.equal(clicked, true, "clicking empty boat button triggers callback");
}

async function checkChumControllerEmptyBoat() {
  const { ChumController } = await import("../../../src/game/application/chum/chum_controller.js");
  const { FISHING_MESSAGES } = await import("../../../src/game/presentation/fishing/fishing_messages.js");
  let editorSlot = null;
  let feedbackOptions = null;
  let warnedMessage = null;
  const fakeInventoryUI = {
    openSlotEditor(slot, opts) {
      editorSlot = slot;
      feedbackOptions = opts;
    },
    showWarning(msg) {
      warnedMessage = msg;
    },
  };
  const fakeInventory = {
    getEquipped() {
      return {
        delivery: { instanceId: "boat-3", effectiveStats: { sections: 3 } },
        deliveryChums: [],
      };
    },
  };
  const fakeChum = {
    getBoats: () => [],
  };
  const controller = new ChumController({
    messages: FISHING_MESSAGES,
    inventory: fakeInventory,
    chum: fakeChum,
    inventoryUI: fakeInventoryUI,
    createUi: () => ({ setState() {}, dispose() {} }),
  });
  controller.handleClick();
  assert.equal(editorSlot, "delivery", "opens delivery slot editor");
  assert.deepEqual(feedbackOptions, { feedbackSlotId: "cargo", tone: "error" }, "highlights cargo sockets in red");
  assert.equal(warnedMessage, FISHING_MESSAGES.loadChumIntoBoat, "shows load chum into boat warning");

  // TK-162: loaded bunkers but no charge: the button is inactive and a click opens the battery socket with a warning.
  const states = [];
  let percent = 0;
  const loaded = new ChumController({
    messages: FISHING_MESSAGES,
    inventory: { getEquipped: () => ({ delivery: { instanceId: "boat-3", effectiveStats: { sections: 3 } },
      deliveryChums: [{ id: "mix" }], deliveryBattery: { instanceId: "battery-1" } }) },
    chum: fakeChum,
    inventoryUI: fakeInventoryUI,
    devicePower: { read: () => ({ hasBattery: true, percent, empty: percent <= 0 }) },
    createUi: () => ({ setState(state) { states.push(state); }, dispose() {} }),
  });
  loaded.updateUI();
  assert.equal(states.at(-1), "empty", "a drained battery shows the inactive (empty) boat button");
  loaded.handleClick();
  assert.deepEqual(feedbackOptions, { feedbackSlotId: "battery", tone: "error" }, "highlights the battery socket in red");
  assert.equal(warnedMessage, FISHING_MESSAGES.boatBatteryEmpty, "says the battery is empty");
  assert.equal(loaded.isAiming, false, "and does not start aiming");
  percent = 50;
  loaded.updateUI();
  assert.equal(states.at(-1), "idle", "a charged battery makes the button active again");
}

async function run() {
  await checkItemDatabase();
  await checkChumControls();
  await checkChumControllerEmptyBoat();
}

run().then(() => {
  console.log("bait-boat-inventory-visuals-check passed");
}).catch((err) => {
  console.error("bait-boat-inventory-visuals-check failed:", err);
  process.exit(1);
});

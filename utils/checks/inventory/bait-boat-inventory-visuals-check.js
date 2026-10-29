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
        setAttribute(k, v) { this.attrs[k] = String(v); },
        addEventListener() {},
        appendChild(child) { this.child = child; },
        replaceChildren(child) { this.child = child; },
        remove() {},
      };
    },
    body: { appendChild() {} },
  };

  const controls = new ChumControls(() => {}, { documentRef: fakeDoc });
  
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
}

async function run() {
  await checkItemDatabase();
  await checkChumControls();
}

run().then(() => {
  console.log("bait-boat-inventory-visuals-check passed");
}).catch((err) => {
  console.error("bait-boat-inventory-visuals-check failed:", err);
  process.exit(1);
});

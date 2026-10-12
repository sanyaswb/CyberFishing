const assert = require("node:assert/strict");
const { TestDocument } = require("../keepnet/test_document");

module.exports = async function checkFeedPicker() {
  const { AquariumFeedPicker } = await import("../../../src/game/presentation/house/aquarium_feed_picker.js");
  const { HOUSE_LABELS } = await import("../../../src/game/presentation/house/house_labels.js");
  const documentRef = new TestDocument(), create = documentRef.createElement.bind(documentRef);
  documentRef.createElement = (tag) => {
    const node = create(tag);
    Object.defineProperty(node, "isConnected", { get: () => documentRef.body.contains(node) });
    if (tag === "dialog") { node.showModal = () => node.open = true; node.close = () => node.open = false; }
    return node;
  };
  const button = create("button"), list = create("div"); list.hidden = true; documentRef.body.append(button, list);
  const applied = [];
  const picker = new AquariumFeedPicker({ documentRef, button, list, labels: HOUSE_LABELS.feedPicker,
    onFeed: (id, count) => { applied.push([id, count]); return { ok: true }; } });
  const items = [{ id: "one", name: "One", count: 1, imagePath: "one.svg" },
    { id: "many", name: "Many", count: 5, imagePath: "many.svg" }, { id: "empty", name: "Empty", count: 0 }];
  const model = { feedItems: items, aquarium: { owned: true, count: 1 } };
  picker.update(model); button.click(); assert.equal(list.hidden, false);
  assert.equal(documentRef.byClass("house__feed-item").length, 2);
  documentRef.byClass("house__feed-item")[0].children[2].click();
  assert.deepEqual(applied[0], ["one", 1]);
  const multi = documentRef.byClass("house__feed-item")[1].children[2]; multi.click();
  const dialog = documentRef.byClass("house__feed-dialog")[0], range = documentRef.byClass("house__feed-range")[0];
  assert.equal(dialog.open, true); assert.equal(range.max, "5");
  range.value = "5"; range.fire("input");
  assert.equal(documentRef.byClass("house__feed-quantity")[0].textContent, "5 / 5 упаковок");
  documentRef.byClass("house__feed-quantity-controls")[0].children[0].click();
  assert.equal(range.value, "4");
  dialog.children[3].children[0].click(); assert.equal(dialog.open, false); assert.equal(applied.length, 1);
  multi.click(); range.value = "99"; range.fire("input"); assert.equal(range.value, "5");
  picker.update({ ...model, feedItems: [{ ...items[1], count: 2 }] });
  assert.equal(range.value, "2", "changed stock clamps pending selection");
  dialog.children[3].children[1].click(); assert.deepEqual(applied[1], ["many", 2]);
  picker.update(model); documentRef.byClass("house__feed-item")[1].children[2].click();
  dialog.fire("cancel"); assert.equal(dialog.open, false); assert.equal(applied.length, 2);
  picker.dispose(); assert.equal(documentRef.byClass("house__feed-dialog").length, 0);
};

const assert = require("node:assert/strict");
const { TestDocument } = require("../keepnet/test_document");

module.exports = async function checkFeedPicker() {
  const { AquariumFeedPicker } = await import("../../../src/game/presentation/house/aquarium_feed_picker.js");
  const { HOUSE_LABELS } = await import("../../../src/game/presentation/house/house_labels.js");
  const documentRef = new TestDocument(), create = documentRef.createElement.bind(documentRef);
  const button = create("button"), list = create("div"), preview = create("span"), hint = create("p");
  button.textContent = "Прикормити"; list.hidden = true; hint.hidden = true;
  documentRef.body.append(button, preview, hint, list);
  const original = create("p"); original.textContent = "Original fixture content"; list.append(original);
  const applied = []; let accepted = true, picker;
  const items = [{ id: "one", name: "One", count: 1, imagePath: "one.svg" },
    { id: "many", name: "Many", count: 5, imagePath: "many.svg" }, { id: "empty", name: "Empty", count: 0 }];
  let model = { feedItems: items, selectedFeedId: "unavailable", aquarium: { owned: true, count: 1, canLoadFeed: true, feed: null } };
  const onFeed = (id, quantity) => {
    applied.push([id, quantity]);
    if (accepted) {
      model = { ...model, feedCountdownLabel: "0:01", feedTimeLabel: "Прикормки на 0:01", aquarium: { ...model.aquarium, canLoadFeed: false,
        feed: { ...items.find(item => item.id === id), quantity: 1, remainingMs: 1000 } } };
      picker.update(model);
    }
    return { ok: accepted };
  };
  const mount = () => new AquariumFeedPicker({ documentRef, button, list, preview, hint, labels: HOUSE_LABELS.feedPicker, onFeed });
  picker = mount(); picker.update(model);
  assert(preview.textContent.includes("One"), "the first available row previews before any choice");
  button.click(); assert.equal(list.hidden, false);
  const rows = [...list.children];
  assert.equal(rows.length, 2); assert(rows.every(row => row.tagName === "button"));
  assert(rows.every(row => row.children.length === 2), "whole rows replace the add buttons");
  rows[0].click(); assert.equal(applied.length, 0, "selection cannot consume feed");
  assert.equal(list.hidden, true, "choosing closes the list without discarding the draft");
  assert.equal(button.textContent, "Завантажити");
  const previewRow = preview.children[0];
  assert(previewRow.classList.contains("house__feed-item"), "the preview uses the same item block as list rows");
  previewRow.click(); assert.equal(list.hidden, false, "the chosen preview reopens the list without loading");
  assert.equal(applied.length, 0);
  rows[1].click(); assert.equal(rows[0].getAttribute("aria-pressed"), "false");
  assert.equal(rows[1].getAttribute("aria-pressed"), "true", "exactly one draft is selected");
  assert(preview.textContent.includes("Many")); assert.equal(documentRef.activeElement, button);
  assert.equal(list.hidden, true);
  const image = rows[1].children[0].children[0]; list.scrollTop = 31;
  picker.update({ ...model, feedItems: [items[0], { ...items[1], count: 2 }] });
  assert.equal(rows[1].children[0].children[0], image); assert.equal(list.scrollTop, 31);
  accepted = false; button.click(); assert.deepEqual(applied[0], ["many", 1]);
  assert.equal(button.textContent, "Завантажити", "a failed load keeps the draft for retry");
  accepted = true; button.click(); assert.deepEqual(applied[1], ["many", 1]);
  assert.equal(button.disabled, true); assert.equal(list.hidden, true); assert.equal(hint.hidden, false);
  assert.equal(documentRef.activeElement, hint, "confirmation focuses the warning below the row instead of disabled buttons");
  assert(preview.textContent.includes("Many"), "loaded feed remains visible during the lock");
  assert(preview.textContent.includes("0:01") && !preview.textContent.includes("Прикормки на"), "the item uses a short countdown");
  assert(!preview.contains(hint), "warnings remain below the controls");
  assert.equal(button.textContent, "Завантажити", "the locked action keeps Load when reserve feed is available");
  assert.equal(previewRow.children[0].children[1].textContent, "1", "active preview shows the consumed pack count");
  button.click(); previewRow.click(); rows[0].click();
  assert.equal(list.hidden, true); assert.equal(applied.length, 2, "disabled controls cannot bypass the authoritative gate");
  model = { ...model, aquarium: { ...model.aquarium, canLoadFeed: true } }; picker.update(model);
  button.click(); rows[0].click();
  previewRow.click();
  button.fire("keydown", { key: "Escape" }); assert.equal(list.hidden, true);
  assert.equal(button.textContent, "Прикормити", "Escape cancels the unconsumed draft");
  button.click(); rows[0].click();
  picker.update({ ...model, feedItems: [items[1]] });
  assert.equal(button.textContent, "Прикормити", "a disappeared pack invalidates a pending draft");
  picker.update({ ...model, aquarium: { ...model.aquarium, count: 0 } }); assert.equal(button.disabled, true);
  picker.update({ ...model, error: "invalid_snapshot" }); assert.equal(button.disabled, true);
  picker.update({ ...model, feedItems: [] }); button.click();
  assert.equal(list.children.length, 1); assert.equal(list.children[0].textContent, HOUSE_LABELS.feedPicker.empty);
  picker.dispose(); picker.dispose();
  assert.deepEqual(list.children, [original]); assert.equal(list.hidden, true);
  assert.equal(button.getAttribute("aria-expanded"), null); assert.equal(button.textContent, "Прикормити");
  assert.equal(preview.children.length, 0); assert.equal(button.listeners.get("click").size, 0);
  picker = mount(); picker.update(model);
  assert.equal(button.listeners.get("click").size, 1);
  button.click(); list.children[0].click(); button.click();
  assert.equal(applied.length, 3, "remount applies once and always consumes one pack");
  picker.dispose();
};

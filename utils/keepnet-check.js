const assert = require("node:assert/strict");
const { TestDocument } = require("./testing/keepnet/test_document");

async function main() {
  const { InventoryUiBootstrap } = await import("../src/bootstrap/production/inventory_ui_bootstrap.js");
  const { composeLiveBait } = await import("../src/bootstrap/production/live_bait_composition.js");
  const { KeepnetViewModel } = await import("../src/game/presentation/keepnet/keepnet_view_model.js");
  const { VictoryState } = await import("../src/game/application/state/victory_state.js");
  const { LIVE_BAIT_CONFIG } = await import("../src/game/config/raw/live_bait/live_bait_config.js");
  const documentRef = new TestDocument();
  let now = 1000;
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const service = composeLiveBait({ storage, clock: { nowMs: () => now }, rng: { next: () => 0 },
    config: { ...LIVE_BAIT_CONFIG, lifetimeMinMs: 10000, lifetimeMaxMs: 10000 },
    fishDb: [{ id: "crucian_stalker", name: "Карась" }, { id: "pike", name: "Щука" }] });
  const fish = { id: "crucian_stalker", name: "Карась", weight: .1, level: 1, imagePath: "assets/fish/a.webp",
    rarity: { halfSteps: 3, maxHalfSteps: 12, unitsPerStar: 2 } };
  service.keepCatch(fish, "one");
  service.keepCatch({ ...fish, weight: .08, imagePath: "assets/fish/b.webp", rarity: { ...fish.rarity, halfSteps: 2 } }, "two");
  service.convertCatch({ ...fish, weight: .06 }, "bait");
  service.keepCatch({ ...fish, id: "pike", name: "Щука", weight: 1.2, imagePath: "" }, "pike");
  const source = service.getView();
  const projection = new KeepnetViewModel().build(source);
  assert.equal(projection.groups.length, 2);
  assert.deepEqual(projection.groups[0].fish.map((item) => item.id), ["one", "two", "bait"]);
  assert.equal(projection.count, 4, "capacity counts individuals, not stacks");
  assert.equal(new KeepnetViewModel().build(source, { speciesId: "missing" }).filtered.length, 4, "stale filter resets before projection");
  assert.equal(new KeepnetViewModel().build(source, { kind: "live_bait" }).groups[0].count, 1);
  assert.equal(source.keepnet.length, 3, "grouping never changes ownership");
  let inventoryClosed = 0;
  let onInventoryOpen;
  const ui = InventoryUiBootstrap.createKeepnet({ documentRef, liveBait: service,
    inventoryUI: { close: () => { inventoryClosed++; }, setOnOpen: (handler) => { onInventoryOpen = handler; } } });
  const button = documentRef.byClass("keepnet-button")[0];
  button.click();
  assert.equal(inventoryClosed, 1);
  const root = documentRef.byClass("keepnet-modal")[0];
  const close = documentRef.byClass("keepnet-modal__close")[0];
  const back = documentRef.byClass("keepnet-modal__back")[0];
  assert.equal(documentRef.activeElement, close);
  assert.equal(documentRef.byClass("keepnet-modal__group").length, 2);
  assert.equal(documentRef.byClass("keepnet-modal__badge")[0].textContent, "3");
  const group = documentRef.byKey("species:crucian_stalker");
  const mobilePanel = documentRef.byClass("keepnet-modal__main")[0];
  mobilePanel.scrollTop = 200;
  group.click();
  assert.equal(mobilePanel.scrollTop, 0, "detail navigation starts at the top on mobile");
  assert.equal(documentRef.byClass("keepnet-modal").length, 1, "details reuse the same dialog");
  assert.equal(documentRef.byClass("keepnet-modal__fish").length, 3);
  assert.equal(documentRef.activeElement, back);
  const images = documentRef.byClass("keepnet-modal__image");
  assert.deepEqual(images.map((image) => image.src), ["assets/fish-thumbnails/a.webp", "assets/fish-thumbnails/b.webp", "assets/fish-thumbnails/a.webp"]);
  assert(documentRef.byClass("keepnet-modal__fish-rarity")[0].textContent.includes("1,5 / 6"));
  assert.equal(documentRef.byClass("keepnet-modal__fish-weight")[0].textContent, "100 г");
  images[0].fire("error");
  assert.equal(images[0].hidden, true);
  assert.equal(images[0].parentNode.children[0].hidden, false, "missing image gets a stable fallback");
  const select = documentRef.byKey("bait:select");
  select.focus();
  const panel = documentRef.byClass("keepnet-modal__right")[0];
  panel.scrollTop = 137;
  mobilePanel.scrollTop = 121;
  now += 1000; ui.refresh();
  assert.equal(documentRef.activeElement, select, "countdown refresh retains focus");
  assert.equal(documentRef.byClass("keepnet-modal__image")[0], images[0], "timer refresh does not reload images");
  assert.equal(panel.scrollTop, 137);
  assert.equal(mobilePanel.scrollTop, 121);
  assert(documentRef.byClass("keepnet-modal__fish-timer")[2].textContent.includes("0:09"));
  select.click(); assert.equal(service.getSelectedBait().fishId, "bait");
  documentRef.byKey("one:convert").click();
  assert.equal(service.getView().liveBaits.length, 2);
  documentRef.byKey("two:release").click();
  assert.equal(service.getView().keepnet.length, 2, "release requires confirmation");
  assert.equal(documentRef.activeElement, documentRef.byKey("two:cancel-release"));
  documentRef.byKey("two:cancel-release").click();
  documentRef.byKey("two:release").click();
  documentRef.byKey("two:confirm-release").click();
  assert.equal(service.getView().keepnet.some((entry) => entry.id === "two"), false);
  const last = documentRef.byKey("bait:release");
  last.focus();
  assert.equal(root.fire("keydown", { key: "Tab" }).prevented, true);
  assert.equal(documentRef.activeElement, close);
  root.fire("keydown", { key: "Tab", shiftKey: true });
  assert.equal(documentRef.activeElement, last);
  root.fire("keydown", { key: "Escape" });
  assert.equal(ui.isOpen, true);
  assert.equal(documentRef.activeElement, documentRef.byKey("species:crucian_stalker"));
  documentRef.byKey("species:crucian_stalker").click();
  now += 11000; ui.refresh();
  assert.equal(back.hidden, true, "an empty species closes its detail view after expiry");
  assert.equal(documentRef.byClass("keepnet-modal__group").length, 1);
  root.fire("keydown", { key: "Escape" });
  assert.equal(ui.isOpen, false);
  assert.equal(documentRef.activeElement, button);
  ui.open(); onInventoryOpen(); assert.equal(ui.isOpen, false);
  ui.showCatchResult({ ok: true, notice: "aquarium_full", fishId: "missing" });
  assert.equal(ui.isOpen, true);
  assert(documentRef.byClass("keepnet-modal__status")[0].textContent.includes("Акваріум заповнений"));
  ui.close();
  ui.showCatchResult({ ok: false, reason: "keepnet_full" });
  assert(documentRef.byClass("keepnet-modal__status")[0].textContent.includes("Садок заповнений"));
  ui.dispose(); assert.equal(documentRef.body.children.length, 0);
  const notifications = [];
  const transitions = [];
  let catchResult = { ok: false, reason: "keepnet_full" };
  let outcomes = 0;
  const victory = new VictoryState({
    ui: { updateContinueButtonState() {}, setOutcomeOverlayActive() {} },
    input: { getPointerGestureId: () => 1 }, config: {}, getViewportSize: () => ({ width: 400, height: 800 }),
    victoryLayoutResolver: { resolve: () => ({}) }, victoryActionGestureResolver: { resolve: () => "live_bait" },
    liveBait: { createCatchId: () => "caught", canConvert: () => true,
      resolveCatch: () => { outcomes++; return catchResult; } },
    onCatchResult: (result) => notifications.push(result), commands: { setState: (state) => transitions.push(state) },
  });
  victory.enter({ fish });
  const gesture = { pointerReleased: true };
  victory.handleInput(gesture);
  assert.equal(gesture.pointerReleased, false);
  assert.equal(transitions.length, 0, "full keepnet does not silently resolve the catch");
  assert.equal(notifications[0].reason, "keepnet_full");
  catchResult = { ok: true, notice: "aquarium_full", fishId: "caught" };
  victory.handleInput({ pointerReleased: true });
  victory.handleInput({ pointerReleased: true });
  assert.deepEqual(transitions, ["scouting"]);
  assert.equal(outcomes, 2, "retry succeeds once after capacity is freed");
  assert.equal(notifications[1].notice, "aquarium_full");
  console.log("Keepnet passed: species stacks, individual images/weight/rarity, filters, live countdown, actions, expiry, focus and navigation.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

const assert = require("node:assert/strict");
const { TestDocument } = require("./testing/keepnet/test_document");

async function main() {
  const { InventoryUiBootstrap } = await import("../src/bootstrap/production/inventory_ui_bootstrap.js");
  const { composeLiveBait } = await import("../src/bootstrap/production/live_bait_composition.js");
  const { KeepnetViewModel } = await import("../src/game/presentation/keepnet/keepnet_view_model.js");
  const { VictoryState } = await import("../src/game/application/state/victory_state.js");
  const { LIVE_BAIT_CONFIG } = await import("../src/game/config/raw/live_bait/live_bait_config.js");
  const { DEGRADATION_COLOR_CONFIG } = await import("../src/game/presentation/visual/degradation_color_config.js");
  const { DegradationColorResolver } = await import("../src/game/presentation/styles/degradation_color_resolver.js");
  const { InventoryResourceMeterRenderer } = await import("../src/game/presentation/inventory/inventory_resource_meter_renderer.js");
  const { InventoryDomFactory } = await import("../src/platform/browser/dom/inventory_dom_factory.js");
  const colors = new DegradationColorResolver({ configProvider: () => DEGRADATION_COLOR_CONFIG });
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
  assert.equal(projection.capacityPercent, 4);
  assert.equal(new KeepnetViewModel().build(source, { kind: "live_bait" }).capacityPercent, 4,
    "filtering never changes the occupied capacity");
  const empty = { ...source, keepnet: [], liveBaits: [], keepnetReservedCount: 0 };
  assert.equal(new KeepnetViewModel().build(empty).capacityPercent, 0);
  assert.equal(new KeepnetViewModel().build({ ...source, keepnetCapacity: 4 }).capacityPercent, 100);
  assert.equal(new KeepnetViewModel().build({ ...source, keepnetCapacity: 3 }).capacityPercent, 100,
    "overcapacity cannot overflow the meter");
  const meters = new InventoryResourceMeterRenderer({ domFactory: new InventoryDomFactory(documentRef),
    degradationColorResolver: colors });
  const reading = meters.create({ id: "capacity", percent: 40, label: "Remaining resource" });
  assert.equal(reading.style.getPropertyValue("--inventory-resource-color"), colors.resolvePercent(40).cssColor);
  meters.updateReading(reading, { percent: 60, remainingPercent: 40, label: "Occupied capacity" });
  assert.equal(reading.style.getPropertyValue("--inventory-resource-color"), colors.resolvePercent(40).cssColor,
    "equal remaining space and remaining resources use the same shared color scale");
  meters.updateReading(reading, { percent: 100, remainingPercent: 0, label: "Full capacity" });
  assert.equal(reading.style.getPropertyValue("--inventory-resource-color"), colors.resolvePercent(0).cssColor);
  meters.updateReading(reading, { percent: 0, remainingPercent: 100, label: "Empty capacity" });
  assert.equal(reading.style.getPropertyValue("--inventory-resource-color"), colors.resolvePercent(100).cssColor);
  assert.equal(new KeepnetViewModel().build(source, { speciesId: "missing" }).filtered.length, 4, "stale filter resets before projection");
  assert.equal(new KeepnetViewModel().build(source, { kind: "live_bait" }).groups[0].count, 1);
  assert.equal(source.keepnet.length, 3, "grouping never changes ownership");
  // The keepnet is the inventory's keepnet section (spec 067): the inventory mounts its halves and owns visibility.
  const inventory = { opened: [], toggled: 0, view: null,
    attachKeepnetSection(view) { this.view = view; documentRef.body.append(view.summaryNode, view.contentNode); },
    openSection(id) { this.opened.push(id); this.view.setVisible(true); },
    toggleSection(id) { this.toggled++; assert.equal(id, "keepnet"); this.view.setVisible(!this.view.isOpen); } };
  const ui = InventoryUiBootstrap.createKeepnet({ documentRef, liveBait: service, degradationColorResolver: colors,
    inventoryUI: inventory });
  assert.equal(inventory.view, ui, "the keepnet attaches itself as the inventory section");
  assert.equal(ui.isOpen, false);
  const button = documentRef.byClass("keepnet-button")[0];
  button.click();
  assert.equal(inventory.toggled, 1, "the toolbar button toggles the inventory's keepnet section");
  assert.equal(ui.isOpen, true);
  const summary = documentRef.byClass("keepnet-section__summary")[0];
  const content = documentRef.byClass("keepnet-section__content")[0];
  assert.equal(documentRef.byClass("keepnet-modal").length, 0, "no separate keepnet dialog remains");
  const backdrop = documentRef.byClass("keepnet-section__backdrop")[0];
  assert(content.contains(backdrop) && backdrop.alt === "" && backdrop.src === "assets/ui/inventory/keepnet.svg",
    "a decorative keepnet lies behind the fish list (shown in portrait)");
  // Spec 074: the shared collection — back/heading/filters panel, then the fish-list panel with the backdrop.
  const keepnetControls = documentRef.byClass("keepnet-section__controls")[0];
  const keepnetItems = documentRef.byClass("keepnet-section__items")[0];
  assert(content.classList.contains("inventory-collection") && content.children[0] === keepnetControls &&
    content.children[1] === keepnetItems && keepnetControls.classList.contains("inventory-collection__controls") &&
    keepnetControls.contains(documentRef.byClass("keepnet-section__filters")[0]) &&
    keepnetItems.classList.contains("inventory-collection__items") && keepnetItems.contains(backdrop) &&
    keepnetItems.contains(documentRef.byClass("keepnet-section__list")[0]) &&
    backdrop.classList.contains("inventory-collection__backdrop"),
  "the keepnet content is a filters panel and a fish-list panel");
  const back = documentRef.byClass("keepnet-section__back")[0];
  const capacity = documentRef.byClass("keepnet-section__capacity")[0];
  const capacityCount = documentRef.byClass("keepnet-section__count")[0];
  assert(summary.contains(capacity) && content.contains(documentRef.byClass("keepnet-section__list")[0]),
    "parameters belong to the summary, fish to the content");
  assert.equal(capacity.getAttribute("role"), "meter");
  assert.equal(capacity.getAttribute("aria-valuenow"), "4");
  assert(capacity.title.includes("4 / 100"), "exact capacity stays available as a contextual hint");
  assert.equal(documentRef.byClass("keepnet-section__section-title")[0].hidden, true);
  assert.equal(documentRef.byClass("keepnet-section__icon")[0].src, "assets/ui/inventory/keepnet.svg");
  assert.equal(capacity.textContent, "", "the capacity meter has no permanent numeric label");
  assert.equal(capacityCount.textContent, "4 / 100");
  assert.equal(capacity.parentNode.children.indexOf(capacityCount) + 1,
    capacity.parentNode.children.indexOf(capacity), "the occupancy counter sits directly above its meter");
  const help = documentRef.byClass("keepnet-section__help")[0];
  const hint = documentRef.byClass("keepnet-section__help-text")[0];
  assert(hint.hidden && documentRef.byClass("keepnet-section__status")[0].hidden,
    "routine explanations stay inside the closed help popover");
  help.click();
  assert(!hint.hidden && help.getAttribute("aria-expanded") === "true");
  assert(hint.textContent.includes("Живці мають власний відлік життя"));
  documentRef.fire("click", { target: summary });
  assert(hint.hidden, "the next click anywhere dismisses the hint");
  help.click();
  assert(documentRef.fire("click", { target: help }).stopped,
    "a second click on help dismisses it without reopening");
  assert(hint.hidden);
  help.click();
  summary.fire("keydown", { key: "Escape" });
  assert(hint.hidden && ui.isOpen, "Escape dismisses help before navigating");
  help.click(); ui.setVisible(false); ui.setVisible(true);
  assert(hint.hidden, "hiding and showing the section resets help");
  // Spec 080: the hint is a ui-hint inside the summary; reading inside it keeps it open, its close button dismisses it.
  assert(hint.classList.contains("ui-hint") && hint.parentNode === summary, "the help hint lies inside the summary");
  help.click();
  assert(!documentRef.fire("click", { target: hint }).stopped && !hint.hidden, "a click inside the hint keeps it open");
  const closeHelp = hint.children.find((node) => node.classList.contains("ui-hint__close"));
  assert.equal(closeHelp.getAttribute("aria-label"), "Закрити підказку");
  closeHelp.click();
  assert(hint.hidden && help.getAttribute("aria-expanded") === "false", "the close button dismisses the hint");
  assert.equal(documentRef.listeners.get("click").size, 0, "help document listeners are released");
  assert.equal(documentRef.byClass("keepnet-section__group").length, 2);
  assert.equal(documentRef.byClass("keepnet-section__badge")[0].textContent, "3");
  const group = documentRef.byKey("species:crucian_stalker");
  content.scrollTop = 200;
  group.click();
  assert.equal(content.scrollTop, 0, "detail navigation starts at the top");
  assert.equal(documentRef.byClass("keepnet-section__content").length, 1, "details reuse the same content host");
  assert.equal(documentRef.byClass("keepnet-section__fish").length, 3);
  assert.equal(documentRef.activeElement, back);
  const images = documentRef.byClass("keepnet-section__image");
  assert.deepEqual(images.map((image) => image.src), ["assets/fish-thumbnails/a.webp", "assets/fish-thumbnails/b.webp", "assets/fish-thumbnails/a.webp"]);
  assert(documentRef.byClass("keepnet-section__fish-rarity")[0].textContent.includes("1,5 / 6"));
  assert.equal(documentRef.byClass("keepnet-section__fish-weight")[0].textContent, "100 г");
  images[0].fire("error");
  assert.equal(images[0].hidden, true);
  assert.equal(images[0].parentNode.children[0].hidden, false, "missing image gets a stable fallback");
  const select = documentRef.byKey("bait:select");
  select.focus();
  content.scrollTop = 137;
  now += 1000; ui.refresh();
  assert.equal(documentRef.activeElement, select, "countdown refresh retains focus");
  assert.equal(documentRef.byClass("keepnet-section__image")[0], images[0], "timer refresh does not reload images");
  assert.equal(documentRef.byClass("keepnet-section__capacity")[0], capacity, "timer refresh retains the shared meter node");
  assert.equal(content.scrollTop, 137);
  assert(documentRef.byClass("keepnet-section__fish-timer")[2].textContent.includes("0:09"));
  select.click(); assert.equal(service.getSelectedBait().fishId, "bait");
  assert.equal(service.beginLiveBaitCast("bait", { compatible: true, free: true, hookCount: 1 }).ok, true);
  ui.refresh();
  assert.equal(capacity.getAttribute("aria-valuenow"), "4", "a hooked bait still reserves its return slot");
  assert.equal(capacityCount.textContent, "4 / 100", "visible occupancy also includes the reserved return slot");
  assert(capacity.title.includes("1 місце на гачку"));
  assert.equal(service.endLiveBaitCast("bait").ok, true);
  ui.refresh();
  documentRef.byKey("one:convert").click();
  assert.equal(service.getView().liveBaits.length, 2);
  documentRef.byKey("two:release").click();
  assert.equal(service.getView().keepnet.length, 2, "release requires confirmation");
  assert.equal(documentRef.activeElement, documentRef.byKey("two:cancel-release"));
  content.fire("keydown", { key: "Escape" });
  assert.equal(documentRef.byKey("two:cancel-release"), undefined, "Escape cancels a pending release first");
  documentRef.byKey("two:release").click();
  documentRef.byKey("two:confirm-release").click();
  assert.equal(service.getView().keepnet.some((entry) => entry.id === "two"), false);
  content.fire("keydown", { key: "Escape" });
  assert.equal(ui.isOpen, true);
  assert.equal(documentRef.activeElement, documentRef.byKey("species:crucian_stalker"));
  documentRef.byKey("species:crucian_stalker").click();
  now += 11000; ui.refresh();
  assert.equal(back.hidden, true, "an empty species closes its detail view after expiry");
  assert.equal(documentRef.byClass("keepnet-section__group").length, 1);
  assert.equal(content.fire("keydown", { key: "Escape" }).prevented, false,
    "at the top level Escape is left to the inventory");
  assert.equal(ui.isOpen, true);
  ui.setVisible(false);
  ui.showCatchResult({ ok: true });
  assert.equal(ui.isOpen, false, "a quiet catch does not open the inventory");
  ui.showCatchResult({ ok: true, notice: "aquarium_full", fishId: "missing" });
  assert.deepEqual(inventory.opened, ["keepnet"], "a catch notice opens the inventory at the keepnet");
  assert.equal(ui.isOpen, true);
  assert(documentRef.byClass("keepnet-section__status")[0].textContent.includes("Акваріум заповнений"));
  ui.setVisible(false);
  ui.showCatchResult({ ok: false, reason: "keepnet_full" });
  assert(documentRef.byClass("keepnet-section__status")[0].textContent.includes("Садок заповнений"));
  help.click();
  ui.dispose(); assert.equal(documentRef.body.children.length, 0);
  assert.equal(documentRef.listeners.get("click").size, 0, "disposing an open hint removes its capture listener");
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
  console.log("Keepnet passed: shared capacity colors and hook reservations, species stacks, individual images/weight/rarity, filters, live countdown, actions, expiry, focus and navigation.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

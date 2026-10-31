const assert = require("node:assert/strict");
const { TestDocument } = require("../../testing/keepnet/test_document");

async function main() {
  const { InventoryUiBootstrap } = await import("../../../src/bootstrap/production/inventory_ui_bootstrap.js");
  const { KeepnetFillImageResolver } = await import("../../../src/game/presentation/keepnet/keepnet_fill_image_resolver.js");
  const { KEEPNET_ART_STAGES } = await import("../../../src/game/presentation/keepnet/keepnet_art_config.js");
  const { AssetRegistry } = await import("../../../src/engine/assets/asset_registry.js");
  const { ASSET_REGISTRY } = await import("../../../src/game/config/generated/asset_registry.js");
  const assets = new AssetRegistry(ASSET_REGISTRY);
  const artwork = new KeepnetFillImageResolver({ stages: KEEPNET_ART_STAGES });
  for (const [percent, stage] of [[-1, 0], [0, 0], [.01, 20], [20, 20], [20.01, 40], [40, 40],
    [40.01, 60], [60, 60], [60.01, 80], [80, 80], [80.01, 100], [100, 100], [150, 100], [NaN, 0]]) {
    assert.equal(artwork.resolve(percent), `items.keepnet.keepnet--${stage}`, "a stage is named by asset id");
  }
  const { composeLiveBait } = await import("../../../src/bootstrap/production/live_bait_composition.js");
  const { KeepnetViewModel } = await import("../../../src/game/presentation/keepnet/keepnet_view_model.js");
  const { VictoryState } = await import("../../../src/game/application/state/victory_state.js");
  const { LIVE_BAIT_CONFIG } = await import("../../../src/game/config/raw/live_bait/live_bait_config.js");
  const { DEGRADATION_COLOR_CONFIG } = await import("../../../src/game/presentation/visual/degradation_color_config.js");
  const { DegradationColorResolver } = await import("../../../src/game/presentation/styles/degradation_color_resolver.js");
  const { InventoryResourceMeterRenderer } = await import("../../../src/game/presentation/inventory/inventory_resource_meter_renderer.js");
  const { InventoryDomFactory } = await import("../../../src/platform/browser/dom/inventory_dom_factory.js");
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
  // Production composition: both overview images, the backdrop and toolbar share the unfiltered occupancy.
  const artworkDocument = new TestDocument();
  const artworkState = { ...empty };
  const createdImages = [];
  const createElement = artworkDocument.createElement.bind(artworkDocument);
  artworkDocument.createElement = (tag) => {
    const element = createElement(tag);
    if (tag === "img") createdImages.push(element);
    return element;
  };
  const artworkView = InventoryUiBootstrap.createKeepnetView({ documentRef: artworkDocument,
    liveBait: { getView: () => artworkState, advance() {} }, buttonMountNode: artworkDocument.body,
    degradationColorResolver: colors, openSection() {}, toggleSection() {}, assets });
  // Spec 157 R5: the view loads only the current fill stage; the other stages wait for preloadKeepnetStages.
  assert.deepEqual([...new Set(createdImages.map((image) => image.src).filter((src) => /keepnet--/u.test(src)))],
    [assets.pathOf(artwork.resolve(0))], "startup requests only the current keepnet stage");
  const stageImages = createdImages.length;
  await InventoryUiBootstrap.preloadKeepnetStages({ createElement: (tag) => {
    const image = createElement(tag);
    queueMicrotask(() => image.onload?.());
    createdImages.push(image);
    return image;
  } }, assets);
  assert.deepEqual(createdImages.slice(stageImages).map((image) => image.src).filter((src) => /keepnet--/u.test(src)),
    KEEPNET_ART_STAGES.map((stage) => assets.pathOf(stage.imageAsset)), "the deferred warm-up loads every stage");
  artworkDocument.body.append(artworkView.summaryNode, artworkView.contentNode);
  // Spec 157 TK-174: until the game is ready the toolbar button shows the sections sprite's keepnet symbol, and its art
  // is lazy and not in the page (not requested); showShortcutArtwork() requests it and swaps it in once it has loaded.
  const keepnetButton = artworkDocument.byClass("keepnet-button")[0];
  const placeholder = keepnetButton.children[0];
  assert.equal(placeholder.tagName, "svg", "the button starts with a sprite icon");
  assert.equal(placeholder.children[0].getAttribute("href"), "assets/ui/inventory-sections.svg#keepnet");
  const buttonArt = createdImages.find((image) => image.className === "keepnet-button__icon");
  assert(buttonArt && buttonArt.loading === "lazy" && !buttonArt.parentNode, "the button art waits outside the page");
  artworkView.showShortcutArtwork();
  assert.equal(buttonArt.loading, "eager", "after ready the art is requested");
  assert.equal(keepnetButton.children[0], placeholder, "the icon stays until the art has loaded");
  buttonArt.fire("load");
  assert.equal(keepnetButton.children[0], buttonArt, "the loaded art replaces the icon");
  buttonArt.fire("load");
  artworkView.showShortcutArtwork();
  assert.deepEqual(keepnetButton.children, [buttonArt], "a later load or call swaps nothing twice");
  artworkView.setVisible(true);
  const artworkImages = [...artworkDocument.byClass("keepnet-section__icon"),
    ...artworkDocument.byClass("keepnet-section__backdrop"), ...artworkDocument.byClass("keepnet-button__icon")];
  let imageWrites = 0;
  for (const image of artworkImages) {
    let source = image.src;
    Object.defineProperty(image, "src", { get: () => source, set: (value) => { source = value; imageWrites++; } });
  }
  for (const count of [0, 1, 20, 21, 40, 41, 60, 61, 80, 81, 100, 101, 0]) {
    artworkState.keepnet = Array.from({ length: count }, (_, index) => ({ ...source.keepnet[0], id: `art-${index}` }));
    artworkView.refresh();
    assert(artworkImages.every((image) => image.src === assets.pathOf(artwork.resolve(Math.min(100, count)))), `artwork at ${count}%`);
    const writes = imageWrites;
    artworkView.refresh();
    assert.equal(imageWrites, writes, "unchanged occupancy never reassigns image sources");
  }
  artworkState.keepnetReservedCount = 21;
  artworkView.refresh();
  assert(artworkImages.every((image) => image.src === assets.pathOf(artwork.resolve(21))), "reservations count towards artwork");
  artworkState.keepnetCapacity = 0;
  artworkView.refresh();
  assert(artworkImages.every((image) => image.src === assets.pathOf(artwork.resolve(100))), "zero capacity follows the full meter");
  artworkView.dispose();
  assert.equal(new KeepnetViewModel().build({ ...source, keepnetCapacity: 4 }).capacityPercent, 100);
  assert.equal(new KeepnetViewModel().build({ ...source, keepnetCapacity: 3 }).capacityPercent, 100,
    "overcapacity cannot overflow the meter");
  const meters = new InventoryResourceMeterRenderer({ domFactory: new InventoryDomFactory(documentRef, { assets }),
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
  const inventory = { opened: [], toggled: 0, view: null, swiped: [],
    swipeSection(step) { this.swiped.push(step); },
    // Like the inventory: the help hint goes to the host's hint region above the sections (spec 086).
    attachKeepnetSection(view) { this.view = view; documentRef.body.append(view.helpNode, view.summaryNode, view.contentNode); },
    openSection(id) { this.opened.push(id); this.view.setVisible(true); },
    toggleSection(id) { this.toggled++; assert.equal(id, "keepnet"); this.view.setVisible(!this.view.isOpen); } };
  // Spec 089: the game hides the help button for now; the component stays and is checked here with showHelp.
  const hiddenHelpDocument = new TestDocument();
  InventoryUiBootstrap.createKeepnet({ documentRef: hiddenHelpDocument, liveBait: service, degradationColorResolver: colors, assets,
    inventoryUI: { attachKeepnetSection(view) { hiddenHelpDocument.body.append(view.summaryNode, view.contentNode); } } });
  assert.equal(hiddenHelpDocument.byClass("keepnet-section__help").length, 0, "the game shows no keepnet help button");
  assert.equal(hiddenHelpDocument.byClass("keepnet-overview").length, 2);
  const ui = InventoryUiBootstrap.createKeepnet({ documentRef, liveBait: service, degradationColorResolver: colors, assets,
    inventoryUI: inventory, showHelp: true });
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
  assert(content.contains(backdrop) && backdrop.alt === "" && backdrop.src === "assets/items/keepnet/keepnet--20.webp",
    "a decorative keepnet lies behind the fish list (shown in portrait)");
  // Spec 074/088: the shared collection, laid out like the backpack: the filters panel, then the fish pager — tabs
  // above the items panel whose pages are the fish list over the faded keepnet and the keepnet view.
  const keepnetControls = documentRef.byClass("keepnet-section__controls")[0];
  const fishList = documentRef.byClass("keepnet-section__list")[0];
  const pager = content.children[1];
  const [pagerTabs, keepnetItems] = pager.children;
  const [fishPage, keepnetPage] = keepnetItems.children[0].children;
  assert(content.classList.contains("inventory-collection") && content.children[0] === keepnetControls &&
    keepnetControls.classList.contains("inventory-collection__controls") &&
    pager.classList.contains("inventory-pager") && pagerTabs.classList.contains("inventory-pager__tabs") &&
    keepnetItems === documentRef.byClass("keepnet-section__items")[0] &&
    keepnetItems.classList.contains("inventory-collection__items") && keepnetItems.classList.contains("inventory-panel") &&
    fishPage.className.includes("inventory-pager__page--fish") && keepnetPage.className.includes("inventory-pager__page--keepnet") &&
    fishPage.children[0] === backdrop && fishPage.children[1] === fishList &&
    backdrop.classList.contains("inventory-collection__backdrop"),
  "the keepnet content is a filters panel and a two-page fish pager");
  const pagerTabButtons = pagerTabs.children[0].children;
  assert.deepEqual(pagerTabButtons.map((tab) => tab.getAttribute("aria-label")), ["Риба", "Садок"]);
  assert.equal(pagerTabButtons[0].children[0].children[0].getAttribute("href"), "assets/ui/inventory-sections.svg#fish");
  const pagerIndex = () => keepnetItems.style.getPropertyValue("--inventory-pager-index");
  assert.equal(pagerIndex(), "0", "the section opens on the fish list");
  // The filters are the backpack's rows: a category row (species toggle, kind buttons), then the species row.
  const [kinds, speciesRow] = documentRef.byClass("keepnet-section__filters")[0].children;
  const [speciesToggle, ...kindButtons] = kinds.children;
  assert(keepnetControls.children[0].contains(kinds) && kinds.classList.contains("inventory-categories") &&
    speciesRow.classList.contains("inventory-subfilters") && speciesToggle.classList.contains("inventory-categories__toggle") &&
    kindButtons.every((button) => button.classList.contains("inventory-categories__button")),
  "keepnet filters use the backpack's filter rows at the top of the controls panel");
  assert.deepEqual(kindButtons.map((button) => button.textContent), ["Уся риба", "Забраний улов", "Живці"]);
  assert.deepEqual(kindButtons.map((button) => button.getAttribute("aria-pressed")), ["true", "false", "false"]);
  assert(!speciesRow.classList.contains("inventory-subfilters--open"));
  speciesToggle.click();
  assert(speciesRow.classList.contains("inventory-subfilters--open") && speciesToggle.getAttribute("aria-expanded") === "true",
    "the toggle opens the species row");
  const speciesRadios = () => documentRef.byClass("inventory-subfilters__checkbox");
  assert.deepEqual(speciesRadios().map((radio) => [radio.type, radio.value, radio.checked]),
    [["radio", "all", true], ["radio", "crucian_stalker", false], ["radio", "pike", false]]);
  // Two keepnet views like the backpack's: the left column's summary and the pager's second page.
  const overviews = documentRef.byClass("keepnet-overview");
  assert(overviews.length === 2 && overviews[0] === summary && keepnetPage.children[0] === overviews[1] &&
    overviews.every((view) => view.children[0].className === "keepnet-overview__visual inventory-panel" &&
      view.children[1].className === "keepnet-overview__stats inventory-panel"),
  "each keepnet view is an image container and a stats container");
  const back = documentRef.byClass("keepnet-section__back")[0];
  const scale = documentRef.byClass("keepnet-section__capacity")[0];
  const [scaleIcon, capacity, capacityCount] = scale.children;
  assert(scale.classList.contains("inventory-scale") && scaleIcon.tagName === "svg" &&
    scaleIcon.children[0].getAttribute("href") === "assets/ui/status-icons.svg#fish",
  "the capacity scale shows the fish icon on its left");
  assert(summary.contains(scale) && content.contains(fishList), "parameters belong to the summary, fish to the content");
  assert.equal(capacity.getAttribute("role"), "meter");
  assert.equal(capacity.getAttribute("aria-valuenow"), "4");
  assert(capacity.title.includes("4 / 100"), "exact capacity stays available as a contextual hint");
  assert.equal(documentRef.byClass("keepnet-section__section-title")[0].hidden, true);
  assert.equal(documentRef.byClass("keepnet-section__detail")[0].hidden, true, "the details row takes no space");
  assert.equal(documentRef.byClass("keepnet-section__icon")[0].src, "assets/items/keepnet/keepnet--20.webp");
  assert.equal(capacity.textContent, "", "the capacity meter has no permanent numeric label");
  assert.equal(capacityCount.textContent, "4 / 100", "the occupancy reading is centred on the meter");
  assert.equal(documentRef.byClass("keepnet-section__capacity")[1].children[2].textContent, "4 / 100",
    "both keepnet views show the same reading");
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
  assert(hint.classList.contains("ui-hint") && hint.parentNode !== summary && !summary.contains(hint),
    "the help hint is placed by its host's hint region, not inside the summary (spec 086)");
  help.click();
  assert(!documentRef.fire("click", { target: hint }).stopped && !hint.hidden, "a click inside the hint keeps it open");
  const closeHelp = hint.children.find((node) => node.classList.contains("ui-hint__close"));
  assert.equal(closeHelp.getAttribute("aria-label"), "Закрити підказку");
  closeHelp.click();
  assert(hint.hidden && help.getAttribute("aria-expanded") === "false", "the close button dismisses the hint");
  assert.equal(documentRef.listeners.get("click").size, 0, "help document listeners are released");
  assert.equal(documentRef.byClass("keepnet-section__group").length, 2);
  kindButtons[2].click();
  assert.deepEqual(kindButtons.map((button) => button.getAttribute("aria-pressed")), ["false", "false", "true"]);
  assert.equal(documentRef.byClass("keepnet-section__group").length, 1, "a kind button filters the fish");
  kindButtons[0].click();
  speciesRadios()[2].checked = true; speciesRadios()[2].fire("change");
  assert.equal(documentRef.byClass("keepnet-section__group").length, 1, "a species choice filters the fish");
  assert.deepEqual(speciesRadios().map((radio) => radio.checked), [false, false, true]);
  speciesRadios()[0].checked = true; speciesRadios()[0].fire("change");
  assert.equal(documentRef.byClass("keepnet-section__group").length, 2);
  // Spec 088: the fish pager swipes like the backpack's and hands swipes past its edges to the inventory.
  keepnetItems.layoutWidth = 300;
  const swipe = (fromX, toX, pointerType = "touch", end = "pointerup") => {
    keepnetItems.fire("pointerdown", { pointerType, button: 0, pointerId: 1, clientX: fromX, clientY: 100 });
    keepnetItems.fire("pointermove", { pointerType, pointerId: 1, clientX: toX, clientY: 101 });
    keepnetItems.fire(end, { type: end, pointerType, pointerId: 1, clientX: toX, clientY: 101 });
  };
  swipe(250, 50);
  assert.equal(pagerIndex(), "1", "a left swipe shows the keepnet view");
  swipe(250, 50);
  assert.deepEqual(inventory.swiped, [1], "a left swipe on the keepnet view goes past the last section");
  swipe(50, 250); swipe(50, 250);
  assert.equal(pagerIndex(), "0");
  assert.deepEqual(inventory.swiped, [1, -1], "a right swipe on the fish list returns to the backpack");
  const portraitStyle = documentRef.defaultView.getComputedStyle;
  documentRef.defaultView.getComputedStyle = (node) => ({ getPropertyValue: name => name === "--inventory-swipe"
    ? "" : portraitStyle(node).getPropertyValue(name) });
  for (const pointerType of ["mouse", "touch"]) {
    const before = inventory.swiped.length;
    swipe(50, 250, pointerType);
    assert.deepEqual(inventory.swiped.slice(before), [-1], "wide keepnet returns to backpack in one swipe: " + pointerType);
    assert.equal(pagerIndex(), "0", "wide swipes leave the hidden summary unselected");
    assert(keepnetItems.fire("click", { detail: 1 }).prevented, "a wide swipe suppresses its follow-up click");
    swipe(250, 50, pointerType, "pointercancel");
    assert.equal(inventory.swiped.length, before + 1, "cancelled wide gestures do not navigate");
  }
  documentRef.defaultView.getComputedStyle = portraitStyle;
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
  assert.equal(documentRef.byClass("keepnet-section__capacity")[0], scale, "timer refresh retains the shared scale node");
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
  await checkSlotIconWarmUp(InventoryUiBootstrap);
  await checkKeepnetArtBudget();
  console.log("Keepnet passed: shared capacity colors and hook reservations, species stacks, individual images/weight/rarity, filters, live countdown, actions, expiry, focus and navigation; inventory slot icons warmed without link preload.");
}

// TK-081: the slot placeholders are drawn only by the open inventory, so a <link preload> in the page head is never
// used within the browser's window and warns. The inventory composition warms each file once instead.
async function checkSlotIconWarmUp(InventoryUiBootstrap) {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.resolve(__dirname, "../../..");
  for (const page of ["index.html", "dev.html"]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert(!/<link[^>]+rel="preload"[^>]+assets\/ui\/inventory\//u.test(html), `${page} has no inventory icon link preload`);
  }
  const { inventorySlotIconAssets } = await import("../../../src/game/presentation/inventory/inventory_slot_icons.js");
  const { AssetRegistry } = await import("../../../src/engine/assets/asset_registry.js");
  const { ASSET_REGISTRY } = await import("../../../src/game/config/generated/asset_registry.js");
  const assets = new AssetRegistry(ASSET_REGISTRY);
  const images = [];
  const documentRef = { createElement: (tag) => { const image = { tag, decode: () => Promise.resolve() }; images.push(image); return image; } };
  const warmed = InventoryUiBootstrap.preloadSlotIcons(documentRef, assets);
  const expected = inventorySlotIconAssets().map((id) => assets.pathOf(id));
  assert.equal(expected.length, 14, "fourteen distinct placeholder files (battery, spec 143; radio, spec 142)");
  assert.deepEqual(images.map((image) => image.src).sort(), [...expected].sort(), "each icon file is requested once");
  assert(images.every((image) => image.tag === "img"));
  images.forEach((image) => image.onload());
  await warmed;
}
// Spec 157 R5: the keepnet stages are display-sized (the largest phone view is ~374 CSS px, x2), committed and light;
// their 2048 px masters stay in asset-sources/ and are never released.
async function checkKeepnetArtBudget() {
  const { AssetRegistry } = await import("../../../src/engine/assets/asset_registry.js");
  const { ASSET_REGISTRY } = await import("../../../src/game/config/generated/asset_registry.js");
  const assets = new AssetRegistry(ASSET_REGISTRY);
  const fs = require("node:fs");
  const path = require("node:path");
  const { spawnSync } = require("node:child_process");
  const sharp = require("sharp");
  const root = path.resolve(__dirname, "../../..");
  const { KEEPNET_ART_STAGES } = await import("../../../src/game/presentation/keepnet/keepnet_art_config.js");
  const tracked = new Set(spawnSync("git", ["ls-files", "assets/items/keepnet", "asset-sources/items/keepnet"], { cwd: root })
    .stdout.toString("utf8").split("\n").filter(Boolean));
  for (const { imageAsset } of KEEPNET_ART_STAGES) {
    const imagePath = assets.pathOf(imageAsset);
    const file = path.join(root, imagePath);
    assert(tracked.has(imagePath), `${imagePath} is committed (Pages ships tracked files only)`);
    const { width, height } = await sharp(file).metadata();
    assert(Math.max(width, height) <= 768, `${imagePath} is display-sized: ${width}x${height}`);
    assert(fs.statSync(file).size <= 200 * 1024, `${imagePath} stays within 200 KB: ${fs.statSync(file).size} bytes`);
    const master = imagePath.replace(/^assets\//u, "asset-sources/");
    assert(tracked.has(master), `${imagePath} keeps its master at ${master}`);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

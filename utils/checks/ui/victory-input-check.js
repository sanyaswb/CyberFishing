// Spec 161: the victory window is DOM. Its reading of a caught fish (weight scale with and without level ranges,
// trophy, anomaly, rarity), the window (plates as icons, ruler, stars, picture on the whole screen and back, actions,
// hide and dispose) and the victory state (one resolution per catch, a failed save keeps the window).
const assert = require("node:assert/strict");
const { TestDocument } = require("../../testing/keepnet/test_document");

async function main() {
  const { VictoryViewModelBuilder } = await import("../../../src/game/presentation/screens/victory_view_model_builder.js");
  const { VictoryWindow } = await import("../../../src/game/presentation/screens/victory_window.js");
  const { VictoryWeightScaleRenderer } = await import("../../../src/game/presentation/screens/victory_weight_scale_renderer.js");
  const { VICTORY_LABELS } = await import("../../../src/game/presentation/screens/victory_labels.js");
  const { RarityStarsRenderer } = await import("../../../src/game/presentation/ui/rarity_stars_renderer.js");
  const { VictoryState } = await import("../../../src/game/application/state/victory_state.js");
  const { InventoryDomFactory } = await import("../../../src/platform/browser/dom/inventory_dom_factory.js");
  const { AssetRegistry } = await import("../../../src/engine/assets/asset_registry.js");
  const { ASSET_REGISTRY } = await import("../../../src/game/config/generated/asset_registry.js");
  const { FISH_DB } = await import("../../../src/game/config/databases/fish_database.js");

  // View model (D4): crucian has level ranges and a trophy weight; perch has no level ranges (its depth range is used)
  // and its trophy weight is 0.833 kg (TK-232).
  const themes = [];
  const builder = new VictoryViewModelBuilder({ species: FISH_DB, resolveFishImage: (fish) => `img/${fish.id}--${fish.level}.webp`,
    themeResolver: { resolve: (fish) => { themes.push(fish); return { color: [10, 20, 30], isAnimated: fish.isUnique, background: { alpha: 0.2 } }; } } });
  const crucian = builder.build({ id: "crucian_stalker", name: "Карась", level: 3, maxLevel: 6, weight: 1.2, isTrophy: true,
    anomaly: "inside", isUnique: true, rarity: { halfSteps: 7, maxHalfSteps: 10, unitsPerStar: 2 } });
  assert.deepEqual(crucian.scale, { minKg: 0.05, maxKg: 5, weightKg: 1.2, trophyKg: 1 }, "the level ranges and the trophy weight");
  assert.deepEqual([crucian.isTrophy, crucian.hasAnomaly, crucian.animated, crucian.imagePath, crucian.color],
    [true, true, true, "img/crucian_stalker--3.webp", [10, 20, 30]]);
  const perch = builder.build({ id: "perch_radioactive", name: "Окунь", level: 1, weight: 9, anomaly: "none" });
  assert.deepEqual(perch.scale, { minKg: 0.125, maxKg: 2.678, weightKg: 2.678, trophyKg: 0.833 },
    "without level ranges the depth range; the marker stays on the ruler; the perch's trophy weight");
  assert.equal(builder.build({ id: "crucian_stalker", weight: 1, level: 1 }).scale.trophyKg, 1);
  const noTrophy = new VictoryViewModelBuilder({ resolveFishImage: () => "", themeResolver: { resolve: () => ({}) },
    species: [{ id: "plain", depthConfig: { minWeightAtMinDepth: 0.1, maxWeightAtMaxDepth: 1 } }] });
  assert.equal(noTrophy.build({ id: "plain", weight: 0.5 }).scale.trophyKg, null, "a species without a trophy weight has no zone");
  assert.deepEqual([perch.hasAnomaly, perch.isTrophy, perch.rarity.isResolved], [false, false, false]);
  assert.equal(builder.build({ id: "unknown", weight: 1 }).scale, null, "an unknown species has no ruler");
  // TK-231: the size system of the keepnet card, the quality tint's alpha.
  assert.deepEqual([crucian.artSize, perch.artSize, crucian.backgroundAlpha], [{ step: 3, of: 6 }, { step: 1, of: 5 }, 0.2]);

  // Window.
  const documentRef = new TestDocument();
  const assets = new AssetRegistry(ASSET_REGISTRY);
  const mountNode = documentRef.createElement("div");
  documentRef.body.append(mountNode);
  const view = new VictoryWindow({ domFactory: new InventoryDomFactory(documentRef, { assets }), mountNode, labels: VICTORY_LABELS,
    stars: new RarityStarsRenderer({ documentRef }),
    scale: new VictoryWeightScaleRenderer({ documentRef, format: VICTORY_LABELS.scaleValue, formatCurrent: VICTORY_LABELS.scaleCurrent }),
    icons: { sprite: "ui.status-icons", weight: "ui.inventory.weight" } });
  const root = view.element;
  assert(root.hidden && mountNode.children[0] === root, "built once, hidden until a catch");
  const actions = [];
  view.show(crucian, { onAction: (action) => actions.push(action) });
  const one = (name) => documentRef.byClass(name)[0];
  assert(!root.hidden && one("victory-window__title").textContent === "Карась" && one("victory-window__image").src ===
    "img/crucian_stalker--3.webp" && one("victory-window__level").textContent === "3");
  assert.equal(root.style.getPropertyValue("--victory-color"), "10, 20, 30");
  assert.equal(root.style.getPropertyValue("--victory-background-alpha"), "0.2", "the panel takes the quality tint's alpha");
  const picture = one("victory-window__picture");
  assert(picture.classList.contains("art-size") && picture.style.getPropertyValue("--art-size-rank") === "0.6",
    "a level-3 fish of six is drawn smaller in the invisible picture box (TK-231)");
  assert(one("victory-window__panel").children[0] === one("victory-window__level") && !picture.contains(one("victory-window__level")),
    "the level sits in the panel's corner, not on the picture");
  assert.equal(documentRef.byClass("victory-scale__label--current")[0].textContent, "1.200", "the caught weight is not rounded");
  assert.deepEqual(documentRef.byClass("victory-window__action").map((button) => button.textContent), ["Забрати", "Відпустити"]);
  assert(root.classList.contains("victory-window--animated"), "a unique fish's glow animates in CSS");
  const stats = one("victory-window__stats").children;
  const hrefs = (stat) => stat.children.filter((child) => child.tagName === "svg").map((icon) => icon.children[0].getAttribute("href"));
  assert.equal(stats[0].children[0].src, "assets/ui/inventory/weight.svg", "the weight plate uses the existing weight icon");
  assert.equal(stats[0].children[1].textContent, "1.200 kg");
  assert.deepEqual(hrefs(stats[1]), ["assets/ui/status-icons.svg#trophy", "assets/ui/status-icons.svg#check"]);
  assert.deepEqual(hrefs(stats[2]), ["assets/ui/status-icons.svg#radiation", "assets/ui/status-icons.svg#check"]);
  assert(stats.every((stat) => stat.getAttribute("aria-label")), "every icon plate has its reading as an accessible name");
  const scale = one("victory-scale");
  assert(scale && documentRef.byClass("victory-scale__trophy").length === 1 && documentRef.byClass("victory-scale__tick").length === 11,
    "the ruler has 11 ticks and a green trophy segment");
  assert.equal(one("rarity-stars").children.length, 5, "five stars for ten half steps");

  // The picture opens the fish on the whole screen; a click there or Escape brings the panel back.
  one("victory-window__picture").click();
  assert(one("victory-window__panel").hidden && !one("victory-window__zoom").hidden && root.classList.contains("victory-window--zoomed"));
  one("victory-window__zoom").click();
  assert(!one("victory-window__panel").hidden && one("victory-window__zoom").hidden);
  one("victory-window__picture").click();
  root.fire("keydown", { key: "Escape" });
  assert(!one("victory-window__panel").hidden, "Escape returns to the panel");

  one("victory-window__action--primary").click();
  documentRef.byClass("victory-window__action")[1].click();
  assert.deepEqual(actions, ["claim", "release"]);
  view.show(perch, { onAction: (action) => actions.push(`perch:${action}`) });
  assert.deepEqual(hrefs(documentRef.byClass("victory-window__stat")[1]), ["assets/ui/status-icons.svg#trophy", "assets/ui/status-icons.svg#cross"]);
  assert.equal(documentRef.byClass("victory-scale__trophy").length, 1, "the perch's trophy zone (TK-232)");
  assert.equal(documentRef.byClass("rarity-stars").length, 0, "an unknown rarity draws no stars");
  assert(!root.classList.contains("victory-window--animated"));
  view.hide();
  one("victory-window__action--primary").click();
  assert(root.hidden && actions.length === 2, "a hidden window reports no action");
  view.dispose();
  assert.equal(mountNode.children.length, 0, "dispose removes the window");

  // Victory state.
  const calls = [];
  let saveOk = false;
  const shown = [];
  const state = new VictoryState({
    ui: { updateContinueButtonState: () => {}, setOutcomeOverlayActive: (active) => calls.push(`overlay:${active}`) },
    victoryWindow: { show: (fish, handlers) => shown.push({ fish, handlers }), hide: () => calls.push("hide") },
    liveBait: { createCatchId: () => "catch-1", resolveCatch: (id, fish, action) => { calls.push(`${action}:${id}:${fish.id}`);
      return saveOk ? { ok: true } : { ok: false, reason: "keepnet_full" }; } },
    onCatchResult: (result) => calls.push(`result:${result.ok}`),
    commands: { setState: (name) => calls.push(`state:${name}`) },
  });
  state.enter({ fish: { id: "crucian_stalker" } });
  assert.equal(shown[0].fish.id, "crucian_stalker", "entering shows the caught fish");
  shown[0].handlers.onAction("live_bait");
  shown[0].handlers.onAction("claim");
  saveOk = true;
  shown[0].handlers.onAction("claim");
  shown[0].handlers.onAction("release");
  assert.deepEqual(calls, ["overlay:true", "claim:catch-1:crucian_stalker", "result:false", "claim:catch-1:crucian_stalker",
    "state:scouting", "result:true"], "unknown action ignored, a failed save keeps the window, one resolution per catch");
  state.exit();
  assert.deepEqual(calls.slice(-2), ["hide", "overlay:false"]);
  console.log("Victory window passed: weight scale with and without level ranges, trophy and anomaly plates as icons, stars, picture on the whole screen and back (click, Escape), actions, hide/dispose; victory state resolves once and keeps the window on a failed save.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

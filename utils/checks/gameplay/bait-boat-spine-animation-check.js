const assert = require("node:assert/strict");

async function checkBoatStateFlow() {
  const { BaitBoat } = await import("../../../src/game/application/chum/bait_boat.js");
  const boat = new BaitBoat(100, 200, {
    skin: { animation: { skeleton: "boat.json", atlas: "boat.atlas" } },
    effectiveStats: { sections: 3, statsByLevel: { 1: { speedPxPerSec: 100 } } },
  });

  // Verify skin retention (TK-146)
  assert.ok(boat.config.skin?.animation, "boat.config must retain skin from equipped item");
  assert.ok(boat.skin?.animation, "boat.skin must retain skin from equipped item");

  // 1. Initial immersion state
  assert.equal(boat.animationState, "immersion");
  assert.equal(boat.immersionTimer, 1.25);
  assert.deepEqual(boat.droppedSections, []);

  // Update idle immersion
  boat.update(1000, null, null, 20, null); // 1.0s
  assert.equal(boat.animationState, "immersion");
  boat.update(300, null, null, 20, null); // 0.3s -> elapsed 1.3s
  assert.equal(boat.animationState, "idle");

  // 2. Setting target triggers moving_start
  boat.setTarget(150, 200, "test-zone-1");
  assert.equal(boat.animationState, "moving_start");
  assert.equal(boat.moveStartTimer, 1.333);

  // 3. Completing start moves into loop
  boat.update(1400, () => 1, null, 20, null);
  assert.equal(boat.animationState, "moving");

  // 4. Force arrival to test opening section 1
  boat.pos.x = 150;
  boat.pos.y = 200;
  boat.update(100, () => 1, null, 20, null);
  assert.equal(boat.animationState, "opening");
  assert.equal(boat.openingSectionIndex, 1);
  assert.equal(boat.isBaitDropped, false, "bait not dropped until door opens");

  // Advance opening timer
  boat.update(1600, () => 1, null, 20, null);
  assert.equal(boat.isBaitDropped, true, "bait dropped after door opened");
  assert.deepEqual(boat.droppedSections, [1], "section 1 recorded as dropped");
  assert.equal(boat.remainingSections, 2);
}

async function checkAnimationController() {
  const { BoatAnimationController } = await import("../../../src/game/presentation/world/boat_animation_controller.js");
  const { BOAT_ANIMATION_CLIPS, BOAT_LIGHT_SLOTS, BOAT_BAIT_SLOTS } = await import("../../../src/game/domain/chum/boat_animation_state.js");

  const visibleSlots = new Map();
  let currentTrackAnimation = null;
  let currentLoop = false;
  const fakeBone = { name: "root", x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

  const fakeScene = {
    setLoop(track, clip) {
      currentTrackAnimation = clip;
      currentLoop = true;
    },
    setAnimation(track, clip, loop) {
      currentTrackAnimation = clip;
      currentLoop = loop;
      return true;
    },
    setSlotVisible(slot, visible) {
      visibleSlots.set(slot, visible);
    },
    getClips() {
      return [{ name: "boat3--immersion", duration: 1.25 }];
    },
    getBones() {
      return [fakeBone];
    },
    setBoneSetup(name, values) {
      if (fakeBone.name === name) {
        Object.assign(fakeBone, values);
        return true;
      }
      return false;
    },
    setPlacement() {},
    update() {},
    getView() { return {}; },
    dispose() {},
  };

  const fakeGlSurface = {
    ensureContext() {},
    isContextLost() { return false; },
  };

  const controller = new BoatAnimationController({
    loadBundle: () => ({ result: Promise.resolve({ status: "ready", bundle: { version: "4.3.26", skeleton: { bones: [{ name: "root" }] } } }) }),
    loadRuntime: () => Promise.resolve({ available: true, runtime: { createScene: () => ({ scene: fakeScene, reason: null }) } }),
    glSurface: fakeGlSurface,
  });

  controller.setDescriptor({
    skeleton: "assets/animations/boats/boat-lvl--3.json",
    atlas: "assets/animations/boats/boat-lvl--3.atlas",
    skin: "skin_boat-lvl--3",
  });

  // Wait for bundle and scene
  await new Promise((r) => setTimeout(r, 10));

  // 1. Immersion with night active: lights must still be OFF
  const immersionRes = controller.advance({ animationState: "immersion", openingSectionIndex: 1, droppedSections: [] }, { dtSec: 0.1, isNight: true });
  assert.equal(immersionRes.clip, BOAT_ANIMATION_CLIPS.IMMERSION);
  for (const slot of BOAT_LIGHT_SLOTS) {
    assert.equal(visibleSlots.get(slot), false, "night light off during immersion");
  }

  // 2. Moving start with night active: lights turn ON
  const startRes = controller.advance({ animationState: "moving_start", openingSectionIndex: 1, droppedSections: [] }, { dtSec: 0.1, isNight: true });
  assert.equal(startRes.clip, BOAT_ANIMATION_CLIPS.MOVE_START);
  for (const slot of BOAT_LIGHT_SLOTS) {
    assert.equal(visibleSlots.get(slot), true, "night light on during moving start at night");
  }

  // 3. Dropping section 1 turns off bait slot 1
  controller.advance({ animationState: "moving", openingSectionIndex: 2, droppedSections: [1] }, { dtSec: 0.1, isNight: true });
  assert.equal(visibleSlots.get(BOAT_BAIT_SLOTS[1]), false, "bait slot 1 turned off after drop");
  assert.equal(visibleSlots.get(BOAT_BAIT_SLOTS[2]), true, "bait slot 2 still visible");
  assert.equal(visibleSlots.get(BOAT_BAIT_SLOTS[3]), true, "bait slot 3 still visible");

  // 4. In daylight: lights turn OFF
  controller.advance({ animationState: "moving", openingSectionIndex: 2, droppedSections: [1] }, { dtSec: 0.1, isNight: false });
  for (const slot of BOAT_LIGHT_SLOTS) {
    assert.equal(visibleSlots.get(slot), false, "night light off during day");
  }

  // 5. DEV methods
  assert.equal(controller.isSpineEnabled(), true);
  const status = controller.getStatus();
  assert.equal(status.mode, "spine");
  assert.equal(controller.getClips().length, 1);
  controller.setClipEnabled("boat3--immersion", false);
  assert.equal(controller.getClips()[0].enabled, false);
  assert.equal(controller.getBones().length, 1);
  assert.equal(controller.setBoneSetup("root", { x: 5 }), true);
  assert.equal(controller.getBoneEdits().root.x, 5);
  assert.ok(controller.exportSkeleton()?.fileName?.includes("boat-lvl--3.json"));

  controller.setSpineEnabled(false);
  assert.equal(controller.isSpineEnabled(), false);
  assert.equal(controller.getStatus().mode, "fallback (emoji)");
  assert.equal(controller.advance({ animationState: "moving", openingSectionIndex: 2, droppedSections: [] }, { dtSec: 0.1 }), null);
  controller.setSpineEnabled(true);
}

async function checkBoatRenderPipeline() {
  const { BoatChumRenderFrameBuilder } = await import("../../../src/game/presentation/rendering/boat_chum_render_frame_builder.js");
  const { PixiWorldEntitiesRenderer } = await import("../../../src/platform/browser/scene/pixi_world_entities_renderer.js");
  const { ReusableRenderList } = await import("../../../src/game/presentation/rendering/reusable_render_list.js");

  const fakeBoatView = { visible: false, x: 0, y: 0, rotation: 0, scale: { set(x, y) { this.x = x; this.y = y; } } };
  const fakeAnimController = {
    setDescriptor() {},
    advance(boat, ctx) {
      return {
        view: fakeBoatView,
        clip: "boat3--immersion",
        clipTimer: 0.1,
      };
    },
  };

  const fakeBoat = {
    pos: { x: 50, y: 120 },
    angle: 0,
    config: {
      emoji: "🚤",
      skin: {
        animation: { skeleton: "boat.json", atlas: "boat.atlas" },
      },
    },
    powerRatio: 0.9,
    waypoints: [],
    sensorRays: [],
  };

  const projector = {
    virtualToScreen(x, y, out) {
      out.x = x * 2;
      out.y = y * 2;
      return out;
    },
    getPerspective() { return { scale: 1.5 }; },
    getScale() { return 1.0; },
  };

  const builder = new BoatChumRenderFrameBuilder({
    chum: { getBoats: () => [fakeBoat], getZones: () => [] },
    projector,
    config: { locations: { showChumZones: false } },
    getWaterMetric: () => ({ surfaceScaleAt: () => 1, surfaceSquashY: 1 }),
    boatAnimation: fakeAnimController,
    getTimeOfDay: () => 22,
  });

  const frameTarget = {
    chumZones: new ReusableRenderList("world.chumZones"),
    waypoints: new ReusableRenderList("world.waypoints"),
    boats: new ReusableRenderList("world.boats"),
    sensorRays: new ReusableRenderList("world.sensorRays"),
  };

  builder.buildInto(frameTarget);
  assert.equal(frameTarget.boats.count, 1);
  const boatRecord = frameTarget.boats.getAt(0);
  assert.equal(boatRecord.x, 100);
  assert.equal(boatRecord.y, 240);
  assert.equal(boatRecord.view, fakeBoatView);
  assert.equal(boatRecord.animClip, "boat3--immersion");
  assert.ok(boatRecord.viewScale > 0);

  class FakeContainer {
    children = [];
    visible = true;
    addChild(...items) {
      for (const item of items) {
        if (!this.children.includes(item)) this.children.push(item);
        item.parent = this;
      }
    }
  }

  class FakeGraphics extends FakeContainer {
    clear() { return this; }
    ellipse() { return this; }
    fill() { return this; }
    stroke() { return this; }
    circle() { return this; }
    rect() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
  }

  class FakeSprite extends FakeContainer {
    anchor = { set() {} };
    texture = null;
    width = 0;
    height = 0;
    x = 0;
    y = 0;
    rotation = 0;
  }

  const fakeStage = new FakeContainer();
  const fakePixi = {
    Container: FakeContainer,
    Graphics: FakeGraphics,
    Sprite: FakeSprite,
  };

  const renderer = new PixiWorldEntitiesRenderer({
    pixi: fakePixi,
    stage: fakeStage,
    texts: { get: () => ({ texture: {}, width: 10, height: 10 }) },
  });

  const world = {
    visible: true,
    clipRegions: new ReusableRenderList("clip"),
    chumZones: frameTarget.chumZones,
    waypoints: frameTarget.waypoints,
    boats: frameTarget.boats,
    sensorRays: frameTarget.sensorRays,
  };

  const updated = renderer.update(world, 1);
  assert.equal(updated, true);
  assert.equal(fakeBoatView.visible, true);
  assert.equal(fakeBoatView.x, 100);
  assert.equal(fakeBoatView.y, 240);
  assert.equal(fakeBoatView.rotation, 0 - Math.PI / 2);
}

async function checkDevToolsAndBoatConfig() {
  const { CONFIG } = await import("../../../src/game/config/runtime/game_config.js");
  const { SpineBoatDevSection } = await import("../../../src/dev/tools/spine_boat_dev_section.js");

  assert.ok(CONFIG.ui?.boat, "CONFIG.ui.boat must exist");
  assert.equal(typeof CONFIG.ui.boat.displayScale, "number");
  assert.equal(typeof CONFIG.ui.boat.x, "string");
  assert.equal(typeof CONFIG.ui.boat.xOffset, "number");
  assert.equal(typeof CONFIG.ui.boat.yOffset, "number");

  const createdElements = [];
  const fakeUi = {
    createInfoRow(label, value, parent) {
      createdElements.push({ type: "info", label, value });
    },
    createSwitcherRow(label, initialValue, parent, onChange) {
      createdElements.push({ type: "switcher", label, initialValue, onChange });
    },
    createButtonRow(label, parent, onClick) {
      createdElements.push({ type: "button", label, onClick });
    },
    createSelectRow(label, options, selected, parent, onChange) {
      createdElements.push({ type: "select", label, options, selected, onChange });
    },
    createInputRow(label, value, parent, onChange) {
      createdElements.push({ type: "input", label, value, onChange });
    },
    createRangeRow(label, options, parent, onChange) {
      createdElements.push({ type: "range", label, onChange });
    },
  };

  const fakeController = {
    exportSkeleton: () => ({ fileName: "boat-lvl--3.json", skeleton: {} }),
    getStatus: () => ({ mode: "spine", mipmapped: false, currentClip: "boat3--immersion", lightsActive: false }),
    isSpineEnabled: () => true,
    setSpineEnabled: () => {},
    getClips: () => [{ name: "boat3--immersion", duration: 1.25, enabled: true }],
    setClipEnabled: () => {},
    getBones: () => [{ name: "root", parent: null, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }],
    setBoneSetup: () => true,
    getBoneEdits: () => ({}),
  };

  let renderedConfigTree = false;
  const section = new SpineBoatDevSection({
    ui: fakeUi,
    controller: fakeController,
    createSection: (label, parent, path) => ({ label, path, replaceChildren() {} }),
    renderConfigTree: (parent) => { renderedConfigTree = true; },
  });

  section.render({});
  assert.ok(createdElements.length > 0, "SpineBoatDevSection creates UI rows");
  assert.equal(renderedConfigTree, true, "SpineBoatDevSection renders config tree for CONFIG.ui.boat");
}

async function checkRealSpineSceneSlotVisibility() {
  const fs = require("node:fs");
  const path = require("node:path");
  const spine = require("@esotericsoftware/spine-webgl");
  const { SpineScene } = await import("../../../src/platform/browser/animation/spine_scene.js");

  const atlasPath = path.resolve(__dirname, "../../../assets/animations/boats/boat-lvl--3.atlas");
  const jsonPath = path.resolve(__dirname, "../../../assets/animations/boats/boat-lvl--3.json");

  const fakeSurface = {
    width: 200,
    height: 200,
    maxTextureSize: 4096,
    isContextLost: () => false,
    onContextChange: () => () => {},
  };
  const fakeGraphics = {
    createTexture: () => ({ setFilters: () => {}, setWraps: () => {}, dispose: () => {} }),
    canMipmap: () => false,
    dispose: () => {},
  };
  const bundle = {
    version: "4.3.13",
    atlasText: fs.readFileSync(atlasPath, "utf8"),
    skeleton: JSON.parse(fs.readFileSync(jsonPath, "utf8")),
    skin: "skin_boat-lvl--3",
    pages: new Map([["boat-lvl--3.webp", {}]]),
  };

  const { scene, reason, error } = SpineScene.create({
    spine,
    bundle,
    surface: fakeSurface,
    graphics: fakeGraphics,
    runtimeVersion: "4.3.13",
  });

  assert.equal(reason, null, `SpineScene must initialize without error, got: ${error}`);
  assert.ok(scene, "SpineScene instance must be created");

  // Non-existent slot returns false
  assert.equal(scene.setSlotVisible("non-existent-slot", true), false);

  // Night light slots: hide and show without throwing (TK-147)
  assert.equal(scene.setSlotVisible("boat-light", false), true);
  assert.equal(scene.setSlotVisible("boat-light", true), true);
  assert.equal(scene.setSlotVisible("boat3-night_light", false), true);
  assert.equal(scene.setSlotVisible("boat3-night_light", true), true);

  // Bait slots: hide and show without throwing
  assert.equal(scene.setSlotVisible("section--1-bait", false), true);
  assert.equal(scene.setSlotVisible("section--1-bait", true), true);
  assert.equal(scene.setSlotVisible("section--1-bait2", false), true);
  assert.equal(scene.setSlotVisible("section--1-bait2", true), true);
  assert.equal(scene.setSlotVisible("section--1-bait3", false), true);
  assert.equal(scene.setSlotVisible("section--1-bait3", true), true);

  scene.dispose();
}

async function run() {
  await checkBoatStateFlow();
  await checkAnimationController();
  await checkBoatRenderPipeline();
  await checkDevToolsAndBoatConfig();
  await checkRealSpineSceneSlotVisibility();
}

run().then(() => {
  console.log("bait-boat-spine-animation-check passed");
}).catch((err) => {
  console.error("bait-boat-spine-animation-check failed:", err);
  process.exit(1);
});

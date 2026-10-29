const assert = require("node:assert/strict");

async function checkBoatStateFlow() {
  const { BaitBoat } = await import("../../../src/game/application/chum/bait_boat.js");
  const boat = new BaitBoat(100, 200, { sections: 3, statsByLevel: { 1: { speedPxPerSec: 100 } } });

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
    loadBundle: () => ({ result: Promise.resolve({ status: "ready", bundle: { version: "4.3.26" } }) }),
    loadRuntime: () => Promise.resolve({ status: "ready", createScene: () => ({ scene: fakeScene }) }),
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

async function run() {
  await checkBoatStateFlow();
  await checkAnimationController();
  await checkBoatRenderPipeline();
}

run().then(() => {
  console.log("bait-boat-spine-animation-check passed");
}).catch((err) => {
  console.error("bait-boat-spine-animation-check failed:", err);
  process.exit(1);
});

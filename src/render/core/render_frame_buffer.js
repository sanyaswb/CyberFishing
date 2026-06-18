class ReusableRenderList {
  #items = [];
  #count = 0;
  #bufferId;

  constructor(bufferId = "renderList") {
    this.#bufferId = bufferId;
  }

  reset() {
    this.#count = 0;
    return this;
  }

  acquire() {
    let record = this.#items[this.#count];
    if (!record) {
      record = {};
      this.#items[this.#count] = record;
      if (typeof RenderAllocationDiagnostics !== "undefined") {
        RenderAllocationDiagnostics.recordBufferGrowth(this.#bufferId);
      }
    }
    this.#count += 1;
    return record;
  }

  forEachActive(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("ReusableRenderList forEachActive requires callback");
    }
    for (let index = 0; index < this.#count; index += 1) {
      callback(this.#items[index], index);
    }
  }

  getAt(index) {
    const activeIndex = Math.floor(Number(index));
    return activeIndex >= 0 && activeIndex < this.#count
      ? this.#items[activeIndex]
      : null;
  }

  getActiveUnchecked(index) {
    return this.#items[index];
  }

  get count() {
    return this.#count;
  }

}

class GameRenderFrame {
  constructor() {
    if (typeof RenderAllocationDiagnostics !== "undefined") {
      RenderAllocationDiagnostics.recordFrameCreated();
    }
    this.frameNumber = 0;
    this.dt = 0;
    this.stateName = "";
    this.viewport = {
      width: 0,
      height: 0,
      scale: 1,
    };
    this.world = {
      visible: false,
      backgroundColor: "#0f171e",
      backgroundLayers: new ReusableRenderList("world.backgroundLayers"),
      clipRegions: new ReusableRenderList("world.clipRegions"),
      debugImage: { visible: false },
      dynamicZones: new ReusableRenderList("world.dynamicZones"),
      chumZones: new ReusableRenderList("world.chumZones"),
      waypoints: new ReusableRenderList("world.waypoints"),
      boats: new ReusableRenderList("world.boats"),
      sensorRays: new ReusableRenderList("world.sensorRays"),
      invalidCastMarker: { visible: false },
    };
    this.casting = {
      visible: false,
      aimingZone: { visible: false },
      powerAim: { visible: false },
      accuracyArea: { visible: false },
    };
    this.fishing = {
      visible: false,
      fightAreas: {
        visible: false,
        clipRegions: new ReusableRenderList("fightAreas.clipRegions"),
        sectorPoints: new ReusableRenderList("sectorPoints"),
        lineRadiusPoints: new ReusableRenderList("lineRadiusPoints"),
        catchZone: { visible: false },
        lastDashZone: { visible: false },
        netZone: { visible: false },
      },
      rodLine: { visible: false },
      float: { visible: false },
    };
    this.hud = {
      visible: false,
      fishCondition: { visible: false },
      rodStroke: { visible: false },
      rodControl: { visible: false },
      tension: { visible: false },
      tackleStress: { visible: false },
      drag: { visible: false },
      holdCharges: { visible: false },
    };
    this.outcome = {
      visible: false,
      mode: "",
      gameOver: { visible: false },
      victory: {
        visible: false,
        stats: new ReusableRenderList("victory.stats"),
      },
    };
    this.debug = { visible: false };
  }

  reset(frameNumber = this.frameNumber + 1, dt = 0, stateName = "") {
    if (frameNumber && typeof frameNumber === "object") {
      const options = frameNumber;
      frameNumber = options.frameNumber ?? this.frameNumber + 1;
      dt = options.dt ?? 0;
      stateName = options.stateName ?? "";
    }
    this.frameNumber = frameNumber;
    this.dt = Math.max(0, Number(dt) || 0);
    this.stateName = String(stateName || "");
    this.world.visible = false;
    this.world.backgroundLayers.reset();
    this.world.clipRegions.reset();
    this.world.dynamicZones.reset();
    this.world.chumZones.reset();
    this.world.waypoints.reset();
    this.world.boats.reset();
    this.world.sensorRays.reset();
    this.world.debugImage.visible = false;
    this.world.invalidCastMarker.visible = false;
    this.casting.visible = false;
    this.casting.aimingZone.visible = false;
    this.casting.powerAim.visible = false;
    this.casting.accuracyArea.visible = false;
    this.fishing.visible = false;
    this.fishing.fightAreas.visible = false;
    this.fishing.fightAreas.clipRegions.reset();
    this.fishing.fightAreas.sectorPoints.reset();
    this.fishing.fightAreas.lineRadiusPoints.reset();
    this.fishing.fightAreas.catchZone.visible = false;
    this.fishing.fightAreas.lastDashZone.visible = false;
    this.fishing.fightAreas.netZone.visible = false;
    this.fishing.rodLine.visible = false;
    this.fishing.float.visible = false;
    this.hud.visible = false;
    this.hud.fishCondition.visible = false;
    this.hud.rodStroke.visible = false;
    this.hud.rodControl.visible = false;
    this.hud.tension.visible = false;
    this.hud.tackleStress.visible = false;
    this.hud.drag.visible = false;
    this.hud.holdCharges.visible = false;
    this.outcome.visible = false;
    this.outcome.mode = "";
    this.outcome.gameOver.visible = false;
    this.outcome.victory.visible = false;
    this.outcome.victory.stats.reset();
    this.debug.visible = false;
    return this;
  }
}

class RenderFrameBuffer {
  #frame = new GameRenderFrame();

  acquire(frameNumber = this.#frame.frameNumber + 1, dt = 0, stateName = "") {
    return this.#frame.reset(frameNumber, dt, stateName);
  }

  get current() {
    return this.#frame;
  }
}

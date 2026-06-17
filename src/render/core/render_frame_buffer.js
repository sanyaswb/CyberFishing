class ReusableRenderList {
  #items = [];
  #count = 0;

  reset() {
    this.#count = 0;
    return this;
  }

  acquire() {
    let record = this.#items[this.#count];
    if (!record) {
      record = {};
      this.#items[this.#count] = record;
    }
    this.#count += 1;
    return record;
  }

  forEach(callback) {
    for (let index = 0; index < this.#count; index += 1) {
      callback(this.#items[index], index);
    }
  }

  get count() {
    return this.#count;
  }

  get items() {
    return this.#items;
  }
}

class GameRenderFrame {
  constructor() {
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
      backgroundLayers: new ReusableRenderList(),
      clipRegions: new ReusableRenderList(),
      debugImage: { visible: false },
      dynamicZones: new ReusableRenderList(),
      chumZones: new ReusableRenderList(),
      waypoints: new ReusableRenderList(),
      boats: new ReusableRenderList(),
      sensorRays: new ReusableRenderList(),
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
        clipRegions: new ReusableRenderList(),
        sectorPoints: new ReusableRenderList(),
        lineRadiusPoints: new ReusableRenderList(),
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
        stats: new ReusableRenderList(),
      },
    };
    this.debug = { visible: false };
  }

  reset({ frameNumber = this.frameNumber + 1, dt = 0, stateName = "" } = {}) {
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

  acquire(resetOptions = {}) {
    return this.#frame.reset(resetOptions);
  }

  get current() {
    return this.#frame;
  }
}

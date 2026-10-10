import { ReusableRenderList } from "./reusable_render_list.js";

export class GameRenderFrame {
  constructor(diagnostics = null) {
    diagnostics?.recordFrameCreated();
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
      backgroundLayers: new ReusableRenderList("world.backgroundLayers", diagnostics),
      clipRegions: new ReusableRenderList("world.clipRegions", diagnostics),
      debugImage: { visible: false },
      dynamicZones: new ReusableRenderList("world.dynamicZones", diagnostics),
      chumZones: new ReusableRenderList("world.chumZones", diagnostics),
      waypoints: new ReusableRenderList("world.waypoints", diagnostics),
      boats: new ReusableRenderList("world.boats", diagnostics),
      sensorRays: new ReusableRenderList("world.sensorRays", diagnostics),
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
        clipRegions: new ReusableRenderList("fightAreas.clipRegions", diagnostics),
        sectorPoints: new ReusableRenderList("sectorPoints", diagnostics),
        lineRadiusPoints: new ReusableRenderList("lineRadiusPoints", diagnostics),
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
      playerPressureFatigue: { visible: false },
    };
    this.outcome = {
      visible: false,
      mode: "",
      gameOver: { visible: false },
      victory: {
        visible: false,
        stats: new ReusableRenderList("victory.stats", diagnostics),
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
    this.hud.playerPressureFatigue.visible = false;
    this.outcome.visible = false;
    this.outcome.mode = "";
    this.outcome.gameOver.visible = false;
    this.outcome.victory.visible = false;
    this.outcome.victory.stats.reset();
    this.debug.visible = false;
    return this;
  }
}

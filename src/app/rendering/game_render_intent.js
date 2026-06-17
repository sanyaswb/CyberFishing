class GameRenderIntent {
  constructor() {
    this.stateName = "";
    this.casting = {
      visible: false,
      zoneVisible: false,
      powerVisible: false,
      accuracyPreview: null,
      visual: null,
      bounds: null,
      virtualBottomY: 0,
      maxDistance: 0,
      mode: "rod",
      nowMs: 0,
    };
    this.fishing = {
      visible: false,
      state: "",
      bottom: 0,
      startTime: 0,
      tensionMeter: null,
      fishCondition: null,
    };
    this.outcome = {
      visible: false,
      mode: "",
      reason: "",
      fish: null,
    };
  }

  reset() {
    this.stateName = "";
    this.casting.visible = false;
    this.casting.zoneVisible = false;
    this.casting.powerVisible = false;
    this.casting.accuracyPreview = null;
    this.casting.visual = null;
    this.casting.bounds = null;
    this.casting.virtualBottomY = 0;
    this.casting.maxDistance = 0;
    this.casting.mode = "rod";
    this.casting.nowMs = 0;
    this.fishing.visible = false;
    this.fishing.state = "";
    this.fishing.bottom = 0;
    this.fishing.startTime = 0;
    this.fishing.tensionMeter = null;
    this.fishing.fishCondition = null;
    this.outcome.visible = false;
    this.outcome.mode = "";
    this.outcome.reason = "";
    this.outcome.fish = null;
    return this;
  }
}

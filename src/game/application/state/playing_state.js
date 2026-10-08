import { GameState } from "./game_state.js";
import { MutableFightFrameContext } from "../fishing/mutable_fight_frame_context.js";

export class PlayingState extends GameState {
  /** @param {PlayingStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  #isNetReady = false;
  #startTime = 0;
  #hasEquippedNet = false;
  #onConfigUpdateBind;
  #removeConfigUpdateListener = null;
  #fightFrameContext = new MutableFightFrameContext();
  #rodControlCastAnchor = null;

  enter(data) {
    this.#startTime = this.deps.clock.now;
    this.data = data || {};
    this.deps.depthUI?.hide?.();
    const fishData = this.data.fish;
    this.#rodControlCastAnchor = null;

    const eq = this.deps.inventory.getEquipped();
    this.#hasEquippedNet = !!eq.net;
    this.deps.fishing.consumeFirstBaitForFight(eq);
    this.deps.fight.startFight(fishData, eq, {
      selectedDepthMeters: this.getSelectedHookDepthMeters(),
    });

    const fightContext = this.#fightFrameContext;
    fightContext.floatEntity = this.deps.float;
    fightContext.net = this.deps.net;
    fightContext.fishData = fishData;
    fightContext.getRodVirtualPos = this.#getRodVirtualPos;
    fightContext.getBaseRodVirtualPos = this.#getBaseRodVirtualPos;
    fightContext.rodControlCastAnchor = null;
    fightContext.getScreenOffsetRatio = this.#getScreenOffsetRatio;
    fightContext.checkWater = this.#checkWater;

    if (this.deps.services.debug.isEnabled()) {
      this.deps.services.logger?.log(
        `%c🎣 КЛЮНУВ: ${fishData.name}!`,
        "color: #00ff00; font-size: 16px; font-weight: bold;",
      );
      this.deps.services.logger?.table({
        "Тип Вудки": eq.rod?.variant || "float",
        "Наявність Котушки":
          (eq.rod?.effectiveStats?.hasReel ?? true)
            ? "Є"
            : "Немає (Махова)",
        "Згенерована Вага": fishData.weight.toFixed(3) + " кг",
        "Рівень (Складність)": fishData.level,
      });

      this.deps.services.debug.emit("debug-fish-hooked", {
        fish: fishData,
        eq,
      });
    }

    this.#onConfigUpdateBind = () =>
      this.deps.fight.syncEquipment(this.deps.inventory.getEquipped());
    this.#removeConfigUpdateListener?.();
    this.#removeConfigUpdateListener = this.deps.subscribeConfigUpdated(
      this.#onConfigUpdateBind,
    );
  }

  update(dt, bounds, envData) {
    const floatPos = this.deps.float.getPosition();
    this.deps.projector.focusOnVirtualPos(floatPos.y, dt, 0.05);
    const input = envData.input || this.deps.input.getState();
    const fightContext = this.#fightFrameContext;
    fightContext.floatEntity = this.deps.float;
    fightContext.bounds = bounds;
    fightContext.input = input;
    fightContext.env = envData.env;
    fightContext.fishData = this.data.fish;
    fightContext.rodControlCastAnchor =
      this.#getRodControlCastAnchor(bounds);

    const result = this.deps.fight.updateFight(dt, fightContext);
    if (result.transition) {
      this.deps.commands.setState(
        result.transition.name,
        result.transition.data,
      );
      return;
    }

    const updatedPos = this.deps.float.getPosition();
    this.#isNetReady = this.deps.net.isFloatInZone(floatPos.y, bounds.bottom);
    this.deps.ui.updateNetButtonState(this.#hasEquippedNet, this.#isNetReady);

    if (updatedPos.y >= bounds.bottom) return;
    this.deps.holdUI.update(null);
  }

  handleNetClick() {
    if (!this.#isNetReady) return;
    const netResult = this.deps.fight.handleNetAttempt(
      this.deps.net,
      this.deps.rng,
      this.data.fish,
    );

    this.deps.services.debug.emit("netCatchRoll", {
      chance: netResult.chance,
      roll: netResult.roll,
      success: netResult.success,
    });

    this.deps.commands.setState(
      netResult.transition.name,
      netResult.transition.data,
    );
  }

  handleInput(input) {
    const eq = this.deps.inventory.getEquipped();
    const result = this.deps.fight.handlePlayerInput(input, eq);
    if (result.consumedSwipe && input.swipeDeltaY)
      this.deps.input.consumeSwipe();
  }

  getRenderState(target, bounds) {
    target.stateName = "playing";
    target.fishing.visible = true;
    target.fishing.state = "playing";
    target.fishing.bottom = bounds.bottom;
    target.fishing.startTime = this.#startTime;
    target.fishing.tensionMeter = this.deps.fight.tensionMeter;
    target.fishing.fishCondition = this.deps.fight.fishCondition;
  }

  getDiagnostics() {
    const bounds = this.deps.world.getDynamicBounds();
    const floatEntity = this.deps.float;
    const floatPos = floatEntity.getPosition();

    return {
      ...this.deps.fight.getDiagnostics({
        floatEntity,
        boundaries: bounds,
        rodPos: this.deps.world.getRodVirtualPos(bounds),
        screenOffset: this.deps.world.getScreenOffsetRatio(floatPos),
        equipment: this.deps.inventory.getEquipped(),
      }),
      hookedFish: this.data.fish,
    };
  }

  exit() {
    this.deps.holdUI.update(null);
    this.deps.ui.hideNetButton();
    this.#removeConfigUpdateListener?.();
    this.#removeConfigUpdateListener = null;
    this.#rodControlCastAnchor = null;
    this.#fightFrameContext.reset();
    this.deps.fight.endFight();
  }

  #getRodControlCastAnchor(frameBounds) {
    if (this.#rodControlCastAnchor) return this.#rodControlCastAnchor;
    const base = this.#getBaseRodVirtualPos(frameBounds);
    this.#rodControlCastAnchor = Object.freeze({
      x: Number(base?.x) || 0,
      y: Number(base?.y) || 0,
    });
    return this.#rodControlCastAnchor;
  }

  #getRodVirtualPos = (frameBounds) =>
    this.deps.world.getRodVirtualPos(frameBounds);
  #getBaseRodVirtualPos = (frameBounds) =>
    this.deps.world.getBaseRodVirtualPos?.(frameBounds) ||
    this.deps.world.getRodVirtualPos(frameBounds);
  #getScreenOffsetRatio = (pos) => this.deps.world.getScreenOffsetRatio(pos);
  #checkWater = (vx, vy) => this.deps.world.checkWater(vx, vy);
}

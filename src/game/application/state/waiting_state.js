import { FishingCastExposureResolver } from "../../domain/fishing/fishing_cast_exposure_resolver.js";
import { GameState } from "./game_state.js";
import { GroundPlaneScope } from "../world/ground_plane_scope.js";
import { IdleRetrievePolicyResolver } from "../../domain/fishing/idle_retrieve_policy_resolver.js";
import { Vector2 } from "../../../engine/math/vector2.js";

export class WaitingState extends GameState {
  /** @param {WaitingStateDeps} deps */
  constructor(deps) {
    super(deps);
    this.#idleRetrievePolicyResolver = new IdleRetrievePolicyResolver();
    this.#castExposureResolver = new FishingCastExposureResolver();
  }

  #effectiveInput = {
    isPulling: false,
    pullDirection: null,
    idleRetrieveParams: null,
  };
  #pullDirection = new Vector2(0, 0);
  #groundPlane = new GroundPlaneScope();
  #baitCandidates = [];
  #idleRetrievePolicyResolver;
  #castExposureResolver;

  enter() {
    this.deps.biteSystem.reset();
  }

  // Spec 183 D4: no long-press re-cast; the tackle is reeled in and a double click takes it out (TK-263).
  handleInput(input) {
    if (input.isDoubleClick) this.deps.commands.setState("scouting");
  }

  update(dt, bounds, envData) {
    const pos = this.deps.float.getPosition();
    this.deps.projector.focusOnVirtualPos(pos.y, dt, 0.05);
    // Spec 153 (D1): along X the camera follows the tackle near the screen edge, keeping the rod in view.
    this.deps.projector.followVirtualX(pos.x, this.deps.world.getRodVirtualPos(bounds).x, dt,
      this.deps.config.locations?.cameraFollowMarginX, this.deps.config.locations?.cameraFollowPriority);

    const input = envData.input || this.deps.input.getState();
    const eq = this.deps.inventory.getEquipped();

    const reelPower = eq?.reel?.effectiveStats?.basePower || 0;
    const isSpinning = this.deps.rules.equipment.isSpinning(eq);

    const effectiveInput = this.#effectiveInput;
    effectiveInput.isPulling = this.deps.castRodControl.isPulling(input);
    effectiveInput.pullDirection = input.pullDirection;
    effectiveInput.idleRetrieveParams = effectiveInput.isPulling
      ? this.#getIdleRetrieveParams(eq)
      : null;

    const hasReel = this.deps.rules.equipment?.requiresReel?.(eq) ?? true;
    const canCastAnywhere =
      this.deps.services?.devFlags?.isEnabled?.("infiniteCasting") === true;
    const maxLineLengthPx = canCastAnywhere
      ? null
      : (this.deps.rules.equipment?.getMaxCastDistance?.(
          eq, Infinity, this.getSelectedHookDepthMeters?.() ?? null,
        ) ?? null);
    const castRodMovement = this.deps.castRodControl.update({ dtMs: dt, input, bounds,
      hasTerminalLoad: eq?.hasTerminalLoad !== false,
      floatEntity: this.deps.float, waterMetric: this.deps.world.getWaterMetric(),
      checkWater: this.deps.world.checkWater, retrieving: effectiveInput.isPulling,
      hasReel, maxLineLengthPx,
    });
    effectiveInput.castRodDeltaX = this.deps.config.physics?.castRodControl?.floatTilt?.enabled === true &&
      castRodMovement.rodMoved ? castRodMovement.deltaPx : 0;

    // The tackle drifts, retrieves and sinks on the water metric's ground plane (see GroundPlaneScope).
    const groundPlane = this.#groundPlane;
    const plane = groundPlane.enter({
      metric: this.deps.world.getWaterMetric(),
      entity: this.deps.float,
      bounds,
      checkWater: (vx, vy) => this.deps.world.checkWater(vx, vy),
    });
    try {
      let pullDirection = null;
      if (effectiveInput.isPulling) {
        const rodPos = groundPlane.point(0, this.deps.world.getRodVirtualPos(bounds));
        pullDirection = this.#pullDirection
          .set(rodPos.x - pos.x, rodPos.y - pos.y)
          .normalize();
      }

      this.deps.getLiveBaitMotion?.()?.update(dt, this.deps.float);

      this.deps.float.update(
        plane.bounds,
        dt,
        envData.env,
        plane.checkWater,
        effectiveInput,
        reelPower,
        pullDirection,
      );
      this.constrainTackleToLine(groundPlane, bounds, eq, plane.checkWater);
    } finally {
      groundPlane.exit();
    }

    // TK-263 (G-131): tackle without a fish stays in the water even in the landing zone; only the player's double click
    // (handleInput) takes it out.

    const baitCandidates = this.#baitCandidates;
    baitCandidates.length = 0;

    this.deps.fishing.collectAvailableBaits(
      eq,
      this.deps.eatenBaits,
      baitCandidates,
    );
    this.deps.liveBaitCandidate?.appendIfHooked(eq, baitCandidates);

    const biteEnv = this.deps.world.getBiteEnv();

    let hooked = this.deps.biteSystem.evaluateBite(dt, biteEnv, {
      hookSize:
        eq?.hooks?.[0]?.effectiveStats?.hookSizeGrade ||
        eq?.baits?.[0]?.effectiveStats?.hookSizeGrade ||
        1,
      baitCandidates,
      exposureMs: this.#castExposureResolver.resolve({
        nowMs: this.deps.clock.now,
        castStartTimeMs: this.deps.getCastStartTime(),
        timeScale: this.deps.config.debug?.timeScale || 1,
      }),
      isPulling: effectiveInput.isPulling,
      castRodFloatMoving: castRodMovement.floatMoved,
      isSpinning,
    });

    // DEV balance tools may replace the naturally hooked fish (Fixed Catch); production composes none.
    if (this.deps.hookedFishOverride) {
      hooked = this.deps.hookedFishOverride.apply({ hooked, baitCandidates, biteEnv });
    }

    if (hooked) {
      const liveBaitFishId = this.deps.liveBaitCandidate?.fishIdForBite(hooked);
      if (liveBaitFishId) hooked.liveBaitFishId = liveBaitFishId;
      this.deps.float.startBite(effectiveInput.isPulling, hooked.biteSequence);
      this.deps.commands.setState("biting", { fish: hooked });
    }
  }

  getRenderState(target, bounds) {
    target.stateName = "waiting";
    target.fishing.visible = true;
    target.fishing.state = "waiting";
    target.fishing.bottom = bounds.bottom;
    target.fishing.startTime = this.deps.getCastStartTime();
  }

  #getIdleRetrieveParams(eq) {
    const policy = this.#idleRetrievePolicyResolver.resolve({
      rod: eq?.rod,
      reel: eq?.reel,
    });
    return policy.getRetrieveParams({
      rod: eq?.rod,
      reel: eq?.reel,
      config: this.deps.config,
    });
  }
}

import { CastPowerAim } from "../casting/cast_power_aim.js";
import { FishingCastExposureResolver } from "../../domain/fishing/fishing_cast_exposure_resolver.js";
import { GameState } from "./game_state.js";
import { IdleRetrievePolicyResolver } from "../../domain/fishing/idle_retrieve_policy_resolver.js";
import { LandingPolicyResolver } from "../../domain/fishing/landing_policy_resolver.js";
import { Vector2 } from "../../../engine/math/vector2.js";

export class WaitingState extends GameState {
  /** @param {WaitingStateDeps} deps */
  constructor(deps) {
    super(deps);
    this.#recastAim = new CastPowerAim({
      config: deps.config,
      projector: deps.projector,
      getViewportSize: deps.getViewportSize,
      panViewport: deps.commands.panViewport,
      rng: deps.rng,
    });
    this.#landingPolicyResolver = new LandingPolicyResolver();
    this.#idleRetrievePolicyResolver = new IdleRetrievePolicyResolver();
    this.#castExposureResolver = new FishingCastExposureResolver();
  }

  #effectiveInput = {
    isPulling: false,
    pullDirection: null,
    idleRetrieveParams: null,
  };
  #pullDirection = new Vector2(0, 0);
  #baitCandidates = [];
  #recastAim;
  #landingPolicyResolver;
  #idleRetrievePolicyResolver;
  #castExposureResolver;
  #isRecastAiming = false;
  #pendingRecast = null;

  enter() {
    this.deps.biteSystem.reset();
    this.#resetRecastAim();
  }

  exit() {
    this.#resetRecastAim();
  }

  handleInput(input) {
    if (input.isDoubleClick) {
      this.deps.commands.setState("scouting");
      this.#resetRecastAim();
      return;
    }

    const eq = this.deps.inventory.getEquipped();

    if (input.longPressPos && this.deps.canPlayerCast()) {
      if (this.#usePowerCasting()) {
        this.#isRecastAiming = true;
        input.longPressPos = null;
        return;
      }

      this.#legacyRecast(input.longPressPos, eq);
      input.longPressPos = null;
    }
  }

  update(dt, bounds, envData) {
    const pos = this.deps.float.getPosition();
    this.deps.projector.focusOnVirtualPos(pos.y, dt, 0.05);

    const input = envData.input || this.deps.input.getState();
    const eq = this.deps.inventory.getEquipped();
    this.#updatePowerRecast(dt, bounds, input, eq);

    const reelPower = eq?.reel?.effectiveStats?.basePower || 0;
    const isSpinning = this.deps.rules.equipment.isSpinning(eq);

    const effectiveInput = this.#effectiveInput;
    effectiveInput.isPulling = this.#isRecastAiming ? false : input.isPulling;
    effectiveInput.pullDirection = input.pullDirection;
    effectiveInput.idleRetrieveParams = effectiveInput.isPulling
      ? this.#getIdleRetrieveParams(eq)
      : null;

    let pullDirection = null;
    if (effectiveInput.isPulling) {
      const rodPos = this.deps.world.getRodVirtualPos(bounds);
      pullDirection = this.#pullDirection
        .set(rodPos.x - pos.x, rodPos.y - pos.y)
        .normalize();
    }

    this.deps.float.update(
      bounds,
      dt,
      envData.env,
      (vx, vy) => this.deps.world.checkWater(vx, vy),
      effectiveInput,
      reelPower,
      pullDirection,
    );

    const updatedPos = this.deps.float.getPosition();

    if (this.#isEmptyTackleLandingComplete(updatedPos, bounds, eq, isSpinning)) {
      this.deps.commands.setState("scouting");
      return;
    }

    const baitCandidates = this.#baitCandidates;
    baitCandidates.length = 0;

    this.deps.fishing.collectAvailableBaits(
      eq,
      this.deps.eatenBaits,
      baitCandidates,
    );

    const biteEnv =
      typeof this.deps.world.getBiteEnv === "function"
        ? this.deps.world.getBiteEnv()
        : envData.biteEnv;

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
    });

    if (hooked && this.deps.config.debug?.fixedCatch?.enabled) {
      const fixed = this.deps.config.debug.fixedCatch;
      const template =
        this.deps.config.spawns.fishes.find((f) => f.id === fixed.fishId) ||
        this.deps.config.spawns.fishes[0];

      const chosenSequence = this.deps.rules.bite.selectBiteSequence(
        template,
        baitCandidates.map((bait) => bait.variant || bait.itemType),
      );
      if (chosenSequence != null) {
        hooked = this.deps.fixedCatchFishFactory.create({
          template,
          weightKg: fixed.weight,
          biteSequence: chosenSequence,
          anomalyChanceOverride: this.deps.services.devFlags.isEnabled(
            "forceAnomalyChance",
          )
            ? 1
            : null,
          locationId: biteEnv?.locationId || "",
        });
      }
    }

    if (hooked) {
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
    const visual = this.#recastAim.getVisualState();
    if (visual) {
      const eq = this.deps.inventory.getEquipped();
      const maxDistance = this.getEffectiveCastDistance(eq);
      this.#populateRecastAccuracyPreview(target, bounds);
      target.casting.visible = true;
      target.casting.powerVisible = true;
      target.casting.visual = visual;
      target.casting.bounds = bounds;
      target.casting.maxDistance = maxDistance;
      target.casting.nowMs = this.deps.clock.now;
    }
  }

  #updatePowerRecast(dt, bounds, input, eq) {
    if (this.#pendingRecast) {
      this.#pendingRecast.timer -= dt;
      if (this.#pendingRecast.timer <= 0) {
        this.#commitPendingRecast();
      }
      return;
    }

    if (!this.#isRecastAiming) return;

    const release = this.#recastAim.update(input, bounds, dt, { mode: "rod" });
    if (!release) return;

    if (this.#isCancelledRelease(release)) {
      this.#resetRecastAim();
      this.deps.commands.setState("scouting");
      return;
    }

    const target = this.resolveCastTarget(this.#recastAim, release, bounds, eq);

    this.#isRecastAiming = false;

    if (!target?.success) {
      this.deps.commands.setInvalidCastMarker({
        x: release.screenX,
        y: release.screenY,
        timer: 500,
      });
      return;
    }

    this.#pendingRecast = {
      timer: target.travelDelayMs,
      x: target.x,
      y: target.y,
      depth: target.depth,
      originVirtualX: target.originVirtualX,
      originVirtualY: target.originVirtualY,
      rodScreenX: target.rodScreenX,
    };
  }

  #commitPendingRecast() {
    const cast = this.#pendingRecast;
    if (!cast) return;
    this.#pendingRecast = null;
    this.deps.castPenalty.registerCast(this.deps.clock.now);
    this.deps.commands.castLine(cast.x, cast.y, cast.depth, {
      rodVirtualPos: {
        x: cast.originVirtualX,
        y: cast.originVirtualY,
      },
      rodScreenX: cast.rodScreenX,
    });
  }

  #legacyRecast(screenPos, eq) {
    const vPos = this.deps.projector.screenToVirtual(screenPos.x, screenPos.y);
    const cell = this.deps.world.checkWater(vPos.x, vPos.y);
    const bounds = this.deps.world.getDynamicBounds();

    const isInside = this.deps.rules.cast.canCastAt(
      vPos.x,
      vPos.y,
      eq,
      bounds,
      this.deps.world.getRodVirtualPos(bounds),
    );

    if (cell && isInside) {
      this.deps.castPenalty.registerCast(this.deps.clock.now);
      this.deps.commands.castLine(vPos.x, vPos.y, cell.depth);
      return;
    }

    this.deps.commands.setInvalidCastMarker({
      x: screenPos.x,
      y: screenPos.y,
      timer: 500,
    });
  }

  #resetRecastAim() {
    this.#isRecastAiming = false;
    this.#pendingRecast = null;
    this.#recastAim?.reset();
  }

  #usePowerCasting() {
    return this.deps.config.casting?.enabled !== false;
  }

  #isCancelledRelease(release) {
    const threshold = this.deps.config.casting?.cancelPowerThreshold ?? 0;
    return release.power <= threshold;
  }

  #isEmptyTackleLandingComplete(position, bounds, eq, isSpinning) {
    const landingDistanceMeters = this.#getLandingDistanceMeters(eq);
    if (landingDistanceMeters <= 0) return false;

    const rodPos = this.deps.world.getRodVirtualPos(bounds);
    const pixelsPerMeter =
      Math.max(
        1,
        Number(this.deps.config.fightPhysicsConfig?.getPixelsPerMeter?.()) ||
          50,
      );
    const distanceMeters =
      Math.hypot(position.x - rodPos.x, position.y - rodPos.y) / pixelsPerMeter;

    if (distanceMeters <= landingDistanceMeters + 0.001) return true;

    if (!isSpinning) return false;

    return position.y >= bounds.bottom;
  }

  #getLandingDistanceMeters(eq) {
    const policy = this.#landingPolicyResolver.resolve({
      rod: eq?.rod,
      reel: eq?.reel,
    });
    return policy.getLandingDistanceMeters({
      rod: eq?.rod,
      reel: eq?.reel,
      config: this.deps.config,
    });
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

  #populateRecastAccuracyPreview(target, bounds) {
    if (!this.deps.config.debug?.casting?.showAccuracyArea) return;
    const eq = this.deps.inventory.getEquipped();
    const maxDistance = this.getEffectiveCastDistance(eq);
    const accuracyPx = this.getRodAccuracyPx(eq);
    const preview = this.#recastAim.getAccuracyPreview(
      bounds,
      maxDistance,
      accuracyPx,
      this.getRodAccuracyPercent(eq),
      this.getRodAccuracyMultiplier(eq),
    );
    target.casting.accuracyPreview = preview;
  }
}

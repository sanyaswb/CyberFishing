import { CastPowerAim } from "../casting/cast_power_aim.js";
import { GameState } from "./game_state.js";

export class ScoutingState extends GameState {
  #castAim;
  #pendingCast = null;
  #missingRodWarnedForPress = false;
  #missingReelWarnedForPress = false;
  #missingLineWarnedForPress = false;
  #isUiDimmed = false;

  /** @param {ScoutingStateDeps} deps */
  constructor(deps) {
    super(deps);
    this.#castAim = new CastPowerAim({
      config: deps.config,
      projector: deps.projector,
      getViewportSize: deps.getViewportSize,
      panViewport: deps.commands.panViewport,
      rng: deps.rng,
    });
  }

  enter() {
    const eq = this.deps.inventory.getEquipped();
    const hasNet = !!eq.net;
    this.deps.ui.updateNetButtonState(hasNet, false);
    this.#pendingCast = null;
    this.#missingRodWarnedForPress = false;
    this.#missingReelWarnedForPress = false;
    this.#missingLineWarnedForPress = false;
    this.#castAim.reset();
    this.#setUiDimmed(false);
  }

  exit() {
    this.deps.depthUI.hide();
    this.#castAim.reset();
    this.#pendingCast = null;
    this.#missingRodWarnedForPress = false;
    this.#missingReelWarnedForPress = false;
    this.#missingLineWarnedForPress = false;
    this.#setUiDimmed(false);
  }

  handleInput(input) {
    if (this.#usePowerCasting()) return;

    if (input.clickPos) {
      const eq = this.deps.inventory.getEquipped();
      if (!this.#canStartRodCast(eq)) {
        if (!eq?.rod) {
          this.deps.commands.showMissingRodInventoryWarning?.();
        } else if (
          this.deps.rules.equipment.requiresReel(eq) &&
          !eq?.reel
        ) {
          this.deps.commands.showMissingReelInventoryWarning?.();
        } else {
          this.deps.commands.showMissingLineInventoryWarning?.();
        }
        return;
      }

      const vPos = this.deps.projector.screenToVirtual(
        input.clickPos.x,
        input.clickPos.y,
      );
      let cell = this.deps.world.checkWater(vPos.x, vPos.y);
      const bounds = this.deps.world.getDynamicBounds();

      const canCastAnywhere =
        this.deps.services.devFlags.isEnabled("infiniteCasting");

      if (canCastAnywhere) {
        if (!cell) cell = { depth: 2.0 };
      }

      let isInside = true;
      if (!canCastAnywhere) {
        isInside = this.deps.rules.cast.canCastAt(
          vPos.x,
          vPos.y,
          eq,
          bounds,
          this.deps.world.getRodVirtualPos(bounds),
          this.getSelectedHookDepthMeters(),
        );
      }

      if ((cell && isInside) || canCastAnywhere) {
        this.deps.commands.castLine(vPos.x, vPos.y, cell.depth);
      } else {
        this.deps.commands.markInvalidCast(input.clickPos);
      }
    }
  }

  update(dt, bounds, context) {
    this.deps.projector.focusOnVirtualPos(bounds.bottom - 200, dt, 0.03);

    if (!this.deps.isAimingChum() && this.#usePowerCasting()) {
      const didCast = this.#updatePowerCasting(dt, bounds, context?.input);
      if (didCast) return;
    }

    const eq = this.deps.inventory.getEquipped();
    const canSelectDepth = this.deps.rules.equipment.canSelectDepth(eq);

    if (!this.deps.canPlayerCast() || !canSelectDepth) {
      if (this.deps.depthUI.isActive) {
        this.deps.depthUI.hide();
      }
      this.deps.currentHookDepthRef.set(
        this.deps.config.fightPhysicsConfig?.getLureRetrieveConfig?.()
          ?.defaultSurfaceDepthMeters ??
          0.1,
      );
      return;
    }

    const maxDepth = this.deps.getMaxHookDepth();

    if (!this.deps.depthUI.isActive) {
      this.deps.depthUI.show(
        maxDepth,
        Math.min(this.deps.currentHookDepthRef.get(), maxDepth),
        (d) => {
          this.deps.currentHookDepthRef.set(d);
          this.#syncDepthCastDistance(eq, bounds);
        },
      );
    } else {
      this.deps.depthUI.updateMax(maxDepth);
    }
    this.#syncDepthCastDistance(eq, bounds);
  }

  getRenderState(target, bounds) {
    target.stateName = "scouting";
    if (this.#usePowerCasting()) {
      if (!this.deps.isAimingChum()) {
        const visual = this.#castAim.getVisualState();
        if (visual) {
          const eq = this.deps.inventory.getEquipped();
          const maxDistance = this.getEffectiveCastDistance(eq);
          this.#populateAccuracyPreview(
            target,
            bounds,
            this.#castAim,
            visual,
          );
          this.#populatePowerAim(target, bounds, visual, maxDistance);
        }
      }
      return;
    }

    if (!this.deps.isAimingChum()) {
      if (this.deps.config.locations?.showAimingZone !== false) {
        const eq = this.deps.inventory.getEquipped();
        let maxDist = this.getEffectiveCastDistance(eq);

        if (maxDist !== Infinity) {
          maxDist = Math.min(maxDist, bounds.bottom - bounds.top);
          this.#populateAimingZone(
            target,
            bounds.bottom,
            maxDist,
            "rod",
          );
        }
      }
    } else {
      const eq = this.deps.inventory.getEquipped();
      const method = eq.delivery ? "boat" : "hand";

      if (
        method === "hand" &&
        this.deps.config.locations?.showAimingZone !== false
      ) {
        this.#populateAimingZone(
          target,
          bounds.bottom,
          this.deps.getChumCastDistance(),
          "chum",
        );
      }
    }
  }

  #updatePowerCasting(dt, bounds, input) {
    const wantsRodAim = !!(input?.pointerDown || input?.isPulling);

    if (!wantsRodAim) {
      this.#missingRodWarnedForPress = false;
      this.#missingReelWarnedForPress = false;
      this.#missingLineWarnedForPress = false;
    }

    const eq = this.deps.inventory.getEquipped();
    if (wantsRodAim && !this.#canStartRodCast(eq)) {
      this.#castAim.reset();
      this.#pendingCast = null;
      this.#setUiDimmed(false);
      if (!eq?.rod && !this.#missingRodWarnedForPress) {
        this.deps.commands.showMissingRodInventoryWarning?.();
        this.#missingRodWarnedForPress = true;
      } else if (
        eq?.rod &&
        this.deps.rules.equipment.requiresReel(eq) &&
        !eq?.reel &&
        !this.#missingReelWarnedForPress
      ) {
        this.deps.commands.showMissingReelInventoryWarning?.();
        this.#missingReelWarnedForPress = true;
      } else if (
        eq?.rod &&
        !this.deps.rules.equipment.hasEquippedLine(eq) &&
        !this.#missingLineWarnedForPress
      ) {
        this.deps.commands.showMissingLineInventoryWarning?.();
        this.#missingLineWarnedForPress = true;
      }
      return false;
    }

    if (this.#pendingCast) {
      this.#setUiDimmed(false);
      this.#pendingCast.timer -= dt;
      if (this.#pendingCast.timer <= 0) {
        this.#commitPendingCast();
        return true;
      }
      return false;
    }

    const release = this.#castAim.update(input, bounds, dt, { mode: "rod" });
    this.#setUiDimmed(!!this.#castAim.getVisualState());
    if (!release) return false;
    this.#setUiDimmed(false);

    if (this.#isCancelledRelease(release)) {
      this.#castAim.reset();
      this.#pendingCast = null;
      this.deps.commands.setState("scouting");
      return true;
    }

    const target = this.resolveCastTarget(this.#castAim, release, bounds, eq);

    if (!target?.success) {
      this.deps.commands.markInvalidCast({
        x: release.screenX,
        y: release.screenY,
      });
      return false;
    }

    this.#pendingCast = {
      timer: target.travelDelayMs,
      x: target.x,
      y: target.y,
      depth: target.depth,
      originVirtualX: target.originVirtualX,
      originVirtualY: target.originVirtualY,
      rodScreenX: target.rodScreenX,
    };
    return false;
  }

  #commitPendingCast() {
    const cast = this.#pendingCast;
    if (!cast) return;
    this.#pendingCast = null;
    this.deps.commands.castLine(cast.x, cast.y, cast.depth, {
      rodVirtualPos: {
        x: cast.originVirtualX,
        y: cast.originVirtualY,
      },
      rodScreenX: cast.rodScreenX,
    });
  }

  #usePowerCasting() {
    return this.deps.config.casting?.enabled !== false;
  }

  #canStartRodCast(eq) {
    const readiness = this.deps.inventory.evaluateCastReadiness?.(eq);
    if (typeof readiness?.canCast === "boolean") return readiness.canCast;
    if (!eq?.rod) return false;
    if (this.deps.rules.equipment.requiresReel(eq) && !eq.reel) return false;
    return this.deps.rules.equipment.hasEquippedLine(eq);
  }

  #isCancelledRelease(release) {
    const threshold = this.deps.config.casting?.cancelPowerThreshold ?? 0;
    return release.power <= threshold;
  }

  #setUiDimmed(isDimmed) {
    if (this.#isUiDimmed === isDimmed) return;

    this.#isUiDimmed = isDimmed;
    // The page-level pointer feedback (body classes) belongs to the UI.
    this.deps.ui.setScoutingPointerDimmed(isDimmed);
  }

  #populateAccuracyPreview(target, bounds, aim, visual) {
    if (!this.deps.config.debug?.casting?.showAccuracyArea) return;
    const eq = this.deps.inventory.getEquipped();
    const maxDistance = this.getEffectiveCastDistance(eq);
    const accuracyPx = this.getRodAccuracyPx(eq);
    const preview = aim.getAccuracyPreview(
      bounds,
      maxDistance,
      accuracyPx,
      this.getRodAccuracyPercent(eq),
      this.getRodAccuracyMultiplier(eq),
    );
    target.casting.accuracyPreview = preview;
  }

  #populatePowerAim(target, bounds, visual, maxDistance) {
    target.casting.visible = true;
    target.casting.powerVisible = true;
    target.casting.visual = visual;
    target.casting.bounds = bounds;
    target.casting.maxDistance = maxDistance;
    target.casting.nowMs = this.deps.clock.now;
  }

  #syncDepthCastDistance(eq, bounds) {
    if (!this.deps.depthUI?.isActive) return;

    const info = this.deps.rules.equipment.getCastDistanceInfo(
      eq,
      1,
      this.getSelectedHookDepthMeters(),
    );
    const pixelsPerMeter = Math.max(1, Number(info.pixelsPerMeter) || 1);
    const locationLimitPx = Math.max(0, bounds.bottom - bounds.top);
    const availablePx = Math.min(info.maxDistancePx, locationLimitPx);
    const fullLinePx = Math.min(
      info.lineLengthMeters * pixelsPerMeter,
      locationLimitPx,
    );

    this.deps.depthUI.updateCastDistance?.({
      availableMeters: availablePx / pixelsPerMeter,
      maximumMeters: fullLinePx / pixelsPerMeter,
      visible: info.isFloatDepthLimited,
    });
  }

  #populateAimingZone(target, bottom, maxDistance, mode) {
    target.casting.visible = true;
    target.casting.zoneVisible = true;
    target.casting.virtualBottomY = bottom;
    target.casting.maxDistance = maxDistance;
    target.casting.mode = mode;
  }
}

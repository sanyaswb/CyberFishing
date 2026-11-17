import { CastPowerAim } from "../casting/cast_power_aim.js";
import { GameState } from "./game_state.js";
import { defaultHookDepthMeters } from "../../domain/fishing/default_hook_depth.js";

export class ScoutingState extends GameState {
  #castAim;
  #pendingCast = null;
  #missingRodWarnedForPress = false;
  #missingReelWarnedForPress = false;
  #missingLineWarnedForPress = false;
  #gasMaskWarnedForPress = false;
  #isUiDimmed = false;
  // TK-366.1: a touch tap without an aim has just armed one; if that tap becomes a double tap, the aim is removed and
  // the camera goes to the map's edge on the tapped side (a double tap moves the view before aiming, not during it).
  #aimArmedByTap = false;

  /** @param {ScoutingStateDeps} deps */
  constructor(deps) {
    super(deps);
    this.#castAim = new CastPowerAim({
      config: deps.config,
      projector: deps.projector,
      getWaterMetric: deps.world.getWaterMetric,
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
    this.#aimArmedByTap = false;
    this.#setUiDimmed(false);
  }

  // Spec 183 D2: a touch aim waits between touches; while it does, a touch aims (the map does not scroll).
  isTouchAimArmed() {
    return this.#castAim.isArmed;
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
      if (this.deps.castGate.isBlocked()) {
        this.deps.commands.showGasMaskRequiredWarning();
        return;
      }
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
      const cell = this.deps.world.checkWater(vPos.x, vPos.y);
      const bounds = this.deps.world.getDynamicBounds();

      // TK-362.2: God mode infiniteCasting lifts only the distance limit; the point must be on the castable water.
      const canCastAnywhere =
        this.deps.services.devFlags.isEnabled("infiniteCasting");

      let isInside = true;
      if (!canCastAnywhere) {
        isInside = this.deps.rules.cast.canCastAt(
          vPos.x,
          vPos.y,
          eq,
          this.deps.world.getWaterMetric(),
          this.deps.world.getRodVirtualPos(bounds),
          this.getSelectedHookDepthMeters(),
        );
      }

      if (cell && isInside) {
        const depth = this.deps.world.getDepthAt?.(vPos.x, vPos.y) ?? cell.depth;
        this.deps.commands.castLine(vPos.x, vPos.y, depth);
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
    } else if (this.#castAim.isArmed) {
      // Spec 183 D2: aiming the chum ends a waiting rod aim.
      this.#castAim.reset();
      this.#setUiDimmed(false);
    }

    const eq = this.deps.inventory.getEquipped();
    const canSelectDepth = this.deps.rules.equipment.canSelectDepth(eq);

    const depthRef = this.deps.currentHookDepthRef;
    if (!this.deps.canPlayerCast() || !canSelectDepth) {
      if (this.deps.depthUI.isActive) {
        this.deps.depthUI.hide();
      }
      depthRef.set(
        this.deps.config.fightPhysicsConfig?.getLureRetrieveConfig?.()
          ?.defaultSurfaceDepthMeters ??
          0.1,
      );
      // Without a depth to choose, a later float starts from its own default again.
      depthRef.clearChoice();
      return;
    }

    // TK-192 / TK-192.1: until the player sets a depth it is half the current tackle's deepest depth (it follows a tackle
    // change); a chosen depth is kept, only inside the tackle's range. TK-192 marked "not chosen" with the value 0.1, which
    // is also the shallowest depth a player can choose, so a chosen 0.1 m became half the range on the next frame.
    const maxDepth = this.deps.getMaxHookDepth();
    let currentDepth = depthRef.get();
    const chosen = depthRef.isChosen() === true;
    if (!chosen || !Number.isFinite(currentDepth) || currentDepth <= 0) {
      const fallback = defaultHookDepthMeters(maxDepth);
      if (currentDepth !== fallback) {
        currentDepth = fallback;
        depthRef.set(currentDepth);
        if (this.deps.depthUI.isActive) this.deps.depthUI.setValue?.(currentDepth);
      }
    } else if (currentDepth > maxDepth) {
      currentDepth = maxDepth;
      depthRef.set(currentDepth);
    }

    if (!this.deps.depthUI.isActive) {
      this.deps.depthUI.show(
        maxDepth,
        currentDepth,
        // The player's move on the track chooses the depth; a clamp to a lower maximum does not.
        (d, change) => (change?.byPlayer === false ? depthRef.set(d) : depthRef.choose(d)),
      );
    } else {
      this.deps.depthUI.updateMax(maxDepth);
    }
    // The button shows the equipped float (or the jig on a spinning rod).
    this.deps.depthUI.setIcon(eq?.float || eq?.baits?.[0] || "");
  }

  getRenderState(target, bounds) {
    target.stateName = "scouting";
    if (this.deps.depthUI.isOpen && !this.deps.isAimingChum()) {
      this.#populateDepthCastLimit(target);
    }
    if (this.#usePowerCasting()) {
      if (!this.deps.isAimingChum()) this.populateRodCast(target, bounds, this.#castAim, this.#pendingCast !== null);
      return;
    }

    if (!this.deps.isAimingChum()) {
      if (this.deps.config.locations?.showAimingZone !== false) {
        const eq = this.deps.inventory.getEquipped();
        let maxDist = this.getEffectiveCastDistance(eq);

        if (maxDist !== Infinity) {
          maxDist = Math.min(maxDist, this.deps.world.getWaterMetric().topBasePixels);
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
      this.#gasMaskWarnedForPress = false;
    }

    const eq = this.deps.inventory.getEquipped();
    const wantsCast = wantsRodAim || input?.clickPos || input?.isDoubleClick;
    // Spec 179 stage E: during an emission a cast needs a gas mask; the game goes on, the press warns once.
    if (wantsCast && this.deps.castGate.isBlocked()) {
      this.#castAim.reset();
      this.#pendingCast = null;
      this.#setUiDimmed(false);
      if (!input?.clickPos && !input?.isDoubleClick && !input?.isPulling) return false;
      if (!this.#gasMaskWarnedForPress) {
        this.deps.commands.showGasMaskRequiredWarning();
        this.#gasMaskWarnedForPress = true;
      }
      return false;
    }
    if (wantsCast && !this.#canStartRodCast(eq)) {
      this.#castAim.reset();
      this.#pendingCast = null;
      this.#setUiDimmed(false);
      // A bare pointer press may still become map navigation. Warn only once
      // the pointer completes a click, or keyboard casting is requested.
      if (!input?.clickPos && !input?.isDoubleClick && !input?.isPulling) return false;
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

    if (this.#castAim.isArmed && !this.#canStartRodCast(eq)) {
      this.#castAim.reset();
      this.#setUiDimmed(false);
    }

    // TK-366.1: a double tap that began without an aim (its first tap armed one) removes that aim and jumps the camera
    // to the map's edge on the tapped side.
    if (input?.isDoubleClick && input.pointerType === "touch" && this.#aimArmedByTap) {
      this.#aimArmedByTap = false;
      this.#jumpToMapEdge(input.pointerRelease.x);
      return false;
    }

    // Spec 183 D1: a touch tap on the map (a scroll candidate that did not move) arms the aim at the tap; a double tap
    // never does. The aim then waits for a touch that sets its direction and power.
    if (input?.clickPos && input.pointerType === "touch" && input.pointerPanning && !this.#castAim.isArmed &&
      !this.#pendingCast) {
      this.#castAim.arm(input.clickPos.x);
      this.#aimArmedByTap = true;
      this.#setUiDimmed(true);
      return false;
    }

    // Keep a navigation gesture from becoming a cast if equipment changes mid-drag.
    if (input?.pointerPanning) return false;

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
    this.#aimArmedByTap = false;
    this.#setUiDimmed(false);

    // TK-365.1: a touch tap while aiming removes the aim (D2) whatever power it shows (a full-power aim, TK-365).
    const touchTap = input?.pointerType === "touch" && !!(input.clickPos || input.isDoubleClick);
    if (touchTap || this.#isCancelledRelease(release)) {
      // Spec 183 D2: a touch aim that ended at power 0 after a move keeps waiting; a tap removes it.
      if (input?.pointerType === "touch" && !touchTap) {
        this.#castAim.arm(release.screenX);
        this.#setUiDimmed(true);
        return false;
      }
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

  // TK-366.1: the camera goes at once to the map's left (x in the screen's left half) or right edge; no aim. The pan is
  // clamped by the camera, so a map's width in screen pixels always reaches the edge.
  #jumpToMapEdge(screenX) {
    const width = Math.max(1, Number(this.deps.getViewportSize()?.width) || 1);
    const mapWidthPx = Number(this.deps.config.locations.baseResolution.width) * this.deps.projector.getScale();
    this.deps.commands.panViewport((screenX < width / 2 ? -1 : 1) * mapWidthPx);
    this.#castAim.reset();
    this.#setUiDimmed(false);
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

  // While the depth track is open: the farthest reachable cast at the selected depth (the same limit a full-power
  // cast uses), bounded by the location, for the cast limit line on the map.
  #populateDepthCastLimit(target) {
    const eq = this.deps.inventory.getEquipped();
    const maxDistance = this.getEffectiveCastDistance(eq);
    if (!Number.isFinite(maxDistance)) return;
    const info = this.deps.rules.equipment.getCastDistanceInfo(eq, null, this.getSelectedHookDepthMeters());
    const pixelsPerMeter = Math.max(1, Number(info.pixelsPerMeter) || 1);
    const limit = target.casting.depthLimit;
    target.casting.visible = true;
    limit.visible = true;
    limit.maxDistance = Math.min(maxDistance, Math.max(0, this.deps.world.getWaterMetric().topBasePixels));
    limit.meters = maxDistance / pixelsPerMeter;
    limit.nowMs = this.deps.clock.realNow;
  }

  #populateAimingZone(target, bottom, maxDistance, mode) {
    target.casting.visible = true;
    target.casting.zoneVisible = true;
    target.casting.virtualBottomY = bottom;
    target.casting.maxDistance = maxDistance;
    target.casting.mode = mode;
  }
}

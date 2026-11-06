import { Vector2 } from "../../../engine/math/vector2.js";
import { clampFinite, clampUnitFinite, nonNegativeOr } from "../../../engine/math/number_normalization.js";
import { CastRodBitePolicy } from "../../domain/fishing/cast_rod_bite_policy.js";
import { CastRodLineConstraint } from "../../domain/fishing/cast_rod_line_constraint.js";

// Owns the cast rod position from cast to strike/retrieval. Presentation only reads getScreenX().
export class CastRodControl {
  #config;
  #projector;
  #canvasMetrics;
  #getBaseRodVirtualPos;
  #bitePolicy = new CastRodBitePolicy();
  #lineConstraint = new CastRodLineConstraint();
  #entity = null;
  #lineLengthPx = 0;
  #screenX = null;
  #base = new Vector2();
  #edge = new Vector2();
  #previousRod = new Vector2();
  #nextRod = new Vector2();
  #position = new Vector2();
  #candidate = new Vector2();
  #mapCandidate = new Vector2();
  #frame = { rodMoved: false, deltaPx: 0, floatMoved: false, floatMoveMeters: 0, retrieving: false, lineTensionActive: false };

  constructor({ config, projector, canvasMetrics, getBaseRodVirtualPos }) {
    this.#config = config;
    this.#projector = projector;
    this.#canvasMetrics = canvasMetrics;
    this.#getBaseRodVirtualPos = getBaseRodVirtualPos;
  }

  getScreenX() { return this.#screenX; }
  getFrame() { return this.#frame; }

  // A stage/camera resize changes screen coordinates without becoming a player's rod-motion action.
  setViewportScreenX(screenX) {
    if (Number.isFinite(screenX)) this.#screenX = screenX;
    this.#clearFrame();
  }

  reset() {
    this.#entity = null;
    this.#screenX = null;
    this.#lineLengthPx = 0;
    this.#clearFrame();
  }

  isLateralInput(input) {
    const action = input?.fightActions?.lateralControl;
    return this.#settings()?.enabled === true && (action
      ? action.active && action.directionX !== 0 && action.inputRatio > 0
      : input?.rodControlActive && input.rodControlDirectionX !== 0 && input.rodControlInputRatio > 0);
  }

  isPulling(input) {
    // Horizontal touch already represents rod movement. Its hold timer must not also retrieve or strike.
    if (this.#settings()?.enabled === true && input?.pointerAction === "rod_control_x") {
      return input.fightActions?.raw?.spaceDown === true || input.keys?.Space === true;
    }
    return input?.isPulling === true;
  }

  resolveBiteResponse(isGuaranteed) {
    return this.#bitePolicy.resolveResponse({
      rodMoved: this.#frame.rodMoved, isGuaranteed, config: this.#settings(),
    });
  }

  update({ dtMs, input, bounds, floatEntity, waterMetric, checkWater, retrieving = false, aiming = false, hasTerminalLoad = true }) {
    this.#clearFrame();
    const cfg = this.#settings();
    if (cfg?.enabled !== true || !floatEntity || !bounds) { this.reset(); return this.#frame; }
    this.#frame.retrieving = retrieving;
    const base = this.#getBaseRodVirtualPos(bounds);
    this.#projector.virtualToScreen(base.x, base.y, this.#base);
    const padding = nonNegativeOr(cfg.range.edgePaddingPx);
    const width = Math.max(1, this.#canvasMetrics.width);
    this.#projector.virtualToScreen(bounds.left, bounds.bottom, this.#edge);
    const greenLeft = clampFinite(this.#edge.x + padding, 0, width);
    this.#projector.virtualToScreen(bounds.right, bounds.bottom, this.#edge);
    const greenRight = Math.max(greenLeft, clampFinite(this.#edge.x - padding, 0, width));
    const baseX = clampFinite(this.#base.x, greenLeft, greenRight);
    const left = baseX - (baseX - greenLeft) * clampUnitFinite(cfg.range.leftRatio);
    const right = baseX + (greenRight - baseX) * clampUnitFinite(cfg.range.rightRatio);
    if (this.#entity !== floatEntity) {
      this.#entity = floatEntity;
      this.#screenX = baseX;
      this.#rodPlane(this.#screenX, bounds, waterMetric, this.#previousRod);
      waterMetric.toBasePlane(floatEntity.getPosition().x, floatEntity.getPosition().y, this.#position);
      this.#lineLengthPx = Math.hypot(this.#position.x - this.#previousRod.x, this.#position.y - this.#previousRod.y);
    }
    const previousX = clampFinite(this.#screenX, left, right);
    this.#screenX = previousX;
    this.#rodPlane(previousX, bounds, waterMetric, this.#previousRod);
    const position = floatEntity.getPosition();
    waterMetric.toBasePlane(position.x, position.y, this.#position);
    if (retrieving) this.#lineLengthPx = Math.min(this.#lineLengthPx,
      Math.hypot(this.#position.x - this.#previousRod.x, this.#position.y - this.#previousRod.y));
    if (aiming || !this.isLateralInput(input)) return this.#frame;
    const action = input.fightActions?.lateralControl;
    const direction = Math.sign(action?.directionX ?? input.rodControlDirectionX);
    const ratio = clampUnitFinite(action?.inputRatio ?? input.rodControlInputRatio);
    const target = baseX + (direction < 0 ? left - baseX : right - baseX) * ratio;
    const dtSec = Math.min(nonNegativeOr(dtMs), this.#config.physics.simulation.maxDtMs) / 1000;
    const step = this.#resolveMovementStep({ previousX, target, dtSec, cfg, bounds, waterMetric, hasTerminalLoad });
    this.#screenX = previousX + Math.sign(target - previousX) * Math.min(Math.abs(target - previousX), step);
    this.#frame.deltaPx = this.#screenX - previousX;
    this.#frame.rodMoved = Math.abs(this.#frame.deltaPx) > nonNegativeOr(cfg.movementEpsilonPx);
    if (!this.#frame.rodMoved) this.#frame.lineTensionActive = false;
    if (!this.#frame.rodMoved || !cfg.floatDrag.enabled) return this.#frame;
    this.#rodPlane(this.#screenX, bounds, waterMetric, this.#nextRod);
    const meters = this.#projectFloatCandidate(position, bounds, waterMetric, checkWater);
    if (meters > nonNegativeOr(cfg.floatDrag.movementEpsilonMeters)) {
      position.set(this.#mapCandidate.x, this.#mapCandidate.y);
      this.#frame.floatMoved = true;
      this.#frame.floatMoveMeters = meters;
    }
    return this.#frame;
  }

  #resolveMovementStep({ previousX, target, dtSec, cfg, bounds, waterMetric, hasTerminalLoad }) {
    const speed = nonNegativeOr(cfg.speedPxPerSecond);
    const stationarySpeed = speed * nonNegativeOr(cfg.speedMultipliers?.stationaryFloat, 1);
    const movingSpeed = hasTerminalLoad ? speed * nonNegativeOr(cfg.speedMultipliers?.movingFloat, 1) : stationarySpeed;
    const distance = Math.abs(target - previousX);
    const stationaryStep = Math.min(distance, stationarySpeed * dtSec);
    if (distance === 0 || dtSec <= 0) return 0;

    // Spend this frame's time at the fast slack speed, then at the taut-line speed after slack runs out.
    this.#rodPlane(target, bounds, waterMetric, this.#nextRod);
    const freeRatio = this.#lineConstraint.freeRodMovementRatio({ position: this.#position,
      previousRod: this.#previousRod, nextRod: this.#nextRod, releasedLengthPx: this.#lineLengthPx });
    const freeDistance = distance * freeRatio;
    if (freeDistance > stationaryStep) {
      this.#frame.lineTensionActive = stationaryStep > 0 &&
        freeDistance - stationaryStep <= nonNegativeOr(cfg.movementEpsilonPx);
      return stationaryStep;
    }
    const freeTime = freeDistance > 0 ? freeDistance / stationarySpeed : 0;
    const step = Math.min(distance, freeDistance + movingSpeed * Math.max(0, dtSec - freeTime));
    this.#frame.lineTensionActive = step > 0 && step >= freeDistance;
    return step;
  }

  #projectFloatCandidate(position, bounds, waterMetric, checkWater) {
    this.#lineConstraint.project({ position: this.#position, previousRod: this.#previousRod,
      nextRod: this.#nextRod, releasedLengthPx: this.#lineLengthPx, out: this.#candidate });
    waterMetric.fromBasePlane(this.#candidate.x, this.#candidate.y, this.#mapCandidate);
    this.#mapCandidate.x = clampFinite(this.#mapCandidate.x, bounds.left, bounds.right);
    this.#mapCandidate.y = clampFinite(this.#mapCandidate.y, bounds.top, bounds.bottom);
    this.#limitToWater(position, this.#mapCandidate, checkWater);
    return waterMetric.distanceMeters(position.x, position.y, this.#mapCandidate.x, this.#mapCandidate.y);
  }

  #settings() { return this.#config.physics?.castRodControl; }

  #clearFrame() {
    this.#frame.rodMoved = false;
    this.#frame.deltaPx = 0;
    this.#frame.floatMoved = false;
    this.#frame.floatMoveMeters = 0;
    this.#frame.retrieving = false;
    this.#frame.lineTensionActive = false;
  }

  #rodPlane(screenX, bounds, metric, out) {
    this.#projector.screenToVirtual(screenX, 0, out);
    return metric.toBasePlane(out.x, bounds.bottom, out);
  }

  #limitToWater(from, to, checkWater) {
    if (!checkWater || checkWater(to.x, to.y)) return;
    if (!checkWater(from.x, from.y)) { to.set(from.x, from.y); return; }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    let low = 0;
    let high = 1;
    for (let index = 0; index < 12; index++) {
      const mid = (low + high) / 2;
      if (checkWater(from.x + dx * mid, from.y + dy * mid)) low = mid;
      else high = mid;
    }
    to.set(from.x + dx * low, from.y + dy * low);
  }
}

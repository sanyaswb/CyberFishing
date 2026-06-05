/**
 * Resolves reel drag against the fish force that remains after player hold.
 *
 * Responsibility boundary:
 * - no entity mutation;
 * - no DOM/canvas dependency;
 * - shared by escape movement and tension calculation.
 */
class DragForceCalculator {
  calculate({
    fishOppositionKg,
    effectiveRodHoldKg = 0,
    yAwayRatio = 1,
    dragRatio = 0,
    dragLimitKg = 0,
    lineHasReserve = true,
    dragLocked = false,
    dragSupported = true,
    targetXSpeedPxPerSec = 0,
    targetYSpeedPxPerSec = 0,
    waterMotionResistance = 1000,
    waterSpeedMultiplier = 64,
    fishBaseSpeed = 1,
    fishStateSpeedMultiplier = 1,
    pixelsPerMeter = 50,
  } = {}) {
    const fishWonForceKg = Math.max(
      0,
      this.#positive(fishOppositionKg) - this.#positive(effectiveRodHoldKg),
    );
    const resolvedYAwayRatio = this.#clamp01(yAwayRatio);
    const fishWonYForceKg = fishWonForceKg * resolvedYAwayRatio;
    const resolvedDragRatio = this.#clamp01(dragRatio);
    const resolvedDragLimitKg = this.#positive(dragLimitKg);
    const canSlipLine = !!lineHasReserve && !dragLocked && !!dragSupported;
    const dragHasThreshold =
      resolvedDragRatio > 0.000001 && resolvedDragLimitKg > 0.000001;
    const dragCanBeExceeded = canSlipLine && dragHasThreshold;
    const shouldSlipDrag =
      dragCanBeExceeded && fishWonYForceKg > resolvedDragLimitKg + 0.000001;

    const dragBlockedForceKg = canSlipLine
      ? dragHasThreshold
        ? Math.min(fishWonYForceKg, resolvedDragLimitKg)
        : 0
      : fishWonYForceKg;

    // Threshold drag model:
    // - open drag blocks nothing, so the full fish-won Y force can move the line;
    // - active drag blocks Y escape up to its kg limit;
    // - only force above that limit becomes Y movement;
    // - if the line cannot slip, no Y movement is allowed and all won Y force loads the line.
    const yEscapeForceKg = canSlipLine
      ? dragHasThreshold
        ? Math.max(0, fishWonYForceKg - resolvedDragLimitKg)
        : fishWonYForceKg
      : 0;
    const excessYForceKg = yEscapeForceKg;
    const excessYSpeedPxPerSec =
      this.speedFromForceKg({
        forceKg: yEscapeForceKg,
        waterMotionResistance,
        waterSpeedMultiplier,
        fishBaseSpeed,
        fishStateSpeedMultiplier,
        pixelsPerMeter,
      }) * Math.sign(Number(targetYSpeedPxPerSec) || 0);
    const dragSlowedYSpeedPxPerSec = 0;
    const hasAwayYMovement = resolvedYAwayRatio > 0.000001;
    const finalYSpeedPxPerSec = hasAwayYMovement
      ? canSlipLine
        ? excessYSpeedPxPerSec
        : 0
      : Number(targetYSpeedPxPerSec) || 0;

    return Object.freeze({
      fishWonForceKg,
      fishWonYForceKg,
      yAwayRatio: resolvedYAwayRatio,
      dragRatio: resolvedDragRatio,
      dragLimitKg: resolvedDragLimitKg,
      dragBlockedForceKg,
      excessYForceKg,
      yEscapeForceKg,
      dragSlowedYSpeedPxPerSec,
      excessYSpeedPxPerSec,
      targetXSpeedPxPerSec: Number(targetXSpeedPxPerSec) || 0,
      targetYSpeedPxPerSec: Number(targetYSpeedPxPerSec) || 0,
      finalXSpeedPxPerSec: Number(targetXSpeedPxPerSec) || 0,
      finalYSpeedPxPerSec,
      lineHasReserve: !!lineHasReserve,
      dragLocked: !!dragLocked,
      dragSupported: !!dragSupported,
      dragCanBeExceeded,
      shouldSlipDrag,
      hasAwayYMovement,
    });
  }

  speedFromForceKg({
    forceKg,
    waterMotionResistance = 1000,
    waterSpeedMultiplier = 64,
    fishBaseSpeed = 1,
    fishStateSpeedMultiplier = 1,
    pixelsPerMeter = 50,
  } = {}) {
    const resistance = Math.max(
      0.000001,
      this.#positive(waterMotionResistance, 1000),
    );
    return (
      Math.sqrt(this.#positive(forceKg) / resistance) *
      this.#positive(waterSpeedMultiplier, 64) *
      this.#positive(fishBaseSpeed, 1) *
      this.#positive(fishStateSpeedMultiplier, 1) *
      Math.max(1, this.#positive(pixelsPerMeter, 50))
    );
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, number);
    return Math.max(0, Number(fallback) || 0);
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}

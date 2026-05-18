class FishPullResistanceModel {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  calculate({
    dtSec,
    playerDemandForceKg,
    fishWeightKg,
    fishActiveForceAwayKg,
    fishStaticResistanceKg,
    fishConfig,
    movementBlocked,
  } = {}) {
    const cfg = this.#config || {};
    const demand = this.#positive(playerDemandForceKg);
    const weight = Math.max(0.001, Number(fishWeightKg) || 0.001);
    const modifiers = fishConfig?.pullResistance || {};
    const staticResistance = this.#resolveStaticResistance({
      weight,
      fishStaticResistanceKg,
      multiplier: modifiers.staticMultiplier,
    });
    const activeAway = this.#positive(fishActiveForceAwayKg);
    const fishOpposition = activeAway + staticResistance;
    const terminalSpeed = this.#resolveTerminalSpeed({
      weight,
      multiplier: modifiers.terminalSpeedMultiplier,
    });
    const surplusForMotion = Math.max(0, demand - fishOpposition);
    const speedFromForce = this.#solveSpeedForDrag({
      weight,
      forceKg: surplusForMotion,
      multiplier: modifiers.waterDragMultiplier,
    });
    const retrieveSpeed = Math.min(terminalSpeed, speedFromForce);
    const waterDrag = this.#calculateWaterDrag({
      weight,
      speedMetersPerSecond: retrieveSpeed,
      multiplier: modifiers.waterDragMultiplier,
    });
    const maxUsefulPull = this.#resolveMaxUsefulPull({
      weight,
      multiplier: modifiers.maxUsefulPullMultiplier,
    });
    const forceNeededForSpeed = fishOpposition + waterDrag;
    const usefulPull = demand <= fishOpposition
      ? demand
      : Math.min(demand, maxUsefulPull, forceNeededForSpeed);
    const terminalReached =
      terminalSpeed > 0 && retrieveSpeed >= terminalSpeed - 0.001;
    const freeLineTension = Math.max(fishOpposition, usefulPull);
    const surplusForce = Math.max(0, demand - usefulPull);
    const blocked = !!movementBlocked;
    const lineTension = blocked && cfg.blockedMovementConvertsSurplusToTension !== false
      ? freeLineTension + surplusForce
      : freeLineTension;

    return new FishRetrieveResult({
      enabled: cfg.enabled !== false,
      playerDemandForceKg: demand,
      fishActiveForceAwayKg: activeAway,
      fishStaticResistanceKg: staticResistance,
      fishOppositionKg: fishOpposition,
      waterDragKg: waterDrag,
      usefulPullForceKg: usefulPull,
      retrieveSpeedMetersPerSecond:
        demand > fishOpposition + this.#balanceEpsilon() ? retrieveSpeed : 0,
      terminalRetrieveSpeedMetersPerSecond: terminalSpeed,
      terminalSpeedReached: terminalReached,
      surplusForceKg: surplusForce,
      lineTensionKg: lineTension,
      desiredMoveMeters: Math.max(0, retrieveSpeed * this.#positive(dtSec)),
      movementBlocked: blocked,
      balanceState: this.#resolveBalanceState(demand, fishOpposition),
    });
  }

  #resolveStaticResistance({ weight, fishStaticResistanceKg, multiplier }) {
    const explicit = Number(fishStaticResistanceKg);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;

    const cfg = this.#config || {};
    const base =
      weight * this.#positive(cfg.staticResistanceByWeightKg ?? 0.8);
    const min = this.#positive(cfg.minStaticResistanceKg ?? 0.03);
    return Math.max(min, base) * this.#positive(multiplier ?? 1);
  }

  #resolveTerminalSpeed({ weight, multiplier }) {
    const cfg = this.#config || {};
    const base = this.#positive(cfg.baseTerminalSpeedMps ?? 1.4);
    const lightBonus =
      this.#positive(cfg.lightFishTerminalSpeedBonus ?? 0.6) *
      this.#clamp01(1 - weight);
    const heavyPenalty =
      this.#positive(cfg.heavyFishTerminalSpeedPenalty ?? 0.25) *
      Math.max(0, weight - 1);
    return Math.max(0, base + lightBonus - heavyPenalty) *
      this.#positive(multiplier ?? 1);
  }

  #resolveMaxUsefulPull({ weight, multiplier }) {
    const cfg = this.#config || {};
    const weighted =
      weight * this.#positive(cfg.maxUsefulPullByWeightMultiplier ?? 8);
    const min = this.#positive(cfg.minUsefulPullKg ?? 0.15);
    const max = this.#positive(cfg.maxUsefulPullKg ?? 3.0);
    const raw = Math.max(min, weighted) * this.#positive(multiplier ?? 1);
    return max > 0 ? Math.min(max, raw) : raw;
  }

  #solveSpeedForDrag({ weight, forceKg, multiplier }) {
    const force = this.#positive(forceKg);
    if (force <= 0) return 0;

    const linear = this.#linearDrag(weight, multiplier);
    const quadratic = this.#quadraticDrag(weight, multiplier);
    if (quadratic <= 0) {
      return linear > 0 ? force / linear : 0;
    }

    const discriminant = linear * linear + 4 * quadratic * force;
    return Math.max(0, (-linear + Math.sqrt(discriminant)) / (2 * quadratic));
  }

  #calculateWaterDrag({ weight, speedMetersPerSecond, multiplier }) {
    const speed = this.#positive(speedMetersPerSecond);
    return this.#linearDrag(weight, multiplier) * speed +
      this.#quadraticDrag(weight, multiplier) * speed * speed;
  }

  #linearDrag(weight, multiplier) {
    return weight *
      this.#positive(this.#config.waterLinearDragKgPerKgPerMps ?? 0.8) *
      this.#positive(multiplier ?? 1);
  }

  #quadraticDrag(weight, multiplier) {
    return weight *
      this.#positive(this.#config.waterQuadraticDragKgPerKgPerMps2 ?? 2.5) *
      this.#positive(multiplier ?? 1);
  }

  #resolveBalanceState(demand, opposition) {
    const epsilon = this.#balanceEpsilon();
    if (demand < opposition - epsilon) return "fish_away";
    if (Math.abs(demand - opposition) <= epsilon) return "balanced";
    return "retrieving";
  }

  #balanceEpsilon() {
    return Math.max(0.001, Number(this.#config.balanceEpsilonKg) || 0.01);
  }

  #positive(value) {
    return Math.max(0, Number(value) || 0);
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}

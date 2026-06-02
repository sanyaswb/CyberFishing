class PlayerForceSystem {
  #playerVector = new Vector2(0, 0);
  #playerPullDir = new Vector2(0, 0);
  #lineDir = new Vector2(0, 0);
  #physicsConfig;

  constructor({ physicsConfig = null } = {}) {
    this.#physicsConfig = physicsConfig;
  }

  calculate({
    fishPosition,
    rodTipPosition,
    input,
    rod,
    reel,
    buffs,
    physics,
    totalFishForceKg,
    playerMaxLoadKg,
    dragRatio,
    physicsConfig = null,
  }) {
    const config = physicsConfig || this.#physicsConfig;
    const basePullDir = this.#playerPullDir
      .set(rodTipPosition.x - fishPosition.x, rodTipPosition.y - fishPosition.y)
      .normalize();

    const inputDir = input?.pullDirection;
    const steerX = Number(inputDir?.x) || 0;
    if (Math.abs(steerX) > 0.001) {
      const inputSteeringBlend =
        config?.getInputSteeringBlend?.() ?? 0.35;
      basePullDir.x += steerX * inputSteeringBlend;
      basePullDir.normalize();
    }

    const lineDir = this.#lineDir
      .set(fishPosition.x - rodTipPosition.x, fishPosition.y - rodTipPosition.y)
      .normalize();
    const idealDir = { x: 0, y: -1 };
    const dot = Math.max(-1, Math.min(1, lineDir.x * idealDir.x + lineDir.y * idealDir.y));
    const angleDeg = (Math.acos(dot) * 180) / Math.PI;
    const angleCfg =
      config?.getRodHoldConfig?.()?.anglePenalty ||
      config?.getRodAnglePenaltyConfig?.() ||
      {};
    const noPenalty = angleCfg.noPenaltyAngleDeg ?? 15;
    const maxPenaltyAngle = angleCfg.maxPenaltyAngleDeg ?? 75;
    const angleStressRatio = this.#clamp01(
      (angleDeg - noPenalty) / Math.max(1, maxPenaltyAngle - noPenalty),
    );
    const maxPenaltyMult = angleCfg.maxPenaltyMultiplier ?? 0.9;
    const anglePenalty = angleCfg.enabled === false
      ? 1
      : this.#lerp(1.0, maxPenaltyMult, angleStressRatio);

    const hasReel = !!reel?.hasReel?.();
    const reelHasDrag = hasReel && reel?.hasDrag?.() !== false;
    const isRecoverOnly = hasReel && !!input?.retrieve && !input?.pointerDown;
    const isPlayerPulling = !!input?.isPulling && !isRecoverOnly;
    const maxPlayerForceKg = this.#calculateMaxPlayerForceKg({
      rod,
      reel,
      hasReel,
      playerMaxLoadKg,
      anglePenalty,
      buffs,
    });

    const clampedDrag = this.#clamp01(dragRatio);
    const rawDragLimitKg = reelHasDrag
      ? this.#calculateDragLimitKg(reel, clampedDrag)
      : maxPlayerForceKg;
    const effectiveDragLimitKg = reelHasDrag ? rawDragLimitKg : maxPlayerForceKg;

    this.#playerVector.set(0, 0);

    const forceContext = {
      maxTackleLoadKg: maxPlayerForceKg,
      dragLimitKg: Number.isFinite(rawDragLimitKg) ? rawDragLimitKg : effectiveDragLimitKg,
      effectiveDragLimitKg,
      anglePenalty,
      angleStressRatio,
      angleDeg,
      isPulling: isPlayerPulling,
    };

    return {
      ...forceContext,
      forceKg: maxPlayerForceKg,
      forceContext,

      // Active player movement is owned by RodPullSystem.
      vector: this.#playerVector,
      pullDir: basePullDir,
    };
  }

  #calculateMaxPlayerForceKg({ rod, reel, hasReel, playerMaxLoadKg, anglePenalty, buffs }) {
    const fallbackRodKg =
      Number(rod?.getEffectiveMaxLoadKg?.()) ||
      Number(rod?.getMaxLoadKg?.()) ||
      0;
    const fallbackReelKg = hasReel
      ? Number(reel?.getEffectiveMaxLoadKg?.()) || Number(reel?.getMaxLoadKg?.()) || 0
      : 0;
    const fallbackValues = [fallbackRodKg];
    if (hasReel && fallbackReelKg > 0) fallbackValues.push(fallbackReelKg);

    const fallbackWeakestKg = fallbackValues
      .filter((value) => Number.isFinite(value) && value > 0)
      .reduce((min, value) => Math.min(min, value), Infinity);

    const baseForceKg = Math.max(
      0,
      Number(playerMaxLoadKg) ||
        (Number.isFinite(fallbackWeakestKg) ? fallbackWeakestKg : fallbackRodKg),
    );
    return baseForceKg * anglePenalty * (buffs?.getTotalMultiplier?.() || 1);
  }

  #calculateDragLimitKg(reel, dragRatio) {
    const range = reel?.getDragRangeKg?.() || {};
    const maxFromRange = Number(range.max);
    const fallbackMax =
      Number(reel?.getEffectiveMaxLoadKg?.()) ||
      Number(reel?.getMaxLoadKg?.()) ||
      0;
    const maxKg = Math.max(0, Number.isFinite(maxFromRange) ? maxFromRange : fallbackMax);
    return maxKg * this.#clamp01(dragRatio);
  }

  #lerp(a, b, t) {
    return a + (b - a) * this.#clamp01(t);
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}

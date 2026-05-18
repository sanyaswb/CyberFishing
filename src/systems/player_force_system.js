class PlayerForceSystem {
  #playerVector = new Vector2(0, 0);
  #playerPullDir = new Vector2(0, 0);
  #lineDir = new Vector2(0, 0);

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
  }) {
    const basePullDir = this.#playerPullDir
      .set(rodTipPosition.x - fishPosition.x, rodTipPosition.y - fishPosition.y)
      .normalize();

    const inputDir = input?.pullDirection;
    const steerX = Number(inputDir?.x) || 0;
    if (Math.abs(steerX) > 0.001) {
      basePullDir.x += steerX * (physics.inputSteeringBlend ?? 0.35);
      basePullDir.normalize();
    }

    const lineDir = this.#lineDir
      .set(fishPosition.x - rodTipPosition.x, fishPosition.y - rodTipPosition.y)
      .normalize();
    const idealDir = { x: 0, y: -1 };
    const dot = Math.max(-1, Math.min(1, lineDir.x * idealDir.x + lineDir.y * idealDir.y));
    const angleDeg = (Math.acos(dot) * 180) / Math.PI;
    const angleCfg = physics.rodAnglePenalty || {};
    const noPenalty = angleCfg.noPenaltyAngleDeg ?? 15;
    const maxPenaltyAngle = angleCfg.maxPenaltyAngleDeg ?? 75;
    const angleStressRatio = this.#clamp01(
      (angleDeg - noPenalty) / Math.max(1, maxPenaltyAngle - noPenalty),
    );
    const maxPenaltyMult = angleCfg.maxPenaltyMultiplier ?? 0.65;
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

    const fishForceKg = Math.max(0.001, Number(totalFishForceKg) || 0.001);
    const clampedDrag = this.#clamp01(dragRatio);
    const rawDragLimitKg = reelHasDrag
      ? this.#calculateDragLimitKg(reel, clampedDrag)
      : maxPlayerForceKg;
    const effectiveDragLimitKg = reelHasDrag ? rawDragLimitKg : maxPlayerForceKg;
    const dragHoldRatio = reelHasDrag
      ? this.#clamp01(effectiveDragLimitKg / fishForceKg)
      : 1;
    const tackleRestrainRatio = this.#clamp01(maxPlayerForceKg / fishForceKg);
    const isDragLocked = !reelHasDrag;
    const canDragHoldFish = !reelHasDrag || effectiveDragLimitKg >= fishForceKg;
    const pullCapacityKg = reelHasDrag
      ? Math.min(maxPlayerForceKg, effectiveDragLimitKg)
      : maxPlayerForceKg;

    const transferRatio = reelHasDrag ? dragHoldRatio : tackleRestrainRatio;
    const shouldSlipDrag = reelHasDrag && effectiveDragLimitKg < fishForceKg;
    const staminaPressureRatio = isPlayerPulling
      ? (hasReel ? dragHoldRatio : tackleRestrainRatio)
      : 0;

    // PlayerForceSystem більше не вирішує, чи рухати рибу до берега.
    // Це є відповідальністю RodPullSystem. Старі поля лишаються тільки як
    // compatibility/debug read-model, щоб не зламати overlay та старі checks.
    const legacyCanWinDistance = isPlayerPulling && canDragHoldFish && pullCapacityKg > fishForceKg;
    const legacyNetPullKg = legacyCanWinDistance ? pullCapacityKg - fishForceKg : 0;
    const legacyEffectivePullKg = isPlayerPulling ? pullCapacityKg : 0;

    this.#playerVector.set(0, 0);

    const forceContext = {
      movementAuthority: "rod_pull_system",
      maxTackleLoadKg: maxPlayerForceKg,
      pullCapacityKg,
      transferRatio,
      restrainRatio: tackleRestrainRatio,
      dragHoldRatio,
      effectiveDragRatio: transferRatio,
      dragLimitKg: Number.isFinite(rawDragLimitKg) ? rawDragLimitKg : effectiveDragLimitKg,
      effectiveDragLimitKg,
      dragLocked: isDragLocked,
      hasReel,
      canDragHoldFish,
      shouldSlipDrag,
      staminaPressureRatio,
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

      legacyReadModel: {
        canWinDistance: legacyCanWinDistance,
        netPullKg: legacyNetPullKg,
        effectivePullKg: legacyEffectivePullKg,
      },
      legacyCanWinDistance,
      legacyNetPullKg,
      legacyEffectivePullKg,
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
    const minKg = Math.max(0, Number(range.min) || 0);
    const maxFromRange = Number(range.max);
    const fallbackMax =
      Number(reel?.getEffectiveMaxLoadKg?.()) ||
      Number(reel?.getMaxLoadKg?.()) ||
      minKg;
    const maxKg = Math.max(minKg, Number.isFinite(maxFromRange) ? maxFromRange : fallbackMax);
    return minKg + (maxKg - minKg) * this.#clamp01(dragRatio);
  }

  #lerp(a, b, t) {
    return a + (b - a) * this.#clamp01(t);
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}

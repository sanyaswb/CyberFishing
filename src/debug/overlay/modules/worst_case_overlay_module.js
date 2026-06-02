class WorstCaseModule extends OverlayModule {
  constructor() {
    super("worstCase");
  }

  shouldRender(d) {
    return d.gameState === "playing" && d.hookedFish;
  }

  render(d) {
    const activeFish = d.hookedFish;
    const behaviors = activeFish.physics?.behaviorProfile?.behaviors || {};
    const currentFishBase = d.fishPassiveKg || d.fishBasePower || 0;

    let maxPull = 0,
      maxMove = 0;
    Object.values(behaviors).forEach((b) => {
      const forceMultiplier = b.forceMultiplier ?? 0;
      const speedMultiplier = b.speedMultiplier ?? 0;
      if (forceMultiplier > maxPull) maxPull = forceMultiplier;
      const effMove = Math.abs(speedMultiplier);
      if (effMove > maxMove) maxMove = effMove;
    });

    const maxPossibleForceY = currentFishBase * maxPull;
    const worstFishX = currentFishBase * maxMove;

    const eq = d.equipment || d.eq || {};
    const effectiveLoad = (item, fallback = 0) => {
      const maxLoad = Number(item?.maxLoadKg ?? fallback);
      const durability = Number(item?.durability ?? 100);
      const lossPerPercent = Number(
        item?.durabilityMaxLoadLossPerPercent ?? 0.001,
      );
      if (!Number.isFinite(maxLoad) || maxLoad <= 0) return fallback;
      return (
        maxLoad *
        Math.max(0.1, 1 - Math.max(0, 100 - durability) * lossPerPercent)
      );
    };
    const loads = [];
    const pushLoad = (value) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) loads.push(n);
    };
    pushLoad(effectiveLoad(eq.rod, 0));
    const hasReel = eq.rod?.hasReel !== false && !!eq.reel;
    if (hasReel) {
      pushLoad(effectiveLoad(eq.reel, 0));
      pushLoad(effectiveLoad(eq.reel?.line, 0));
    } else {
      pushLoad(
        CONFIG.fightPhysicsConfig?.getLineConfig?.()?.defaultMaxLoadKg ?? 0,
      );
    }
    const pPower = loads.length ? Math.min(...loads) : 0;

    const angleCfg =
      CONFIG.fightPhysicsConfig?.getRodAnglePenaltyConfig?.() || {};
    const worstPenaltyMult =
      angleCfg.enabled === false
        ? 1.0
        : (angleCfg.maxPenaltyMultiplier ?? 0.65);
    const worstPlayerY = pPower * worstPenaltyMult;
    const playerSteerMin =
      pPower *
      worstPenaltyMult *
      (CONFIG.fightPhysicsConfig?.getPlayerSteeringMultiplier?.() ?? 1.5);

    let html = this.formatHeader("💀 НАЙГІРШІ УМОВИ (КУТ)", "#ff4444");
    html += `<div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Максимальна тяга X:</div>
             <div style="margin-bottom: 2px; display: flex; justify-content: space-between;"><span>Риба:</span> <span style="color: #ff4444; font-weight: bold;">${worstFishX.toFixed(3)}</span></div>
             <div style="margin-bottom: 8px; display: flex; justify-content: space-between;"><span>Гравець:</span> <span style="color: #ffaa00; font-weight: bold;">${playerSteerMin.toFixed(3)}</span></div>`;

    html += `<div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Максимальна тяга Y:</div>
             <div style="margin-bottom: 2px; display: flex; justify-content: space-between;"><span>Риба:</span> <span style="color: #ff4444; font-weight: bold;">${maxPossibleForceY.toFixed(3)}</span></div>
             <div style="margin-bottom: 12px; display: flex; justify-content: space-between;"><span>Гравець:</span> <span style="color: #ffaa00; font-weight: bold;">${worstPlayerY.toFixed(3)}</span></div>`;

    return html;
  }
}

window.WorstCaseModule = WorstCaseModule;

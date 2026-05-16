window.DEBUG_MODULES = {
  biteTicks: true,
  location: false,
  forces: false,
  deviations: false,
  tension: false,
  rodPull: false,
  stamina: false,
  exhaustion: false,
  catchTime: false,
  prediction: false,
  net: false,
  map: false,
};

function getActiveLocationDebugData() {
  const locations = typeof CONFIG !== "undefined" ? CONFIG.locations || {} : {};
  const maps = locations.map || {};
  const locationId = locations.currentLocationId || Object.keys(maps)[0];
  const map = maps[locationId];
  const baseRes = locations.baseResolution || { width: 0, height: 0 };
  const cellSize = Number(locations.cellSize) || 1;
  const designCellSize = Number(locations.designCellSize) || cellSize;

  return {
    locations,
    maps,
    locationId,
    map,
    baseRes,
    cellSize,
    designCellSize,
  };
}

function printLocationMapDebug() {
  const { locationId, map, baseRes, cellSize, designCellSize } =
    getActiveLocationDebugData();

  if (!map) {
    console.warn("[MAP] No active map config found.");
    return;
  }

  const gridW = baseRes.width / cellSize;
  const gridH = baseRes.height / cellSize;
  const safeTop = Number(map.safeZone?.top) || 0;
  const safeBottom = Number(map.safeZone?.bottom) || baseRes.height;
  const safeHeight = Math.max(0, safeBottom - safeTop);
  const safeCells = safeHeight / cellSize;
  const castableBounds = getZoneBounds(
    map.zones?.castable || [],
    cellSize,
    baseRes,
  );
  const accuracyPercent = normalizeDebugPercent(
    CONFIG.casting?.accuracyDistancePercent,
  );
  const handAccuracyPercent = normalizeDebugPercent(
    CONFIG.casting?.handChumAccuracyDistancePercent ??
      CONFIG.casting?.accuracyDistancePercent,
  );
  const accuracyMultiplier = normalizeDebugMultiplier(
    CONFIG.casting?.accuracyDistanceMultiplier,
  );
  const handAccuracyMultiplier = normalizeDebugMultiplier(
    CONFIG.casting?.handChumAccuracyDistanceMultiplier ??
      CONFIG.casting?.accuracyDistanceMultiplier,
  );

  console.group(
    `%c[MAP] ${locationId} - ${map.name || "Unnamed location"}`,
    "color: #b066ff; font-size: 14px; font-weight: bold;",
  );

  console.table({
    "Base resolution": `${baseRes.width} x ${baseRes.height} px`,
    "Browser viewport": `${window.innerWidth} x ${window.innerHeight} px`,
    "Cell size": `${cellSize} px`,
    "Design cell size": `${designCellSize} px`,
    "Cell multiplier": (cellSize / Math.max(1, designCellSize)).toFixed(3),
    "Grid size": `${gridW.toFixed(2)} x ${gridH.toFixed(2)} cells`,
    "Safe zone Y": `${safeTop} -> ${safeBottom}`,
    "Safe zone height": `${safeHeight}px / ${safeCells.toFixed(2)} cells`,
    "Castable bounds": castableBounds
      ? `${castableBounds.x}px, ${castableBounds.y}px, ${castableBounds.width}px x ${castableBounds.height}px`
      : "none",
    "Rod accuracy percent": `${(accuracyPercent * 100).toFixed(2)}%`,
    "Rod accuracy multiplier": accuracyMultiplier.toFixed(2),
    "Rod spread at castable max": castableBounds
      ? `${(castableBounds.height * accuracyPercent * accuracyMultiplier).toFixed(2)} px diameter`
      : "n/a",
    "Hand chum accuracy percent": `${(handAccuracyPercent * 100).toFixed(2)}%`,
    "Hand chum accuracy multiplier": handAccuracyMultiplier.toFixed(2),
    "Chum cast distance": `${map.chumCastDistance ?? "n/a"} px`,
    "Chum spread at max": Number.isFinite(Number(map.chumCastDistance))
      ? `${(Number(map.chumCastDistance) * handAccuracyPercent * handAccuracyMultiplier).toFixed(2)} px diameter`
      : "n/a",
  });

  console.log("%c[MAP] Perspective samples", "color: #00ccff;");
  console.table(
    buildPerspectiveRows(map, [
      { label: "safe top", y: safeTop },
      { label: "castable top", y: castableBounds ? castableBounds.y : safeTop },
      {
        label: "castable middle",
        y: castableBounds
          ? castableBounds.y + castableBounds.height / 2
          : safeTop + safeHeight / 2,
      },
      {
        label: "castable bottom",
        y: castableBounds
          ? castableBounds.y + castableBounds.height
          : safeBottom,
      },
      { label: "safe bottom", y: safeBottom },
    ]),
  );

  printZoneTable("castable", map.zones?.castable || [], cellSize, baseRes);
  printZoneTable("collisions", map.zones?.collisions || [], cellSize, baseRes);
  printZoneTable("snags", map.zones?.snags || [], cellSize, baseRes);
  printZoneTable("dynamic", map.zones?.dynamic || [], cellSize, baseRes);

  console.groupEnd();
}

function printZoneTable(type, zones, cellSize, baseRes) {
  if (!zones.length) return;
  console.log(`%c[MAP] Zones: ${type}`, "color: #00ff80;");
  console.table(
    zones.map((zone, index) => {
      const adaptiveWidth = zone.adaptiveX ? baseRes.width : zone.w * cellSize;
      const xPx = zone.adaptiveX ? 0 : zone.x * cellSize;
      const yPx = zone.y * cellSize;
      const widthPx = adaptiveWidth;
      const heightPx = zone.h * cellSize;
      return {
        index,
        id: zone.id || "",
        type: zone.type || type,
        xCells: zone.x,
        yCells: zone.y,
        wCells: zone.w,
        hCells: zone.h,
        xPx,
        yPx,
        widthPx,
        heightPx,
        areaPx: widthPx * heightPx,
        rightPx: xPx + widthPx,
        bottomPx: yPx + heightPx,
        boundsCount: Array.isArray(zone.bounds) ? zone.bounds.length : 0,
        boundsPx: Array.isArray(zone.bounds)
          ? zone.bounds
              .map(
                (b) =>
                  `${b.x * cellSize},${b.y * cellSize},${b.w * cellSize}x${b.h * cellSize}`,
              )
              .join(" | ")
          : "",
        moving: zone.moving === true,
        multiplier: zone.multiplier ?? zone.bonus ?? "",
      };
    }),
  );
}

function getZoneBounds(zones, cellSize, baseRes) {
  if (!zones.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const zone of zones) {
    const x = zone.adaptiveX ? 0 : zone.x * cellSize;
    const y = zone.y * cellSize;
    const w = zone.adaptiveX ? baseRes.width : zone.w * cellSize;
    const h = zone.h * cellSize;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function buildPerspectiveRows(map, samples) {
  return samples.map((sample) => {
    const p = getDebugPerspective(map, sample.y);
    return {
      label: sample.label,
      y: Number(sample.y).toFixed(2),
      scale: p.scale.toFixed(4),
      squashY: p.squashY.toFixed(4),
      angleDeg: p.angleDeg.toFixed(2),
    };
  });
}

function getDebugPerspective(map, virtualY) {
  const pConfig = map.perspective || { angleTop: 5, angleBottom: 60 };
  const topY = Number(map.safeZone?.top) || 0;
  const bottomY = Number(map.safeZone?.bottom) || 1;
  const distRatio = clamp01((virtualY - topY) / Math.max(1, bottomY - topY));
  const angleDeg =
    pConfig.angleTop + (pConfig.angleBottom - pConfig.angleTop) * distRatio;
  const angleRad = (angleDeg * Math.PI) / 180;
  const bottomAngleRad = ((pConfig.angleBottom || 1) * Math.PI) / 180;
  return {
    angleDeg,
    squashY: Math.sin(angleRad),
    scale: Math.tan(angleRad) / Math.max(0.0001, Math.tan(bottomAngleRad)),
  };
}

function normalizeDebugPercent(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1 ? raw / 100 : raw;
}

function normalizeDebugMultiplier(value) {
  const raw = Number(value);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function fmt(value, digits = 3) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "n/a";
}

function fmtMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "n/a";
  return `${n.toFixed(0)} ms`;
}

function getEquipmentPower(item) {
  if (!item) return 0;
  const maxLoad = Number(item.maxLoadKg);
  const durability = Number(item.durability ?? 100);
  const lossPerPercent = Number(item.durabilityMaxLoadLossPerPercent ?? 0.001);
  if (!Number.isFinite(maxLoad) || maxLoad <= 0) return 0;
  return (
    maxLoad * Math.max(0.1, 1 - Math.max(0, 100 - durability) * lossPerPercent)
  );
}

function getHookPower(hook) {
  if (!hook) return 0;
  const level = Number(hook.level) || 0;
  const weight = Number(hook.weight) || 0;
  const quality = Number(hook.quality) || 0;
  return (level * weight + quality) * 0.01;
}

function getLastKnownFish(ctx) {
  return ctx.live?.hookedFish || ctx.fight?.fish || null;
}

function getLastKnownEquipment(ctx) {
  return ctx.live?.equipment || ctx.fight?.eq || {};
}

function renderLocationModule(ctx) {
  const { locationId, map, baseRes, cellSize, designCellSize } =
    getActiveLocationDebugData();
  if (!map) {
    console.warn("[location] No active location.");
    return;
  }

  const castableBounds = getZoneBounds(
    map.zones?.castable || [],
    cellSize,
    baseRes,
  );
  const safeTop = Number(map.safeZone?.top) || 0;
  const safeBottom = Number(map.safeZone?.bottom) || baseRes.height;

  console.table({
    "Game state": ctx.live?.gameState || "n/a",
    "Location id": locationId,
    "Location name": map.name || "Unnamed location",
    "Base resolution": `${baseRes.width} x ${baseRes.height}`,
    "Cell size": `${cellSize}`,
    "Design cell size": `${designCellSize}`,
    "Safe zone": `${safeTop} -> ${safeBottom}`,
    "Castable height": castableBounds ? castableBounds.height : "none",
    "Current float": ctx.live
      ? `${ctx.live.floatX}, ${ctx.live.floatY}`
      : "no live payload yet",
    "Hook depth": ctx.live ? fmt(ctx.live.hookDepth, 2) : "n/a",
    "Bottom depth": ctx.live ? fmt(ctx.live.bottomDepth, 2) : "n/a",
  });
}

function renderMapModule() {
  printLocationMapDebug();
}

function renderForcesModule(ctx) {
  const live = ctx.live || {};
  const fish = getLastKnownFish(ctx);
  const eq = getLastKnownEquipment(ctx);
  const rod = eq.rod || {};
  const reel = rod.hasReel === false ? null : eq.reel || {};

  console.table({
    Fish: fish ? `${fish.name || fish.id} / ${fmt(fish.weight, 3)} kg` : "n/a",
    "Fish state": live.fishState || "n/a",
    "Rod max load kg": fmt(getEquipmentPower(rod), 3),
    "Reel max load kg": fmt(getEquipmentPower(reel), 3),
    "Player force Y live": fmt(live.playerForceY, 3),
    "Player max Y live": fmt(live.playerMaxPowerY, 3),
    "Player force X live": fmt(live.playerForceX, 3),
    "Player max X live": fmt(live.playerMaxPowerX, 3),
    "Fish force Y live": fmt(live.fishForceY, 3),
    "Fish force X live": fmt(live.fishForceX, 3),
    "Fish base power live": fmt(live.fishBasePower, 3),
    "Fish initial power live": fmt(live.fishInitialPower, 3),
    "Pull multiplier live": fmt(live.pullMult, 3),
    "Move multiplier live": fmt(live.moveMult, 3),
    "Active debuff": live.activeDebuffName || "n/a",
  });
}

function renderDeviationsModule(ctx) {
  const live = ctx.live || {};
  const playerY = Number(live.playerForceY);
  const playerMaxY = Number(live.playerMaxPowerY);
  const playerX = Number(live.playerForceX);
  const playerMaxX = Number(live.playerMaxPowerX);
  const fishY = Number(live.fishForceY);
  const fishX = Number(live.fishForceX);

  console.table({
    "Y usage": Number.isFinite(playerY + playerMaxY)
      ? `${fmt((playerY / Math.max(0.001, playerMaxY)) * 100, 1)}%`
      : "n/a",
    "X usage": Number.isFinite(playerX + playerMaxX)
      ? `${fmt((playerX / Math.max(0.001, playerMaxX)) * 100, 1)}%`
      : "n/a",
    "Fish total force": Number.isFinite(fishY + fishX)
      ? fmt(Math.hypot(fishY, fishX), 3)
      : "n/a",
    "Player total force": Number.isFinite(playerY + playerX)
      ? fmt(Math.hypot(playerY, playerX), 3)
      : "n/a",
    "Live data source": live.gameState
      ? `debug-live-update (${live.gameState})`
      : "none",
  });
}

function renderTensionModule(ctx) {
  const live = ctx.live || {};
  const config = CONFIG.tension || {};
  const maxTackleLoadKg = Number(live.maxTackleLoadKg ?? live.playerMaxPowerY);
  const fishForceKg =
    Number(live.totalFishForceKg) ||
    Math.hypot(Number(live.fishForceY) || 0, Number(live.fishForceX) || 0);
  const dragLimitKg = Number(live.dragLimitKg) || 0;
  const tensionKg = Number(live.tensionKg) || 0;
  const tensionRatio = Number.isFinite(maxTackleLoadKg)
    ? tensionKg / Math.max(0.001, maxTackleLoadKg)
    : NaN;

  console.table({
    "Current tension kg": fmt(tensionKg, 3),
    "Current tension %": fmt(live.tension ?? live.tensionPercent, 2),
    "Max tackle load kg": fmt(maxTackleLoadKg, 3),
    "Fish force kg": fmt(fishForceKg, 3),
    "Drag limit kg": fmt(dragLimitKg, 3),
    "Tension / max load": fmt(tensionRatio, 3),
    "Kg smoothing / sec": fmt(config.kgSmoothPerSecond, 3),
    "Break threshold %": fmt(config.breakThreshold, 2),
    "Formula source":
      "FightPhysicsSystem.calculateTensionKg + TackleStressSystem",
  });
}

function renderRodPullModule(ctx) {
  const live = ctx.live || {};
  console.table({
    "Rod pull active": live.rodPullActive === true,
    "Pull ratio": `${fmt((Number(live.rodPullRatio) || 0) * 100, 1)}%`,
    "Pull force kg": fmt(live.rodPullForceKg, 3),
    "Fish force kg": fmt(live.fishForceKg ?? live.totalFishForceKg, 3),
    "Max tackle load kg": fmt(live.maxTackleLoadKg, 3),
    "Drag limit kg": fmt(live.dragLimitKg, 3),
    "Available extra kg": fmt(live.availableExtraForceKg, 3),
    "Charge speed multiplier": fmt(live.rodPullChargeSpeedMultiplier, 3),
    "Charge per second": fmt(live.rodPullChargePerSecond, 3),
    "Rod stroke used": `${fmt(live.rodPullDistanceMeters, 2)} / ${fmt(live.rodPullAvailableDistanceMeters, 2)} m`,
    "Rod stroke base": fmt(live.rodPullMaxDistanceMeters, 2),
    "Slack meters": fmt(live.slackMeters ?? live.lineSlackMeters, 2),
    "Slack penalty": fmt(live.slackPenaltyMeters, 2),
    "Reel recovering slack": live.reelRecoveringSlack === true,
    "Rod bar recovering": live.rodPullReleaseRecovering === true,
    "Rod bar recovery ratio": fmt(live.rodPullReleaseRecoveryRatio, 3),
    "Hard line limit": live.hardLineLimit === true,
    "Result": live.rodPullCanMoveFish ? "MOVING_FISH" : "NO_PULL",
    "Blocked reason": live.rodPullBlockedReason || "none",
  });
}

function renderStaminaModule(ctx) {
  const live = ctx.live || {};
  const config = CONFIG.stamina?.mechanics || {};

  console.table({
    "Fish condition phase": live.fishConditionPhase || "n/a",
    "Fish state": live.fishState || "n/a",
    "Current stamina": fmt(live.currentStamina, 3),
    "Current exhaustion": fmt(live.currentExhaustion, 3),
    "Max points": fmt(live.fishConditionMaxPoints, 3),
    "Base depletion rate": fmt(config.baseDepletionRate, 3),
    "Edge regen rate": fmt(config.edgeRegenRate, 3),
    "Regen multiplier phase 1": fmt(config.regenMultiplierPhase1, 3),
    "Mastery active": live.isMasteryActive === true,
    "Mastery timer": fmtMs(live.masteryTimerMs),
    "Mastery multiplier live": fmt(live.masteryCurrentMult, 3),
    "Exhaustion duration live": fmtMs(live.exhaustionDurationMs),
  });
}

function renderExhaustionModule(ctx) {
  const live = ctx.live || {};
  const config = CONFIG.stamina?.mechanics || {};
  console.table({
    "Fish condition phase": live.fishConditionPhase || "n/a",
    "Current exhaustion": fmt(live.currentExhaustion, 3),
    "Max points": fmt(live.fishConditionMaxPoints, 3),
    "Duration live": fmtMs(live.exhaustionDurationMs),
    "Optimal max tension": fmt(config.exhaustionOptimalMax, 2),
    "Base power drop per sec": fmt(config.basePowerDropPerSec, 4),
    "Mastery time ratio": fmt(config.masteryTimeRatio, 3),
    "Mastery power multiplier": fmt(config.masteryPowerMultiplier, 3),
    "Active debuff": live.activeDebuffName || "n/a",
  });
}

function renderCatchTimeModule(ctx) {
  const live = ctx.live || {};
  const fish = getLastKnownFish(ctx);
  const durationMs = Number(live.exhaustionDurationMs);
  const masteryRatio = CONFIG.stamina?.mechanics?.masteryTimeRatio ?? 0.5;

  console.table({
    Fish: fish ? fish.name || fish.id : "n/a",
    "Weight kg": fish ? fmt(fish.weight, 3) : "n/a",
    Level: fish?.level ?? "n/a",
    "Ideal exhaustion duration": fmtMs(durationMs),
    "Mastery starts after": Number.isFinite(durationMs)
      ? fmtMs(durationMs * masteryRatio)
      : "n/a",
    "Data source": Number.isFinite(durationMs)
      ? "StaminaController.getExhaustionDurationMs"
      : "waiting for live fight data",
  });
}

function renderPredictionModule(ctx) {
  const live = ctx.live || {};
  const chances = Array.isArray(live.liveChances) ? live.liveChances : [];
  if (!chances.length) {
    console.info("[prediction] No live bite chance data yet.");
    return;
  }
  console.table(
    chances.map((fish) => ({
      fish: fish.name,
      chance: fish.chance,
      base: fish.breakdown?.base,
      bait: fish.breakdown?.bait,
      time: fish.breakdown?.time,
      day: fish.breakdown?.day,
      depth: fish.breakdown?.depth,
      weather: fish.breakdown?.weather,
      zone: fish.breakdown?.zone,
      chum: fish.breakdown?.chum,
      spam: fish.breakdown?.spam,
      overDepth: fish.breakdown?.overDepth,
    })),
  );
}

function renderNetModule(ctx) {
  const eq = getLastKnownEquipment(ctx);
  const fish = getLastKnownFish(ctx);
  const net = eq.net || {};
  console.table({
    "Equipped net": net.name || net.id || "none",
    "Net active": net.active === true,
    "Net level": net.level ?? "n/a",
    Fish: fish ? fish.name || fish.id : "n/a",
    "Fish weight": fish ? `${fmt(fish.weight, 3)} kg` : "n/a",
    "Last net roll": ctx.lastNetRoll
      ? `${ctx.lastNetRoll.roll.toFixed(1)} / ${ctx.lastNetRoll.chance}%`
      : "none",
    "Last net success": ctx.lastNetRoll ? ctx.lastNetRoll.success : "n/a",
  });
}

function renderBiteTicksModule() {
  const config = typeof CONFIG !== "undefined" ? CONFIG : {};
  const tickRate = config.spawns?.tickRateMs ?? "n/a";
  const cooldown = config.physics?.guaranteedBiteCooldownMs || [];
  const godMode = config.debug?.godMode || {};
  console.table({
    "Logger status": "enabled",
    "Waiting tick rate": `${tickRate} ms`,
    "Guaranteed cooldown min": cooldown[0] != null ? fmtMs(cooldown[0]) : "n/a",
    "Guaranteed cooldown max": cooldown[1] != null ? fmtMs(cooldown[1]) : "n/a",
    "GOD fixed chance": godMode.fixedBiteChanceEnabled
      ? `${godMode.fixedBiteChancePercent}%`
      : "off",
    "GOD bite sequence mode": godMode.biteSequenceMode || "default",
    "Event source": "BiteSystem + WaterEntity.startBite/_rollBiteSequence",
  });
}

function printBiteTickLog(detail = {}) {
  if (!window.DEBUG_MODULES?.biteTicks) return;

  const tick = detail.tickIndex ?? "?";
  const result = detail.result || "n/a";
  const cooldown = detail.cooldown || {};
  const title =
    cooldown.active && result === "COOLDOWN"
      ? `[BITE:WAITING] #${tick} cooldown active — next checks paused`
      : `[BITE:WAITING] #${tick} ${result}`;

  console.groupCollapsed(`%c${title}`, "color: #00d1ff; font-weight: bold;");
  console.table({
    Режим: detail.mode || "WAITING",
    Тік: tick,
    "Період перевірки": fmtMs(detail.tickRateMs),
    "Перевірено риб": detail.checkedFishCount ?? 0,
    Результат: result,
    "Клюнуло кандидатів": detail.bitesCount ?? 0,
    "Обрана риба": detail.selectedFish
      ? `${detail.selectedFish.name || detail.selectedFish.id} (${detail.selectedFish.chancePercent})`
      : "none",
    "GOD fixed chance": detail.godMode?.fixedBiteChanceEnabled
      ? `${detail.godMode.fixedBiteChancePercent}%`
      : "off",
    "GOD sequence mode": detail.godMode?.biteSequenceMode || "default",
  });

  if (Array.isArray(detail.fishRolls) && detail.fishRolls.length > 0) {
    console.table(
      detail.fishRolls.map((fish, index) => ({
        "#": index + 1,
        Риба: fish.name || fish.id,
        Шанс: fish.chancePercent,
        "Випав шанс / roll": fish.rollPercent,
        Результат: fish.skipped ? "skip: chance 0%" : fish.result,
      })),
    );
  }

  if (cooldown.active) {
    console.table({
      "Колдаун запущено/активний": true,
      Причина: cooldown.reason || "n/a",
      "Стартовий час": cooldown.startedMs ? fmtMs(cooldown.startedMs) : "n/a",
      "Було залишку": cooldown.beforeMs ? fmtMs(cooldown.beforeMs) : "n/a",
      "Стало залишку": cooldown.afterMs ? fmtMs(cooldown.afterMs) : "n/a",
    });
  } else {
    console.info("Колдаун після покльовки: не запущено.");
  }

  console.groupEnd();
}

function printBiteSequenceLog(detail = {}) {
  if (!window.DEBUG_MODULES?.biteTicks) return;

  if (detail.event === "START") {
    const seq = detail.sequence || {};
    console.groupCollapsed(
      "%c[BITE:BITING] start sequence",
      "color: #ffcc00; font-weight: bold;",
    );
    console.table({
      Режим: detail.mode || "BITING",
      Подія: "START",
      "Pulling під час покльовки": detail.isPulling === true,
      "Активна приманка": detail.isSpinningLure === true,
      "Guaranteed chance": seq.chanceGuaranteedPercent || "n/a",
      "Normal chance": seq.chanceNormalPercent || "n/a",
      "Max sequences config": Array.isArray(seq.maxSequences)
        ? `${seq.maxSequences[0]}..${seq.maxSequences[1]}`
        : seq.maxSequences,
      "Згенеровано sequences": seq.targetSequenceCount ?? "n/a",
      "Guaranteed iters": Array.isArray(seq.guaranteedIters)
        ? `${seq.guaranteedIters[0]}..${seq.guaranteedIters[1]}`
        : seq.guaranteedIters,
      "Normal iters": Array.isArray(seq.normalIters)
        ? `${seq.normalIters[0]}..${seq.normalIters[1]}`
        : seq.normalIters,
      "Fallback між ітераціями": Array.isArray(seq.intervalMs)
        ? `${fmtMs(seq.intervalMs[0])}..${fmtMs(seq.intervalMs[1])}`
        : fmtMs(seq.intervalMs),
      "Fallback між sequences": Array.isArray(seq.sequenceIntervalMs)
        ? `${fmtMs(seq.sequenceIntervalMs[0])}..${fmtMs(seq.sequenceIntervalMs[1])}`
        : fmtMs(seq.sequenceIntervalMs),
    });
    console.groupEnd();
    return;
  }

  console.groupCollapsed(
    `%c[BITE:BITING] sequence ${detail.sequenceIndex}/${detail.sequenceCount} → ${detail.selectedType}`,
    "color: #ffcc00; font-weight: bold;",
  );
  console.table({
    Режим: detail.mode || "BITING",
    Подія: detail.event || "SEQUENCE_ROLL",
    "Фактичний шанс guaranteed": detail.chanceGuaranteedPercent,
    "Фактичний шанс normal": detail.chanceNormalPercent,
    "Шанс який випав / roll": detail.rollPercent,
    "Обраний тип": detail.selectedType,
    "Згенеровано ітерацій": detail.generatedIterations,
    "Fallback між sequences": detail.sequenceIntervalMs
      ? fmtMs(detail.sequenceIntervalMs)
      : "не запускався",
  });

  if (Array.isArray(detail.iterations) && detail.iterations.length > 0) {
    console.table(
      detail.iterations.map((iter) => ({
        Ітерація: iter.index,
        Результат: iter.result,
        "Animation steps": iter.stepCount,
        "Fallback між ітерацією": fmtMs(iter.fallbackMs),
      })),
    );
  }
  console.groupEnd();
}

const DEBUG_CONSOLE_MODULES = {
  biteTicks: {
    title: "Bite Tick Logger",
    render: renderBiteTicksModule,
  },
  location: {
    title: "Location",
    render: renderLocationModule,
  },
  map: {
    title: "Map And Zones",
    render: renderMapModule,
  },
  forces: {
    title: "Fight Forces",
    render: renderForcesModule,
  },
  deviations: {
    title: "Force Deviations",
    render: renderDeviationsModule,
  },
  tension: {
    title: "Tension",
    render: renderTensionModule,
  },
  rodPull: {
    title: "Rod Pull",
    render: renderRodPullModule,
  },
  stamina: {
    title: "Stamina",
    render: renderStaminaModule,
  },
  exhaustion: {
    title: "Exhaustion",
    render: renderExhaustionModule,
  },
  catchTime: {
    title: "Catch Time",
    render: renderCatchTimeModule,
  },
  prediction: {
    title: "Bite Prediction",
    render: renderPredictionModule,
  },
  net: {
    title: "Landing Net",
    render: renderNetModule,
  },
};

const DebugConsole = {
  live: null,
  fight: null,
  lastNetRoll: null,
  pendingModules: new Set(),

  setLiveData(detail) {
    this.live = detail || null;
    if (this.pendingModules.size > 0) {
      for (const moduleName of this.pendingModules) {
        this.printModule(moduleName, { reason: "live snapshot" });
      }
      this.pendingModules.clear();
    }
  },

  setFightData(detail) {
    this.fight = detail || null;
  },

  setNetRoll(detail) {
    this.lastNetRoll = detail || null;
  },

  printModule(moduleName, meta = {}) {
    const module = DEBUG_CONSOLE_MODULES[moduleName];
    if (!module) {
      console.warn(`[DEBUG] Unknown console module: ${moduleName}`);
      return;
    }

    const state = this.live?.gameState || "no-live-state";
    const reason = meta.reason ? ` / ${meta.reason}` : "";
    console.group(
      `%c[DEBUG:${moduleName}] ${module.title} (${state}${reason})`,
      "color: #b066ff; font-weight: bold;",
    );
    module.render({
      live: this.live,
      fight: this.fight,
      lastNetRoll: this.lastNetRoll,
    });
    console.groupEnd();
  },

  requestModule(moduleName, meta = {}) {
    if (!this.live) this.pendingModules.add(moduleName);
    this.printModule(moduleName, meta);
  },

  printEnabled(meta = {}) {
    for (const moduleName of Object.keys(window.DEBUG_MODULES || {})) {
      if (window.DEBUG_MODULES[moduleName]) this.printModule(moduleName, meta);
    }
  },
};

window.DebugConsole = DebugConsole;
window.printLocationMapDebug = printLocationMapDebug;

document.addEventListener("debug-live-update", (e) => {
  DebugConsole.setLiveData(e.detail);
});

document.addEventListener("debug-module-toggled", (e) => {
  const { module, enabled } = e.detail || {};
  if (enabled) DebugConsole.requestModule(module, { reason: "enabled" });
});

document.addEventListener("config-updated", (e) => {
  const path = e.detail?.path || [];
  const root = path[0];
  const second = path[1];
  if (root === "CONFIG" && second === "locations" && window.DEBUG_MODULES.map) {
    DebugConsole.printModule("map", { reason: "config updated" });
  }
  if (root === "CONFIG" && second === "casting" && window.DEBUG_MODULES.map) {
    DebugConsole.printModule("map", { reason: "config updated" });
  }
});

document.addEventListener("debug-fish-hooked", (e) => {
  DebugConsole.setFightData(e.detail);
  DebugConsole.printEnabled({ reason: "fish hooked" });
});

document.addEventListener("debug-bite-tick", (e) => {
  printBiteTickLog(e.detail);
});

document.addEventListener("debug-bite-sequence", (e) => {
  printBiteSequenceLog(e.detail);
});

document.addEventListener("netCatchRoll", (e) => {
  DebugConsole.setNetRoll(e.detail);
  if (!window.DEBUG_MODULES.net) return;
  const { chance, roll, success } = e.detail;
  console.log(
    `[NET] Attempt: chance ${chance}%, roll ${roll.toFixed(1)}, success ${success}`,
  );
  DebugConsole.printModule("net", { reason: "net roll" });
});

class GodMode {
  static get isActive() {
    return typeof CONFIG !== "undefined" && CONFIG.debug?.godMode?.enabled;
  }

  static get infiniteResources() {
    return this.isActive && CONFIG.debug.godMode.infiniteResources;
  }

  static get noHookEscape() {
    return this.isActive && CONFIG.debug.godMode.noHookEscape;
  }

  static get noLineBreak() {
    return this.isActive && CONFIG.debug.godMode.noLineBreak;
  }

  static get noRodBreak() {
    return this.isActive && CONFIG.debug.godMode.noRodBreak;
  }

  static get infiniteCasting() {
    return this.isActive && CONFIG.debug.godMode.infiniteCasting;
  }

  static get noEquipmentLoss() {
    return this.isActive && CONFIG.debug.godMode.noEquipmentLoss;
  }

  static get fixedBiteChanceEnabled() {
    return this.isActive && CONFIG.debug.godMode.fixedBiteChanceEnabled;
  }

  static get fixedBiteChancePercent() {
    if (!this.fixedBiteChanceEnabled) return null;
    const value = Number(CONFIG.debug.godMode.fixedBiteChancePercent);
    return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 100));
  }

  static get biteSequenceMode() {
    if (!this.isActive) return "default";
    const mode = String(
      CONFIG.debug.godMode.biteSequenceMode || "default",
    ).toLowerCase();
    return mode === "guaranteed" || mode === "normal" ? mode : "default";
  }
}

class TestBuildProvider {
  static injectDebugBuild(inventory) {
    const boxInstanceId = "debug_build_box_001";
    const boxInstanceId2 = "debug_build_box_002";
    if (inventory.getInstance(boxInstanceId)) return;

    inventory.addItem({
      instanceId: boxInstanceId,
      itemId: "sys_build_box",
      quantity: 1,
      buildName: "Test Build (Dev)",
      type: "build_box",
    });

    inventory.addItem({
      instanceId: boxInstanceId2,
      itemId: "sys_build_box",
      quantity: 1,
      buildName: "Test Build (Dev2)",
      type: "build_box",
    });

    const debugItems = [
      {
        instanceId: "debug_rod_001",
        itemId: "rod_test_float",
        quantity: 1,
        buildId: boxInstanceId,
      },
      {
        instanceId: "debug_line_001",
        itemId: "line_test_13m",
        quantity: 1,
        buildId: boxInstanceId,
      },
      {
        instanceId: "debug_reel_001",
        itemId: "float_day",
        quantity: 1,
        buildId: boxInstanceId,
      },
      {
        instanceId: "debug_hook_001",
        itemId: "sinker_light",
        quantity: 1,
        buildId: boxInstanceId,
      },
      {
        instanceId: "debug_chum_001",
        itemId: "hook_basic",
        quantity: 1,
        buildId: boxInstanceId,
      },
      {
        instanceId: "debug_rod_002",
        itemId: "rod_test_feeder",
        quantity: 1,
        buildId: boxInstanceId2,
      },
      {
        instanceId: "debug_line_002",
        itemId: "line_test_13m",
        quantity: 1,
        buildId: boxInstanceId2,
      },
      {
        instanceId: "debug_feeder_spring_001",
        itemId: "feeder_spring_basic",
        quantity: 1,
        buildId: boxInstanceId2,
      },
      {
        instanceId: "debug_hook_basic_002",
        itemId: "hook_basic",
        quantity: 1,
        buildId: boxInstanceId2,
      },
      {
        instanceId: "debug_reel_test_002",
        itemId: "reel_test",
        quantity: 1,
        buildId: boxInstanceId2,
      },
      {
        instanceId: "debug_carp_mix_basic_004",
        itemId: "carp_mix_basic",
        quantity: 1,
        buildId: boxInstanceId2,
      },
    ];

    debugItems.forEach((item) => inventory.addItem(item));
  }
}

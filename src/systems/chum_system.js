class ChumZone {
  constructor(
    id,
    x,
    y,
    baitConfig,
    deployRealTimeMs,
    locationSquash,
    isDelivered = false,
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.baitId = baitConfig.id;
    this.baitConfig = baitConfig;
    this.deployRealTimeMs = deployRealTimeMs;
    this.isDelivered = isDelivered;
    this.isExpired = false;
    this.currentBonus = 1.0;

    // Читаємо єдиний радіус
    this.baseRadius = baitConfig.radius || 150;

    // Беремо перспективу з локації (або дефолтні значення для безпеки)
    this.squashTop = locationSquash?.top ?? 0.15;
    this.squashBottom = locationSquash?.bottom ?? 0.75;
  }

  // ОСЬ ВІН, НАШ ЗАГУБЛЕНИЙ МЕТОД:
  updateState(realTimeNow, timeScale) {
    if (!this.isDelivered) return 0;

    const realElapsedMs = realTimeNow - this.deployRealTimeMs;
    const gameElapsedMs = realElapsedMs * timeScale;

    const cfg = this.baitConfig;
    const peakStartTime = cfg.rampUpTimeMs;
    const peakEndTime = peakStartTime + cfg.peakDurationMs;
    const totalTime = cfg.totalBonusTimeMs;
    const expireTime = totalTime + cfg.minBonusDurationHours * 3600000;

    if (gameElapsedMs >= expireTime) {
      this.isExpired = true;
      return 0;
    }

    if (gameElapsedMs < peakStartTime) {
      return 1.0 + (cfg.maxBonus - 1.0) * (gameElapsedMs / peakStartTime);
    } else if (gameElapsedMs < peakEndTime) {
      return cfg.maxBonus;
    } else if (gameElapsedMs < totalTime) {
      const progress =
        (gameElapsedMs - peakEndTime) / (totalTime - peakEndTime);
      return cfg.maxBonus - (cfg.maxBonus - cfg.minBonus) * progress;
    } else {
      return cfg.minBonus;
    }
  }

  getMultiplierAt(targetX, targetY, targetFishId, virtualTopY, virtualBottomY) {
    if (this.isExpired || !this.isDelivered) return 1.0;

    if (
      targetFishId !== null &&
      !this.baitConfig.targetFishes.includes(targetFishId)
    ) {
      return 1.0;
    }

    // Рахуємо позицію по Y від 0 до 1
    const distRatio = Math.max(
      0,
      Math.min(1.0, (this.y - virtualTopY) / (virtualBottomY - virtualTopY)),
    );

    // ДИНАМІЧНИЙ РАДІУС
    const currentRadX = this.baseRadius;
    const currentScaleY =
      this.squashTop + (this.squashBottom - this.squashTop) * distRatio;
    const currentRadY = this.baseRadius * currentScaleY;

    const dx = targetX - this.x;
    const dy = targetY - this.y;

    const isInside =
      (dx * dx) / (currentRadX * currentRadX) +
        (dy * dy) / (currentRadY * currentRadY) <=
      1;

    if (isInside) {
      return this.currentBonus;
    }
    return 1.0;
  }

  checkOverlap(otherZone) {
    const dx = this.x - otherZone.x;
    const dy = this.y - otherZone.y;
    const dist = Math.hypot(dx, dy);

    // Замінили baseRadX на baseRadius
    return dist < Math.max(this.baseRadius, otherZone.baseRadius);
    // return dist < this.baseRadius + otherZone.baseRadius;
  }
}

class ChumManager {
  #locationId;
  #chumConfig;
  #zones = [];
  #boats = [];
  #storageKey;
  #locationMemoryKey;
  #memoryGrid = {};
  #boatEnergy = null;
  #locationSquash;

  constructor(locationId, chumConfig, locationSquash) {
    this.#locationId = locationId;
    this.#chumConfig = chumConfig;
    this.#storageKey = `chum_active_${locationId}`;
    this.#locationMemoryKey = `chum_memory_${locationId}`;
    this.handUses = chumConfig.deliveryMethods.hand.maxUses || 7;

    // 1. СПОЧАТКУ зберігаємо перспективу з конфігу
    this.#locationSquash = locationSquash || { top: 0.15, bottom: 0.75 };

    // 2. І ТІЛЬКИ ПОТІМ завантажуємо зони (тепер вони отримають правильні дані)
    this.loadFromStorage();

    document.addEventListener("config-updated", (e) =>
      this.#onConfigUpdate(e.detail),
    );
  }

  useHandBait() {
    if (this.handUses > 0) {
      this.handUses--;
      return true;
    }
    return false;
  }

  // Метод для оновлення існуючих зон у реальному часі
  #onConfigUpdate({ path, value }) {
    // 1. Якщо змінилася перспектива (perspectiveSquash)
    if (path.includes("perspectiveSquash")) {
      const prop = path[path.length - 1]; // Отримуємо "top" або "bottom"

      if (prop === "top" || prop === "bottom") {
        // Оновлюємо збережене значення в менеджері
        this.#locationSquash[prop] = value;

        // Проходимося по ВСІХ закинутих зонах і оновлюємо їх
        for (const zone of this.#zones) {
          if (prop === "top") zone.squashTop = value;
          if (prop === "bottom") zone.squashBottom = value;
        }
      }
    }

    // 2. БОНУС: Якщо ви зміните 'radius' прикормки в DevTools,
    // він теж миттєво оновиться на екрані!
    if (path.includes("baits") && path.includes("radius")) {
      const baitId = path[path.indexOf("baits") - 1]; // Отримуємо ID прикормки (напр. carp_mix_basic)

      for (const zone of this.#zones) {
        if (zone.baitId === baitId) {
          zone.baseRadius = value;
        }
      }
    }
  }

  getBoatEnergy() {
    if (this.#boatEnergy === null) {
      const config = this.#chumConfig.deliveryMethods.boat;
      const stats = config.statsByLevel[config.level] || config.statsByLevel[1];
      this.#boatEnergy = stats.maxEnergy;
    }
    return this.#boatEnergy;
  }

  hasDriftingBoat() {
    return this.#boats.some((b) => b.state === "drifting");
  }

  spawnIdleBoat(startX, startY) {
    const boatConfig = this.#chumConfig.deliveryMethods.boat;
    const currentEnergy = this.getBoatEnergy();
    const boat = new BaitBoat(startX, startY, boatConfig, null, currentEnergy);
    this.#boats.push(boat);
    return boat;
  }

  loadFromStorage() {
    const savedZones = CacheManager.get(this.#storageKey, []);

    this.#zones = savedZones
      .map((z) => {
        const baitConfig = this.#chumConfig.baits[z.baitId];
        if (!baitConfig) return null;

        return new ChumZone(
          z.id,
          z.x,
          z.y,
          baitConfig,
          z.deployRealTimeMs,
          this.#locationSquash,
          z.isDelivered,
        );
      })
      .filter((z) => z !== null);

    this.#memoryGrid = CacheManager.get(this.#locationMemoryKey, {});
  }

  saveToStorage() {
    if (typeof CacheManager === "undefined") return;

    const zonesToSave = this.#zones
      .filter((z) => !z.isExpired)
      .map((z) => ({
        id: z.id,
        x: z.x,
        y: z.y,
        baitId: z.baitId,
        deployRealTimeMs: z.deployRealTimeMs,
        isDelivered: z.isDelivered,
      }));

    CacheManager.set(this.#storageKey, zonesToSave);
    CacheManager.set(this.#locationMemoryKey, this.#memoryGrid);
  }

  deployBait(targetX, targetY, baitId, method, activeBoat = null) {
    const baitConfig = this.#chumConfig.baits[baitId];
    if (!baitConfig) return null;

    const zoneId = Date.now().toString() + Math.floor(Math.random() * 1000);

    // ВИПРАВЛЕНО: Зона "доставлена" одразу, якщо кораблика немає в аргументах
    // (це означає, що ми кинули рукою АБО натиснули кнопку скидання на вже приплившому кораблику)
    const isDeliveredNow = activeBoat === null;

    const newZone = new ChumZone(
      zoneId,
      targetX,
      targetY,
      baitConfig,
      Date.now(),
      this.#locationSquash,
      isDeliveredNow, // <--- Передаємо правильний статус
    );

    const overlappingIndex = this.#zones.findIndex((z) =>
      z.checkOverlap(newZone),
    );
    if (overlappingIndex !== -1) {
      this.#zones[overlappingIndex] = newZone;
    } else {
      this.#zones.push(newZone);
    }

    if (activeBoat) {
      activeBoat.setTarget(targetX, targetY, zoneId);
    }

    this.#addMemory(targetX, targetY);
    this.saveToStorage();
    return newZone;
  }

  #addMemory(x, y) {
    const gridX = Math.floor(x / 100) * 100;
    const gridY = Math.floor(y / 100) * 100;
    const key = `${gridX}_${gridY}`;
    this.#memoryGrid[key] = (this.#memoryGrid[key] || 0) + 0.05;
  }

  removeBoat(boat) {
    const index = this.#boats.indexOf(boat);
    if (index !== -1) {
      this.#boats.splice(index, 1);
    }
  }

  update(realTimeNow, timeScale) {
    let needsSave = false;
    for (let i = this.#zones.length - 1; i >= 0; i--) {
      const zone = this.#zones[i];
      zone.currentBonus = zone.updateState(realTimeNow, timeScale);
      if (zone.isExpired) {
        this.#zones.splice(i, 1);
        needsSave = true;
      }
    }
    if (needsSave) this.saveToStorage();
  }

  updateBoats(dt, checkWater, cellSize, env) {
    let needsSave = false;
    for (let i = this.#boats.length - 1; i >= 0; i--) {
      const boat = this.#boats[i];
      boat.update(dt, checkWater, cellSize, env);
      this.#boatEnergy = boat.energy;

      if (boat.isBaitDropped && boat.zoneId) {
        const zone = this.#zones.find((z) => z.id === boat.zoneId);
        if (zone && !zone.isDelivered) {
          zone.x = boat.pos.x;
          zone.y = boat.pos.y;

          zone.isDelivered = true;
          zone.deployRealTimeMs = Date.now();
          needsSave = true;
        }
        boat.zoneId = null;
      }

      if (boat.isFinished) {
        this.#boats.splice(i, 1);
      }
    }
    if (needsSave) this.saveToStorage();
  }

  isBoatMoving() {
    return this.#boats.some(
      (b) => b.state === "deploying" || b.state === "returning",
    );
  }

  getWaitingBoat() {
    return this.#boats.find((b) => b.state === "waiting" && b.zoneId !== null);
  }

  activateWaitingBoat() {
    const boat = this.getWaitingBoat();
    if (boat) {
      boat.isBaitDropped = true;

      const isManual = this.#chumConfig.deliveryMethods.boat.manualControl;
      if (!isManual) {
        boat.state = "returning";
      } else {
        boat.state = "waiting";
      }
    }
  }

  getMultiplier(floatX, floatY, fishId, virtualTopY, virtualBottomY) {
    let activeMultiplier = 1.0;

    for (const zone of this.#zones) {
      const zoneMult = zone.getMultiplierAt(
        floatX,
        floatY,
        fishId,
        virtualTopY,
        virtualBottomY,
      );
      if (zoneMult > activeMultiplier) {
        activeMultiplier = zoneMult;
      }
    }

    const gridX = Math.floor(floatX / 100) * 100;
    const gridY = Math.floor(floatY / 100) * 100;
    const memoryBonus = this.#memoryGrid[`${gridX}_${gridY}`] || 0;

    return activeMultiplier + memoryBonus;
  }

  getChumDataAt(floatX, floatY, vTop, vBottom) {
    let bestBonus = 1.0;
    let bestTargets = [];

    for (const zone of this.#zones) {
      if (!zone.isDelivered || zone.isExpired) continue;

      const zoneMult = zone.getMultiplierAt(
        floatX,
        floatY,
        null,
        vTop,
        vBottom,
      );

      if (zoneMult > bestBonus) {
        bestBonus = zoneMult;
        if (zone.baitConfig && Array.isArray(zone.baitConfig.targetFishes)) {
          bestTargets = zone.baitConfig.targetFishes;
        }
      }
    }

    return { bonus: bestBonus, targets: bestTargets };
  }

  getActiveChumTargets(floatX, floatY, virtualTopY, virtualBottomY) {
    const bonus = this.getMultiplier(
      floatX,
      floatY,
      null,
      virtualTopY,
      virtualBottomY,
    );

    if (bonus > 1.0) {
      for (const zone of this.#zones) {
        if (!zone.isDelivered) continue;

        if (
          zone.getMultiplierAt(
            floatX,
            floatY,
            null,
            virtualTopY,
            virtualBottomY,
          ) > 1.0
        ) {
          const baitConfig = this.#chumConfig.baits[zone.baitId];
          if (baitConfig && baitConfig.targetFishes) {
            return baitConfig.targetFishes;
          }
        }
      }
    }
    return null;
  }

  getZones() {
    return this.#zones;
  }
  getBoats() {
    return this.#boats;
  }
}

class BaitBoat {
  #sensorRays = [];

  constructor(startX, startY, config, zoneId = null, initialEnergy = null) {
    this.startPos = new Vector2(startX, startY);
    this.pos = new Vector2(startX, startY);
    this.target = null;
    this.config = config;
    this.stats = config.statsByLevel[config.level] || config.statsByLevel[1];
    this.zoneId = zoneId;
    this.velocity = new Vector2(0, 0);
    this.angle = -Math.PI / 2;
    this.energy = initialEnergy !== null ? initialEnergy : this.stats.maxEnergy;
    this.state = "idle";
    this.isBaitDropped = false;
    this.isFinished = false;
    this.hasLeftShore = false;
    this.remainingSections = config.sections || 1;
    this.waypoints = [];
  }

  get sensorRays() {
    return this.#sensorRays;
  }

  setTarget(targetX, targetY, zoneId = null, isReturn = false) {
    if (this.state === "drifting") return;
    const isManual = this.config.manualControl;

    if (!isManual && !isReturn && this.state === "deploying") {
      this.waypoints.push({ x: targetX, y: targetY, zoneId: zoneId });
      return;
    }

    this.target = new Vector2(targetX, targetY);
    if (zoneId !== null) this.zoneId = zoneId;
    this.state = isReturn ? "returning" : "deploying";
  }

  getVisualWaypoints() {
    const points = [];
    if (this.state === "deploying" && this.target) {
      points.push({ x: this.target.x, y: this.target.y });
    }
    for (const wp of this.waypoints) {
      points.push({ x: wp.x, y: wp.y });
    }
    return points;
  }

  // ГОЛОВНИЙ ЦИКЛ (Читається як інструкція)
  update(dt, checkWater, cellSize, env) {
    if (this.state === "idle" || this.isFinished) return;

    const dtSec = dt * 0.001;
    const isManual = this.config.manualControl;

    this.#updateEnergy(dtSec);

    if (this.state === "waiting" || this.state === "drifting") {
      this.#applyDrift(dtSec, checkWater, env);
      return;
    }

    const targetInfo = this.#calculateTargetInfo();
    const obstacles = !isManual
      ? this.#scanEnvironment(checkWater, cellSize)
      : { isForwardBlocked: false, clearAngle: null, lookDist: 0 };

    // 1. Перевірка прибуття або екстреного скидання
    if (this.#checkArrival(targetInfo, obstacles, isManual)) {
      return; // Якщо прибули, перериваємо логіку руху в цьому кадрі
    }

    // 2. Розрахунок векторів кермування (ШІ або Ручне)
    const steering = this.#calculateSteering(targetInfo, obstacles, isManual);

    // 3. Застосування фізики (інерція, швидкість, обертання)
    this.#applyPhysics(steering, dtSec);

    // 4. Рух та ковзання по колізіях
    this.#moveAndCollide(dtSec, checkWater, isManual);

    // 5. Перевірка повернення на берег
    this.#checkShoreParking(isManual);
  }

  // ПРИВАТНІ МЕТОДИ (Інкапсульована логіка)
  #updateEnergy(dtSec) {
    const drainMult = this.state === "waiting" ? 0.5 : 1;
    if (this.state !== "drifting") {
      this.energy -= this.stats.energyDrainPerSec * drainMult * dtSec;
      if (this.energy <= 0) {
        this.energy = 0;
        this.state = "drifting";
      }
    }
  }

  #applyDrift(dtSec, checkWater, env) {
    if (!env || !env.current) return;

    const driftSpeed = env.current.speedPxPerSec * 0.8;
    const dx = env.current.direction.x * driftSpeed * dtSec;
    const dy = env.current.direction.y * driftSpeed * dtSec;

    if (checkWater) {
      if (checkWater(this.pos.x + dx, this.pos.y)) this.pos.x += dx;
      if (checkWater(this.pos.x, this.pos.y + dy)) this.pos.y += dy;
    } else {
      this.pos.x += dx;
      this.pos.y += dy;
    }

    if (this.state === "drifting") {
      const targetAngle = Math.atan2(
        env.current.direction.y,
        env.current.direction.x,
      );
      let angleDiff = targetAngle - this.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), dtSec);
    }
  }

  #calculateTargetInfo() {
    const target = this.state === "deploying" ? this.target : this.startPos;
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    const distSq = dx * dx + dy * dy;
    return { dx, dy, distSq, dist: Math.sqrt(distSq) || 1 };
  }

  #scanEnvironment(checkWater, cellSize) {
    const currentSpeed = Math.sqrt(
      this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y,
    );
    const maxSpeed = this.stats.speedPxPerSec;
    const speedRatio = Math.min(1.0, currentSpeed / maxSpeed);

    const baseLook = 2 * cellSize;
    const lookDist = baseLook + speedRatio * 3 * cellSize;

    const maxSpread = Math.PI / 2;
    const minSpread = Math.PI / 6;
    const currentSpread = maxSpread - (maxSpread - minSpread) * speedRatio;

    const angles = [
      0,
      -currentSpread * 0.5,
      currentSpread * 0.5,
      -currentSpread,
      currentSpread,
    ];

    const turnSpeed = this.config.turnSpeedRad || 3.0;
    const turnRadius = maxSpeed / turnSpeed;
    const safetyRadius = Math.max(cellSize, turnRadius * 0.9);

    let isForwardBlocked = false;
    let clearAngle = null;
    let isTrapped = false;

    this.#sensorRays = [];

    for (let i = 0; i < angles.length; i++) {
      const offset = angles[i];
      const checkAngle = this.angle + offset;

      const farX = this.pos.x + Math.cos(checkAngle) * lookDist;
      const farY = this.pos.y + Math.sin(checkAngle) * lookDist;

      const closeX = this.pos.x + Math.cos(checkAngle) * safetyRadius;
      const closeY = this.pos.y + Math.sin(checkAngle) * safetyRadius;

      const isFarClear = checkWater(farX, farY);
      const isCloseClear = checkWater(closeX, closeY);

      this.#sensorRays.push({
        startX: this.pos.x,
        startY: this.pos.y,
        endX: farX,
        endY: farY,
        isBlocked: !(isFarClear && isCloseClear),
      });

      if (isFarClear && isCloseClear) {
        if (clearAngle === null) clearAngle = checkAngle;
      } else {
        if (i === 0) isForwardBlocked = true;
        if (!isCloseClear && Math.abs(offset) <= currentSpread * 0.5) {
          isTrapped = true;
        }
      }
    }

    const backX = this.pos.x - Math.cos(this.angle) * safetyRadius;
    const backY = this.pos.y - Math.sin(this.angle) * safetyRadius;
    const canReverse = checkWater(backX, backY);

    return { isForwardBlocked, clearAngle, lookDist, isTrapped, canReverse };
  }

  #checkArrival({ dist }, { isForwardBlocked }, isManual) {
    const radiusReturn = this.config.finishRadiusReturning || 30;
    const radiusTarget = this.config.finishRadiusTarget || 5;
    const finishRadius =
      this.state === "returning" ? radiusReturn : radiusTarget;

    const isSmartDrop =
      !isManual && this.state === "deploying" && dist < 45 && isForwardBlocked;

    if (dist < finishRadius || isSmartDrop) {
      if (this.state === "deploying") {
        if (!isManual) {
          if (this.zoneId !== null) this.isBaitDropped = true;
          if (this.zoneId === null) {
            this.isBaitDropped = false;
            this.#processNextWaypoint();
          }
        } else {
          this.state = "waiting";
        }
      } else if (this.state === "returning") {
        this.isFinished = true;
      }
      return true; // Логіку руху перервано (ми прибули)
    }
    return false; // Продовжуємо рух
  }

  #processNextWaypoint() {
    if (this.waypoints.length > 0) {
      let closestIdx = 0;
      let minSq = Infinity;

      for (let i = 0; i < this.waypoints.length; i++) {
        const wpx = this.waypoints[i].x - this.pos.x;
        const wpy = this.waypoints[i].y - this.pos.y;
        const dSqSq = wpx * wpx + wpy * wpy;
        if (dSqSq < minSq) {
          minSq = dSqSq;
          closestIdx = i;
        }
      }

      const wp = this.waypoints.splice(closestIdx, 1)[0];
      this.target.x = wp.x;
      this.target.y = wp.y;
      this.zoneId = wp.zoneId;
    } else {
      this.state = "returning";
    }
  }

  #calculateSteering(
    { dx, dy, dist },
    { isForwardBlocked, clearAngle, lookDist },
    isManual,
  ) {
    let steerX = 0;
    let steerY = 0;
    const slowRadius = this.config.slowRadius || 80;
    const arrivalRatio = dist < slowRadius ? dist / slowRadius : 1.0;

    // 1. SEEK (Прагнення до цілі)
    steerX += (dx / dist) * arrivalRatio;
    steerY += (dy / dist) * arrivalRatio;

    const isParking = this.state === "returning" && dist < lookDist * 1.5;

    // 2. AVOIDANCE (ШІ обхід перешкод)
    if (!isManual && isForwardBlocked && !isParking) {
      steerX *= 0.1; // Глушимо тягу вперед
      steerY *= 0.1;

      if (clearAngle !== null) {
        steerX += Math.cos(clearAngle) * 4;
        steerY += Math.sin(clearAngle) * 4;
      } else {
        steerX -= Math.cos(this.angle) * 4;
        steerY -= Math.sin(this.angle) * 4;
      }
    }

    // 3. РОЗРАХУНОК ГАЛЬМА (Більше не віднімаємо від steerX!)
    let currentBrake = 0;
    if (dist < slowRadius) {
      const maxBrake = this.config.brakeForce || 0.4;
      currentBrake =
        !isManual && isForwardBlocked && !isParking
          ? 0
          : maxBrake * (1.0 - arrivalRatio);
    }

    // Повертаємо вектор напрямку ТА силу гальма окремо
    return { x: steerX, y: steerY, brake: currentBrake };
  }

  #applyPhysics(steering, dtSec) {
    const accel = this.config.acceleration || 400;

    const steeringMag = Math.sqrt(
      steering.x * steering.x + steering.y * steering.y,
    );

    // 1. РОЗВОРОТ (Спочатку крутимо кермо!)
    // Якщо ШІ дає команду кудись пливти, ми спочатку розвертаємо туди ніс
    if (steeringMag > 0.01) {
      const desiredAngle = Math.atan2(steering.y, steering.x);
      let angleDiff = desiredAngle - this.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const maxTurn = (this.config.turnSpeedRad || 3.0) * dtSec;
      this.angle +=
        Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);
    }

    // 2. ВЕКТОР ТЯГИ (Пропелер штовхає ТІЛЬКИ туди, куди дивиться ніс)
    if (steeringMag > 0.01) {
      const dirX = steering.x / steeringMag;
      const dirY = steering.y / steeringMag;

      const noseX = Math.cos(this.angle);
      const noseY = Math.sin(this.angle);

      // Dot product: перевіряємо, наскільки напрямок ШІ співпадає з носом (від -1 до 1)
      const alignment = dirX * noseX + dirY * noseY;

      // ---> АНТИ-ВИХОР (Anti-Orbit Protection) <---
      // Отримуємо дистанцію з вектора (ми знаємо, що steeringMag падає біля цілі)
      const isVeryClose = steeringMag < 0.5; // Ми в центрі slowRadius
      const isOvershot = alignment < 0.5; // Ніс дивиться повз ціль або назад

      if (alignment > 0) {
        // Якщо ми промазали, але знаходимося дуже близько до цілі - глушимо мотор на 80%,
        // щоб катер не літав колами, а дав носу час розвернутися на місці.
        const thrustMultiplier = isVeryClose && isOvershot ? 0.2 : 1.0;

        const forwardThrust = alignment * accel * dtSec * thrustMultiplier;
        this.velocity.x += noseX * forwardThrust;
        this.velocity.y += noseY * forwardThrust;
      }
    }

    // 3. ЕФЕКТ КІЛЯ (Вбиваємо бокове ковзання - імітація кіля у воді)
    const noseX = Math.cos(this.angle);
    const noseY = Math.sin(this.angle);
    const rightX = -noseY; // Вектор правого борту
    const rightY = noseX;

    // Розкладаємо поточну швидкість на "вперед/назад" і "вправо/вліво"
    const forwardSpeed = this.velocity.x * noseX + this.velocity.y * noseY;
    let lateralSpeed = this.velocity.x * rightX + this.velocity.y * rightY;

    // Тертя води об борти зрізає 50% бокової швидкості щокадру
    lateralSpeed *= 0.5;

    // Збираємо швидкість назад докупи
    this.velocity.x = noseX * forwardSpeed + rightX * lateralSpeed;
    this.velocity.y = noseY * forwardSpeed + rightY * lateralSpeed;

    // 4. ГАЛЬМА І ТЕРТЯ
    if (steering.brake > 0) {
      const brakeFriction = Math.max(0, 1.0 - steering.brake * dtSec * 5);
      this.velocity.x *= brakeFriction;
      this.velocity.y *= brakeFriction;
    }

    // Природний опір води (швидкість падає, якщо відпустити газ)
    this.velocity.x *= 0.98;
    this.velocity.y *= 0.98;

    // 5. ОБМЕЖЕННЯ ШВИДКОСТІ
    const maxSpeed = this.stats.speedPxPerSec;
    const vSq =
      this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y;
    if (vSq > maxSpeed * maxSpeed) {
      const v = Math.sqrt(vSq);
      this.velocity.x = (this.velocity.x / v) * maxSpeed;
      this.velocity.y = (this.velocity.y / v) * maxSpeed;
    }
  }

  #moveAndCollide(dtSec, checkWater, isManual) {
    const nextX = this.pos.x + this.velocity.x * dtSec;
    const nextY = this.pos.y + this.velocity.y * dtSec;

    if (checkWater) {
      const canMoveX = checkWater(nextX, this.pos.y);
      const canMoveY = checkWater(this.pos.x, nextY);

      if (canMoveX) this.pos.x = nextX;
      else this.velocity.x *= -0.3; // Відскік

      if (canMoveY) this.pos.y = nextY;
      else this.velocity.y *= -0.3; // Відскік

      // Якщо вперлися глухо в ручному режимі
      if (!canMoveX && !canMoveY && isManual) {
        this.state = "waiting";
      }
    } else {
      this.pos.x = nextX;
      this.pos.y = nextY;
    }
  }

  #checkShoreParking(isManual) {
    if (!this.hasLeftShore && this.startPos.y - this.pos.y > 50) {
      this.hasLeftShore = true;
    }

    if (
      this.hasLeftShore &&
      this.state === "returning" &&
      this.pos.y >= this.startPos.y - 30
    ) {
      if (!isManual) {
        this.isFinished = true;
      } else {
        this.state = "waiting";
      }
    }
  }
}

class ChumZone {
  constructor(id, x, y, baitConfig, deployRealTimeMs, isDelivered = false) {
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
  }

  updateState(realTimeNow, timeScale) {
    // ... (Цей метод залишається без змін, він працює ідеально)
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

  // ЗАМІНА: Замість top/bottom отримуємо проектор
  getMultiplierAt(targetX, targetY, targetFishId, projector) {
    if (this.isExpired || !this.isDelivered) return 1.0;

    if (
      targetFishId !== null &&
      !this.baitConfig.targetFishes.includes(targetFishId)
    ) {
      return 1.0;
    }

    // 1. Отримуємо нову тригонометричну перспективу
    const perspective = projector.getPerspective(this.y);

    // 2. ДИНАМІЧНИЙ РАДІУС (Точна копія логіки з рендерера)
    // Масштабуємо фізичний радіус вдалині та сплющуємо його
    const currentRadX = this.baseRadius * perspective.scale;
    const currentRadY = currentRadX * perspective.squashY;

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

  // ЗАМІНА: Тепер враховує перспективу при накладанні
  checkOverlap(otherZone, projector) {
    const perspective = projector.getPerspective(this.y);

    const dx = this.x - otherZone.x;
    // Нормалізуємо Y через новий squashY, перетворюючи еліпс назад у коло для перевірки
    const dy = (this.y - otherZone.y) / perspective.squashY;

    const dist = Math.hypot(dx, dy);

    // Масштаб впливає на те, наскільки великою зона здається фізично
    const effectiveRadius =
      Math.max(this.baseRadius, otherZone.baseRadius) * perspective.scale;

    return dist < effectiveRadius * 0.6;
  }
}

class ChumManager {
  #chumConfig;
  #zones = [];
  #boats = [];
  #storageKey;
  #locationMemoryKey;
  #memoryGrid = {};
  #boatEnergy = null;
  #projector;

  constructor(locationId, chumConfig, projector) {
    this.#chumConfig = chumConfig;
    this.#projector = projector;
    this.#storageKey = `chum_active_${locationId}`;
    this.#locationMemoryKey = `chum_memory_${locationId}`;

    // ВИПРАВЛЕНО: Додано безпечні перевірки та дефолтні значення
    this.handUses = chumConfig?.deliveryMethods?.hand?.maxUses ?? 999;

    this.loadFromStorage();

    document.addEventListener("config-updated", (e) =>
      this.#onConfigUpdate(e.detail),
    );
  }

  useHandBait() {
    return true;
  }

  // Метод для оновлення існуючих зон у реальному часі
  #onConfigUpdate({ path, value }) {
    // Тепер ми шукаємо в "chums", а не в "baits", оскільки в ITEM_DB це категорія "chums"
    if (path.includes("chums") && path.includes("radius")) {
      // +1 бере назву самої прикормки (наприклад: 'carp_mix_basic')
      const baitId = path[path.indexOf("chums") + 1];
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

  spawnIdleBoat(startX, startY, boatItem = {}) {
    // Енергія та характеристики тепер беруться з екіпірованого предмета (boatItem)
    const currentEnergy = boatItem.maxEnergy || 100;
    const boat = new BaitBoat(startX, startY, boatItem, null, currentEnergy);
    this.#boats.push(boat);
    return boat;
  }

  loadFromStorage() {
    const savedZones = CacheManager.get(this.#storageKey, []);

    this.#zones = savedZones
      .map((z) => {
        const baitConfig = this.#chumConfig.baits[z.baitId];
        if (!baitConfig) return null;

        // ЗМІНА: Прибрано this.#locationSquash
        return new ChumZone(
          z.id,
          z.x,
          z.y,
          baitConfig,
          z.deployRealTimeMs,
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

  deployBait(targetX, targetY, baitId, activeBoat = null) {
    const baitConfig = this.#chumConfig.baits[baitId];
    if (!baitConfig) return null;

    const zoneId = `zone_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const isDeliveredNow = activeBoat === null;

    const newZone = new ChumZone(
      zoneId,
      targetX,
      targetY,
      baitConfig,
      Date.now(),
      isDeliveredNow,
    );

    const overlappingIndex = this.#zones.findIndex(
      (z) => z.isDelivered && z.checkOverlap(newZone, this.#projector),
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

  updateBoats(dt, checkPhysics, checkSensor, cellSize, env) {
    let needsSave = false;
    for (let i = this.#boats.length - 1; i >= 0; i--) {
      const boat = this.#boats[i];
      boat.update(dt, checkPhysics, checkSensor, cellSize, env);
      this.#boatEnergy = boat.energy;

      if (boat.isBaitDropped && boat.zoneId) {
        const zone = this.#zones.find((z) => z.id === boat.zoneId);
        if (zone) {
          zone.x = boat.pos.x;
          zone.y = boat.pos.y;
          zone.isDelivered = true;
          zone.deployRealTimeMs = Date.now();
          needsSave = true;
        }

        boat.isBaitDropped = false;
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

      // Беремо налаштування ручного контролю з конфігу самого кораблика
      const isManual = boat.config?.manualControl ?? true;

      if (!isManual) {
        boat.state = "returning";
      } else {
        boat.state = "waiting";
      }
    }
  }

  getMultiplier(floatX, floatY, fishId) {
    let activeMultiplier = 1.0;

    for (const zone of this.#zones) {
      const zoneMult = zone.getMultiplierAt(
        floatX,
        floatY,
        fishId,
        this.#projector,
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

  getChumDataAt(floatX, floatY) {
    let bestBonus = 1.0;
    let bestTargets = [];

    for (const zone of this.#zones) {
      if (!zone.isDelivered || zone.isExpired) continue;

      const zoneMult = zone.getMultiplierAt(
        floatX,
        floatY,
        null,
        this.#projector,
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

  getActiveChumTargets(floatX, floatY) {
    const bonus = this.getMultiplier(floatX, floatY, null);

    if (bonus > 1.0) {
      for (const zone of this.#zones) {
        if (!zone.isDelivered) continue;

        if (zone.getMultiplierAt(floatX, floatY, null, this.#projector) > 1.0) {
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
  #sensorRays = Array.from({ length: 3 }, () => ({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isBlocked: false,
  }));
  #sensorTimer = 0;
  #sensorInterval = 0.15;
  #cachedSensors = null;
  #lastScanData = { lookDist: 0, angles: [0, 0, 0] };

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

    this.avoidanceState = "none";
    this.avoidanceTimer = 0;
    this.avoidanceTargetAngle = 0;
    this.engineThrottle = 1.0;
    this.persistenceTimer = 0;
    this.maneuverTimer = 0;
  }

  // Знайди і заміни гетер
  get sensorRays() {
    if (this.config.showSensors === false) return [];
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

  update(dt, checkPhysics, checkSensor, cellSize, env) {
    if (this.state === "idle" || this.isFinished) return;

    const dtSec = dt * 0.001;
    this.persistenceTimer = Math.max(0, this.persistenceTimer - dtSec);
    this.maneuverTimer = Math.max(0, this.maneuverTimer - dtSec);
    const isManual = this.config.manualControl;

    this.#updateEnergy(dtSec);

    this.#sensorTimer -= dtSec;
    if (this.#sensorTimer <= 0 || !this.#cachedSensors) {
      this.#cachedSensors = this.#scanEnvironment(
        checkPhysics,
        checkSensor,
        cellSize,
      );
      this.#sensorTimer = this.#sensorInterval;
    }

    if (this.state === "waiting" || this.state === "drifting") {
      this.#applyDrift(dtSec, checkPhysics, env);
      this.#syncRayPositions();
      return;
    }

    this.#syncRayPositions();

    const targetInfo = this.#calculateTargetInfo();
    const obstacles = this.#cachedSensors;

    if (isManual) {
      const targetAlignment =
        (targetInfo.dx / targetInfo.dist) * Math.cos(this.angle) +
        (targetInfo.dy / targetInfo.dist) * Math.sin(this.angle);

      if (
        obstacles.isBumperHit &&
        targetAlignment > -0.2 &&
        this.avoidanceState === "none"
      ) {
        this.engineThrottle = Math.max(0, this.engineThrottle - dtSec * 1.5);

        if (
          this.engineThrottle === 0 &&
          Math.hypot(this.velocity.x, this.velocity.y) < 15
        ) {
          this.state = "waiting";
          return;
        }
      } else {
        this.engineThrottle = Math.min(1.0, this.engineThrottle + dtSec * 2.0);
      }
    } else {
      this.engineThrottle = 1.0;
    }

    if (this.#checkArrival(targetInfo, obstacles, isManual)) return;

    const steering = this.#calculateSteering(
      targetInfo,
      obstacles,
      isManual,
      dtSec,
    );
    this.#applyPhysics(steering, dtSec);
    this.#moveAndCollide(dtSec, checkPhysics, isManual);
    this.#checkShoreParking(isManual);
  }

  #syncRayPositions() {
    if (!this.#lastScanData.lookDist) return;
    const { lookDist, angles } = this.#lastScanData;

    for (let i = 0; i < 3; i++) {
      const ray = this.#sensorRays[i];
      const checkAngle = this.angle + angles[i];

      ray.startX = this.pos.x;
      ray.startY = this.pos.y;
      ray.endX = this.pos.x + Math.cos(checkAngle) * lookDist;
      ray.endY = this.pos.y + Math.sin(checkAngle) * lookDist;
    }
  }

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

  #applyDrift(dtSec, checkPhysics, env) {
    if (!env || !env.current) return;

    const driftSpeed = env.current.speedPxPerSec * 0.8;
    const dx = env.current.direction.x * driftSpeed * dtSec;
    const dy = env.current.direction.y * driftSpeed * dtSec;

    if (checkPhysics) {
      if (checkPhysics(this.pos.x + dx, this.pos.y)) this.pos.x += dx;
      if (checkPhysics(this.pos.x, this.pos.y + dy)) this.pos.y += dy;
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

  #scanEnvironment(checkPhysics, checkSensor, cellSize) {
    const speedRatio = Math.min(
      1.0,
      Math.hypot(this.velocity.x, this.velocity.y) / this.stats.speedPxPerSec,
    );
    const rangeFactor = this.config.sensorRangeFactor || 1.5;

    // Розраховуємо дистанцію: базова дальність + динамічний бонус від швидкості
    const lookDist = cellSize * rangeFactor + speedRatio * cellSize * 2.0;
    const currentSpread = Math.PI / 2 - (Math.PI / 3) * speedRatio;

    const angles = [0, -currentSpread, currentSpread];
    this.#lastScanData = { lookDist, angles };
    const obstacleWeights = [false, false, false];
    let isForwardBlocked = false;

    for (let i = 0; i < 3; i++) {
      const checkAngle = this.angle + angles[i];
      let isRayBlocked = false;

      const testSteps = [0.5, 1.0];
      for (const step of testSteps) {
        const px = this.pos.x + Math.cos(checkAngle) * lookDist * step;
        const py = this.pos.y + Math.sin(checkAngle) * lookDist * step;

        if (checkSensor && checkSensor(px, py)) {
          isRayBlocked = true;
          break;
        }
      }

      obstacleWeights[i] = isRayBlocked;

      // Перевикористовуємо існуючі об'єкти замість створення нових
      const ray = this.#sensorRays[i];
      ray.startX = this.pos.x;
      ray.startY = this.pos.y;
      ray.endX = this.pos.x + Math.cos(checkAngle) * lookDist;
      ray.endY = this.pos.y + Math.sin(checkAngle) * lookDist;
      ray.isBlocked = isRayBlocked;

      if (i === 0 && isRayBlocked) isForwardBlocked = true;
    }

    const bumperX = this.pos.x + Math.cos(this.angle) * (cellSize * 0.6);
    const bumperY = this.pos.y + Math.sin(this.angle) * (cellSize * 0.6);
    const isBumperHit = checkPhysics ? !checkPhysics(bumperX, bumperY) : false;

    return { isForwardBlocked, isBumperHit, obstacleWeights, lookDist };
  }

  #setAvoidance(newState, time, angle) {
    this.avoidanceState = newState;
    this.avoidanceTimer = time;
    this.avoidanceTargetAngle = angle;
  }

  #calculateSteering({ dx, dy, dist }, sensors, isManual, dtSec) {
    const slowRadius = this.config.slowRadius || 150;
    const t = Math.min(dist / slowRadius, 1.0);
    const arrivalRatio = t * t;

    const isBlindZone = dist < sensors.lookDist * 1.5;

    if (this.avoidanceTimer > 0) {
      this.avoidanceTimer -= dtSec;
      const maneuverTime = this.config.maneuver?.maneuverTimeSec || 1.5;

      if (this.avoidanceTimer <= 0) {
        if (this.avoidanceState === "reversing") {
          this.maneuverTimer = maneuverTime;
          if (!isManual) {
            const turnDir = sensors.obstacleWeights[1] ? 1 : -1;
            this.#setAvoidance(
              "evading",
              0.6,
              this.angle + (Math.PI / 2) * turnDir,
            );
          } else {
            this.#setAvoidance("none", 0, 0);
          }
        } else {
          this.#setAvoidance("none", 0, 0);
        }
      } else if (
        this.avoidanceState === "reversing" &&
        !sensors.isForwardBlocked
      ) {
        if (this.avoidanceTimer <= 0.5) {
          this.maneuverTimer = 1.5;
          if (!isManual) {
            const turnDir = sensors.obstacleWeights[1] ? 1 : -1;
            this.#setAvoidance(
              "evading",
              0.6,
              this.angle + (Math.PI / 2) * turnDir,
            );
          } else {
            this.#setAvoidance("none", 0, 0);
          }
        }
      }
    }

    const targetAlignment =
      (dx / dist) * Math.cos(this.angle) + (dy / dist) * Math.sin(this.angle);
    const isGoingTowardsWall = targetAlignment > -0.2;

    // ЛОГІКА УХИЛЯННЯ/РЕВЕРСУ ДЛЯ ОБОХ РЕЖИМІВ
    if (this.avoidanceState === "none") {
      const reverseTime = this.config.maneuver?.reverseTimeSec || 1.2; // <--- ДОДАНО

      if (isManual) {
        if (sensors.isBumperHit && !isGoingTowardsWall) {
          this.#setAvoidance("reversing", reverseTime, this.angle); // <--- ЗМІНЕНО
        }
      } else {
        if (!isBlindZone) {
          const isStuck =
            Math.hypot(this.velocity.x, this.velocity.y) < 10 &&
            sensors.isForwardBlocked &&
            isGoingTowardsWall;
          if (sensors.isBumperHit || isStuck) {
            this.#setAvoidance("reversing", reverseTime, this.angle); // <--- ЗМІНЕНО
          } else if (sensors.isForwardBlocked && isGoingTowardsWall) {
            const turnDir = sensors.obstacleWeights[1] ? 1 : -1;
            this.#setAvoidance(
              "evading",
              0.5,
              this.angle + (Math.PI / 2) * turnDir,
            );
          }
        }
      }
    }

    if (this.avoidanceState === "reversing") {
      return {
        x: -Math.cos(this.avoidanceTargetAngle),
        y: -Math.sin(this.avoidanceTargetAngle),
        brake: 0,
      };
    }
    if (this.avoidanceState === "evading") {
      return {
        x: Math.cos(this.avoidanceTargetAngle),
        y: Math.sin(this.avoidanceTargetAngle),
        brake: 0.3,
      };
    }

    let steerX = (dx / dist) * arrivalRatio;
    let steerY = (dy / dist) * arrivalRatio;
    let hazardBrake = 0;

    // 2. AVOIDANCE (Оновлено: використання persistenceTimer та параметрів конфігу)
    const isForwardBlocked = sensors.isForwardBlocked;
    const isParking = this.state === "returning";

    // Визначаємо вільний кут для об'їзду (якщо один з боків вільний)
    const turnDir = sensors.obstacleWeights[1] ? 1 : -1;
    const clearAngle =
      sensors.obstacleWeights[1] && sensors.obstacleWeights[2]
        ? null
        : this.angle + (Math.PI / 2) * turnDir;

    // Читаємо налаштування з CONFIG
    const persistenceTime = (this.config.avoidancePersistenceMs || 300) / 1000;
    const thrustMult = this.config.avoidanceThrustMultiplier || 0.1;

    // Активуємо таймер, якщо бачимо перешкоду
    if (isForwardBlocked) {
      this.persistenceTimer = persistenceTime;
    }

    // Кораблик вважає, що він у режимі "об'їзду", поки бачить стіну АБО поки не вичерпано таймер
    const inAvoidanceMode =
      (isForwardBlocked || this.persistenceTimer > 0) && !isParking;

    if (!isManual && inAvoidanceMode && this.avoidanceState === "none") {
      // Використовуємо динамічну тягу з конфігу замість жорсткого 0.1
      steerX *= thrustMult;
      steerY *= thrustMult;

      if (clearAngle !== null) {
        steerX += Math.cos(clearAngle) * 4;
        steerY += Math.sin(clearAngle) * 4;
      } else {
        // Якщо шлях зовсім заблокований - здаємо назад
        steerX -= Math.cos(this.angle) * 4;
        steerY -= Math.sin(this.angle) * 4;
      }
    }

    const targetBrake =
      dist < slowRadius && this.avoidanceState === "none"
        ? (this.config.brakeForce || 0.5) * (1.0 - arrivalRatio)
        : 0;
    return { x: steerX, y: steerY, brake: Math.max(targetBrake, hazardBrake) };
  }

  #moveAndCollide(dtSec, checkPhysics, isManual) {
    const moveX = this.velocity.x * dtSec;
    const moveY = this.velocity.y * dtSec;
    const nextX = this.pos.x + moveX;
    const nextY = this.pos.y + moveY;

    if (checkPhysics) {
      const cellX = checkPhysics(nextX, this.pos.y);
      const cellY = checkPhysics(this.pos.x, nextY);

      if (cellX !== null) {
        this.pos.x = nextX;
      } else {
        this.velocity.x = 0;
        this.pos.x -=
          moveX !== 0 ? Math.sign(moveX) * 2 : Math.cos(this.angle) * 2;
      }

      if (cellY !== null) {
        this.pos.y = nextY;
      } else {
        this.velocity.y = 0;
        this.pos.y -=
          moveY !== 0 ? Math.sign(moveY) * 2 : Math.sin(this.angle) * 2;
      }

      if (cellX === null && cellY === null && isManual) this.state = "waiting";
    } else {
      this.pos.x = nextX;
      this.pos.y = nextY;
    }
  }

  #checkArrival({ dist }, { isForwardBlocked }, isManual) {
    const cfg = this.config;
    const targetRad = cfg.finishRadiusTarget || 10;
    const finishRad =
      this.state === "returning" ? cfg.finishRadiusReturning || 30 : targetRad;

    const speed = Math.hypot(this.velocity.x, this.velocity.y);

    const isCloseEnough = dist < finishRad;
    const isStalled = speed < 15 && dist < finishRad * 2.5;
    const isSmartDrop =
      !isManual && this.state === "deploying" && dist < 45 && isForwardBlocked;

    if (isCloseEnough || isStalled || isSmartDrop) {
      if (this.state === "deploying") {
        if (!isManual) {
          if (this.zoneId && !this.isBaitDropped) {
            this.isBaitDropped = true;
            this.remainingSections--;
            return true;
          }

          if (this.isBaitDropped) return true;

          if (this.waypoints.length > 0) {
            this.#processNextWaypoint();
            return true;
          } else {
            this.zoneId = null;
            this.state = "returning";
          }
        } else {
          this.state = "waiting";
        }
      } else if (this.state === "returning") {
        this.isFinished = true;
      }
      return true;
    }
    return false;
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

  #applyPhysics(steering, dtSec) {
    const accel = this.config.acceleration || 400;
    const isReversing = this.avoidanceState === "reversing";
    const steeringMag = Math.hypot(steering.x, steering.y);
    const noseX = Math.cos(this.angle);
    const noseY = Math.sin(this.angle);

    if (steeringMag > 0.01) {
      let desiredAngle = Math.atan2(steering.y, steering.x);
      if (isReversing) desiredAngle += Math.PI;

      let angleDiff = desiredAngle - this.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // ПРЯМЕ КЕРУВАННЯ (Ваш оригінальний підхід)
      const maxTurn = (this.config.turnSpeedRad || 3.0) * dtSec;
      this.angle +=
        Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);

      if (isReversing) {
        const reverseMult = this.config.maneuver?.reverseThrustMult || 0.8;
        const reverseThrust = accel * dtSec * reverseMult; // <--- ЗМІНЕНО
        this.velocity.x -= noseX * reverseThrust;
        this.velocity.y -= noseY * reverseThrust;
      } else {
        const alignment =
          (steering.x / steeringMag) * noseX +
          (steering.y / steeringMag) * noseY;

        const alignFactor = Math.max(0.3, alignment);

        const maneuverThrust = this.config.maneuver?.maneuverThrustMult || 0.3;
        const maneuverPenalty = this.maneuverTimer > 0 ? maneuverThrust : 1.0; // <--- ЗМІНЕНО

        const thrustMultiplier =
          steeringMag < 0.5 && alignment < 0.7 ? 0.1 : 1.0;

        const forwardThrust =
          alignFactor * accel * dtSec * thrustMultiplier * maneuverPenalty;

        this.velocity.x += noseX * forwardThrust;
        this.velocity.y += noseY * forwardThrust;
      }
    }

    const rightX = -noseY;
    const rightY = noseX;
    const forwardSpeed = this.velocity.x * noseX + this.velocity.y * noseY;
    let lateralSpeed = this.velocity.x * rightX + this.velocity.y * rightY;

    lateralSpeed *= 0.05;

    this.velocity.x = noseX * forwardSpeed + rightX * lateralSpeed;
    this.velocity.y = noseY * forwardSpeed + rightY * lateralSpeed;

    if (steering.brake > 0) {
      const brakeFriction = Math.max(0, 1.0 - steering.brake * dtSec * 7);
      this.velocity.x *= brakeFriction;
      this.velocity.y *= brakeFriction;
    }

    this.velocity.x *= 0.97;
    this.velocity.y *= 0.97;

    const maneuverSpeed = this.config.maneuver?.maneuverSpeedMult || 0.4;
    const maxSpeed =
      this.maneuverTimer > 0
        ? this.stats.speedPxPerSec * maneuverSpeed // <--- ЗМІНЕНО
        : this.stats.speedPxPerSec;

    const vMag = Math.hypot(this.velocity.x, this.velocity.y);
    if (vMag > maxSpeed) {
      this.velocity.x = (this.velocity.x / vMag) * maxSpeed;
      this.velocity.y = (this.velocity.y / vMag) * maxSpeed;
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

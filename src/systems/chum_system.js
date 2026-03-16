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

  updateBoats(dt, checkPhysics, checkSensor, cellSize, env) {
    let needsSave = false;
    for (let i = this.#boats.length - 1; i >= 0; i--) {
      const boat = this.#boats[i];
      boat.update(dt, checkPhysics, checkSensor, cellSize, env);
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

    // ГОРДІСТЬ КОРАБЛИКА: Він не пливе туди, де немає води або меж карти
    const mapW = this.config.mapWidth || 2560;
    const mapH = this.config.mapHeight || 1440;
    const isOutOfBounds =
      targetX < 0 || targetX > mapW || targetY < 0 || targetY > mapH;

    // Якщо точка за межами - просто ігноруємо команду
    if (isOutOfBounds) return;

    const isManual = this.config.manualControl;

    // Якщо ми вже в дорозі - додаємо в чергу (авторежим)
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
  update(dt, checkPhysics, checkSensor, cellSize, env) {
    if (this.state === "idle" || this.isFinished) return;

    const dtSec = dt * 0.001;
    const isManual = this.config.manualControl;

    this.#updateEnergy(dtSec);

    if (this.state === "waiting" || this.state === "drifting") {
      this.#applyDrift(dtSec, checkPhysics, env);
      return;
    }

    const targetInfo = this.#calculateTargetInfo();
    const obstacles = !isManual
      ? this.#scanEnvironment(checkPhysics, checkSensor, cellSize)
      : {
          isForwardBlocked: false,
          clearAngle: null,
          lookDist: 0,
          obstacleWeights: [false, false, false, false, false],
          isBumperHit: false,
        };

    if (this.#checkArrival(targetInfo, obstacles, isManual)) {
      return;
    }

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

  #setAvoidance(newState, time, angle, reason) {
    if (this.avoidanceState !== newState) {
      console.log(
        `[BaitBoat] Avoidance: ${this.avoidanceState || "undefined"} -> ${newState} | Reason: ${reason}`,
      );
      this.avoidanceState = newState;
    }
    this.avoidanceTimer = time;
    this.avoidanceTargetAngle = angle;
  }

  #calculateSteering({ dx, dy, dist }, sensors, isManual, dtSec) {
    let steerX = 0;
    let steerY = 0;
    let hazardBrake = 0;

    const slowRadius = this.config.slowRadius || 150;
    const arrivalRatio = dist < slowRadius ? dist / slowRadius : 1.0;

    const isDocking = dist < sensors.lookDist * 1.2;
    const distToStart = Math.hypot(
      this.pos.x - this.startPos.x,
      this.pos.y - this.startPos.y,
    );
    const isLaunching =
      this.state === "deploying" && distToStart < sensors.lookDist * 1.5;
    const isBlindZone = isDocking || isLaunching;

    if (!this.avoidanceState) {
      this.#setAvoidance("none", 0, 0, "Initialization");
    }

    if (this.avoidanceTimer > 0) {
      this.avoidanceTimer -= dtSec;
      if (this.avoidanceTimer <= 0) {
        if (this.avoidanceState === "reversing") {
          const turnDir = sensors.obstacleWeights[1] ? 1 : -1;
          this.#setAvoidance(
            "evading",
            0.6,
            this.angle + (Math.PI / 2) * turnDir,
            "Reversing finished, evading",
          );
        } else {
          this.#setAvoidance("none", 0, 0, "Timer expired");
        }
      }
    }

    if (!isManual && !isBlindZone) {
      const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y);
      const targetAlignment =
        (dx / dist) * Math.cos(this.angle) + (dy / dist) * Math.sin(this.angle);
      const isGoingTowardsWall = targetAlignment > -0.2;
      const isStuck =
        currentSpeed < 10 && sensors.isForwardBlocked && isGoingTowardsWall;

      if ((sensors.isBumperHit || isStuck) && this.avoidanceState === "none") {
        const trigger = sensors.isBumperHit
          ? "Bumper hit"
          : "Stuck (low speed)";
        this.#setAvoidance("reversing", 1.2, this.angle, trigger);
      } else if (
        this.avoidanceState === "none" &&
        sensors.isForwardBlocked &&
        isGoingTowardsWall
      ) {
        const turnDir = sensors.obstacleWeights[1] ? 1 : -1;
        this.#setAvoidance(
          "evading",
          0.5,
          this.angle + (Math.PI / 2) * turnDir,
          "Forward blocked",
        );
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
    }

    steerX = (dx / dist) * arrivalRatio;
    steerY = (dy / dist) * arrivalRatio;

    if (!isManual && !isBlindZone && this.avoidanceState === "none") {
      const repulsion = 1.8;
      if (sensors.obstacleWeights[1] || sensors.obstacleWeights[3]) {
        steerX += Math.cos(this.angle + Math.PI / 2) * repulsion;
        steerY += Math.sin(this.angle + Math.PI / 2) * repulsion;
      }
      if (sensors.obstacleWeights[2] || sensors.obstacleWeights[4]) {
        steerX += Math.cos(this.angle - Math.PI / 2) * repulsion;
        steerY += Math.sin(this.angle - Math.PI / 2) * repulsion;
      }

      const targetAlignment =
        (dx / dist) * Math.cos(this.angle) + (dy / dist) * Math.sin(this.angle);
      if (sensors.isForwardBlocked && targetAlignment > -0.2) hazardBrake = 0.6;
    }

    let targetBrake = 0;
    if (dist < slowRadius && this.avoidanceState === "none") {
      targetBrake = (this.config.brakeForce || 0.5) * (1.0 - arrivalRatio);
    }

    return { x: steerX, y: steerY, brake: Math.max(targetBrake, hazardBrake) };
  }

  #scanEnvironment(checkPhysics, checkSensor, cellSize) {
    const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y);
    const maxSpeed = this.stats.speedPxPerSec;
    const speedRatio = Math.min(1.0, currentSpeed / maxSpeed);

    const lookDist = cellSize * 1.5 + speedRatio * cellSize * 2.5;
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

    this.#sensorRays = [];
    let obstacleWeights = [false, false, false, false, false];
    let clearAngle = null;
    let isForwardBlocked = false;

    for (let i = 0; i < angles.length; i++) {
      const offset = angles[i];
      const checkAngle = this.angle + offset;
      let isRayBlocked = false;

      const testSteps = [0.3, 0.6, 1.0];

      for (const step of testSteps) {
        const px = this.pos.x + Math.cos(checkAngle) * lookDist * step;
        const py = this.pos.y + Math.sin(checkAngle) * lookDist * step;

        const isCollision = checkSensor ? checkSensor(px, py) : false;

        if (isCollision) {
          isRayBlocked = true;
          break;
        }
      }

      obstacleWeights[i] = isRayBlocked;

      this.#sensorRays.push({
        startX: this.pos.x,
        startY: this.pos.y,
        endX: this.pos.x + Math.cos(checkAngle) * lookDist,
        endY: this.pos.y + Math.sin(checkAngle) * lookDist,
        isBlocked: isRayBlocked,
      });

      if (!isRayBlocked && clearAngle === null) clearAngle = checkAngle;
      if (isRayBlocked && i === 0) isForwardBlocked = true;
    }

    const bumperX = this.pos.x + Math.cos(this.angle) * (cellSize * 0.6);
    const bumperY = this.pos.y + Math.sin(this.angle) * (cellSize * 0.6);
    const bumperCell = checkPhysics ? checkPhysics(bumperX, bumperY) : null;
    const isBumperHit = !bumperCell;

    return {
      isForwardBlocked,
      clearAngle,
      lookDist,
      isBumperHit,
      obstacleWeights,
    };
  }

  #moveAndCollide(dtSec, checkWater, isManual) {
    const moveX = this.velocity.x * dtSec;
    const moveY = this.velocity.y * dtSec;
    const nextX = this.pos.x + moveX;
    const nextY = this.pos.y + moveY;

    if (checkWater) {
      const cellX = checkWater(nextX, this.pos.y);
      const cellY = checkWater(this.pos.x, nextY);

      if (cellX !== null) {
        this.pos.x = nextX;
      } else {
        this.velocity.x = 0;
        // Відштовхуємось проти реального вектору руху!
        const pushDir = moveX !== 0 ? Math.sign(moveX) : Math.cos(this.angle);
        this.pos.x -= pushDir * 2;
      }

      if (cellY !== null) {
        this.pos.y = nextY;
      } else {
        this.velocity.y = 0;
        const pushDir = moveY !== 0 ? Math.sign(moveY) : Math.sin(this.angle);
        this.pos.y -= pushDir * 2;
      }

      if (cellX === null && cellY === null && isManual) {
        this.state = "waiting";
      }
    } else {
      this.pos.x = nextX;
      this.pos.y = nextY;
    }
  }

  #checkArrival({ dist }, { isForwardBlocked }, isManual) {
    const radiusReturn = this.config.finishRadiusReturning || 30;
    const radiusTarget = this.config.finishRadiusTarget || 10; // Трохи збільшили допуск
    const finishRadius =
      this.state === "returning" ? radiusReturn : radiusTarget;

    // "РОЗУМНЕ ПРИБУТТЯ":
    // Якщо ми в радіусі 45 пікселів і бачимо стіну (не можемо пройти далі),
    // вважаємо, що ми на місці. Це фіксить застрягання на "точках біля берега".
    const isSmartDrop =
      !isManual && this.state === "deploying" && dist < 45 && isForwardBlocked;

    if (dist < finishRadius || isSmartDrop) {
      if (this.state === "deploying") {
        if (!isManual) {
          // Якщо це точка зони - скидаємо прикормку
          if (this.zoneId !== null) {
            this.isBaitDropped = true;
          }

          // Переходимо до наступної цілі або вертаємось додому
          if (this.waypoints.length > 0 || this.zoneId === null) {
            this.isBaitDropped = false; // Скидаємо прапорець для наступної точки
            this.#processNextWaypoint();
          }
        } else {
          // В ручному режимі просто чекаємо на наступну команду
          this.state = "waiting";
        }
      } else if (this.state === "returning") {
        this.isFinished = true;
      }
      return true; // Ми прибули, рух зупинено
    }

    return false; // Ще пливемо
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

    const steeringMag = Math.sqrt(
      steering.x * steering.x + steering.y * steering.y,
    );

    const noseX = Math.cos(this.angle);
    const noseY = Math.sin(this.angle);

    if (steeringMag > 0.01) {
      let desiredAngle = Math.atan2(steering.y, steering.x);

      if (isReversing) {
        desiredAngle += Math.PI;
      }

      let angleDiff = desiredAngle - this.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const maxTurn = (this.config.turnSpeedRad || 3.0) * dtSec;
      this.angle +=
        Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);
    }

    if (steeringMag > 0.01) {
      if (isReversing) {
        const reverseThrust = accel * dtSec * 0.8;
        this.velocity.x -= noseX * reverseThrust;
        this.velocity.y -= noseY * reverseThrust;
      } else {
        const dirX = steering.x / steeringMag;
        const dirY = steering.y / steeringMag;
        const alignment = dirX * noseX + dirY * noseY;

        if (alignment > 0) {
          const isVeryClose = steeringMag < 0.5;
          const isOvershot = alignment < 0.7;
          const thrustMultiplier = isVeryClose && isOvershot ? 0.1 : 1.0;

          const forwardThrust = alignment * accel * dtSec * thrustMultiplier;
          this.velocity.x += noseX * forwardThrust;
          this.velocity.y += noseY * forwardThrust;
        }
      }
    }

    const rightX = -noseY;
    const rightY = noseX;

    const forwardSpeed = this.velocity.x * noseX + this.velocity.y * noseY;
    let lateralSpeed = this.velocity.x * rightX + this.velocity.y * rightY;

    lateralSpeed *= 0.1;

    this.velocity.x = noseX * forwardSpeed + rightX * lateralSpeed;
    this.velocity.y = noseY * forwardSpeed + rightY * lateralSpeed;

    if (steering.brake > 0) {
      const brakeFriction = Math.max(0, 1.0 - steering.brake * dtSec * 7);
      this.velocity.x *= brakeFriction;
      this.velocity.y *= brakeFriction;
    }

    this.velocity.x *= 0.97;
    this.velocity.y *= 0.97;

    const maxSpeed = this.stats.speedPxPerSec;
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

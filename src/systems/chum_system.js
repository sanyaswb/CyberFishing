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

    // 1. СПОЧАТКУ зберігаємо перспективу з конфігу
    this.#locationSquash = locationSquash || { top: 0.15, bottom: 0.75 };

    // 2. І ТІЛЬКИ ПОТІМ завантажуємо зони (тепер вони отримають правильні дані)
    this.loadFromStorage();

    document.addEventListener("config-updated", (e) =>
      this.#onConfigUpdate(e.detail),
    );
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

    const isHand = method === "hand";
    const zoneId = Date.now().toString() + Math.floor(Math.random() * 1000);

    // --- ВИПРАВЛЕНО: рівно 7 аргументів у правильному порядку ---
    const newZone = new ChumZone(
      zoneId, // 1. id
      targetX, // 2. x
      targetY, // 3. y
      baitConfig, // 4. baitConfig
      Date.now(), // 5. deployRealTimeMs
      this.#locationSquash, // 6. locationSquash
      isHand, // 7. isDelivered
    );

    const overlappingIndex = this.#zones.findIndex((z) =>
      z.checkOverlap(newZone),
    );
    if (overlappingIndex !== -1) {
      this.#zones[overlappingIndex] = newZone;
    } else {
      this.#zones.push(newZone);
    }

    if (!isHand && activeBoat) {
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
  }

  setTarget(targetX, targetY, zoneId = null, isReturn = false) {
    this.target = new Vector2(targetX, targetY);
    if (zoneId !== null) this.zoneId = zoneId;

    if (this.state === "drifting") return;

    this.state = isReturn ? "returning" : "deploying";
  }

  update(dt, checkWater, cellSize, env) {
    if (this.state === "idle" || this.isFinished) return;

    const drainMult = this.state === "waiting" ? 0.5 : 1.0;
    const isManual = this.config.manualControl;

    // --- ВИТРАТА ЕНЕРГІЇ ---
    if (this.state !== "drifting") {
      this.energy -= this.stats.energyDrainPerSec * drainMult * (dt / 1000);
      if (this.energy <= 0) {
        this.energy = 0;
        this.state = "drifting";
      }
    }

    // --- ДРЕЙФ ---
    if (this.state === "waiting" || this.state === "drifting") {
      if (env && env.current) {
        const boatDriftResistance = 0.8;
        const driftSpeed = env.current.speedPxPerSec * boatDriftResistance;
        const dx = env.current.direction.x * driftSpeed * (dt / 1000);
        const dy = env.current.direction.y * driftSpeed * (dt / 1000);
        let nextX = this.pos.x + dx;
        let nextY = this.pos.y + dy;
        if (checkWater) {
          if (!checkWater(nextX, this.pos.y)) nextX = this.pos.x;
          if (!checkWater(this.pos.x, nextY)) nextY = this.pos.y;
        }
        this.pos.x = nextX;
        this.pos.y = nextY;
        if (this.state === "drifting") {
          this.angle = Math.atan2(
            env.current.direction.y,
            env.current.direction.x,
          );
        }
      }
      return;
    }

    const currentTarget =
      this.state === "deploying" ? this.target : this.startPos;
    const distToTarget = Math.hypot(
      currentTarget.x - this.pos.x,
      currentTarget.y - this.pos.y,
    );
    const finishRadius = this.state === "returning" ? 30 : 15;

    // --- ПРИБУТТЯ ДО ЦІЛІ ---
    if (distToTarget < finishRadius) {
      if (this.state === "deploying") {
        if (!isManual) {
          this.isBaitDropped = true;
          this.state = "returning";
        } else {
          this.state = "waiting";
        }
      } else if (this.state === "returning") {
        this.isFinished = true;
      }
      return;
    }

    let desiredAngle = Math.atan2(
      currentTarget.y - this.pos.y,
      currentTarget.x - this.pos.x,
    );

    // --- ШТУЧНИЙ ІНТЕЛЕКТ (Вуса, тільки для Авто) ---
    if (!isManual) {
      let actualLookAhead = this.config.lookAheadCells * cellSize;
      if (distToTarget > actualLookAhead * 1.5) {
        const anglesToCheck = [
          0,
          -Math.PI / 4,
          Math.PI / 4,
          -Math.PI / 2,
          Math.PI / 2,
        ];
        let clearAngle = null;
        let isPathBlocked = false;

        for (const offset of anglesToCheck) {
          const checkAngle = this.angle + offset;
          const px = this.pos.x + Math.cos(checkAngle) * actualLookAhead;
          const py = this.pos.y + Math.sin(checkAngle) * actualLookAhead;

          if (checkWater && checkWater(px, py)) {
            if (clearAngle === null) clearAngle = checkAngle;
          } else {
            if (offset === 0) isPathBlocked = true;
          }
        }
        if (isPathBlocked && clearAngle !== null) {
          desiredAngle = clearAngle;
        }
      }
    }

    // --- ПЛАВНИЙ ПОВОРОТ ---
    let angleDiff = desiredAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const maxTurn = this.config.turnSpeedRad * (dt / 1000);
    this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);

    // --- ЄДИНА ЛОГІКА ВИХОДУ З ТУПИКА (РЕВЕРС) ---
    // Рахуємо, скільки місця нам треба для безпечного розвороту
    const turnRadius = this.stats.speedPxPerSec / this.config.turnSpeedRad;
    const clearanceDist = Math.max(30, turnRadius * 0.8); // Сенсор дивиться вперед на ~40-50px

    const clearX = this.pos.x + Math.cos(this.angle) * clearanceDist;
    const clearY = this.pos.y + Math.sin(this.angle) * clearanceDist;

    let isForwardClear = true;
    if (checkWater) {
      isForwardClear = checkWater(clearX, clearY);
    }

    let currentSpeed = this.stats.speedPxPerSec;

    // Якщо попереду стіна (не вистачає місця для радіуса)
    if (!isForwardClear) {
      // Якщо нам треба повернути (кут до цілі більше ніж ~11 градусів), здаємо назад!
      if (Math.abs(angleDiff) > 0.2) {
        currentSpeed = -this.stats.speedPxPerSec * 0.6; // Реверс на 60% швидкості
      }
      // Якщо ми дивимось прямо в стіну, і це ручний режим - зупиняємось, щоб не буксувати
      else if (isManual) {
        this.state = "waiting";
        return;
      }
    }

    // --- РУХ І ФІЗИЧНІ ЗІТКНЕННЯ ---
    this.velocity.x = Math.cos(this.angle) * currentSpeed;
    this.velocity.y = Math.sin(this.angle) * currentSpeed;

    const nextX = this.pos.x + this.velocity.x * (dt / 1000);
    const nextY = this.pos.y + this.velocity.y * (dt / 1000);

    // Фінальна перевірка: чи не вріжемося ми, рухаючись туди (навіть задом)
    if (checkWater && !checkWater(nextX, nextY)) {
      if (isManual) {
        this.state = "waiting"; // Затиснуті з усіх боків у ручному - стоїмо
      }
      // В авто-режимі просто ігноруємо рух (стоїмо), але кут продовжує крутитися!
    } else {
      // Якщо вільна вода - застосовуємо координати
      this.pos.x = nextX;
      this.pos.y = nextY;
    }

    // 1. Фіксуємо, що кораблик відплив від берега хоча б на 50 пікселів
    if (!this.hasLeftShore && this.startPos.y - this.pos.y > 50) {
      this.hasLeftShore = true;
    }

    // 2. Якщо кораблик вже плавав, і тепер підійшов близько до берега (на відстань 30 пікселів до стартової лінії Y)
    if (this.hasLeftShore && this.pos.y >= this.startPos.y - 30) {
      console.log("Кораблик повернувся в руки гравцеві!");
      this.isFinished = true; // Кораблик зникає, кнопка прикормки знову активна
    }
  }
}

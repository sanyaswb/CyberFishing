class ChumZone {
  constructor(id, x, y, baitConfig, deployRealTimeMs, isDelivered = false) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.baitConfig = baitConfig;
    this.deployRealTimeMs = deployRealTimeMs;
    this.isDelivered = isDelivered;
    this.isExpired = false;

    this.baseRadX = baitConfig.radiusX;
    this.baseRadYMax = baitConfig.radiusY.max;
    this.baseRadYMin = baitConfig.radiusY.min;
  }

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
    if (!this.baitConfig.targetFishes.includes(targetFishId)) return 1.0;

    const distRatio = Math.max(
      0,
      Math.min(1.0, (this.y - virtualTopY) / (virtualBottomY - virtualTopY)),
    );
    const currentRadY =
      this.baseRadYMin + (this.baseRadYMax - this.baseRadYMin) * distRatio;

    const dx = targetX - this.x;
    const dy = targetY - this.y;

    const isInside =
      (dx * dx) / (this.baseRadX * this.baseRadX) +
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
    return dist < Math.max(this.baseRadX, otherZone.baseRadX);
  }
}

class ChumManager {
  #locationId;
  #zones = [];
  #boats = [];
  #storageKey;
  #locationMemoryKey;
  #memoryGrid = {};
  #boatEnergy = null;

  constructor(locationId) {
    this.#locationId = locationId;
    this.#storageKey = `chum_active_${locationId}`;
    this.#locationMemoryKey = `chum_memory_${locationId}`;
    this.loadFromStorage();
  }

  getBoatEnergy() {
    if (this.#boatEnergy === null) {
      const config = CONFIG.chum.deliveryMethods.boat;
      const stats = config.statsByLevel[config.level] || config.statsByLevel[1];
      this.#boatEnergy = stats.maxEnergy; // Заряджаємо на 100% при першому запуску
    }
    return this.#boatEnergy;
  }

  hasDriftingBoat() {
    return this.#boats.some((b) => b.state === "drifting");
  }

  spawnIdleBoat(startX, startY) {
    const boatConfig = CONFIG.chum.deliveryMethods.boat;
    const currentEnergy = this.getBoatEnergy(); // Беремо залишок батареї
    // Передаємо currentEnergy у кораблик!
    const boat = new BaitBoat(startX, startY, boatConfig, null, currentEnergy);
    this.#boats.push(boat);
    return boat;
  }

  loadFromStorage() {
    if (typeof localStorage !== "undefined") {
      const savedZones = JSON.parse(
        localStorage.getItem(this.#storageKey) || "[]",
      );
      this.#zones = savedZones.map((z) => {
        const zone = new ChumZone(
          z.id,
          z.x,
          z.y,
          CONFIG.chum.baits[z.baitId],
          z.deployRealTimeMs,
          z.isDelivered,
        );
        return zone;
      });
      this.#memoryGrid = JSON.parse(
        localStorage.getItem(this.#locationMemoryKey) || "{}",
      );
    }
  }

  saveToStorage() {
    if (typeof localStorage === "undefined") return;
    const zonesToSave = this.#zones
      .filter((z) => !z.isExpired)
      .map((z) => ({
        id: z.id,
        x: z.x,
        y: z.y,
        baitId: z.baitConfig.id,
        deployRealTimeMs: z.deployRealTimeMs,
        isDelivered: z.isDelivered,
      }));
    localStorage.setItem(this.#storageKey, JSON.stringify(zonesToSave));
    localStorage.setItem(
      this.#locationMemoryKey,
      JSON.stringify(this.#memoryGrid),
    );
  }

  deployBait(targetX, targetY, baitId, method, activeBoat = null) {
    const baitConfig = CONFIG.chum.baits[baitId];
    if (!baitConfig) return null;

    const isHand = method === "hand";
    const zoneId = Date.now().toString() + Math.floor(Math.random() * 1000);

    const newZone = new ChumZone(
      zoneId,
      targetX,
      targetY,
      baitConfig,
      Date.now(),
      isHand,
    );

    const overlappingIndex = this.#zones.findIndex((z) =>
      z.checkOverlap(newZone),
    );
    if (overlappingIndex !== -1) {
      this.#zones[overlappingIndex] = newZone;
    } else {
      this.#zones.push(newZone);
    }

    // Якщо це кораблик, передаємо йому координати цілі
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

      const isManual = CONFIG.chum.deliveryMethods.boat.manualControl;
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

  // ОНОВЛЕНИЙ МЕТОД: Повертає бонус і список риб, враховуючи перспективу
  getChumDataAt(floatX, floatY, vTop, vBottom) {
    // Використовуємо твій існуючий метод (передаємо null замість конкретної риби)
    const bonus = this.getMultiplier(floatX, floatY, null, vTop, vBottom);

    if (bonus > 1.0) {
      // Шукаємо, яка саме зона дала нам цей бонус
      const activeZone = this.#zones.find((zone) => {
        if (!zone.isDelivered) return false;
        // Перевіряємо точне перетинання з урахуванням овалу
        return zone.getMultiplierAt(floatX, floatY, null, vTop, vBottom) > 1.0;
      });

      if (activeZone) {
        const baitConfig = CONFIG.chum.baits[activeZone.baitId];
        return {
          bonus: bonus,
          targets: baitConfig.targetFishes || [], // Віддаємо масив цільової риби!
        };
      }
    }
    return { bonus: 1.0, targets: null };
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

        // Перевіряємо, чи саме ця зона дає бонус у цій точці
        if (
          zone.getMultiplierAt(
            floatX,
            floatY,
            null,
            virtualTopY,
            virtualBottomY,
          ) > 1.0
        ) {
          const baitConfig = CONFIG.chum.baits[zone.baitId];
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

    if (this.state !== "drifting") {
      this.energy -= this.stats.energyDrainPerSec * drainMult * (dt / 1000);
      if (this.energy <= 0) {
        this.energy = 0;
        this.state = "drifting";
      }
    }

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

    if (distToTarget < finishRadius) {
      if (this.state === "deploying") {
        this.state = "waiting";
      } else if (this.state === "returning") {
        this.isFinished = true;
      }
      return;
    }

    let desiredAngle = Math.atan2(
      currentTarget.y - this.pos.y,
      currentTarget.x - this.pos.x,
    );

    let actualLookAhead = this.config.lookAheadCells * cellSize;
    let ignoreCollisions = false;

    if (distToTarget < actualLookAhead * 1.5) {
      actualLookAhead = 0;
      ignoreCollisions = true;
    }

    if (actualLookAhead > 0) {
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

      if (isPathBlocked) {
        if (clearAngle !== null) {
          desiredAngle = clearAngle;
        } else {
          desiredAngle = this.angle + Math.PI;
        }
      }
    }

    let angleDiff = desiredAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const maxTurn = this.config.turnSpeedRad * (dt / 1000);
    this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);

    this.velocity.x = Math.cos(this.angle) * this.stats.speedPxPerSec;
    this.velocity.y = Math.sin(this.angle) * this.stats.speedPxPerSec;

    const nextX = this.pos.x + this.velocity.x * (dt / 1000);
    const nextY = this.pos.y + this.velocity.y * (dt / 1000);

    let canMove = true;
    if (checkWater && !ignoreCollisions) {
      canMove = checkWater(nextX, nextY);
    }

    if (canMove) {
      this.pos.x = nextX;
      this.pos.y = nextY;
    } else {
      this.angle += Math.PI / 2;
    }
  }
}

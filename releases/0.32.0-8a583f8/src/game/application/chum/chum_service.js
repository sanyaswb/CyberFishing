import { BaitBoat } from "./bait_boat.js";
import { ChumZone } from "./chum_zone.js";

export class ChumService {
  #chumConfig;
  #zones = [];
  #boats = [];
  #storageKey;
  #locationMemoryKey;
  #memoryGrid = {};
  #boatEnergy = null;
  #projector;
  #onConfigUpdateBind;
  #onBoatReturned;
  #rng;
  #now;
  #cache;
  #configEvents;

  constructor(locationId, chumConfig, projector, services = {}) {
    this.#chumConfig = chumConfig;
    this.#cache = services.cache;
    this.#projector = projector;
    this.#rng = services.rng || { next: () => Math.random() };
    this.#now = services.now || (() => Date.now());
    this.#onBoatReturned =
      typeof services.onBoatReturned === "function"
        ? services.onBoatReturned
        : null;
    this.#storageKey = `chum_active_${locationId}`;
    this.#locationMemoryKey = `chum_memory_${locationId}`;


    this.handUses = chumConfig?.deliveryMethods?.hand?.maxUses ?? 999;

    this.loadFromStorage();

    this.#onConfigUpdateBind = (e) => this.#onConfigUpdate(e.detail);
    // DEV config edits arrive as "config-updated" events on the injected event target (the document in production).
    this.#configEvents = services.configEvents || null;
    this.#configEvents?.addEventListener("config-updated", this.#onConfigUpdateBind);
  }

  // Apply configuration edits to existing zones.
  #onConfigUpdate({ path, value }) {

    if (path.includes("chums") && path.includes("radius")) {
      // The next path segment identifies the chum catalog item.
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
      const statsConfig = config.effectiveStats || config;
      const stats =
        statsConfig.statsByLevel[statsConfig.upgradeLevel] ||
        statsConfig.statsByLevel[1];
      this.#boatEnergy = stats.maxEnergy;
    }
    return this.#boatEnergy;
  }

  spawnIdleBoat(startX, startY, boatItem = {}) {
    // Energy and performance come from the equipped boat item.
    const currentEnergy = boatItem.maxEnergy || 100;
    const boat = new BaitBoat(startX, startY, boatItem, null, currentEnergy);
    this.#boats.push(boat);
    return boat;
  }

  loadFromStorage() {
    const savedZones = this.#cache.get(this.#storageKey, []);

    this.#zones.length = 0;
    for (let i = 0; i < savedZones.length; i++) {
      const z = savedZones[i];
      const baitConfig = this.#chumConfig.baits[z.baitId];
      if (!baitConfig) continue;

      this.#zones.push(
        new ChumZone(
          z.id,
          z.x,
          z.y,
          baitConfig,
          z.deployRealTimeMs,
          z.isDelivered,
        ),
      );
    }

    this.#memoryGrid = this.#cache.get(this.#locationMemoryKey, {});
  }

  saveToStorage() {
    if (!this.#cache) return;

    const zonesToSave = [];
    for (let i = 0; i < this.#zones.length; i++) {
      const z = this.#zones[i];
      if (z.isExpired) continue;
      zonesToSave.push({
        id: z.id,
        x: z.x,
        y: z.y,
        baitId: z.baitId,
        deployRealTimeMs: z.deployRealTimeMs,
        isDelivered: z.isDelivered,
      });
    }

    this.#cache.set(this.#storageKey, zonesToSave);
    this.#cache.set(this.#locationMemoryKey, this.#memoryGrid);
  }

  deployBait(targetX, targetY, baitId, activeBoat = null) {
    const baitConfig = this.#chumConfig.baits[baitId];
    if (!baitConfig) return null;

    const now = this.#now();
    const randomIdPart =
      typeof this.#rng.int === "function"
        ? this.#rng.int(0, 999)
        : Math.floor(this.#rng.next() * 1000);
    const zoneId = `zone_${Math.floor(now)}_${randomIdPart}`;
    const isDeliveredNow = activeBoat === null;

    const newZone = new ChumZone(
      zoneId,
      targetX,
      targetY,
      baitConfig,
      now,
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
          zone.deployRealTimeMs = this.#now();
          needsSave = true;
        }

        boat.isBaitDropped = false;
        boat.zoneId = null;
      }

      if (boat.isFinished) {
        if (boat.remainingSections <= 0) {
          this.#onBoatReturned?.({
            allBaysEmptied: true,
            hasReturnedToPlayer: true,
            rootInstanceId: boat.rootInstanceId,
          });
        }
        this.#boats.splice(i, 1);
      }
    }
    if (needsSave) this.saveToStorage();
  }

  dispose() {
    if (this.#onConfigUpdateBind) {
      this.#configEvents?.removeEventListener("config-updated", this.#onConfigUpdateBind);
      this.#onConfigUpdateBind = null;
    }
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

  getZones() {
    return this.#zones;
  }
  getBoats() {
    return this.#boats;
  }
}

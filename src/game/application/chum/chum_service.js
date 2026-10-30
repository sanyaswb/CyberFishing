import { BaitBoat } from "./bait_boat.js";
import { BaitBoatGroundPlaneScope } from "./bait_boat_ground_plane_scope.js";
import { BoatPowerRatePolicy } from "../../domain/rules/boat_power_rate_policy.js";
import { ChumZone } from "./chum_zone.js";

export class ChumService {
  #chumConfig;
  #zones = [];
  #boats = [];
  #groundPlane = new BaitBoatGroundPlaneScope();
  #storageKey;
  #power;
  #powerRate = new BoatPowerRatePolicy();
  #getWaterMetric;
  #onConfigUpdateBind;
  #onBoatReturned;
  #rng;
  #now;
  #gameTime;
  #legacyTimeScale;
  #cache;
  #configEvents;
  #boatsKey;
  #boatSaveMs = 0;
  #consumeBoatChum;
  #onBoatLost;
  #findBoatItem;
  #routePlanner;

  constructor(locationId, chumConfig, getWaterMetric, services = {}) {
    this.#chumConfig = chumConfig;
    this.#cache = services.cache;
    this.#getWaterMetric = getWaterMetric;
    this.#rng = services.rng || { next: () => Math.random() };
    this.#now = services.now || (() => Date.now());
    // Spec 143: boats run on the battery in their slot; DevicePowerService consumes it.
    if (typeof services.devicePower?.consume !== "function") {
      throw new TypeError("ChumService requires devicePower");
    }
    this.#power = services.devicePower;
    // Spec 152: spots live by monotonic game time; legacyTimeScale converts saves from before it.
    if (typeof services.gameTime?.getGameMs !== "function") {
      throw new TypeError("ChumService requires gameTime");
    }
    this.#gameTime = services.gameTime;
    this.#legacyTimeScale = Number(services.legacyTimeScale) || 1;
    this.#onBoatReturned =
      typeof services.onBoatReturned === "function"
        ? services.onBoatReturned
        : null;
    this.#storageKey = `chum_active_${locationId}`;
    // Spec 151: a boat spends a cargo slot when its bunker opens, is lost with its items when the player leaves the
    // location, and a launched boat is saved across reloads (restored from the owned boat item).
    this.#consumeBoatChum = services.consumeBoatChum || null;
    this.#onBoatLost = services.onBoatLost || null;
    this.#findBoatItem = services.findBoatItem || null;
    // Spec 154: routes on the current map ({ plan, isReachable }); without it a boat steers straight with its rays.
    this.#routePlanner = services.routePlanner || null;
    this.#boatsKey = `chum_boats_${locationId}`;

    this.handUses = chumConfig?.deliveryMethods?.hand?.maxUses ?? 999;

    this.loadFromStorage();
    this.#restoreBoats();

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

  // Performance comes from the equipped boat item, power from the battery in its slot (spec 143).
  spawnIdleBoat(startX, startY, boatItem = {}, batteryInstanceId = null) {
    const boat = new BaitBoat(startX, startY, boatItem, null, batteryInstanceId);
    this.#boats.push(boat);
    return boat;
  }

  // Saved spots (spec 152). Records from before spec 152 carry deployRealTimeMs: a delivered zone becomes a one-drop
  // spot of the same age in game time (real age x the legacy timeScale), an undelivered one is dropped.
  loadFromStorage() {
    const savedZones = this.#cache.get(this.#storageKey, []);
    const gameNow = this.#gameTime.getGameMs();

    this.#zones.length = 0;
    for (let i = 0; i < savedZones.length; i++) {
      const z = savedZones[i];
      const baitConfig = this.#spotConfig(z.baitId);
      if (!baitConfig) continue;
      if (z.deployRealTimeMs !== undefined) {
        if (!z.isDelivered) continue;
        const meanDropGameMs = gameNow - Math.max(0, this.#now() - z.deployRealTimeMs) * this.#legacyTimeScale;
        this.#zones.push(new ChumZone({ id: z.id, x: z.x, y: z.y, baitConfig, meanDropGameMs }));
        continue;
      }
      this.#zones.push(new ChumZone({ id: z.id, x: z.x, y: z.y, baitConfig, drops: z.drops,
        meanDropGameMs: z.meanDropGameMs, feedLoad: z.feedLoad, feedGameMs: z.feedGameMs }));
    }
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
        drops: z.drops,
        meanDropGameMs: z.meanDropGameMs,
        feedLoad: z.feedLoad,
        feedGameMs: z.feedGameMs,
      });
    }

    this.#cache.set(this.#storageKey, zonesToSave);
  }

  // A hand cast drops at once; a boat carries the chum to the target and drops it when its bunker opens (spec 152 D2).
  // slotIndex: the boat's cargo slot whose chum this target spends at the drop (spec 151 D5).
  deployBait(targetX, targetY, baitId, activeBoat = null, slotIndex = null) {
    if (!this.#spotConfig(baitId)) return null;
    if (activeBoat) {
      activeBoat.setTarget(targetX, targetY, { baitId, slotIndex });
      return null;
    }
    return this.dropChum(targetX, targetY, baitId);
  }

  // The chum reaches the water: it joins the same chum's spot here or starts a new one (spec 152 D3/D5).
  dropChum(x, y, baitId) {
    const baitConfig = this.#spotConfig(baitId);
    if (!baitConfig) return null;
    const gameMs = this.#gameTime.getGameMs();
    const waterMetric = this.#getWaterMetric();
    let spot = this.#zones.find((zone) => !zone.isExpired && zone.isSameSpot(baitId, x, y, waterMetric));
    if (spot) {
      spot.addDrop(x, y, gameMs);
    } else {
      const randomIdPart =
        typeof this.#rng.int === "function"
          ? this.#rng.int(0, 999)
          : Math.floor(this.#rng.next() * 1000);
      spot = new ChumZone({ id: `zone_${Math.floor(this.#now())}_${randomIdPart}`, x, y, baitConfig,
        meanDropGameMs: gameMs });
      this.#zones.push(spot);
    }
    spot.currentBonus = spot.updateState(gameMs);
    this.saveToStorage();
    return spot;
  }

  // A chum's spot parameters are its effective stats (radius, bonus curve, targetFishes, feed), as the catalog projects
  // them (spec 152 B4: reading them from the definition's top level gave no bonus and no expiry).
  #spotConfig(baitId) {
    const stats = this.#chumConfig.baits[baitId]?.effectiveStats;
    return stats ? { ...stats, id: baitId } : null;
  }

  removeBoat(boat) {
    const index = this.#boats.indexOf(boat);
    if (index !== -1) {
      this.#boats.splice(index, 1);
    }
  }

  update() {
    const gameMs = this.#gameTime.getGameMs();
    let needsSave = false;
    for (let i = this.#zones.length - 1; i >= 0; i--) {
      const zone = this.#zones[i];
      zone.currentBonus = zone.updateState(gameMs);
      if (zone.isExpired) {
        this.#zones.splice(i, 1);
        needsSave = true;
      }
    }
    if (needsSave) this.saveToStorage();
  }

  // waterMetric: the location's metric; every boat update runs on its ground plane (spec 054), and drops and rays are
  // back on the map before anything else reads them.
  updateBoats(dt, checkPhysics, checkSensor, cellSize, env, waterMetric = null) {
    let boatsChanged = false;
    for (let i = this.#boats.length - 1; i >= 0; i--) {
      const boat = this.#boats[i];
      const stateBefore = boat.state;
      this.#planRoute(boat);
      const plane = this.#groundPlane.enter({ metric: waterMetric, boat, checkPhysics, checkSensor, cellSize });
      try {
        boat.update(dt, plane.checkPhysics, plane.checkSensor, plane.cellSize, env);
      } finally {
        this.#groundPlane.exit();
      }
      this.#consumePower(boat, dt);
      this.#planRoute(boat);
      if (boat.state !== stateBefore) boatsChanged = true;

      if (boat.isBaitDropped && boat.drop) {
        // Spec 151 D5: the cargo is spent only now; a slot emptied meanwhile drops nothing.
        const { baitId, slotIndex } = boat.drop;
        if (!this.#consumeBoatChum || this.#consumeBoatChum(slotIndex)) this.dropChum(boat.pos.x, boat.pos.y, baitId);
        boat.isBaitDropped = false;
        boat.drop = null;
        boatsChanged = true;
      }

      if (boat.isFinished || this.#isMoored(boat, waterMetric)) {
        this.#finishBoat(i);
        boatsChanged = true;
      }
    }
    this.#boatSaveMs += Math.max(0, Number(dt) || 0);
    if (boatsChanged || (this.#boatSaveMs >= 1000 && this.#boats.length > 0)) this.saveBoats();
  }

  // A leg plans its route on the map as it is now (spec 154 D1), in map coordinates (outside the ground plane).
  #planRoute(boat) {
    if (!boat.needsRoute) return;
    const goal = boat.legGoal;
    boat.setRoute(this.#routePlanner?.plan(boat.pos.x, boat.pos.y, goal.x, goal.y) ?? null);
  }

  // Spec 154 Q1: a target in water the boat cannot reach from its shore start is refused.
  isReachableByBoat(boat, x, y) {
    return this.#routePlanner ? this.#routePlanner.isReachable(boat.startPos.x, boat.startPos.y, x, y) : true;
  }

  // Spec 151 D8: a drifting boat that reaches the player's shore within its mooring distance is taken back.
  #isMoored(boat, waterMetric) {
    if (boat.state !== "drifting" || !waterMetric) return false;
    const mooringMeters = Number(boat.config.recovery?.mooringMeters);
    return Number.isFinite(mooringMeters) && waterMetric.metersFromShore(boat.pos.y) <= mooringMeters;
  }

  // Spec 151: the player takes a drifting boat back with the landing net; its cargo stays in the bunkers.
  recoverBoat(boat) {
    const index = this.#boats.indexOf(boat);
    if (index === -1 || boat.state !== "drifting") return false;
    this.#finishBoat(index);
    this.saveBoats();
    return true;
  }

  // Spec 151 D1: leaving the location loses every launched boat with its battery and cargo.
  loseBoats() {
    const lost = this.rootInstanceIdsAway();
    this.#boats.length = 0;
    this.saveBoats();
    for (const rootInstanceId of lost) this.#onBoatLost?.({ rootInstanceId });
  }

  // Roots of the boats on the water (not one only being aimed); the inventory keeps them unchanged (spec 151 D5).
  rootInstanceIdsAway() {
    const roots = [];
    for (const boat of this.#boats) {
      if (boat.state !== "idle" && boat.rootInstanceId) roots.push(boat.rootInstanceId);
    }
    return roots;
  }

  saveBoats() {
    this.#boatSaveMs = 0;
    if (!this.#cache) return;
    const snapshots = [];
    for (const boat of this.#boats) {
      if (boat.state === "idle" || !boat.rootInstanceId) continue;
      snapshots.push({ rootInstanceId: boat.rootInstanceId, batteryInstanceId: boat.batteryInstanceId,
        ...boat.toSnapshot() });
    }
    this.#cache.set(this.#boatsKey, snapshots);
  }

  #restoreBoats() {
    const snapshots = this.#cache?.get(this.#boatsKey, []) || [];
    for (const snapshot of snapshots) {
      const boatItem = this.#findBoatItem?.(snapshot.rootInstanceId);
      if (!boatItem) continue;
      const boat = new BaitBoat(snapshot.startX, snapshot.startY, boatItem, null, snapshot.batteryInstanceId);
      this.#boats.push(boat.restore(snapshot));
    }
  }

  // The boat is off the water first, so the return's auto refill may fill its bunkers again.
  #finishBoat(index) {
    const [boat] = this.#boats.splice(index, 1);
    if (boat.remainingSections <= 0) {
      this.#onBoatReturned?.({
        allBaysEmptied: true,
        hasReturnedToPlayer: true,
        rootInstanceId: boat.rootInstanceId,
      });
    }
  }

  // Spec 143 D-P1: a boat in the water consumes its battery by state; an empty or missing battery stops it.
  #consumePower(boat, dt) {
    const reading = this.#power.consume({
      deviceId: boat.rootInstanceId,
      batteryInstanceId: boat.batteryInstanceId,
      unitsPerSecond: this.#powerRate.unitsPerSecond(boat.state, boat.config),
      seconds: Math.max(0, Number(dt) || 0) * 0.001,
    });
    boat.powerRatio = Math.max(0, Math.min(1, reading.percent / 100));
    if (reading.empty) boat.runOutOfPower();
  }

  dispose() {
    if (this.#onConfigUpdateBind) {
      this.#configEvents?.removeEventListener("config-updated", this.#onConfigUpdateBind);
      this.#onConfigUpdateBind = null;
    }
  }

  // The best spot covering the point; an overfed spot gives a bonus below 1 (spec 152 D5).
  getChumDataAt(floatX, floatY) {
    let bestBonus = null;
    let bestTargets = [];
    const waterMetric = this.#getWaterMetric();

    for (const zone of this.#zones) {
      if (zone.isExpired || !zone.covers(floatX, floatY, waterMetric)) continue;
      if (bestBonus === null || zone.currentBonus > bestBonus) {
        bestBonus = zone.currentBonus;
        bestTargets = Array.isArray(zone.baitConfig.targetFishes) ? zone.baitConfig.targetFishes : [];
      }
    }

    return { bonus: bestBonus ?? 1.0, targets: bestTargets };
  }

  getZones() {
    return this.#zones;
  }
  getBoats() {
    return this.#boats;
  }
}

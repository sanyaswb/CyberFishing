import { CastPowerAim } from "../casting/cast_power_aim.js";
import { BoatRules } from "../../domain/rules/boat_rules.js";

export class ChumController {
  #messages;
  #inventory;
  #chum;
  #projector;
  #inventoryUI;
  #fishing;
  #location;
  #clock;
  #config;
  #depthUI;
  #getDynamicBounds;
  #getWaterMetric;
  #getRodVirtualPos;
  #checkWater;
  #markInvalidCast;
  #canPlayerCast;
  #getGameStateName;
  #devicePower;
  #ui;
  #activeHandChum = null;
  #isAiming = false;
  #activeBoat = null;
  #uiClickLockTime = 0;
  #handCastAim = null;
  #pendingHandDrop = null;
  #boatRules = new BoatRules();

  constructor({
    messages,
    inventory,
    chum,
    projector,
    inventoryUI,
    fishing,
    location,
    clock,
    config,
    rng,
    getViewportSize,
    panViewport,
    depthUI,
    getDynamicBounds,
    getWaterMetric,
    getRodVirtualPos,
    checkWater,
    markInvalidCast,
    canPlayerCast,
    getGameStateName,
    devicePower,
    createUi,
  }) {
    this.#messages = messages;
    this.#inventory = inventory;
    this.#chum = chum;
    this.#projector = projector;
    this.#inventoryUI = inventoryUI;
    this.#fishing = fishing;
    this.#location = location;
    this.#clock = clock;
    this.#config = config;
    this.#depthUI = depthUI;
    this.#getDynamicBounds = getDynamicBounds;
    this.#getWaterMetric = getWaterMetric;
    this.#getRodVirtualPos = getRodVirtualPos;
    this.#checkWater = checkWater;
    this.#markInvalidCast = markInvalidCast;
    this.#canPlayerCast = canPlayerCast;
    this.#getGameStateName = getGameStateName;
    this.#devicePower = devicePower;
    this.#handCastAim = new CastPowerAim({
      config,
      projector,
      getWaterMetric,
      getViewportSize,
      panViewport,
      rng,
    });
    this.#ui = createUi(() => this.handleClick());
    this.refreshActiveHandChum();
  }

  get ui() {
    return this.#ui;
  }

  dispose() {
    this.#handCastAim?.reset?.();
    this.#pendingHandDrop = null;
    this.#activeBoat = null;
    this.#ui?.dispose?.();
    this.#ui = null;
  }

  get isAiming() {
    return this.#isAiming;
  }

  get activeBoat() {
    return this.#activeBoat;
  }

  set activeBoat(boat) {
    this.#activeBoat = boat;
  }

  refreshActiveHandChum() {
    this.#activeHandChum = this.#inventory.getEquipped()?.handChum || null;
  }

  updateUI() {
    const eq = this.#inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";
    const boatItem = eq.delivery || {};
    const isManual = boatItem.effectiveStats?.manualControl ?? true;
    const sections = this.#boatRules.sectionCount(boatItem.effectiveStats);

    let state = "idle";
    let count = 0;

    if (method === "hand") {
      const activeChum = this.#activeHandChum;
      count = activeChum ? activeChum.quantity || 1 : 0;
      if (count <= 0) state = "empty";
      else if (this.#isAiming) state = "aiming";
      else state = "idle";
    } else if (method === "boat") {
      const boats = this.#chum.getBoats();
      const activeBoat = boats.length > 0 ? boats[0] : null;

      if (!activeBoat) {
        const loadedCount = this.#countLoadedChums(eq.deliveryChums);
        count = sections;
        // TK-162: without a charged battery the boat cannot go, like without chum: the button shows it.
        state = loadedCount === 0 || this.#batteryProblem(eq) ? "empty" : this.#isAiming ? "aiming" : "idle";
      } else {
        count = activeBoat.remainingSections;

        if (activeBoat.state === "idle") {
          state = this.#isAiming ? "aiming" : "idle";
        } else if (activeBoat.state === "drifting") {
          state = "empty";
        } else if (isManual) {
          if (
            activeBoat.state === "deploying" ||
            activeBoat.state === "returning"
          ) {
            state = "moving";
          } else if (activeBoat.state === "waiting") {
            state = count > 0 ? "ready" : "empty";
          }
        } else if (activeBoat.state === "returning") {
          state = "moving";
        } else if (
          activeBoat.state === "deploying" ||
          activeBoat.state === "waiting"
        ) {
          state = this.#isAiming ? "aiming" : "moving";
        }
      }
    }

    let boatIconUrl = null;
    if (method === "boat") {
      const loadedCount = this.#countLoadedChums(eq.deliveryChums);
      const fullyLoaded = sections > 0 && loadedCount >= sections;
      const artwork = boatItem.skin?.equipment;
      boatIconUrl = fullyLoaded
        ? artwork?.bait || "assets/items/boats/boat-lvl--3_bait.webp"
        : artwork?.noBait || "assets/items/boats/boat-lvl--3_no-bait.webp";
    }

    this.#ui.setState(state, method, count, isManual, !!(eq.delivery || eq.handChum), boatIconUrl);
    this.#syncAimingWithBoatState(method, isManual);
  }

  handleClick() {
    const eq = this.#inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";

    if (method === "hand") {
      if (this.#activeHandChum) {
        this.toggleAim();
      } else {
        this.#warn(this.#messages.noChumInInventory);
      }
      return;
    }

    if (method !== "boat") return;

    const boats = this.#chum.getBoats();
    if (boats.length === 0) {
      const batteryProblem = this.#batteryProblem(eq);
      const loaded = this.#countLoadedChums(eq.deliveryChums) > 0;
      if (loaded && batteryProblem && !this.#isAiming) {
        // TK-162: like empty bunkers (TK-150), a missing or empty battery opens the boat editor at its battery socket.
        this.#inventoryUI?.openSlotEditor?.("delivery", { feedbackSlotId: "battery", tone: "error" });
        this.#warn(batteryProblem);
      } else if (loaded) {
        this.toggleAim();
      } else {
        this.#inventoryUI?.openSlotEditor?.("delivery", { feedbackSlotId: "cargo", tone: "error" });
        this.#warn(this.#messages.loadChumIntoBoat);
      }
      return;
    }

    const activeBoat = boats[0];
    const boatItem = eq.delivery || {};
    const isManual = boatItem.effectiveStats?.manualControl ?? true;

    if (activeBoat.state === "drifting") {
      this.#warn(this.#messages.boatDrifting);
      return;
    }

    if (this.#isAiming) {
      this.toggleAim();
      return;
    }

    if (
      isManual &&
      activeBoat.state === "waiting" &&
      activeBoat.remainingSections > 0
    ) {
      this.#dropManualBoatChum(activeBoat, boatItem);
    }
  }

  toggleAim() {
    const launching = !this.#isAiming && this.#inventory.getEquipped().delivery;
    if (launching && !this.#activeBoat && !this.#isBoatPowered(this.#inventory.getEquipped())) return;
    this.#isAiming = !this.#isAiming;
    this.#uiClickLockTime = this.#clock.now;
    this.#handCastAim?.reset();
    this.#pendingHandDrop = null;

    if (this.#isAiming) {
      this.#depthUI.hide();
    }

    const eq = this.#inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";

    if (this.#isAiming && method === "boat") {
      const bounds = this.#getDynamicBounds();
      const rodPos = this.#getRodVirtualPos(bounds);
      const boatUi = this.#config.ui?.boat || {};
      const baseX = boatUi.x === "center" ? (bounds.left + bounds.right) / 2 : typeof boatUi.x === "number" ? boatUi.x : rodPos.x;
      const startX = baseX + (Number(boatUi.xOffset) || 0);
      const startY = bounds.bottom + (boatUi.yOffset !== undefined ? Number(boatUi.yOffset) : -5);

      this.#activeBoat = this.#chum.spawnIdleBoat(
        startX,
        startY,
        eq.delivery,
        eq.deliveryBattery?.instanceId || null,
      );

      if (this.#activeBoat) {
        const loadedChums = this.#getLoadedChums(eq.deliveryChums);
        this.#activeBoat.remainingSections = loadedChums.length;
        const initialDropped = [];
        for (let s = 1; s <= this.#activeBoat.sectionCount; s++) {
          if (!eq.deliveryChums || !eq.deliveryChums[s - 1]) {
            initialDropped.push(s);
          }
        }
        this.#activeBoat.droppedSections = initialDropped;
      }
    } else if (!this.#isAiming && this.#activeBoat) {
      if (this.#activeBoat.state === "idle") {
        this.#chum.removeBoat(this.#activeBoat);
      }
      this.#activeBoat = null;
    }
  }

  setAiming(value) {
    if (this.#isAiming !== !!value) {
      this.toggleAim();
    }
  }

  handleAiming(input, bounds, dt = 0) {
    if (
      this.#uiClickLockTime &&
      this.#clock.now - this.#uiClickLockTime < 200
    ) {
      input.clickPos = null;
      return;
    }

    const eq = this.#inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";

    if (method === "boat" && this.#activeBoat && this.#activeBoat.state === "idle") {
      const rodPos = this.#getRodVirtualPos(bounds);
      const boatUi = this.#config.ui?.boat || {};
      const baseX = boatUi.x === "center" ? (bounds.left + bounds.right) / 2 : typeof boatUi.x === "number" ? boatUi.x : rodPos.x;
      const startX = baseX + (Number(boatUi.xOffset) || 0);
      const startY = bounds.bottom + (boatUi.yOffset !== undefined ? Number(boatUi.yOffset) : -5);
      if (this.#activeBoat.pos) {
        this.#activeBoat.pos.x = startX;
        this.#activeBoat.pos.y = startY;
      }
      if (this.#activeBoat.startPos) {
        this.#activeBoat.startPos.x = startX;
        this.#activeBoat.startPos.y = startY;
      }
    }

    if (method === "hand" && this.#config.casting?.enabled !== false) {
      this.#handleHandPowerAiming(input, bounds, dt);
      return;
    }

    if (!input.clickPos) return;

    const vPos = this.#projector.screenToVirtual(
      input.clickPos.x,
      input.clickPos.y,
    );
    const cell = this.#checkWater(vPos.x, vPos.y);

    if (method === "hand") {
      this.#handleHandAiming(input, vPos, cell);
    } else if (method === "boat") {
      this.#handleBoatAiming(input, vPos, cell);
    }
  }

  handleGlobalBoatControl(input) {
    const stateName = this.#getGameStateName();
    if (
      !input.clickPos ||
      this.#isAiming ||
      stateName === "playing" ||
      stateName === "victory" ||
      stateName === "failed"
    ) {
      return;
    }

    const boats = this.#chum.getBoats();
    if (boats.length === 0) return;

    const activeBoat = boats[0];
    const vPos = this.#projector.screenToVirtual(
      input.clickPos.x,
      input.clickPos.y,
    );
    let clickHandled = false;

    if (activeBoat.state !== "drifting") {
      clickHandled = this.#handleBoatMapClick(activeBoat, vPos, input.clickPos);
    }

    if (clickHandled || !this.#canPlayerCast()) {
      input.clickPos = null;
    }
  }

  // Spec 151: a drifting boat inside the equipped landing net's reach (Net's zone, up to the shore) can be taken back
  // with the net button. Without a net it only comes back by mooring (D4).
  getBoatInNetReach(net, waterMetric) {
    if (!net?.isActive) return null;
    const boat = this.#chum.getBoats()[0] || null;
    return boat?.state === "drifting" && net.isFloatInZone(boat.pos.y, waterMetric) ? boat : null;
  }

  recoverBoatWithNet(net, waterMetric) {
    const boat = this.getBoatInNetReach(net, waterMetric);
    return boat ? this.#chum.recoverBoat(boat) : false;
  }

  getPowerAimVisualState() {
    return this.#handCastAim?.getVisualState?.() || null;
  }

  getPowerAimAccuracyPreview(bounds) {
    return this.#handCastAim?.getAccuracyPreview?.(
      bounds,
      this.#location.chumCastDistance,
      this.#config.casting?.handChumAccuracyPx ??
        this.#config.casting?.rodAccuracyFallbackPx ??
        100,
      this.#config.casting?.handChumAccuracyDistancePercent ??
        this.#config.casting?.accuracyDistancePercent ??
        null,
      this.#config.casting?.handChumAccuracyDistanceMultiplier ??
        this.#config.casting?.accuracyDistanceMultiplier ??
        1,
    );
  }

  #handleHandPowerAiming(input, bounds, dt) {
    if (this.#pendingHandDrop) {
      this.#pendingHandDrop.timer -= dt;
      if (this.#pendingHandDrop.timer <= 0) {
        const drop = this.#pendingHandDrop;
        this.#pendingHandDrop = null;
        const consumed = this.#fishing.consumeHandChum({
          instanceId: drop.chumInstanceId,
        });
        if (consumed) {
          this.#chum.deployBait(drop.x, drop.y, drop.chumId);
        } else {
          this.#warn(this.#messages.selectedChumUnavailable);
        }
        input.clickPos = null;
        this.toggleAim();
      }
      return;
    }

    const release = this.#handCastAim.update(input, bounds, dt, {
      mode: "chum",
    });
    if (!release) return;

    if (this.#isCancelledRelease(release)) {
      this.#handCastAim.reset();
      this.toggleAim();
      return;
    }

    const activeChum = this.#activeHandChum;
    if (!activeChum) {
      this.#markInvalidCast({ x: release.screenX, y: release.screenY });
      this.toggleAim();
      return;
    }

    const target = this.#handCastAim.resolveTarget(release, {
      bounds,
      maxDistance: this.#location.chumCastDistance,
      accuracyPx:
        this.#config.casting?.handChumAccuracyPx ??
        this.#config.casting?.rodAccuracyFallbackPx ??
        100,
      accuracyPercent:
        this.#config.casting?.handChumAccuracyDistancePercent ??
        this.#config.casting?.accuracyDistancePercent ??
        null,
      accuracyMultiplier:
        this.#config.casting?.handChumAccuracyDistanceMultiplier ??
        this.#config.casting?.accuracyDistanceMultiplier ??
        1,
      checkWater: (vx, vy) => this.#checkWater(vx, vy),
    });

    if (!target?.success) {
      this.#markInvalidCast({ x: release.screenX, y: release.screenY });
      this.toggleAim();
      return;
    }

    this.#pendingHandDrop = {
      timer: target.travelDelayMs,
      x: target.x,
      y: target.y,
      chumId: activeChum.id,
      chumInstanceId: activeChum.instanceId,
    };
  }

  #isCancelledRelease(release) {
    const threshold = this.#config.casting?.cancelPowerThreshold ?? 0;
    return release.power <= threshold;
  }

  #handleHandAiming(input, vPos, cell) {
    const activeChum = this.#activeHandChum;

    if (!cell || !activeChum) {
      this.#markInvalidCast(input.clickPos);
      input.clickPos = null;
      this.toggleAim();
      return;
    }

    const virtualLineY = this.#getWaterMetric().yAtBasePixels(this.#location.chumCastDistance);
    if (vPos.y < virtualLineY) {
      this.#markInvalidCast(input.clickPos);
      input.clickPos = null;
      this.toggleAim();
      this.#warn(this.#messages.tooFarForHandCast);
      return;
    }

    this.#chum.deployBait(vPos.x, vPos.y, activeChum.id);
    this.#fishing.consumeHandChum(activeChum);
    input.clickPos = null;
    this.toggleAim();
  }

  #handleBoatAiming(input, vPos, cell) {
    const activeBoat = this.#activeBoat;
    if (!activeBoat) {
      this.#markInvalidCast(input.clickPos);
      input.clickPos = null;
      return;
    }

    const reservedTargets = this.#getReservedTargets(activeBoat);
    const loadedChums = this.#getLoadedChums(this.#inventory.getEquipped().deliveryChums);
    const chumData = loadedChums[reservedTargets] || null;

    if (!cell || !chumData || !this.#chum.isReachableByBoat(activeBoat, vPos.x, vPos.y)) {
      this.#markInvalidCast(input.clickPos);
      input.clickPos = null;
      return;
    }

    this.#chum.deployBait(vPos.x, vPos.y, chumData.item.id, activeBoat, chumData.slotIndex);
    input.clickPos = null;

    const loadedCount = loadedChums.length;
    if (reservedTargets + 1 >= loadedCount) {
      this.toggleAim();
    }
  }

  #handleBoatMapClick(activeBoat, vPos, clickPos) {
    const cell = this.#checkWater(vPos.x, vPos.y);
    if (!cell) {
      this.#markInvalidCast(clickPos);
      return true;
    }

    const eq = this.#inventory.getEquipped();
    const boatItem = eq.delivery || {};
    const isManual = boatItem.effectiveStats?.manualControl ?? true;

    if (isManual) {
      if (activeBoat.state !== "returning") {
        activeBoat.setTarget(vPos.x, vPos.y);
        return true;
      }
      return false;
    }

    const reservedTargets = this.#getReservedTargets(activeBoat);
    const freeSlots = activeBoat.remainingSections - reservedTargets;
    if (freeSlots <= 0 || activeBoat.state === "returning") return false;

    const loadedChums = this.#getLoadedChums(eq.deliveryChums);
    const chumData = loadedChums[reservedTargets] || null;
    if (!chumData) return false;
    if (!this.#chum.isReachableByBoat(activeBoat, vPos.x, vPos.y)) {
      this.#markInvalidCast(clickPos);
      return true;
    }

    this.#chum.deployBait(vPos.x, vPos.y, chumData.item.id, activeBoat, chumData.slotIndex);
    return true;
  }

  #dropManualBoatChum(activeBoat, boatItem) {
    const chumData = this.#getLoadedChums(this.#inventory.getEquipped().deliveryChums)[0];

    if (chumData) {
      this.#chum.deployBait(
        activeBoat.pos.x,
        activeBoat.pos.y,
        chumData.item.id,
      );
      this.#fishing.consumeDeliveryChum(chumData.slotIndex);
    }

    activeBoat.remainingSections--;

    if (activeBoat.remainingSections <= 0) {
      const hasAI =
        boatItem.effectiveStats?.hasAutoReturn ?? false;
      if (hasAI) {
        activeBoat.state = "returning";
      }
    }
  }

  #syncAimingWithBoatState(method, isManual) {
    if (!this.#isAiming || method !== "boat") return;

    const boats = this.#chum.getBoats();
    const activeBoat = boats.length > 0 ? boats[0] : null;
    if (!activeBoat) return;

    if (!isManual && activeBoat.state === "returning") {
      this.#isAiming = false;
    } else if (
      isManual &&
      activeBoat.state !== "idle" &&
      activeBoat.state !== "waiting"
    ) {
      this.#isAiming = false;
    }
  }

  // Spec 143: a boat starts only with a charged battery in its slot; otherwise the player is told why.
  #isBoatPowered(eq) {
    const problem = this.#batteryProblem(eq);
    if (problem) this.#warn(problem);
    return !problem;
  }

  // The warning for a boat that cannot start for want of power, or null when its battery is charged.
  #batteryProblem(eq) {
    const batteryId = eq.deliveryBattery?.instanceId || null;
    if (!batteryId) return this.#messages.boatNeedsBattery;
    return this.#devicePower.read(batteryId).empty ? this.#messages.boatBatteryEmpty : null;
  }

  #getLoadedChums(deliveryChums) {
    const loadedChums = [];
    const chumsArr = deliveryChums || [];
    for (let i = 0; i < chumsArr.length; i++) {
      if (chumsArr[i]) {
        loadedChums.push({ slotIndex: i, item: chumsArr[i] });
      }
    }
    return loadedChums;
  }

  #countLoadedChums(deliveryChums) {
    let loadedCount = 0;
    const chumsArr = deliveryChums || [];
    for (let i = 0; i < chumsArr.length; i++) {
      if (chumsArr[i]) loadedCount++;
    }
    return loadedCount;
  }

  #getReservedTargets(boat) {
    return (boat.drop ? 1 : 0) + (boat.waypoints ? boat.waypoints.length : 0);
  }

  #warn(message) {
    this.#inventoryUI?.showWarning(message);
  }
}

class ChumController {
  #inventory;
  #chum;
  #projector;
  #inventoryUI;
  #fishing;
  #location;
  #clock;
  #config;
  #rng;
  #getViewportSize;
  #panViewport;
  #depthUI;
  #getDynamicBounds;
  #getRodVirtualPos;
  #checkWater;
  #markInvalidCast;
  #canPlayerCast;
  #getGameStateName;
  #ui;
  #activeHandChum = null;
  #isAiming = false;
  #activeBoat = null;
  #uiClickLockTime = 0;
  #boatLoadedChums = new WeakMap();
  #handCastAim = null;
  #pendingHandDrop = null;

  constructor({
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
    getRodVirtualPos,
    checkWater,
    markInvalidCast,
    canPlayerCast,
    getGameStateName,
  }) {
    this.#inventory = inventory;
    this.#chum = chum;
    this.#projector = projector;
    this.#inventoryUI = inventoryUI;
    this.#fishing = fishing;
    this.#location = location;
    this.#clock = clock;
    this.#config = config;
    this.#rng = rng;
    this.#getViewportSize = getViewportSize;
    this.#panViewport = panViewport;
    this.#depthUI = depthUI;
    this.#getDynamicBounds = getDynamicBounds;
    this.#getRodVirtualPos = getRodVirtualPos;
    this.#checkWater = checkWater;
    this.#markInvalidCast = markInvalidCast;
    this.#canPlayerCast = canPlayerCast;
    this.#getGameStateName = getGameStateName;
    this.#handCastAim = new CastPowerAim({
      config,
      projector,
      getViewportSize,
      panViewport,
      rng,
    });
    this.#ui = new ChumUI(() => this.handleClick());
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
    const isManual = boatItem.manualControl ?? true;
    const sections = boatItem.sections ?? boatItem.engineStats?.sections ?? 1;

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
        state =
          loadedCount === 0 ? "empty" : this.#isAiming ? "aiming" : "idle";
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

    this.#ui.setState(state, method, count, isManual);
    this.#syncAimingWithBoatState(method, isManual);
  }

  handleClick() {
    const eq = this.#inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";

    if (method === "hand") {
      if (this.#activeHandChum) {
        this.toggleAim();
      } else {
        this.#warn("У вас немає прикормки в інвентарі!");
      }
      return;
    }

    if (method !== "boat") return;

    const boats = this.#chum.getBoats();
    if (boats.length === 0) {
      if (this.#countLoadedChums(eq.deliveryChums) > 0) {
        this.toggleAim();
      } else {
        this.#warn("Завантажте прикормку в бункери кораблика через інвентар!");
      }
      return;
    }

    const activeBoat = boats[0];
    const boatItem = eq.delivery || {};
    const isManual = boatItem.manualControl ?? true;

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

      this.#activeBoat = this.#chum.spawnIdleBoat(
        rodPos.x,
        bounds.bottom - 5,
        eq.delivery,
      );

      if (this.#activeBoat) {
        const loadedChums = this.#getLoadedChums(eq.deliveryChums);
        this.#boatLoadedChums.set(this.#activeBoat, loadedChums);
        this.#activeBoat.remainingSections = loadedChums.length;
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
      this.#handleHandAiming(input, bounds, vPos, cell);
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

    const distToBoat = Math.hypot(
      activeBoat.pos.x - vPos.x,
      activeBoat.pos.y - vPos.y,
    );
    const mapBounds = this.#getDynamicBounds();

    if (distToBoat < 40) {
      if (activeBoat.pos.y > mapBounds.bottom - 200) {
        this.#chum.removeBoat(activeBoat);
      }
      clickHandled = true;
    } else if (activeBoat.state !== "drifting") {
      clickHandled = this.#handleBoatMapClick(activeBoat, vPos, input.clickPos);
    }

    if (clickHandled || !this.#canPlayerCast()) {
      input.clickPos = null;
    }
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
          this.#warn("Обрана прикормка більше недоступна.");
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

  #handleHandAiming(input, bounds, vPos, cell) {
    const activeChum = this.#activeHandChum;

    if (!cell || !activeChum) {
      this.#markInvalidCast(input.clickPos);
      input.clickPos = null;
      this.toggleAim();
      return;
    }

    const virtualLineY = bounds.bottom - this.#location.chumCastDistance;
    if (vPos.y < virtualLineY) {
      this.#markInvalidCast(input.clickPos);
      input.clickPos = null;
      this.toggleAim();
      this.#warn("Занадто далеко для ручного закидання!");
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
    const loadedChums = this.#boatLoadedChums.get(activeBoat) || [];
    const chumData = loadedChums[reservedTargets] || null;
    const chumToDrop = chumData ? chumData.item : null;

    if (!cell || !chumToDrop) {
      this.#markInvalidCast(input.clickPos);
      input.clickPos = null;
      return;
    }

    this.#chum.deployBait(vPos.x, vPos.y, chumToDrop.id, activeBoat);
    this.#fishing.consumeDeliveryChum(chumData.slotIndex);
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
    const isManual = boatItem.manualControl ?? true;

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

    const loadedChums = this.#boatLoadedChums.get(activeBoat) || [];
    const chumData = loadedChums[reservedTargets] || null;
    const chumToDrop = chumData ? chumData.item : null;
    if (!chumToDrop) return false;

    this.#chum.deployBait(vPos.x, vPos.y, chumToDrop.id, activeBoat);
    this.#fishing.consumeDeliveryChum(chumData.slotIndex);
    return true;
  }

  #dropManualBoatChum(activeBoat, boatItem) {
    const loadedChums = this.#boatLoadedChums.get(activeBoat) || [];
    const loadedCount = loadedChums.length;
    const dropIndex = loadedCount - activeBoat.remainingSections;
    const chumData = loadedChums[dropIndex];

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
        boatItem.hasAutoReturn ?? boatItem.engineStats?.hasAutoReturn ?? false;
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
    return (boat.zoneId ? 1 : 0) + (boat.waypoints ? boat.waypoints.length : 0);
  }

  #warn(message) {
    this.#inventoryUI?.showWarning(message);
  }
}

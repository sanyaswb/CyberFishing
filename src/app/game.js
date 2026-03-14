class Game {
  #canvas;
  #inputManager;
  #renderer;
  #uiManager;
  #fishingSystem;
  #float;
  #lastTime;
  #bounds;
  #tensionMeter;
  #gameState;
  #fishCondition;
  #staminaController;
  #locationMap;
  #projector;
  #invalidCastMarker;
  #isNetReady = false;
  failReason = null;
  #gameTimeHours = 0;
  #castManager;
  #biteSystem;
  #isRaining = false;
  #isFoggy = false;
  #weatherTimer = 0;
  #currentBitingFish = null;
  #currentHookDepth = 1.0;
  #depthUI;
  #timeUI;
  #windState = { direction: 0, rainMult: 1.0, timer: 0 };
  #lastHour = -1;
  #currentPhase = "day";
  #castStartTime = 0;
  #castDistanceRatio = 0;
  #lastGameState = null;
  #playStartTime = 0;
  #chumManager;
  #chumUI;
  #isAimingChum = false;
  #activeBoat = null;
  #holdUI;
  #net;

  constructor(canvasId) {
    this.#canvas = document.getElementById(canvasId);
    const rodX = CONFIG.ui?.rod?.x;
    const anchorX = rodX && rodX !== "center" ? Number(rodX) : null;

    this.#inputManager = new InputManager(this.#canvas, anchorX);
    this.#renderer = new Renderer(this.#canvas);
    this.#net = new Net(CONFIG.net);
    this.#uiManager = new UIManager(CONFIG);
    this.#uiManager.onNetClick = () => this.#handleNetClick();
    this.#uiManager.onContinueClick = () => this.#resetGame();

    const locId = "test";
    const locCfg = CONFIG.locations.map[locId];
    const squash = locCfg?.perspectiveSquash || { top: 0.15, bottom: 0.75 };

    this.#chumManager = new ChumManager(locId, CONFIG.chum, squash);
    this.#chumUI = new ChumUI(() => this.#handleChumClick());
    this.#locationMap = new LocationMap(locId, CONFIG.locations);
    this.#projector = new ViewportProjector(CONFIG.locations, locId);

    this.#initEvents();
    this.#depthUI = new DepthSelectorUI();
    this.#timeUI = new TimeDisplayUI();
    this.#holdUI = new HoldChargesUI();
    this.#resizeCanvas();
    window.addEventListener("resize", () => this.#resizeCanvas());

    const initX = CONFIG.float.initialX ?? this.#canvas.width / 2;
    const initY = CONFIG.float.initialY ?? this.#canvas.height / 2;
    this.#float = new FloatEntity(initX, initY, CONFIG.float);

    this.#gameTimeHours =
      CONFIG.debug?.initialTime ??
      new Date().getHours() + new Date().getMinutes() / 60;
    this.#gameState = "scouting";
    this.#bounds = {
      left: 0,
      right: CONFIG.locations.baseResolution.width,
      top: 0,
      bottom: CONFIG.locations.baseResolution.height,
    };
    this.#lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.#castManager = new CastManager();
    this.#biteSystem = new BiteSystem(CONFIG.spawns, CONFIG.float);
  }

  #initEvents() {
    document.addEventListener("config-updated", (e) => {
      if (e.detail?.path?.[0] === "locations") {
        this.#projector?.update(0, 0);
        this.#projector?.update(this.#canvas.width, this.#canvas.height);
        this.#locationMap?.refreshConfig(CONFIG.locations);
      }
    });
  }

  #castLine(virtualX, virtualY, bottomDepth) {
    const isOverDepth = this.#currentHookDepth > bottomDepth;

    let rodScreenX = this.#canvas.width / 2;
    if (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== "center") {
      rodScreenX = Number(CONFIG.ui.rod.x);
    }
    const rodScreenY = this.#canvas.height - (CONFIG.ui?.rod?.yOffset || 0);
    const rodVirtualPos = this.#projector.screenToVirtual(
      rodScreenX,
      rodScreenY,
    );

    const castableBounds = this.#locationMap.getCastableBoundsVirtual(
      CONFIG.locations.cellSize,
    );
    const maxDistX = Math.max(
      Math.abs(castableBounds.left - rodVirtualPos.x),
      Math.abs(castableBounds.right - rodVirtualPos.x),
    );
    const maxDistY = Math.max(
      Math.abs(castableBounds.top - rodVirtualPos.y),
      Math.abs(castableBounds.bottom - rodVirtualPos.y),
    );
    const maxPossibleDist = Math.hypot(maxDistX, maxDistY);

    const currentDist = Math.hypot(
      virtualX - rodVirtualPos.x,
      virtualY - rodVirtualPos.y,
    );
    const distanceRatio = Math.max(
      0,
      Math.min(1, currentDist / maxPossibleDist),
    );

    this.#float.cast(
      virtualX,
      virtualY,
      this.#currentHookDepth,
      isOverDepth,
      CONFIG.sinker,
      distanceRatio,
    );

    this.#gameState = "waiting";
    this.#biteSystem.reset();
    this.failReason = null;

    this.#castStartTime = performance.now();
    this.#castDistanceRatio = distanceRatio;
  }

  #hookFish(hookedFish) {
    this.#gameState = "playing";
    this.#isNetReady = false;

    const rod = new Rod(CONFIG.rod.level, CONFIG.rod.basePower);
    const reel = new Reel(
      CONFIG.reel.level,
      CONFIG.reel.basePower,
      CONFIG.reel.hold,
    );
    const hook = new Hook(
      CONFIG.hook.level,
      CONFIG.hook.weight,
      CONFIG.hook.quality,
    );

    const fish = new Fish(
      hookedFish.level,
      hookedFish.weight,
      hookedFish.resistance,
      hookedFish.physics,
    );

    this.#fishingSystem = new FishingSystem(rod, reel, fish);
    this.#tensionMeter = new TensionMeter(
      CONFIG.rod.level,
      CONFIG.reel.level,
      hook,
      CONFIG.tension,
    );

    this.#fishCondition = new FishCondition(
      hookedFish.level,
      hookedFish.weight,
      CONFIG.stamina.fish,
    );

    const playerBasePower = rod.getPower() + reel.getPower();
    this.#staminaController = new StaminaController(
      this.#fishCondition,
      fish,
      playerBasePower,
      CONFIG.stamina.mechanics,
    );

    console.log(
      `%c🎣 КЛЮНУВ: ${hookedFish.name}!`,
      "color: #00ff00; font-size: 16px; font-weight: bold;",
    );
    console.table({
      "Згенерована Вага": hookedFish.weight.toFixed(3) + " кг",
      "Рівень (Складність)": hookedFish.level,
      "Базовий Опір": hookedFish.resistance.toFixed(2),
    });

    document.dispatchEvent(
      new CustomEvent("debug-fish-hooked", { detail: hookedFish }),
    );
  }

  #resizeCanvas() {
    this.#canvas.width = window.innerWidth;
    this.#canvas.height = window.innerHeight;

    if (
      this.#projector &&
      this.#projector.update(this.#canvas.width, this.#canvas.height)
    ) {
      this.#locationMap.recalculateZones(
        this.#projector,
        CONFIG.locations.cellSize,
      );
    }
  }

  start() {
    requestAnimationFrame(this.loop);
  }

  #handleNetClick() {
    if (!this.#isNetReady || this.#gameState !== "playing") return;

    // --- НОВЕ: Отримуємо вагу та рахуємо шанс прямо тут ---
    const fishWeight = this.#fishingSystem
      ? this.#fishingSystem.getFishWeight()
      : 0;
    const catchChance = this.#net.calculateCatchChance(fishWeight);

    const roll = Math.random() * 100;
    const isSuccess = roll <= catchChance;

    // Відправляємо подію з новим розрахованим шансом
    document.dispatchEvent(
      new CustomEvent("netCatchRoll", {
        detail: {
          chance: catchChance, // Замінили this.#netCatchChance на catchChance
          roll: roll,
          success: isSuccess,
        },
      }),
    );

    if (isSuccess) {
      this.#gameState = "victory";
    } else {
      this.#gameState = "failed";
      this.failReason = "net_escape";
    }

    if (CONFIG.debug?.overlay) {
      document.dispatchEvent(
        new CustomEvent("debug-live-update", {
          detail: { gameState: this.#gameState },
        }),
      );
    }
  }

  #resetGame() {
    this.#gameState = "scouting";
    this.failReason = null;
    this.#currentBitingFish = null;
    this.#isNetReady = false;

    if (this.#tensionMeter) this.#tensionMeter.reset();
    if (this.#biteSystem) this.#biteSystem.reset();
    this.#float.stopBite();
    if (CONFIG.debug?.overlay) {
      document.dispatchEvent(
        new CustomEvent("debug-live-update", {
          detail: { gameState: "scouting" },
        }),
      );
    }
  }

  #toggleChumAim() {
    if (
      this.#gameState !== "scouting" &&
      this.#gameState !== "waiting" &&
      this.#gameState !== "biting"
    )
      return;

    if (this.#chumManager.getWaitingBoat()) {
      this.#chumManager.activateWaitingBoat();
      return;
    }

    if (this.#chumManager.isBoatMoving()) {
      console.log("Кораблик в русі, зачекайте!");
      return;
    }

    const method = CONFIG.chum.currentMethod || "hand";

    this.#isAimingChum = !this.#isAimingChum;

    if (this.#isAimingChum && method === "boat") {
      const rodScreenX =
        CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== "center"
          ? Number(CONFIG.ui.rod.x)
          : this.#canvas.width / 2;
      const rodVirtualPos = this.#projector.screenToVirtual(rodScreenX, 0);

      const mapBounds = this.#locationMap.getCastableBoundsVirtual(
        CONFIG.locations.cellSize,
      );
      const startY = mapBounds ? mapBounds.bottom - 5 : 1440;
      const startX = Math.max(
        mapBounds ? mapBounds.left : 0,
        Math.min(mapBounds ? mapBounds.right : 2560, rodVirtualPos.x),
      );

      this.#activeBoat = this.#chumManager.spawnIdleBoat(startX, startY);
    } else if (!this.#isAimingChum && this.#activeBoat) {
      if (this.#activeBoat.state === "idle") {
        this.#chumManager.removeBoat(this.#activeBoat);
      }
      this.#activeBoat = null;
    }
  }

  #handleChumClick() {
    const method = CONFIG.chum.currentMethod;

    if (method === "hand") {
      if (this.#chumManager.handUses > 0) {
        this.#toggleChumAim();
      } else {
        console.log("Прикормка для руки закінчилась!");
      }
    } else if (method === "boat") {
      const boats = this.#chumManager.getBoats();

      if (boats.length === 0) {
        this.#toggleChumAim();
      } else {
        const activeBoat = boats[0];
        const isManual = CONFIG.chum.deliveryMethods.boat.manualControl;

        if (
          isManual &&
          activeBoat.state === "waiting" &&
          activeBoat.remainingSections > 0
        ) {
          // Скидаємо прикормку під корабликом
          this.#chumManager.deployBait(
            activeBoat.pos.x,
            activeBoat.pos.y,
            "carp_mix_basic",
            "boat",
          );
          activeBoat.remainingSections--;
          console.log(
            `Прикормку скинуто! Залишилось секцій: ${activeBoat.remainingSections}`,
          );
        }
      }
    }
  }

  update(dt) {
    const timeScale = CONFIG.debug?.timeScale || 1;
    this.#updateWorldTime(dt, timeScale);
    this.#updateSystems(dt, timeScale);

    const inputState = this.#inputManager.getState();
    const dynamicEnv = this.#calculateEnvironment(dt);
    const bounds = this.#getDynamicBounds();

    this.#handleCamera(dt);
    this.#handleChumLogic(dt, timeScale, inputState);

    if (this.#isAimingChum) {
      this.#handleChumAiming(inputState, bounds);
      return;
    }

    this.#handleGlobalBoatControl(inputState);
    this.#handleStateLogic(dt, inputState, dynamicEnv, bounds);
    this.#updateUserInterface();
    this.#syncDebugOverlay(bounds);
  }

  #updateWorldTime(dt, timeScale) {
    this.#gameTimeHours =
      (this.#gameTimeHours + (dt / 3600000) * timeScale) % 24;
    const currentHour = Math.floor(this.#gameTimeHours);

    if (currentHour !== this.#lastHour) {
      this.#lastHour = currentHour;
      for (const [phase, times] of Object.entries(CONFIG.spawns.timePhases)) {
        const inRange =
          times.startHour < times.endHour
            ? currentHour >= times.startHour && currentHour < times.endHour
            : currentHour >= times.startHour || currentHour < times.endHour;
        if (inRange) this.#currentPhase = phase;
      }
    }
  }

  #updateSystems(dt, timeScale) {
    this.#timeUI.update(this.#gameTimeHours);
    this.#projector.update(this.#canvas.width, this.#canvas.height);
    this.#locationMap.update(dt, this.#gameTimeHours);
    this.#castManager.update(dt);
    if (this.#invalidCastMarker) {
      this.#invalidCastMarker.timer -= dt;
      if (this.#invalidCastMarker.timer <= 0) this.#invalidCastMarker = null;
    }
  }

  #handleCamera(dt) {
    const isFishing = ["waiting", "biting", "playing"].includes(
      this.#gameState,
    );
    if (isFishing) {
      this.#projector.focusOnVirtualPos(this.#float.getPosition().y, dt, 0.05);
    } else if (this.#gameState === "scouting") {
      const bounds = this.#locationMap.getCastableBoundsVirtual(
        CONFIG.locations.cellSize,
      );
      this.#projector.focusOnVirtualPos(
        bounds ? bounds.bottom - 200 : 1200,
        dt,
        0.03,
      );
    }
  }

  #calculateEnvironment(dt) {
    const windCfg = CONFIG.locations.map.test.environment.wind;
    const weatherCfg = CONFIG.locations.map.test.weather;

    this.#windState.timer -= dt;
    if (this.#windState.timer <= 0) {
      this.#windState.timer =
        86400000 /
        (windCfg.changesPerDay[0] +
          Math.random() *
            (windCfg.changesPerDay[1] - windCfg.changesPerDay[0]));
      this.#windState.direction = [-1, 0, 1][Math.floor(Math.random() * 3)];
    }

    this.#weatherTimer -= dt;
    if (this.#weatherTimer <= 0) {
      this.#isRaining = Math.random() < weatherCfg.chances.rain;
      this.#isFoggy = Math.random() < weatherCfg.chances.fog;
      this.#weatherTimer = weatherCfg.updateIntervalMs;
      this.#windState.rainMult = this.#isRaining
        ? windCfg.rainMultiplier[0] +
          Math.random() *
            (windCfg.rainMultiplier[1] - windCfg.rainMultiplier[0])
        : 1.0;
    }

    const baseEnv = CONFIG.locations.map.test.environment;
    if (!baseEnv) return null;

    const env = { current: baseEnv.current, wind: null };
    if (baseEnv.wind && this.#windState.direction !== 0) {
      const m = this.#windState.rainMult;
      env.wind = {
        direction: this.#windState.direction,
        breezeAngleRange: baseEnv.wind.breezeAngleRange.map((v) => v * m),
        gustAngleRange: baseEnv.wind.gustAngleRange.map((v) => v * m),
        gustFluctuationMs: baseEnv.wind.gustFluctuationMs,
        gustChancePerSec: baseEnv.wind.gustChancePerSec * m,
        gustDurationMs: baseEnv.wind.gustDurationMs,
      };
    }
    return env;
  }

  #handleChumLogic(dt, timeScale, inputState) {
    if (!this.#chumManager) return;

    const env = CONFIG.locations.map.test.environment;
    const boatEnv = env ? { current: env.current } : null;

    this.#chumManager.update(Date.now(), timeScale);
    this.#chumManager.updateBoats(
      dt,
      (vx, vy) => this.#checkWater(vx, vy),
      CONFIG.locations.cellSize,
      boatEnv,
    );

    const bounds = this.#locationMap.getCastableBoundsVirtual(
      CONFIG.locations.cellSize,
    );
    if (bounds) {
      const triggerY = this.#net.getTriggerVirtualY(bounds.bottom);
      this.#chumManager.getBoats().forEach((boat) => {
        if (boat.state === "drifting" && boat.pos.y >= triggerY)
          boat.isFinished = true;
      });
    }

    this.#updateChumUI();
  }

  #updateChumUI() {
    const method = CONFIG.chum.currentMethod;
    const boats = this.#chumManager.getBoats();
    const activeBoat = boats[0] || null;
    const isManual = CONFIG.chum?.deliveryMethods?.boat?.manualControl;

    if (this.#gameState === "playing") {
      this.#isAimingChum = false;
      this.#chumUI.setState("disabled", method, 0, isManual);
      return;
    }

    if (method === "hand") {
      const uses = this.#chumManager.handUses;
      const state =
        uses <= 0 ? "empty" : this.#isAimingChum ? "aiming" : "idle";
      this.#chumUI.setState(state, method, uses, isManual);
    } else if (method === "boat") {
      if (!activeBoat) {
        this.#chumUI.setState(
          this.#isAimingChum ? "aiming" : "idle",
          "boat",
          1,
          isManual,
        );
      } else {
        const sections = activeBoat.remainingSections || 0;
        let state = "idle";
        if (
          activeBoat.state === "drifting" ||
          this.#chumManager.getBoatEnergy() <= 0
        )
          state = "empty";
        else if (["deploying", "returning"].includes(activeBoat.state))
          state = "moving";
        else if (activeBoat.state === "waiting")
          state = sections > 0 ? "ready" : "empty";
        this.#chumUI.setState(state, "boat", sections, isManual);
      }
    }
  }

  #handleChumAiming(inputState, bounds) {
    inputState.isPulling = false;
    inputState.longPressPos = null;

    if (!inputState.clickPos) return;

    const method = CONFIG.chum.currentMethod || "hand";
    const locCfg = CONFIG.locations.map["test"];
    const maxHandDist = locCfg.chumCastDistance || 800;
    const vPos = this.#projector.screenToVirtual(
      inputState.clickPos.x,
      inputState.clickPos.y,
    );

    if (this.#checkWater(vPos.x, vPos.y)) {
      if (method === "boat" && this.#activeBoat) {
        this.#chumManager.deployBait(
          vPos.x,
          vPos.y,
          "carp_mix_basic",
          method,
          this.#activeBoat,
        );
        if (!CONFIG.chum?.deliveryMethods?.boat?.manualControl)
          this.#activeBoat.remainingSections--;
        this.#activeBoat = null;
        this.#isAimingChum = false;
      } else if (method === "hand") {
        const throwLineY = bounds.bottom - maxHandDist;
        if (vPos.y >= throwLineY && this.#chumManager.useHandBait()) {
          this.#chumManager.deployBait(
            vPos.x,
            vPos.y,
            "carp_mix_basic",
            "hand",
          );
          this.#toggleChumAim();
        } else {
          this.#markInvalidCast(inputState.clickPos);
        }
      }
    } else {
      this.#markInvalidCast(inputState.clickPos);
    }
  }

  #handleGlobalBoatControl(inputState) {
    if (
      !inputState.clickPos ||
      this.#isAimingChum ||
      this.#gameState === "playing"
    )
      return;

    const boats = this.#chumManager?.getBoats() || [];
    if (boats.length === 0) return;

    const boat = boats[0];
    const vPos = this.#projector.screenToVirtual(
      inputState.clickPos.x,
      inputState.clickPos.y,
    );
    const dist = Math.hypot(boat.pos.x - vPos.x, boat.pos.y - vPos.y);

    if (dist < 40) {
      const bounds = this.#locationMap.getCastableBoundsVirtual(
        CONFIG.locations.cellSize,
      );
      if (boat.pos.y > (bounds ? bounds.bottom : 1440) - 200) {
        this.#chumManager.removeBoat(boat);
      }
      inputState.clickPos = null;
      return;
    }

    if (boat.state !== "drifting") {
      const isManual = CONFIG.chum?.deliveryMethods?.boat?.manualControl;
      if (isManual && boat.state !== "returning") {
        boat.setTarget(vPos.x, vPos.y);
        inputState.clickPos = null;
      } else if (
        !isManual &&
        boat.remainingSections > 0 &&
        boat.state !== "returning"
      ) {
        this.#chumManager.deployBait(
          vPos.x,
          vPos.y,
          "carp_mix_basic",
          "boat",
          boat,
        );
        boat.remainingSections--;
        inputState.clickPos = null;
      }
    }
  }

  #handleStateLogic(dt, input, env, bounds) {
    switch (this.#gameState) {
      case "scouting":
        this.#updateScouting(dt, input);
        break;
      case "waiting":
        this.#updateWaiting(dt, input, env, bounds);
        break;
      case "biting":
        this.#updateBiting(dt, input, env, bounds);
        break;
      case "playing":
        this.#updatePlaying(dt, input, env, bounds);
        break;
    }
  }

  #updateScouting(dt, input) {
    const maxDepth = CONFIG.sinker.maxDepth || 8.0;
    if (!this.#depthUI.isActive) {
      this.#depthUI.show(
        maxDepth,
        this.#currentHookDepth,
        (d) => (this.#currentHookDepth = d),
      );
    } else {
      this.#depthUI.updateMax?.(maxDepth);
    }

    if (input.panDeltaX !== 0 || input.panDeltaY !== 0) {
      const scale = this.#projector.getScale();
      this.#projector.pan(input.panDeltaX / scale, input.panDeltaY / scale);
    }

    if (input.clickPos) {
      const boat = this.#chumManager?.getBoats()[0];
      const isManual = CONFIG.chum?.deliveryMethods?.boat?.manualControl;
      const canCast =
        !boat ||
        boat.state === "drifting" ||
        (!isManual && boat.remainingSections <= 0) ||
        boat.state === "returning";

      if (canCast) {
        const vPos = this.#projector.screenToVirtual(
          input.clickPos.x,
          input.clickPos.y,
        );
        const cell = this.#getCell(vPos.x, vPos.y);
        if (
          cell?.isCastable &&
          !cell.hasCollision &&
          this.#castManager.canCast()
        ) {
          this.#castManager.registerCast(performance.now());
          this.#depthUI.hide();
          this.#castLine(vPos.x, vPos.y, cell.depth);
        } else {
          this.#markInvalidCast(input.clickPos);
        }
      }
    }
  }

  #updateWaiting(dt, input, env, bounds) {
    if (input.isDoubleClick) {
      if (!this.#chumManager || this.#chumManager.getBoats().length === 0) {
        this.#gameState = "scouting";
        this.#tensionMeter?.reset();
        this.#biteSystem?.reset();
      }
      return;
    }

    if (input.longPressPos) {
      const vPos = this.#projector.screenToVirtual(
        input.longPressPos.x,
        input.longPressPos.y,
      );
      const cell = this.#getCell(vPos.x, vPos.y);
      if (
        cell?.isCastable &&
        !cell.hasCollision &&
        (!this.#chumManager || this.#chumManager.getBoats().length === 0)
      ) {
        this.#castManager.registerCast(performance.now());
        this.#castLine(vPos.x, vPos.y, cell.depth);
      } else {
        this.#markInvalidCast(input.longPressPos);
      }
    }

    this.#float.update(bounds, dt, env, (vx, vy) => this.#checkWater(vx, vy));
    const envData = this.#getEnvData(bounds);
    const hookedFish = this.#biteSystem.evaluateBite(dt, envData, {
      hookSize: CONFIG.hook.level,
      baitId: "oil_worm",
    });

    if (hookedFish) {
      this.#gameState = "biting";
      this.#currentBitingFish = this.#applyDebugCatch(hookedFish);
      this.#float.startBite();
    }
  }

  #updateBiting(dt, input, env, bounds) {
    this.#float.updateBite(dt, (vx, vy) => this.#checkWater(vx, vy));
    this.#float.update(bounds, dt, env, (vx, vy) => this.#checkWater(vx, vy));

    if (!this.#float.isBiting()) {
      this.#gameState = "waiting";
      this.#currentBitingFish = null;
      this.#biteSystem.reset();
    } else if (input.isPulling) {
      if (this.#chumManager?.getBoats().length > 0) {
        input.isPulling = false;
      } else {
        if (Math.random() <= (this.#float.isGuaranteedBite() ? 0.99 : 0.01)) {
          this.#float.hook();
          this.#hookFish(this.#currentBitingFish);
        } else {
          this.#float.stopBite();
          this.#gameState = "scouting";
          this.#currentBitingFish = null;
        }
      }
    }
  }

  #updatePlaying(dt, input, env, bounds) {
    if (this.#tensionMeter.isBroken()) {
      this.failReason = this.#tensionMeter.getBreakReason();
      this.#gameState = "failed";
      document.dispatchEvent(
        new CustomEvent("fishingFailed", {
          detail: { reason: this.failReason },
        }),
      );
      return;
    }

    this.#handleReelMechanics(input);

    const floatPos = this.#float.getPosition();
    const fishForceRaw = this.#fishingSystem.calculateFishForce(
      dt,
      floatPos,
      this.#bounds,
      CONFIG.stamina.mechanics,
      (vx, vy) => this.#checkWater(vx, vy),
    );

    let tensionFishY = fishForceRaw.y;
    const isHold = this.#fishingSystem.isHoldActive?.() || false;
    if (isHold && tensionFishY < 0) {
      tensionFishY = 0;
      fishForceRaw.y *= this.#fishingSystem.getHoldTensionMultiplier?.() || 1.0;
    }

    this.#float.applyForce(
      new Vector2(fishForceRaw.x, tensionFishY).multiplyScalar(
        CONFIG.physics.fishForceMultiplier,
      ),
    );

    const rodPos = this.#getRodVirtualPos();
    const screenOffset = Math.min(
      1,
      Math.abs(
        this.#projector.virtualToScreen(floatPos.x, floatPos.y).x -
          (CONFIG.ui?.rod?.x === "center"
            ? this.#canvas.width / 2
            : Number(CONFIG.ui.rod.x)),
      ) /
        (this.#canvas.width / 2),
    );

    if (input.isPulling) {
      const pForce = this.#fishingSystem.calculatePlayerForce(
        input.pullDirection,
        floatPos.x,
        floatPos.y,
        rodPos,
        screenOffset,
        CONFIG.physics,
      );
      this.#float.applyForce(
        pForce.multiplyScalar(CONFIG.physics.playerForceMultiplier),
      );
    }

    const playerMaxPower = Math.abs(
      this.#fishingSystem.calculatePlayerForce(
        new Vector2(0, 1),
        floatPos.x,
        floatPos.y,
        rodPos,
        screenOffset,
        CONFIG.physics,
      ).y * CONFIG.physics.playerForceMultiplier,
    );
    const fishPowerMag =
      Math.max(Math.abs(fishForceRaw.x), Math.abs(fishForceRaw.y)) *
      CONFIG.physics.fishForceMultiplier;

    this.#tensionMeter.update(
      input.isPulling,
      playerMaxPower,
      fishPowerMag,
      this.#fishingSystem.getReelPower(),
      fishPowerMag * 0.01,
      dt,
      CONFIG.tension,
      CONFIG.hookMechanics,
      isHold,
    );
    this.#staminaController.evaluate(
      this.#tensionMeter.getTension(),
      input.isPulling,
      dt,
      floatPos.x,
      bounds,
    );
    this.#float.update(bounds, dt, env, (vx, vy) => this.#checkWater(vx, vy));

    this.#checkVictory(this.#float.getPosition(), bounds.bottom, dt);
  }

  #handleReelMechanics(input) {
    const holdState = this.#fishingSystem.getHoldUIState?.();
    const swipeThreshold = CONFIG.reel?.hold?.swipeThresholdPx || 100;

    if (holdState?.hasHold) {
      const toggle =
        input.toggleHold ||
        (input.swipeDeltaY !== undefined && input.swipeDeltaY > swipeThreshold);
      if (toggle) {
        this.#fishingSystem.isHoldActive()
          ? this.#fishingSystem.deactivateHold()
          : this.#fishingSystem.activateHold();
        if (input.swipeDeltaY !== undefined) this.#inputManager.consumeSwipe();
      }
    }

    const pump =
      input.pumpAction ||
      (input.swipeDeltaY !== undefined && input.swipeDeltaY < -swipeThreshold);
    if (pump) {
      const reduction = this.#fishingSystem.tryUsePump(
        CONFIG.reel?.pumpLevel || 0,
        CONFIG.reel?.pumpPowerPerLevel || 10,
      );
      if (reduction > 0) {
        this.#tensionMeter.applyPump(reduction);
        if (input.swipeDeltaY !== undefined) this.#inputManager.consumeSwipe();
      }
    }
  }

  #checkVictory(pos, bottomY, dt) {
    this.#isNetReady = this.#net.isFloatInZone(pos.y, bottomY);
    const triggerY = this.#net.getTriggerVirtualY(bottomY);
    const autoCatchY =
      bottomY -
      (CONFIG.locations.catchLineOffsetPx ?? 5) / this.#projector.getScale();

    if (pos.y >= triggerY && pos.y < autoCatchY) {
      this.#fishingSystem.tryTriggerFishLastDash?.(dt);
    }

    if (pos.y >= autoCatchY) {
      this.#gameState = "victory";
    }
  }

  #updateUserInterface() {
    if (this.#gameState === "playing") {
      this.#holdUI.update(this.#fishingSystem.getHoldUIState?.());
    } else {
      this.#holdUI.update(null);
      if (this.#gameState !== "scouting" && this.#depthUI.isActive)
        this.#depthUI.hide();
    }
  }

  #getEnvData(bounds) {
    const pos = this.#float.getPosition();
    const cell = this.#getCell(pos.x, pos.y);
    const depth = cell ? cell.depth : 0;
    const vTop = bounds ? bounds.top : 0;
    const vBot = bounds ? bounds.bottom : 1440;
    const chum = this.#chumManager
      ? this.#chumManager.getChumDataAt(pos.x, pos.y, vTop, vBot)
      : { bonus: 1.0, targets: null };

    return {
      hookDepth: Math.min(this.#float.getCurrentHookDepth(), depth),
      lineLength: this.#currentHookDepth,
      bottomDepth: depth,
      timePhase: this.#currentPhase,
      dayOfWeek: new Date().getDay(),
      zoneMultiplier: 1.0,
      chumBonus: chum.bonus,
      chumTargets: chum.targets,
      isRaining: this.#isRaining,
      isFoggy: this.#isFoggy,
      castSpamMultiplier: this.#castManager.getBiteChanceMultiplier(),
    };
  }

  #getDynamicBounds() {
    const cb = this.#locationMap.getCastableBoundsVirtual(
      CONFIG.locations.cellSize,
    );
    const vTL = this.#projector.screenToVirtual(0, 0);
    const vBR = this.#projector.screenToVirtual(
      this.#canvas.width,
      this.#canvas.height,
    );

    let L = cb ? cb.left : 0;
    let R = cb ? cb.right : 2560;

    if (CONFIG.locations.lockZoneXToScreen) {
      L = Math.max(vTL.x, L);
      R = Math.min(vBR.x, R);
    }

    return {
      left: L,
      right: R,
      top: cb ? cb.top : 0,
      bottom: cb ? cb.bottom : 1440,
    };
  }

  #getRodVirtualPos() {
    const rodX =
      CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== "center"
        ? Number(CONFIG.ui.rod.x)
        : this.#canvas.width / 2;
    const bounds = this.#locationMap.getCastableBoundsVirtual(
      CONFIG.locations.cellSize,
    );
    return new Vector2(
      this.#projector.screenToVirtual(rodX, 0).x,
      bounds ? bounds.bottom : 1440,
    );
  }

  #checkWater(vx, vy) {
    const cell = this.#getCell(vx, vy);
    return !!(cell && cell.isCastable && !cell.hasCollision);
  }

  #getCell(vx, vy) {
    return this.#locationMap.getCellAtVirtualPos(
      vx,
      vy,
      CONFIG.locations.cellSize,
    );
  }

  #markInvalidCast(pos) {
    this.#invalidCastMarker = { x: pos.x, y: pos.y, timer: 500 };
  }

  #applyDebugCatch(fish) {
    if (!CONFIG.debug?.fixedCatch?.enabled) return fish;
    const fixed = CONFIG.debug.fixedCatch;
    const template =
      CONFIG.spawns.fishes.find((f) => f.id === fixed.fishId) ||
      CONFIG.spawns.fishes[0];
    return {
      id: template.id,
      name: template.name + " (TEST)",
      physics: template.physics,
      ...fixed,
    };
  }

  #syncDebugOverlay(bounds) {
    if (!CONFIG.debug?.overlay) return;

    const env = this.#getEnvData(bounds);
    const pos = this.#float.getPosition();
    const fs = this.#fishingSystem;

    document.dispatchEvent(
      new CustomEvent("debug-live-update", {
        detail: {
          gameState: this.#gameState,
          floatX: Math.round(pos.x),
          floatY: Math.round(pos.y),
          hookDepth: env.hookDepth,
          bottomDepth: env.bottomDepth,
          lineLength: env.lineLength, // Додано
          bait: "oil_worm",
          phase: this.#currentPhase,
          liveChances: this.#biteSystem.getLiveChances(env, {
            hookSize: CONFIG.hook.level,
            baitId: "oil_worm",
          }),
          isRaining: this.#isRaining, // Додано
          isFoggy: this.#isFoggy, // Додано
          fishState: fs?.getCurrentState?.() || "N/A",
          activeDebuff: fs?.getActiveDebuffName?.() || "Немає",
          isMastery: this.#staminaController?.isMasteryActive?.() || false,
        },
      }),
    );
  }

  draw() {
    this.#renderer.clear(CONFIG.canvas.backgroundColor);

    const mapBounds = this.#locationMap.getCastableBoundsVirtual(
      CONFIG.locations.cellSize,
    );
    const virtualBottomY = mapBounds ? mapBounds.bottom : 1440;
    const vTop = mapBounds ? mapBounds.top : 0;

    if (typeof this.#renderer.drawBackground === "function") {
      this.#renderer.drawBackground(this.#locationMap, this.#projector);
    }

    if (CONFIG.locations && CONFIG.locations.debugVisuals) {
      this.#renderer.drawLocationDebug(
        this.#locationMap,
        this.#projector,
        CONFIG.locations,
      );
    }

    if (this.#invalidCastMarker) {
      this.#renderer.drawInvalidCastMarker(this.#invalidCastMarker);
    }

    if (
      CONFIG.locations.showChumZones !== false &&
      this.#chumManager &&
      typeof this.#renderer.drawChumZones === "function"
    ) {
      this.#renderer.drawChumZones(
        this.#chumManager,
        this.#projector,
        vTop,
        virtualBottomY,
      );
    }

    if (
      this.#chumManager &&
      typeof this.#renderer.drawBoatWaypoints === "function"
    ) {
      this.#renderer.drawBoatWaypoints(this.#chumManager, this.#projector);
    }

    if (this.#chumManager && typeof this.#renderer.drawBoats === "function") {
      this.#renderer.drawBoats(
        this.#chumManager,
        this.#projector,
        vTop,
        virtualBottomY,
      );
    }

    if (
      this.#isAimingChum &&
      typeof this.#renderer.drawChumAiming === "function"
    ) {
      const method = CONFIG.chum.currentMethod || "hand";

      if (method === "hand") {
        const locationConfig = CONFIG.locations.map["test"];
        const maxHandDist = locationConfig?.chumCastDistance || 800;

        this.#renderer.drawChumAiming(
          this.#projector,
          virtualBottomY,
          maxHandDist,
        );
      }
    }

    if (
      this.#gameState === "waiting" ||
      this.#gameState === "biting" ||
      this.#gameState === "playing" ||
      this.#gameState === "failed" ||
      this.#gameState === "victory"
    ) {
      const vPos = this.#float.getPosition();
      const sPos = this.#projector.virtualToScreen(vPos.x, vPos.y);

      this.#renderer.drawCatchZone(
        this.#projector,
        this.#net,
        virtualBottomY,
        CONFIG.locations,
        CONFIG.ui.catchZone,
      );

      let lineLengthRatio = 1.0;
      let lineDropOffset = 0;

      if (this.#gameState === "waiting" || this.#gameState === "biting") {
        const targetDepth = this.#currentHookDepth || 1.0;
        const sinkRate = CONFIG.sinker?.sinkRate || 1.0;
        const baseSinkTimeMs = (targetDepth / sinkRate) * 1000;

        const minDelay = CONFIG.ui?.line?.distanceDelayMinMs ?? 500;
        const maxDelay = CONFIG.ui?.line?.distanceDelayMaxMs ?? 2000;
        const distanceDelayMs =
          minDelay + this.#castDistanceRatio * (maxDelay - minDelay);

        const durationMs = baseSinkTimeMs + distanceDelayMs;

        const elapsed = performance.now() - this.#castStartTime;
        let progress = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;

        const easePower = CONFIG.ui?.line?.shrinkEasePower ?? 3;
        let easeOutProgress = progress;
        if (easePower > 1) {
          easeOutProgress = 1 - Math.pow(1 - progress, easePower);
        }

        const targetPercent = (CONFIG.ui?.line?.shrinkPercent ?? 60) / 100;
        lineLengthRatio = 1.0 - easeOutProgress * (1.0 - targetPercent);

        lineDropOffset = easeOutProgress * (CONFIG.ui?.line?.sinkDropPx ?? 40);
      } else if (this.#gameState === "playing") {
        if (this.#lastGameState !== "playing") {
          this.#playStartTime = performance.now();
        }

        const elapsed = performance.now() - this.#playStartTime;
        const baseSnapDuration = CONFIG.ui?.line?.snapDurationMs ?? 500;
        const maxMult = CONFIG.ui?.line?.snapDepthMaxMultiplier ?? 2.0;
        const currentDepth = this.#currentHookDepth || 0;

        const depthRatio = Math.min(1, currentDepth / 10.0);
        const dynamicMult = 1.0 + depthRatio * (maxMult - 1.0);
        const snapDuration = baseSnapDuration * dynamicMult;

        let progress =
          snapDuration > 0 ? Math.min(1, elapsed / snapDuration) : 1;
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const targetPercent = (CONFIG.ui?.line?.shrinkPercent ?? 60) / 100;

        lineLengthRatio = targetPercent + easeProgress * (1.0 - targetPercent);

        const maxDrop = CONFIG.ui?.line?.sinkDropPx ?? 40;
        lineDropOffset = maxDrop * (1 - easeProgress);
      }

      this.#lastGameState = this.#gameState;

      const mapBottomScreenY = this.#projector.virtualToScreen(
        0,
        virtualBottomY,
      ).y;

      const rodScreenY = this.#canvas.height - (CONFIG.ui?.rod?.yOffset || 0);
      const rodTopY = rodScreenY - 200;

      const distY = sPos.y - rodTopY;

      if (distY < 0) {
        const minRatio = (mapBottomScreenY - rodTopY) / distY;
        lineLengthRatio = Math.max(lineLengthRatio, minRatio);
      }

      const targetYAfterShrink = rodTopY + distY * lineLengthRatio;
      const maxAllowedDrop = Math.max(0, mapBottomScreenY - targetYAfterShrink);

      lineDropOffset = Math.min(lineDropOffset, maxAllowedDrop);

      const currentTension = this.#tensionMeter
        ? this.#tensionMeter.getTension()
        : 0;
      this.#renderer.drawRodLine(
        sPos,
        this.#gameState,
        currentTension,
        lineLengthRatio,
        lineDropOffset,
        CONFIG.ui.rod,
        CONFIG.ui.line,
      );

      this.#renderer.drawFloat(sPos, this.#float, CONFIG.float);

      if (
        this.#gameState === "playing" &&
        this.#tensionMeter &&
        this.#fishCondition
      ) {
        this.#renderer.drawTensionBar(
          this.#tensionMeter,
          CONFIG.tension,
          CONFIG.ui.indicators,
        );
        this.#renderer.drawFishCondition(
          this.#fishCondition,
          CONFIG.ui.indicators,
        );
      }
    }

    if (this.#gameState === "failed") {
      this.#renderer.drawGameOver(
        this.#canvas.width,
        this.#canvas.height,
        this.failReason || this.#tensionMeter.getBreakReason(),
      );
    } else if (this.#gameState === "victory") {
      this.#renderer.drawVictory(this.#canvas.width, this.#canvas.height);
    }
  }

  loop(timestamp) {
    const dt = timestamp - this.#lastTime;
    this.#lastTime = timestamp;

    this.update(dt);
    this.draw();

    if (this.#uiManager) {
      this.#uiManager.updateNetButtonState(
        CONFIG,
        this.#isNetReady && this.#gameState === "playing",
      );
      this.#uiManager.updateContinueButtonState(
        this.#gameState === "failed" || this.#gameState === "victory",
      );
    }

    requestAnimationFrame(this.loop);
  }
}

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

    let anchorX = null;
    if (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== "center") {
      anchorX = Number(CONFIG.ui.rod.x);
    }

    this.#inputManager = new InputManager(this.#canvas, anchorX);
    this.#renderer = new Renderer(this.#canvas);
    this.#net = new Net(CONFIG.net);
    this.#uiManager = new UIManager(CONFIG);
    this.#uiManager.onNetClick = () => this.#handleNetClick();
    this.#uiManager.onContinueClick = () => this.#resetGame();

    const currentLocationId = "test";
    const locationConfig = CONFIG.locations.map[currentLocationId];
    const perspectiveSquash = locationConfig?.perspectiveSquash || {
      top: 0.15,
      bottom: 0.75,
    };

    this.#chumManager = new ChumManager(
      currentLocationId,
      CONFIG.chum,
      perspectiveSquash,
    );

    this.#chumUI = new ChumUI(() => this.#toggleChumAim());
    this.#isAimingChum = false;
    this.#locationMap = new LocationMap("test", CONFIG.locations);
    this.#projector = new ViewportProjector(CONFIG.locations, "test");

    document.addEventListener("config-updated", (e) => {
      if (e.detail && e.detail.path && e.detail.path[0] === "locations") {
        if (this.#projector) {
          this.#projector.update(0, 0);
          this.#projector.update(this.#canvas.width, this.#canvas.height);
        }
        if (this.#locationMap) {
          this.#locationMap.refreshConfig(CONFIG.locations);
        }
      }
    });

    this.#depthUI = new DepthSelectorUI();
    this.#timeUI = new TimeDisplayUI();
    this.#holdUI = new HoldChargesUI();
    this.#resizeCanvas();
    window.addEventListener("resize", () => this.#resizeCanvas());

    const initialX = CONFIG.float.initialX ?? this.#canvas.width / 2;
    const initialY = CONFIG.float.initialY ?? this.#canvas.height / 2;
    this.#float = new FloatEntity(initialX, initialY, CONFIG.float);

    const now = new Date();
    this.#gameTimeHours =
      CONFIG.debug?.initialTime ?? now.getHours() + now.getMinutes() / 60;

    this.#gameState = "scouting";
    this.#invalidCastMarker = null;

    this.#bounds = {
      left: 0,
      right: CONFIG.locations.baseResolution.width,
      top: 0,
      bottom: CONFIG.locations.baseResolution.height,
    };

    this.#lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.#castManager = new CastManager(); // Більше не потребує конфігу
    this.#biteSystem = new BiteSystem(CONFIG.spawns, CONFIG.float); // Передаємо тільки потрібні частини
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

  update(dt) {
    const timeScale = CONFIG.debug?.timeScale || 1;
    this.#gameTimeHours += (dt / 1000 / 3600) * timeScale;
    if (this.#gameTimeHours >= 24) this.#gameTimeHours %= 24;

    this.#timeUI.update(this.#gameTimeHours);
    this.#projector.update(this.#canvas.width, this.#canvas.height);
    this.#locationMap.update(dt, this.#gameTimeHours);

    // === АВТОМАТИЧНА КАМЕРА (ТІЛЬКИ ПО Y) ===
    if (
      this.#gameState === "waiting" ||
      this.#gameState === "biting" ||
      this.#gameState === "playing"
    ) {
      const floatVPos = this.#float.getPosition();
      this.#projector.focusOnVirtualPos(floatVPos.y, dt, 0.05);
    } else if (this.#gameState === "scouting") {
      const mapBoundsForCamera = this.#locationMap.getCastableBoundsVirtual(
        CONFIG.locations.cellSize,
      );
      const safeY = mapBoundsForCamera ? mapBoundsForCamera.bottom - 200 : 1200;
      this.#projector.focusOnVirtualPos(safeY, dt, 0.03);
    }

    const inputState = this.#inputManager.getState();

    const checkWater = (vx, vy) => {
      const cell = this.#locationMap.getCellAtVirtualPos(
        vx,
        vy,
        CONFIG.locations.cellSize,
      );
      return cell && cell.isCastable && !cell.hasCollision;
    };

    const boatBaseEnv = CONFIG.locations.map.test.environment || null;
    const boatEnv = boatBaseEnv ? { current: boatBaseEnv.current } : null;

    if (this.#chumManager) {
      this.#chumManager.update(Date.now(), timeScale);
      this.#chumManager.updateBoats(
        dt,
        checkWater,
        CONFIG.locations.cellSize,
        boatEnv,
      );

      const bounds = this.#locationMap.getCastableBoundsVirtual(
        CONFIG.locations.cellSize,
      );
      if (bounds) {
        const virtualBottomY = bounds.bottom;
        // Беремо лінію спрацьовування з нашого нового класу Net
        const triggerVirtualY = this.#net.getTriggerVirtualY(virtualBottomY);

        const boats = this.#chumManager.getBoats();
        for (const boat of boats) {
          if (boat.state === "drifting") {
            // Тепер просто перевіряємо віртуальну координату кораблика
            if (boat.pos.y >= triggerVirtualY) {
              boat.isFinished = true;
            }
          }
        }
      }
    }

    if (this.#chumUI && typeof this.#chumUI.setState === "function") {
      const isBoatMethod = CONFIG.chum.currentMethod === "boat";
      const boats = this.#chumManager ? this.#chumManager.getBoats() : [];
      const activeBoat = boats.length > 0 ? boats[0] : null;

      if (this.#gameState === "playing") {
        if (this.#isAimingChum) {
          this.#isAimingChum = false;
        }
        this.#chumUI.setState("disabled");
      } else if (this.#chumManager && this.#chumManager.hasDriftingBoat()) {
        this.#chumUI.setState("empty");
      } else if (
        activeBoat &&
        activeBoat.state === "waiting" &&
        !activeBoat.zoneId
      ) {
        this.#chumUI.setState("empty");
      } else if (this.#chumManager && this.#chumManager.getWaitingBoat()) {
        this.#chumUI.setState("ready");
      } else if (this.#chumManager && this.#chumManager.isBoatMoving()) {
        this.#chumUI.setState("moving");
      } else if (
        isBoatMethod &&
        this.#chumManager &&
        this.#chumManager.getBoatEnergy() <= 0
      ) {
        this.#chumUI.setState("empty");
      } else if (this.#isAimingChum) {
        this.#chumUI.setState("aiming");
      } else {
        this.#chumUI.setState("idle");
      }
    }

    if (this.#isAimingChum) {
      inputState.isPulling = false;
      inputState.longPressPos = null;

      const method = CONFIG.chum.currentMethod || "hand";

      // --- ЗМІНЕНО ТУТ: Читаємо дистанцію з локації ---
      const locationConfig = CONFIG.locations.map["test"];
      const maxHandDist = locationConfig.chumCastDistance || 800;

      if (inputState.clickPos) {
        const vPos = this.#projector.screenToVirtual(
          inputState.clickPos.x,
          inputState.clickPos.y,
        );
        const cell = this.#locationMap.getCellAtVirtualPos(
          vPos.x,
          vPos.y,
          CONFIG.locations.cellSize,
        );

        // --- НОВЕ: Рахуємо лінію заборони у віртуальному світі ---
        const mapBounds = this.#locationMap.getCastableBoundsVirtual(
          CONFIG.locations.cellSize,
        );
        const virtualBottomY = mapBounds ? mapBounds.bottom : 1440;

        // Це точна координата Y, вище якої кидати не можна
        const throwLineVirtualY = virtualBottomY - maxHandDist;

        if (cell && cell.isCastable && !cell.hasCollision) {
          if (method === "boat" && this.#activeBoat) {
            this.#chumManager.deployBait(
              vPos.x,
              vPos.y,
              "carp_mix_basic",
              method,
              this.#activeBoat,
            );
            this.#activeBoat = null;
            this.#isAimingChum = false;

            // --- ЗМІНЕНО ТУТ: Перевіряємо, чи клік знаходиться НИЖЧЕ нашої лінії (Y більший або дорівнює) ---
          } else if (method === "hand" && vPos.y >= throwLineVirtualY) {
            this.#chumManager.deployBait(
              vPos.x,
              vPos.y,
              "carp_mix_basic",
              "hand",
            );
            this.#toggleChumAim();
          } else {
            console.log("Задалеко для кидка рукою!");
            this.#invalidCastMarker = {
              x: inputState.clickPos.x,
              y: inputState.clickPos.y,
              timer: 500,
            };
          }
        } else {
          this.#invalidCastMarker = {
            x: inputState.clickPos.x,
            y: inputState.clickPos.y,
            timer: 500,
          };
        }
        return;
      }
    }

    if (inputState.isDoubleClick) {
      if (this.#gameState === "waiting") {
        if (this.#chumManager && this.#chumManager.isBoatMoving()) return;

        this.#gameState = "scouting";
        if (this.#tensionMeter) this.#tensionMeter.reset();
        if (this.#biteSystem) this.#biteSystem.reset();

        if (CONFIG.debug?.overlay) {
          document.dispatchEvent(
            new CustomEvent("debug-live-update", {
              detail: { gameState: "scouting" },
            }),
          );
        }
        return;
      }
    }

    if (inputState.longPressPos && this.#gameState === "waiting") {
      if (this.#chumManager && this.#chumManager.isBoatMoving()) {
        console.log("Закидання заблоковано: кораблик у русі!");
        return;
      }

      const vPos = this.#projector.screenToVirtual(
        inputState.longPressPos.x,
        inputState.longPressPos.y,
      );
      const cell = this.#locationMap.getCellAtVirtualPos(
        vPos.x,
        vPos.y,
        CONFIG.locations.cellSize,
      );

      if (cell && cell.isCastable && !cell.hasCollision) {
        this.#castManager.registerCast(performance.now());
        this.#castLine(vPos.x, vPos.y, cell.depth);
      } else {
        this.#invalidCastMarker = {
          x: inputState.longPressPos.x,
          y: inputState.longPressPos.y,
          timer: 500,
        };
      }
    }

    if (this.#gameState === "scouting") {
      const maxDepth = CONFIG.sinker.maxDepth || 8.0;

      if (!this.#depthUI.isActive) {
        this.#depthUI.show(maxDepth, this.#currentHookDepth, (newDepth) => {
          this.#currentHookDepth = newDepth;
        });
      } else {
        if (typeof this.#depthUI.updateMax === "function") {
          this.#depthUI.updateMax(maxDepth);
        }
      }

      if (inputState.panDeltaX !== 0) {
        const virtualDelta = inputState.panDeltaX / this.#projector.getScale();
        this.#projector.pan(virtualDelta);
      }

      if (inputState.clickPos) {
        const vPos = this.#projector.screenToVirtual(
          inputState.clickPos.x,
          inputState.clickPos.y,
        );
        const cell = this.#locationMap.getCellAtVirtualPos(
          vPos.x,
          vPos.y,
          CONFIG.locations.cellSize,
        );

        if (cell && cell.isCastable && !cell.hasCollision) {
          if (this.#castManager.canCast()) {
            this.#castManager.registerCast(performance.now());
            this.#depthUI.hide();
            this.#castLine(vPos.x, vPos.y, cell.depth);
          } else {
            this.#invalidCastMarker = {
              x: inputState.clickPos.x,
              y: inputState.clickPos.y,
              timer: 500,
            };
          }
        } else {
          this.#invalidCastMarker = {
            x: inputState.clickPos.x,
            y: inputState.clickPos.y,
            timer: 500,
          };
        }
      }

      if (this.#invalidCastMarker) {
        this.#invalidCastMarker.timer -= dt;
        if (this.#invalidCastMarker.timer <= 0) this.#invalidCastMarker = null;
      }
      return;
    } else {
      if (this.#depthUI.isActive) {
        this.#depthUI.hide();
      }
    }

    this.#castManager.update(dt);

    const windCfg = CONFIG.locations.map.test.environment.wind;

    this.#windState.timer -= dt;
    if (this.#windState.timer <= 0) {
      const changes =
        windCfg.changesPerDay[0] +
        Math.random() * (windCfg.changesPerDay[1] - windCfg.changesPerDay[0]);
      this.#windState.timer = (24 * 60 * 60 * 1000) / changes;

      const dirs = [-1, 0, 1];
      this.#windState.direction = dirs[Math.floor(Math.random() * dirs.length)];
    }

    this.#weatherTimer -= dt;
    if (this.#weatherTimer <= 0) {
      const weatherCfg = CONFIG.locations.map.test.weather;

      this.#isRaining = Math.random() < weatherCfg.chances.rain;
      this.#isFoggy = Math.random() < weatherCfg.chances.fog;
      this.#weatherTimer = weatherCfg.updateIntervalMs;

      if (this.#isRaining && windCfg.rainMultiplier) {
        this.#windState.rainMult =
          windCfg.rainMultiplier[0] +
          Math.random() *
            (windCfg.rainMultiplier[1] - windCfg.rainMultiplier[0]);
      } else {
        this.#windState.rainMult = 1.0;
      }
    }

    const baseEnv = CONFIG.locations.map.test.environment || null;
    let dynamicEnv = null;

    if (baseEnv) {
      dynamicEnv = { current: baseEnv.current, wind: null };

      if (baseEnv.wind && this.#windState.direction !== 0) {
        const mult = this.#windState.rainMult;
        dynamicEnv.wind = {
          direction: this.#windState.direction,
          breezeAngleRange: [
            baseEnv.wind.breezeAngleRange[0] * mult,
            baseEnv.wind.breezeAngleRange[1] * mult,
          ],
          gustAngleRange: [
            baseEnv.wind.gustAngleRange[0] * mult,
            baseEnv.wind.gustAngleRange[1] * mult,
          ],
          gustFluctuationMs: baseEnv.wind.gustFluctuationMs,
          gustChancePerSec: baseEnv.wind.gustChancePerSec * mult,
          gustDurationMs: baseEnv.wind.gustDurationMs,
        };
      }
    }

    const currentHour = Math.floor(this.#gameTimeHours);

    if (currentHour !== this.#lastHour) {
      this.#lastHour = currentHour;
      for (const [phase, times] of Object.entries(CONFIG.spawns.timePhases)) {
        if (times.startHour < times.endHour) {
          if (currentHour >= times.startHour && currentHour < times.endHour)
            this.#currentPhase = phase;
        } else {
          if (currentHour >= times.startHour || currentHour < times.endHour)
            this.#currentPhase = phase;
        }
      }
    }

    const floatPos = this.#float.getPosition();
    const floatScreenPos = this.#projector.virtualToScreen(
      floatPos.x,
      floatPos.y,
    );

    const currentCell = this.#locationMap.getCellAtVirtualPos(
      floatPos.x,
      floatPos.y,
      CONFIG.locations.cellSize,
    );
    const currentDepth = currentCell ? currentCell.depth : 0;

    const bounds = this.#locationMap.getCastableBoundsVirtual(
      CONFIG.locations.cellSize,
    );
    const vTop = bounds ? bounds.top : 0;
    const virtualBottomY = bounds ? bounds.bottom : 1440;

    const chumData = this.#chumManager
      ? this.#chumManager.getChumDataAt(
          floatPos.x,
          floatPos.y,
          vTop,
          virtualBottomY,
        )
      : { bonus: 1.0, targets: null };

    const envData = {
      hookDepth: Math.min(this.#float.getCurrentHookDepth(), currentDepth),
      lineLength: this.#currentHookDepth,
      bottomDepth: currentDepth,
      timePhase: this.#currentPhase,
      dayOfWeek: new Date().getDay(),
      zoneMultiplier: 1.0,
      chumBonus: chumData.bonus,
      chumTargets: chumData.targets,
      isRaining: this.#isRaining,
      isFoggy: this.#isFoggy,
      castSpamMultiplier: this.#castManager.getBiteChanceMultiplier(),
    };

    const playerGear = {
      hookSize: CONFIG.hook.level,
      baitId: "oil_worm",
    };

    const castableBounds = this.#locationMap.getCastableBoundsVirtual(
      CONFIG.locations.cellSize,
    );

    const vTopLeft = this.#projector.screenToVirtual(0, 0);
    const vBottomRight = this.#projector.screenToVirtual(
      this.#canvas.width,
      this.#canvas.height,
    );

    // 1. Базові межі по осі X (на всю карту)
    let boundLeft = castableBounds ? castableBounds.left : 0;
    let boundRight = castableBounds ? castableBounds.right : 2560;

    // 2. Якщо увімкнено фіксацію по X - обрізаємо межі до країв поточного екрана (камери)
    if (CONFIG.locations.lockZoneXToScreen) {
      boundLeft = Math.max(vTopLeft.x, boundLeft);
      boundRight = Math.min(vBottomRight.x, boundRight);
    }

    const dynamicBounds = {
      left: boundLeft,
      right: boundRight,
      // ВАЖЛИВО: Осі Y ЗАВЖДИ фіксуються по віртуальній карті (щоб не читерили вікном)
      top: castableBounds ? castableBounds.top : 0,
      bottom: castableBounds ? castableBounds.bottom : 1440,
    };

    if (this.#gameState === "waiting") {
      this.#float.update(dynamicBounds, dt, dynamicEnv, checkWater);

      let hookedFish = this.#biteSystem.evaluateBite(dt, envData, playerGear);

      if (hookedFish && CONFIG.debug?.fixedCatch?.enabled) {
        const fixed = CONFIG.debug.fixedCatch;
        const template =
          CONFIG.spawns.fishes.find((f) => f.id === fixed.fishId) ||
          CONFIG.spawns.fishes[0];

        hookedFish = {
          id: template.id,
          name: template.name + " (TEST)",
          physics: template.physics,
          level: fixed.level,
          weight: fixed.weight,
          resistance: fixed.resistance,
        };
      }

      if (hookedFish) {
        this.#gameState = "biting";
        this.#currentBitingFish = hookedFish;
        this.#float.startBite();
      }
    } else if (this.#gameState === "biting") {
      this.#float.updateBite(dt, checkWater);
      this.#float.update(dynamicBounds, dt, dynamicEnv, checkWater);

      if (!this.#float.isBiting()) {
        this.#gameState = "waiting";
        this.#currentBitingFish = null;
        if (this.#biteSystem) this.#biteSystem.reset();
        if (this.#tensionMeter) this.#tensionMeter.reset();
      } else if (inputState.isPulling) {
        const isGuaranteed = this.#float.isGuaranteedBite();
        const catchChance = isGuaranteed ? 0.99 : 0.01;

        if (Math.random() <= catchChance) {
          this.#float.hook();
          this.#hookFish(this.#currentBitingFish);
        } else {
          this.#float.stopBite();
          this.#gameState = "scouting";
          this.#currentBitingFish = null;
          if (this.#tensionMeter) this.#tensionMeter.reset();
        }
      }
    }

    let finalFishForce = { x: 0, y: 0 };
    let finalPlayerForce = { x: 0, y: 0 };

    if (this.#gameState === "playing") {
      if (this.#tensionMeter.isBroken()) {
        this.#gameState = "failed";
        const reason = this.#tensionMeter.getBreakReason();
        this.failReason = reason;
        document.dispatchEvent(
          new CustomEvent("fishingFailed", { detail: { reason: reason } }),
        );

        if (CONFIG.debug?.overlay) {
          document.dispatchEvent(
            new CustomEvent("debug-live-update", {
              detail: { gameState: "failed" },
            }),
          );
        }
        return;
      }

      // ДОДАНО 1: ПЕРЕХОПЛЕННЯ УПРАВЛІННЯ ДЛЯ МЕХАНІКИ УТРИМАННЯ (TOGGLE)
      let holdState = null;
      if (
        this.#fishingSystem &&
        typeof this.#fishingSystem.getHoldUIState === "function"
      ) {
        holdState = this.#fishingSystem.getHoldUIState();
      }

      if (holdState && holdState.hasHold) {
        let wantsToToggle = false;

        if (inputState.toggleHold) {
          wantsToToggle = true;
        }

        const swipeThreshold = CONFIG.reel?.hold?.swipeThresholdPx || 100;
        if (
          inputState.swipeDeltaY !== undefined &&
          inputState.swipeDeltaY > swipeThreshold
        ) {
          wantsToToggle = true;
          this.#inputManager.consumeSwipe();
        }

        if (wantsToToggle) {
          if (this.#fishingSystem.isHoldActive()) {
            this.#fishingSystem.deactivateHold();
          } else {
            this.#fishingSystem.activateHold();
          }
        }
      }

      // ДОДАНО 3: МЕХАНІКА ПІДТЯЖКИ (PUMP - Клавіша S або Свайп Вниз)
      let wantsToPump = false;

      if (inputState.pumpAction) wantsToPump = true;

      const swipeThreshold = CONFIG.reel?.hold?.swipeThresholdPx || 100;
      if (
        inputState.swipeDeltaY !== undefined &&
        inputState.swipeDeltaY < -swipeThreshold
      ) {
        wantsToPump = true;
        this.#inputManager.consumeSwipe();
      }

      if (wantsToPump) {
        const pumpLevel = CONFIG.reel?.pumpLevel || 0;
        const powerPerLevel = CONFIG.reel?.pumpPowerPerLevel || 10;

        const reductionAmount = this.#fishingSystem.tryUsePump(
          pumpLevel,
          powerPerLevel,
        );

        if (reductionAmount > 0) {
          this.#tensionMeter.applyPump(reductionAmount);

          if (window.DEBUG_MODULES && window.DEBUG_MODULES.forces) {
            console.log(
              `%c🎣 ПІДТЯЖКА! Натяг знижено на ${reductionAmount}% (Рівень: ${pumpLevel} * Сила: ${powerPerLevel}%)`,
              "color: #00ccff; font-weight: bold;",
            );
          }
        }
      }
      // =========================================================

      const fishForceRaw = this.#fishingSystem.calculateFishForce(
        dt,
        floatPos,
        this.#bounds,
        CONFIG.stamina.mechanics,
        checkWater,
      );

      let effectiveFishForceY = fishForceRaw.y;
      let tensionFishForce = fishForceRaw.clone();

      const isHold =
        typeof this.#fishingSystem.isHoldActive === "function"
          ? this.#fishingSystem.isHoldActive()
          : false;

      if (isHold) {
        if (effectiveFishForceY < 0) {
          effectiveFishForceY = 0;

          const tensionMult =
            typeof this.#fishingSystem.getHoldTensionMultiplier === "function"
              ? this.#fishingSystem.getHoldTensionMultiplier()
              : 1.0;

          tensionFishForce.y = fishForceRaw.y * tensionMult;
        }
      }

      const currentFishMaxForceScaled =
        Math.max(Math.abs(tensionFishForce.x), Math.abs(tensionFishForce.y)) *
        0.01;

      const fishForce = new Vector2(
        fishForceRaw.x,
        effectiveFishForceY,
      ).multiplyScalar(CONFIG.physics.fishForceMultiplier);
      this.#float.applyForce(fishForce);

      finalFishForce = tensionFishForce
        .clone()
        .multiplyScalar(CONFIG.physics.fishForceMultiplier);

      let rodScreenX = this.#canvas.width / 2;

      if (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== "center") {
        rodScreenX = Number(CONFIG.ui.rod.x);
      }

      // СТАЛО:
      // Отримуємо віртуальний берег
      const mapBoundsForRod = this.#locationMap.getCastableBoundsVirtual(
        CONFIG.locations.cellSize,
      );
      const shoreVirtualY = mapBoundsForRod ? mapBoundsForRod.bottom : 1440;

      // Жорстко фіксуємо точку тяги рибака на віртуальному березі,
      // незалежно від того, якого розміру вікно браузера!
      const rodVirtualPos = new Vector2(
        this.#projector.screenToVirtual(rodScreenX, 0).x,
        shoreVirtualY,
      );

      const floatScreenPosInitial = this.#projector.virtualToScreen(
        floatPos.x,
        floatPos.y,
      );
      const maxOffsetDistance = Math.max(
        rodScreenX,
        this.#canvas.width - rodScreenX,
      );
      const screenOffsetRatio = Math.min(
        1,
        Math.abs(floatScreenPosInitial.x - rodScreenX) / maxOffsetDistance,
      );

      const rawPlayerPower = this.#fishingSystem.calculatePlayerForce(
        new Vector2(0, 1),
        floatPos.x,
        floatPos.y,
        rodVirtualPos,
        screenOffsetRatio,
        CONFIG.physics,
      ).y;

      const playerMaxPower = Math.abs(
        rawPlayerPower * CONFIG.physics.playerForceMultiplier,
      );

      const fishPowerMag =
        Math.max(Math.abs(tensionFishForce.x), Math.abs(tensionFishForce.y)) *
        CONFIG.physics.fishForceMultiplier;

      const reelPower = this.#fishingSystem.getReelPower();

      let playerForce = new Vector2(0, 0);

      if (inputState.isPulling) {
        const playerForceRaw = this.#fishingSystem.calculatePlayerForce(
          inputState.pullDirection,
          floatPos.x,
          floatPos.y,
          rodVirtualPos,
          screenOffsetRatio,
          CONFIG.physics,
        );
        playerForce = playerForceRaw
          .clone()
          .multiplyScalar(CONFIG.physics.playerForceMultiplier);
        this.#float.applyForce(playerForce);
      }

      finalPlayerForce = playerForce;

      this.#tensionMeter.update(
        inputState.isPulling,
        playerMaxPower,
        fishPowerMag,
        reelPower,
        currentFishMaxForceScaled,
        dt,
        CONFIG.tension,
        CONFIG.hookMechanics,
        isHold,
      );

      this.#staminaController.evaluate(
        this.#tensionMeter.getTension(),
        inputState.isPulling,
        dt,
        floatPos.x,
        dynamicBounds,
      );

      this.#float.update(dynamicBounds, dt, dynamicEnv, checkWater);

      const updatedFloatPos = this.#float.getPosition();

      const castableBoundsVirtual = this.#locationMap.getCastableBoundsVirtual(
        CONFIG.locations.cellSize,
      );
      const virtualBottomY = castableBoundsVirtual
        ? castableBoundsVirtual.bottom
        : 1440;

      // --- 1. ОНОВЛЕННЯ ПІДСАКИ ЧЕРЕЗ КЛАС NET ---
      this.#isNetReady = this.#net.isFloatInZone(
        updatedFloatPos.y,
        virtualBottomY,
      );

      // --- 2. ЛОГІКА РИВКА ТА АВТОВИЛОВУ (У віртуальних координатах) ---
      const triggerVirtualY = this.#net.getTriggerVirtualY(virtualBottomY);

      // Конвертуємо піксельний відступ берега у віртуальний
      const catchLineOffsetPx = CONFIG.locations.catchLineOffsetPx ?? 5;
      const virtualCatchOffset = catchLineOffsetPx / this.#projector.getScale();
      const autoCatchVirtualY = virtualBottomY - virtualCatchOffset;

      // Ривок риби біля підсаки
      if (
        updatedFloatPos.y >= triggerVirtualY &&
        updatedFloatPos.y < autoCatchVirtualY
      ) {
        if (typeof this.#fishingSystem.tryTriggerFishLastDash === "function") {
          this.#fishingSystem.tryTriggerFishLastDash(dt);
        }
      }

      // Гарантований вилов, якщо риба дотягнута прямо до ніг (за межу підсаки)
      if (updatedFloatPos.y >= autoCatchVirtualY) {
        this.#gameState = "victory";

        if (CONFIG.debug?.overlay) {
          document.dispatchEvent(
            new CustomEvent("debug-live-update", {
              detail: { gameState: "victory" },
            }),
          );
        }
        return;
      }
    }

    if (
      this.#gameState === "playing" &&
      this.#fishingSystem &&
      typeof this.#fishingSystem.getHoldUIState === "function"
    ) {
      this.#holdUI.update(this.#fishingSystem.getHoldUIState());
    } else if (this.#holdUI) {
      this.#holdUI.update(null);
    }

    if (
      CONFIG.debug?.overlay &&
      (this.#gameState === "waiting" ||
        this.#gameState === "biting" ||
        this.#gameState === "playing")
    ) {
      const rawFloatDepth = this.#float.getCurrentHookDepth();

      envData.lineLength = rawFloatDepth;
      envData.hookDepth = Math.min(rawFloatDepth, envData.bottomDepth);

      const liveChances = this.#biteSystem.getLiveChances(envData, playerGear);

      const debugData = {
        gameState: this.#gameState,
        chumZones: this.#chumManager ? this.#chumManager.getZones() : [],
        floatX: Math.round(floatPos.x),
        floatY: Math.round(floatPos.y),
        hookDepth: envData.hookDepth,
        bottomDepth: envData.bottomDepth,
        lineLength: envData.lineLength,
        bait: playerGear.baitId,
        phase: envData.timePhase,
        liveChances: liveChances,
        isRaining: this.#isRaining,
        isFoggy: this.#isFoggy,

        playerForceY: Math.abs(finalPlayerForce.y),
        playerForceX: Math.abs(finalPlayerForce.x),
        fishForceY: Math.abs(finalFishForce.y),
        fishForceX: Math.abs(finalFishForce.x),

        fishState:
          this.#fishingSystem && this.#fishingSystem.getCurrentState
            ? this.#fishingSystem.getCurrentState()
            : "N/A",
        fishBasePower:
          this.#fishingSystem && this.#fishingSystem.getFishBasePower
            ? this.#fishingSystem.getFishBasePower()
            : 0,
        fishInitialPower:
          this.#fishingSystem && this.#fishingSystem.getFishInitialPower
            ? this.#fishingSystem.getFishInitialPower()
            : 0,
        pullMult:
          this.#fishingSystem && this.#fishingSystem.getPullMultiplier
            ? this.#fishingSystem.getPullMultiplier()
            : 1,
        moveMult:
          this.#fishingSystem && this.#fishingSystem.getMoveMultiplier
            ? this.#fishingSystem.getMoveMultiplier()
            : 1,
        hookedFish: this.#currentBitingFish,
        activeDebuffName:
          this.#fishingSystem && this.#fishingSystem.getActiveDebuffName
            ? this.#fishingSystem.getActiveDebuffName()
            : "Немає",
        masteryCurrentMult:
          this.#fishingSystem && this.#fishingSystem.getMasteryMultiplier
            ? this.#fishingSystem.getMasteryMultiplier()
            : 1.0,
        masteryTimerMs:
          this.#staminaController && this.#staminaController.getMasteryTimer
            ? this.#staminaController.getMasteryTimer()
            : 0,
        isMasteryActive:
          this.#staminaController && this.#staminaController.isMasteryActive
            ? this.#staminaController.isMasteryActive()
            : false,
        exhaustionDurationMs:
          this.#staminaController &&
          this.#staminaController.getExhaustionDurationMs
            ? this.#staminaController.getExhaustionDurationMs()
            : 1000,
      };

      document.dispatchEvent(
        new CustomEvent("debug-live-update", { detail: debugData }),
      );
    }
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

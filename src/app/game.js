class EnvironmentSystem {
  #config;
  #gameTimeHours;
  #lastHour = -1;
  #currentPhase = "day";
  #isRaining = false;
  #isFoggy = false;
  #weatherTimer = 0;
  #windState = { direction: 0, rainMult: 1.0, timer: 0 };

  constructor(config, initialTime = 12) {
    this.#config = config;
    this.#gameTimeHours = initialTime;
  }

  update(dt, timeScale) {
    this.#gameTimeHours =
      (this.#gameTimeHours + (dt / 3600000) * timeScale) % 24;
    const hour = Math.floor(this.#gameTimeHours);

    if (hour !== this.#lastHour) {
      this.#lastHour = hour;
      this.#updatePhase(hour);
    }
    this.#updateWeather(dt);
  }

  #updatePhase(hour) {
    const phases = CONFIG.spawns.timePhases;
    for (const [phase, times] of Object.entries(phases)) {
      const inRange =
        times.startHour < times.endHour
          ? hour >= times.startHour && hour < times.endHour
          : hour >= times.startHour || hour < times.endHour;
      if (inRange) this.#currentPhase = phase;
    }
  }

  #updateWeather(dt) {
    const { weather, environment } = this.#config;
    this.#weatherTimer -= dt;
    if (this.#weatherTimer <= 0) {
      this.#isRaining = Math.random() < weather.chances.rain;
      this.#isFoggy = Math.random() < weather.chances.fog;
      this.#weatherTimer = weather.updateIntervalMs;

      // --- ВІДНОВЛЕНО: Перевірка наявності rainMultiplier ---
      const rainMultConfig = environment.wind?.rainMultiplier;
      this.#windState.rainMult =
        this.#isRaining && rainMultConfig
          ? rainMultConfig[0] +
            Math.random() * (rainMultConfig[1] - rainMultConfig[0])
          : 1.0;
    }

    this.#windState.timer -= dt;
    if (this.#windState.timer <= 0) {
      const { changesPerDay } = environment.wind;
      this.#windState.timer =
        86400000 /
        (changesPerDay[0] +
          Math.random() * (changesPerDay[1] - changesPerDay[0]));
      this.#windState.direction = [-1, 0, 1][Math.floor(Math.random() * 3)];
    }
  }

  getSnapshot() {
    return {
      time: this.#gameTimeHours,
      phase: this.#currentPhase,
      isRaining: this.#isRaining,
      isFoggy: this.#isFoggy,
      wind: { ...this.#windState },
    };
  }

  getPhysicsEnv() {
    const base = this.#config.environment;
    const env = { current: base.current, wind: null };
    if (base.wind && this.#windState.direction !== 0) {
      const m = this.#windState.rainMult;
      env.wind = {
        direction: this.#windState.direction,
        breezeAngleRange: base.wind.breezeAngleRange.map((v) => v * m),
        gustAngleRange: base.wind.gustAngleRange.map((v) => v * m),
        gustFluctuationMs: base.wind.gustFluctuationMs,
        gustChancePerSec: base.wind.gustChancePerSec * m,
        gustDurationMs: base.wind.gustDurationMs,
      };
    }
    return env;
  }
}

class GameState {
  constructor(game, data = {}) {
    this.game = game;
    this.data = data;
  }
  enter() {}
  exit() {}
  handleInput() {}
  update() {}
  draw() {}
}

class ScoutingState extends GameState {
  enter() {
    const eq = this.game.systems.inventory.getEquipped();
    const hasNet = !!eq.net;
    this.game.systems.ui.updateNetButtonState(hasNet, false);
  }

  exit() {
    this.game.depthUI.hide();
  }

  handleInput(input) {
    const isBoatMoving = this.game.systems.chum.isBoatMoving();

    if (!isBoatMoving && (input.panDeltaX || input.panDeltaY)) {
      const scale = this.game.systems.projector.getScale();
      this.game.systems.projector.pan(
        input.panDeltaX / scale,
        input.panDeltaY / scale,
      );
    }

    if (input.clickPos) {
      // --- ДОДАЙ ЦІ 3 РЯДКИ ДЛЯ ДЕБАГУ ---
      console.log("=== КЛІК ЗЛОВЛЕНО В SCOUTING STATE ===");
      console.log("isAimingChum дорівнює:", this.game.isAimingChum);
      console.log("Координати кліку:", input.clickPos);
      // ----------------------------------

      const vPos = this.game.systems.projector.screenToVirtual(
        input.clickPos.x,
        input.clickPos.y,
      );
      const cell = this.game.checkWater(vPos.x, vPos.y);
      const bounds = this.game.getDynamicBounds();

      // === 1. ЛОГІКА ДЛЯ РУЧНОГО ЗАКИДАННЯ ПРИКОРМКИ ===
      if (this.game.isAimingChum) {
        const locId = "test"; // Замініть на змінну поточної локації, якщо вона у вас динамічна
        const chumDist = CONFIG.locations.map[locId].chumCastDistance || 300;

        // Вираховуємо лінію горизонту для прикормки (все що вище - недоступно)
        const virtualLineY = bounds.bottom - chumDist;

        // Перевіряємо: чи клік у воді (зелена зона) І чи не далі за дозволену помаранчеву лінію
        if (cell && vPos.y >= virtualLineY) {
          this.game.isAimingChum = false;

          // ВАЖЛИВО: Заміни 'handleChumDeploy' на ту назву методу,
          // яку ти використовуєш у своєму класі Game для кидка прикормки
          if (typeof this.game.handleChumDeploy === "function") {
            this.game.handleChumDeploy(vPos.x, vPos.y);
          } else if (typeof this.game.deployHandChum === "function") {
            this.game.deployHandChum(vPos.x, vPos.y);
          } else {
            console.error("Метод кидка прикормки не знайдено в класі Game!");
          }
        } else {
          // Якщо клікнув занадто далеко або на берег — показуємо хрестик і скидаємо приціл
          this.game.markInvalidCast(input.clickPos);
          this.game.isAimingChum = false;
        }
        return; // Обов'язковий вихід, щоб гравець випадково не закинув вудку
      }

      // === 2. ЛОГІКА ДЛЯ ЗАКИДАННЯ ВУДКИ ===
      const eq = this.game.systems.inventory.getEquipped();
      let rawDist = eq.rod?.maxDistance;
      let maxDist = rawDist === "max" || rawDist == null ? Infinity : rawDist;

      if (maxDist !== Infinity) {
        maxDist = Math.min(maxDist, bounds.bottom - bounds.top);
      }

      let isInside = true;
      if (maxDist !== Infinity) {
        const virtualLineY = bounds.bottom - maxDist;
        isInside = vPos.y >= virtualLineY;
      }

      if (cell && this.game.canPlayerCast()) {
        if (!isInside) {
          this.game.markInvalidCast(input.clickPos);
          return;
        }

        if (this.game.castManager.canCast()) {
          this.game.castManager.registerCast(performance.now());
          this.game.castLine(vPos.x, vPos.y, cell.depth);
        } else {
          this.game.markInvalidCast(input.clickPos);
        }
      } else if (!cell) {
        this.game.markInvalidCast(input.clickPos);
      }
    }
  }

  update(dt, bounds) {
    this.game.systems.projector.focusOnVirtualPos(
      bounds.bottom - 200,
      dt,
      0.03,
    );

    const eq = this.game.systems.inventory.getEquipped();
    const rodType = eq?.rod?.type;
    const bait = eq?.baits?.[0];
    const isFeeder = rodType === "feeder";
    const isSpinning = rodType === "spinning";
    const isJig = bait?.type === "jig";
    const hasSinker = !!eq?.sinker;

    const canSelectDepth =
      !isFeeder && ((isSpinning && isJig) || (!isSpinning && hasSinker));

    if (!this.game.canPlayerCast() || !canSelectDepth) {
      if (this.game.depthUI.isActive) {
        this.game.depthUI.hide();
      }
      this.game.currentHookDepth = CONFIG.physics?.defaultDepthNoSinker ?? 0.1;
      return;
    }

    const maxDepth = this.game.getMaxHookDepth();

    if (!this.game.depthUI.isActive) {
      this.game.depthUI.show(
        maxDepth,
        Math.min(this.game.currentHookDepth, maxDepth),
        (d) => (this.game.currentHookDepth = d),
      );
    } else {
      if (typeof this.game.depthUI.updateMax === "function") {
        this.game.depthUI.updateMax(maxDepth);
      }
    }
  }

  draw(renderer, bounds) {
    if (!this.game.isAimingChum) {
      // Відмальовка дозволеної зони для ВУДКИ
      if (CONFIG.locations?.showAimingZone !== false) {
        const eq = this.game.systems.inventory.getEquipped();
        let rawDist = eq.rod?.maxDistance;
        let maxDist = rawDist === "max" || rawDist == null ? Infinity : rawDist;

        if (maxDist !== Infinity) {
          maxDist = Math.min(maxDist, bounds.bottom - bounds.top);
          renderer.drawAimingZone(
            this.game.systems.projector,
            bounds.bottom,
            maxDist,
            "rod",
          );
        }
      }
    } else {
      // Відмальовка дозволеної зони для ПРИКОРМКИ
      if (CONFIG.locations?.showAimingZone !== false) {
        const locId = "test"; // Замініть на змінну поточної локації, якщо вона у вас динамічна
        const chumDist = CONFIG.locations.map[locId].chumCastDistance || 300;

        renderer.drawAimingZone(
          this.game.systems.projector,
          bounds.bottom,
          chumDist,
          "chum",
        );
      }
    }
  }
}

class PlayingState extends GameState {
  #fishingSystem;
  #tensionMeter;
  #fishCondition;
  #staminaController;
  #isNetReady = false;
  #startTime = 0;
  #forces = { pX: 0, pY: 0, fX: 0, fY: 0 };
  #rod;
  #reel;
  #hasEquippedNet = false;
  #onConfigUpdateBind;

  enter(data) {
    this.#startTime = performance.now();
    this.data = data || {};
    const fishData = this.data.fish;

    const eq = this.game.systems.inventory.getEquipped();
    this.#hasEquippedNet = !!eq.net;

    const usedBait = (eq?.baits || []).find((b) => b && b.type === "bait");
    if (usedBait) {
      this.game.systems.inventory.consumeItem(usedBait.instanceId, 1);
    }

    this.#rod = new Rod(
      eq.rod?.level || 1,
      eq.rod?.basePower || 1.0,
      eq.rod?.compensation || 0,
      eq.rod?.type || "float",
      eq.rod?.maxDistance || 100,
      eq.rod?.hasReel !== false,
    );

    this.#reel = eq.reel
      ? new Reel(
          eq.reel.level || 1,
          eq.reel.basePower || 1.0,
          eq.reel.hold || null,
        )
      : new Reel(0, 0, null);

    // --- ВИПРАВЛЕНО БАГ З ЧИТАННЯМ ГАЧКА ---
    const activeHook = eq.hooks?.[0] || {};
    const hookLevel = activeHook.level || 1;
    const hookWeight = activeHook.weight || 1;
    const hookQuality = activeHook.quality || 1.0;
    const hook = new Hook(hookLevel, hookWeight, hookQuality);

    const fish = new Fish(
      fishData.level,
      fishData.weight,
      fishData.resistance,
      fishData.physics,
    );

    this.#fishingSystem = new FishingSystem(this.#rod, this.#reel, fish);

    this.#tensionMeter = new TensionMeter(
      eq.rod?.level || 1,
      eq.reel?.level || 0,
      hook,
      CONFIG.tension,
    );

    this.#fishCondition = new FishCondition(
      fishData.level,
      fishData.weight,
      CONFIG.stamina.fish,
    );

    this.#staminaController = new StaminaController(
      this.#fishCondition,
      fish,
      this.#rod.getPower() + this.#reel.getPower(),
      CONFIG.stamina.mechanics,
    );

    console.log(
      `%c🎣 КЛЮНУВ: ${fishData.name}!`,
      "color: #00ff00; font-size: 16px; font-weight: bold;",
    );
    console.table({
      "Тип Вудки": this.#rod.getType(),
      "Наявність Котушки": this.#rod.hasReel() ? "Є" : "Немає (Махова)",
      "Згенерована Вага": fishData.weight.toFixed(3) + " кг",
      "Рівень (Складність)": fishData.level,
      "Базовий Опір": fishData.resistance.toFixed(2),
    });

    document.dispatchEvent(
      new CustomEvent("debug-fish-hooked", {
        detail: { fish: fishData, eq: eq },
      }),
    );

    // --- ДОДАНО: Слухаємо DevTools під час виважування ---
    this.#onConfigUpdateBind = () => this.#syncEquipment();
    document.addEventListener("config-updated", this.#onConfigUpdateBind);
  }

  #syncEquipment() {
    const eq = this.game.systems.inventory.getEquipped();

    this.#rod = new Rod(
      eq.rod?.level || 1,
      eq.rod?.basePower || 1.0,
      eq.rod?.compensation || 0,
      eq.rod?.type || "float",
      eq.rod?.maxDistance || 100,
      eq.rod?.hasReel !== false,
    );

    this.#reel = eq.reel
      ? new Reel(
          eq.reel.level || 1,
          eq.reel.basePower || 1.0,
          eq.reel.hold || null,
        )
      : new Reel(0, 0, null);

    const activeHook = eq.hooks?.[0] || {};
    const hookLevel = activeHook.level || 1;
    const hookWeight = activeHook.weight || 1;
    const hookQuality = activeHook.quality || 1.0;
    const hook = new Hook(hookLevel, hookWeight, hookQuality);

    this.#fishingSystem.updateEquipment(this.#rod, this.#reel);
    this.#tensionMeter.updateEquipment(
      eq.rod?.level || 1,
      eq.reel?.level || 0,
      hook,
      CONFIG.tension,
    );
    this.#staminaController.updatePlayerPower(
      this.#rod.getPower() + this.#reel.getPower(),
    );

    if (window.DEBUG_MODULES && window.DEBUG_MODULES.forces) {
      console.log(
        "%c🔄 [DevTools] Характеристики снастей оновлено в реальному часі!",
        "color: #00ccff; font-weight: bold;",
      );
    }
  }

  update(dt, bounds, envData) {
    if (this.#tensionMeter.isBroken()) {
      this.game.setState("failed", {
        reason: this.#tensionMeter.getBreakReason(),
      });
      return;
    }

    const floatPos = this.game.float.getPosition();
    this.game.systems.projector.focusOnVirtualPos(floatPos.y, dt, 0.05);

    const fishForceRaw = this.#fishingSystem.calculateFishForce(
      dt,
      floatPos,
      bounds,
      CONFIG.stamina.mechanics,
      (vx, vy) => this.game.checkWater(vx, vy),
    );
    let tFishY = fishForceRaw.y;
    const activeHold = this.#fishingSystem.isHoldActive();

    if (activeHold && tFishY < 0) {
      tFishY = 0;
      fishForceRaw.y *= this.#fishingSystem.getHoldTensionMultiplier?.() || 1.0;
    }

    this.game.float.applyForce(
      new Vector2(fishForceRaw.x, tFishY).multiplyScalar(
        CONFIG.physics.fishForceMultiplier,
      ),
    );

    const input = this.game.systems.input.getState();
    const rodPos = this.game.getRodVirtualPos(bounds);
    const screenOffset = this.game.getScreenOffsetRatio(floatPos);

    let pF = new Vector2(0, 0);
    if (input.isPulling) {
      pF = this.#fishingSystem.calculatePlayerForce(
        input.pullDirection,
        floatPos.x,
        floatPos.y,
        rodPos,
        screenOffset,
        CONFIG.physics,
        bounds,
      );
      this.game.float.applyForce(
        pF.clone().multiplyScalar(CONFIG.physics.playerForceMultiplier),
      );
    }

    this.#forces = {
      pX: pF.x,
      pY: pF.y,
      fX: fishForceRaw.x,
      fY: fishForceRaw.y,
    };

    const pMax = Math.abs(
      this.#fishingSystem.calculatePlayerForce(
        { x: 0, y: 1 },
        floatPos.x,
        floatPos.y,
        rodPos,
        screenOffset,
        CONFIG.physics,
        bounds,
      ).y * CONFIG.physics.playerForceMultiplier,
    );

    const fMag =
      Math.max(Math.abs(fishForceRaw.x), Math.abs(fishForceRaw.y)) *
      CONFIG.physics.fishForceMultiplier;

    this.#tensionMeter.update(
      input.isPulling,
      pMax,
      fMag,
      this.#fishingSystem.getReelPower(),
      fMag * 0.01,
      dt,
      CONFIG.tension,
      CONFIG.hookMechanics,
      activeHold,
    );

    this.#staminaController.evaluate(
      this.#tensionMeter.getTension(),
      input.isPulling,
      dt,
      floatPos.x,
      bounds,
    );

    let pullDirection = null;
    if (input.isPulling) {
      pullDirection = new Vector2(
        rodPos.x - floatPos.x,
        rodPos.y - floatPos.y,
      ).normalize();
    }

    this.game.float.update(
      bounds,
      dt,
      envData.env,
      (vx, vy) => this.game.checkWater(vx, vy),
      input,
      this.#fishingSystem.getReelPower(),
      pullDirection,
    );

    this.#isNetReady = this.game.net.isFloatInZone(floatPos.y, bounds.bottom);
    this.game.systems.ui.updateNetButtonState(
      this.#hasEquippedNet,
      this.#isNetReady,
    );

    const autoY =
      bounds.bottom -
      (CONFIG.locations.catchLineOffsetPx || 5) /
        this.game.systems.projector.getScale();

    if (
      floatPos.y >= this.game.net.getTriggerVirtualY(bounds.bottom) &&
      floatPos.y < autoY
    ) {
      this.#fishingSystem.tryTriggerFishLastDash?.(dt);
    }

    if (floatPos.y >= autoY) {
      this.game.setState("victory", { fish: this.data.fish });
    }
    this.game.holdUI.update(this.#fishingSystem.getHoldUIState());
  }

  handleNetClick() {
    if (!this.#isNetReady) return;

    const fishWeight = this.#fishingSystem.getFishWeight();
    const chance = this.game.net.calculateCatchChance(fishWeight);
    const roll = Math.random() * 100;
    const success = roll <= chance;

    document.dispatchEvent(
      new CustomEvent("netCatchRoll", {
        detail: { chance: chance, roll: roll, success: success },
      }),
    );

    this.game.setState(success ? "victory" : "failed", {
      reason: success ? null : "net_escape",
      fish: this.data.fish,
    });
  }

  handleInput(input) {
    const isHold = this.#fishingSystem.isHoldActive();
    const eq = this.game.systems.inventory.getEquipped();
    // 4. ВИПРАВЛЕНО: Безпечне читання параметрів котушки
    const swipeThreshold = eq.reel?.hold?.swipeThresholdPx || 100;

    if (this.#fishingSystem.getHoldUIState()?.hasHold) {
      if (input.toggleHold || input.swipeDeltaY > swipeThreshold) {
        isHold
          ? this.#fishingSystem.deactivateHold()
          : this.#fishingSystem.activateHold();
        if (input.swipeDeltaY) this.game.systems.input.consumeSwipe();
      }
    }

    if (input.pumpAction || input.swipeDeltaY < -swipeThreshold) {
      const red = this.#fishingSystem.tryUsePump(
        eq.reel?.pumpLevel || 0,
        eq.reel?.pumpPowerPerLevel || 10,
      );
      if (red > 0) this.#tensionMeter.applyPump(red);
      if (input.swipeDeltaY) this.game.systems.input.consumeSwipe();
    }
  }

  draw(renderer, bounds) {
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "playing",
      this.#tensionMeter,
      this.#fishCondition,
      this.#startTime,
    );
  }

  getDebugData() {
    const fs = this.#fishingSystem;
    const sc = this.#staminaController;
    const floatPos = this.game.float.getPosition();
    const bounds = this.game.getDynamicBounds();
    const rodPos = this.game.getRodVirtualPos(bounds);
    const screenOffset = this.game.getScreenOffsetRatio(floatPos);

    const maxP = this.#fishingSystem.calculatePlayerForce(
      { x: 0, y: 1 },
      floatPos.x,
      floatPos.y,
      rodPos,
      screenOffset,
      CONFIG.physics,
      bounds,
    );

    const xRange = CONFIG.physics?.distanceXMultiplier || [1.0, 1.0];
    const distRatio = Math.max(
      0,
      Math.min(1.0, (floatPos.y - bounds.top) / (bounds.bottom - bounds.top)),
    );
    const depthScaleX = xRange[0] + distRatio * (xRange[1] - xRange[0]);

    const steerP =
      (this.#rod.getPower() + this.#reel.getPower()) *
      CONFIG.physics.playerSteeringMultiplier *
      CONFIG.physics.playerForceMultiplier *
      depthScaleX;

    return {
      playerForceY: Math.abs(this.#forces.pY || 0),
      playerForceX: Math.abs(this.#forces.pX || 0),
      fishForceY: Math.abs(this.#forces.fY || 0),
      fishForceX: Math.abs(this.#forces.fX || 0),

      playerMaxPowerY: Math.abs(maxP.y * CONFIG.physics.playerForceMultiplier),
      playerMaxPowerX: steerP,

      fishState: fs?.getCurrentState?.() || "idle",
      fishBasePower: fs?.getFishBasePower?.() || 0,
      fishInitialPower: fs?.getFishInitialPower?.() || 0,
      pullMult: fs?.getPullMultiplier?.() || 0,
      moveMult: fs?.getMoveMultiplier?.() || 0,
      activeDebuffName: fs?.getActiveDebuffName?.() || "Немає",

      masteryCurrentMult: fs?.getMasteryMultiplier?.() || 1.0,
      masteryTimerMs: sc?.getMasteryTimer?.() || 0,
      isMasteryActive: sc?.isMasteryActive?.() || false,
      exhaustionDurationMs: sc?.getExhaustionDurationMs?.() || 1000,

      hookedFish: this.data.fish,
      eq: this.game.systems.inventory.getEquipped(), // <-- ДОДАНО
    };
  }

  exit() {
    this.game.holdUI.update(null);
    this.game.systems.ui.hideNetButton();
    if (this.#onConfigUpdateBind) {
      document.removeEventListener("config-updated", this.#onConfigUpdateBind);
    }
  }
}

class WaitingState extends GameState {
  enter() {
    this.game.systems.bite.reset();
  }

  handleInput(input) {
    if (input.isDoubleClick && this.game.canPlayerCast()) {
      this.game.setState("scouting");
    }

    const eq = this.game.systems.inventory.getEquipped();
    const isSpinning = eq?.rod?.type === "spinning";

    if (!isSpinning && input.longPressPos && this.game.canPlayerCast()) {
      const vPos = this.game.systems.projector.screenToVirtual(
        input.longPressPos.x,
        input.longPressPos.y,
      );
      const cell = this.game.checkWater(vPos.x, vPos.y);

      if (cell) {
        this.game.castManager.registerCast(performance.now());
        this.game.castLine(vPos.x, vPos.y, cell.depth);

        if (eq?.rod?.type === "feeder" && eq?.feederChum) {
          this.game.systems.inventory.consumeItem(eq.feederChum.instanceId, 1);
        }
      } else {
        this.game.invalidCastMarker = {
          x: input.longPressPos.x,
          y: input.longPressPos.y,
          timer: 500,
        };
      }
    }
  }

  update(dt, bounds, envData) {
    const pos = this.game.float.getPosition();
    this.game.systems.projector.focusOnVirtualPos(pos.y, dt, 0.05);

    const input = this.game.systems.input.getState();
    const eq = this.game.systems.inventory.getEquipped();

    const reelPower = eq?.reel ? eq.reel.basePower || 0 : 0;
    const isSpinning = eq?.rod?.type === "spinning";

    const effectiveInput = {
      ...input,
      isPulling: isSpinning ? input.isPulling : false,
    };

    let pullDirection = null;
    if (effectiveInput.isPulling) {
      const rodPos = this.game.getRodVirtualPos(bounds);
      pullDirection = new Vector2(
        rodPos.x - pos.x,
        rodPos.y - pos.y,
      ).normalize();
    }

    this.game.float.update(
      bounds,
      dt,
      envData.env,
      (vx, vy) => this.game.checkWater(vx, vy),
      effectiveInput,
      reelPower,
      pullDirection,
    );

    const updatedPos = this.game.float.getPosition();
    const shoreY =
      bounds.bottom -
      (CONFIG.locations.catchLineOffsetPx || 5) /
        this.game.systems.projector.getScale();

    if (updatedPos.y >= shoreY) {
      this.game.setState("scouting");
      return;
    }

    const activeBaits = (eq?.baits || []).filter(
      (b) =>
        b &&
        !(this.game.eatenBaits || []).some(
          (eb) => eb.instanceId === b.instanceId,
        ),
    );

    const baitIds = activeBaits.map((b) => b.id);
    const baitTypes = activeBaits.map((b) => b.type);

    let hooked = this.game.systems.bite.evaluateBite(dt, envData.biteEnv, {
      hookSize: eq?.hooks?.[0]?.level || eq?.baits?.[0]?.level || 1,
      baits: baitIds,
      baitTypes: baitTypes,
      isPulling: effectiveInput.isPulling,
    });

    if (hooked && CONFIG.debug?.fixedCatch?.enabled) {
      const fixed = CONFIG.debug.fixedCatch;
      const template =
        CONFIG.spawns.fishes.find((f) => f.id === fixed.fishId) ||
        CONFIG.spawns.fishes[0];

      const isActiveLure = baitTypes.some((type) =>
        ["spinner", "wobbler", "jig"].includes(type),
      );

      const chosenSequence = template.biteMechanics
        ? isActiveLure
          ? template.biteMechanics.active
          : template.biteMechanics.passive
        : null;

      hooked = {
        id: template.id,
        name: template.name + " (TEST)",
        physics: template.physics,
        level: fixed.level,
        weight: fixed.weight,
        resistance: fixed.resistance,
        biteSequence: chosenSequence,
      };
    }

    if (hooked) {
      const usedBait = (eq?.baits || []).find(
        (b) => b !== null && b !== undefined,
      );

      this.game.float.startBite(effectiveInput.isPulling, hooked.biteSequence);
      this.game.setState("biting", { fish: hooked });
    }
  }

  draw(renderer, bounds) {
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "waiting",
      null,
      null,
      this.game.castStartTime,
    );
  }
}

class BitingState extends GameState {
  #feederAudioTemplate;
  #lastStepId = -1;
  #ringQueue = [];
  #stepTimeElapsed = 0;

  enter(data) {
    if (super.enter) super.enter();

    this.fish = data.fish;

    this.#lastStepId = -1;
    this.#ringQueue = [];
    this.#stepTimeElapsed = 0;

    const eq = this.game.systems.inventory.getEquipped();
    if (eq?.rod?.type === "feeder" && CONFIG.ui?.audio?.feederBite) {
      this.#feederAudioTemplate = new Audio(CONFIG.ui.audio.feederBite);
    } else {
      this.#feederAudioTemplate = null;
    }
  }

  exit() {
    this.#ringQueue = [];
  }

  handleInput(input) {
    const eq = this.game.systems.inventory.getEquipped();
    const isSpinning = eq?.rod?.type === "spinning";

    if (input.isPulling && !isSpinning) {
      if (!this.game.canPlayerCast()) return;

      const isGuaranteed = this.game.float.isGuaranteedBite();
      const success = Math.random() <= (isGuaranteed ? 0.99 : 0.01);

      if (success) {
        this.game.float.hook();
        if (
          this.game.systems.bite &&
          typeof this.game.systems.bite.hookFish === "function"
        ) {
          this.game.systems.bite.hookFish();
        }
        this.game.setState("playing", { fish: this.fish });
      } else {
        this.game.float.stopBite();
        this.game.setState("scouting");
      }
    }
  }

  update(dt, bounds, envData) {
    this.game.float.updateBite(dt, (vx, vy) => this.game.checkWater(vx, vy));

    const input = this.game.systems.input.getState();
    const pos = this.game.float.getPosition();
    this.game.systems.projector.focusOnVirtualPos(pos.y, dt, 0.05);

    const eq = this.game.systems.inventory.getEquipped();
    const isSpinning = eq?.rod?.type === "spinning";

    const reelPower = eq?.reel ? eq.reel.basePower || 0 : 0;

    let pullDirection = null;
    if (input.isPulling) {
      const rodPos = this.game.getRodVirtualPos(bounds);
      pullDirection = new Vector2(
        rodPos.x - pos.x,
        rodPos.y - pos.y,
      ).normalize();
    }

    this.game.float.update(
      bounds,
      dt,
      envData.env,
      (vx, vy) => this.game.checkWater(vx, vy),
      input,
      reelPower,
      pullDirection,
    );

    const stepInfo = this.game.float.getBiteStepInfo?.();
    if (isSpinning && stepInfo && stepInfo.isGuaranteed && input.isPulling) {
      this.game.float.hook();
      if (
        this.game.systems.bite &&
        typeof this.game.systems.bite.hookFish === "function"
      ) {
        this.game.systems.bite.hookFish();
      }
      this.game.setState("playing", { fish: this.fish });
      return;
    }

    // --- ЗМІНЕНО: Якщо риба втратила інтерес (не встигли підсікти) ---
    if (!this.game.float.isBiting()) {
      this.game.setState("waiting");
      return;
    }

    const updatedPos = this.game.float.getPosition();
    const shoreY =
      bounds.bottom -
      (CONFIG.locations.catchLineOffsetPx || 5) /
        this.game.systems.projector.getScale();
    if (updatedPos.y >= shoreY) {
      this.game.float.stopBite();
      this.game.setState("scouting");
      return;
    }

    // --- ЗМІНЕНО: Механіка ТАЄМНОЇ втрати наживки ---
    if (stepInfo) {
      if (stepInfo.id !== this.#lastStepId) {
        this.#lastStepId = stepInfo.id;

        if (stepInfo.isAction) {
          // Шукаємо, в якому саме слоті лежить наживка, яку зараз їдять
          let consumedSlot = null;
          let consumedBaitId = null;
          if (eq.baits) {
            for (let i = 0; i < eq.baits.length; i++) {
              if (eq.baits[i] && eq.baits[i].type === "bait") {
                consumedSlot = `baits_${i}`;
                consumedBaitId = eq.baits[i].instanceId;
                break;
              }
            }
          }

          if (consumedBaitId) {
            const lossChance = stepInfo.isGuaranteed
              ? (CONFIG.physics.baitLossChance?.guaranteed ?? 0.5)
              : (CONFIG.physics.baitLossChance?.normal ?? 0.15);

            if (Math.random() <= lossChance) {
              // 1. ЗНІМАЄМО з гачка (щоб гравець не знав, поки не витягне, а шанс кльову став 0%)
              this.game.systems.inventory.unequipItem(consumedSlot);
              // 2. Видаляємо 1 штуку з рюкзака фізично
              this.game.systems.inventory.consumeItem(consumedBaitId, 1);

              // 3. Тихо повертаємо у стан очікування (поплавок просто завмирає)
              this.game.float.stopBite();
              this.game.setState("waiting");
              return;
            }
          }

          if (this.#feederAudioTemplate) {
            this.#scheduleRings(stepInfo);
          }
        }
      }

      if (this.#feederAudioTemplate) {
        this.#processRingQueue(dt);
      }
    }
  }

  #scheduleRings(stepInfo) {
    this.#ringQueue = [];
    this.#stepTimeElapsed = 0;

    const cfg = CONFIG.feederConfig || {
      volumeNormal: 0.4,
      volumeGuaranteed: 1.0,
      guaranteedRings: [2, 3],
    };

    if (!stepInfo.isGuaranteed) {
      this.#ringQueue.push({
        startAt: 0,
        volume: cfg.volumeNormal,
      });
    } else {
      const minRings = cfg.guaranteedRings[0];
      const maxRings = cfg.guaranteedRings[1];
      const ringCount = Math.floor(
        minRings + Math.random() * (maxRings - minRings + 1),
      );

      const interval = stepInfo.duration / ringCount;

      for (let i = 0; i < ringCount; i++) {
        this.#ringQueue.push({
          startAt: i * interval,
          volume: cfg.volumeGuaranteed,
        });
      }
    }
  }

  #processRingQueue(dt) {
    if (this.#ringQueue.length === 0) return;

    this.#stepTimeElapsed += dt;

    while (
      this.#ringQueue.length > 0 &&
      this.#stepTimeElapsed >= this.#ringQueue[0].startAt
    ) {
      const currentRing = this.#ringQueue.shift();
      this.#playSound(currentRing.volume);
    }
  }

  #playSound(volume) {
    const soundClone = this.#feederAudioTemplate.cloneNode();
    soundClone.volume = volume;
    soundClone.play().catch(() => {});
  }

  draw(renderer, bounds) {
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "biting",
      null,
      null,
      this.game.castStartTime,
    );
  }
}

class FailedState extends GameState {
  enter(data) {
    if (super.enter) super.enter();
    this.game.systems.ui.updateContinueButtonState(true);

    const eq = this.game.systems.inventory.getEquipped();
    const reason = data?.reason;

    // 1. Втрата наживки: відбувається ЗАВЖДИ (риба з'їла/збила), незалежно від причини сходу
    if (
      reason === "rod" ||
      reason === "line" ||
      reason === "hook" ||
      reason === "net_escape"
    ) {
      if (eq.baits) {
        eq.baits.forEach((b, index) => {
          if (b) {
            this.game.systems.inventory.consumeItem(b.instanceId, 1);
            this.game.systems.inventory.unequipItem(`baits_${index}`);
          }
        });
      }
    }

    // 2. Втрата оснастки (гачки, поплавок, грузило, прикормка): ТІЛЬКИ при обриві ліски або поломці вудки
    if (reason === "rod" || reason === "line") {
      if (eq.hooks) {
        eq.hooks.forEach((h, index) => {
          if (h) {
            this.game.systems.inventory.consumeItem(h.instanceId, 1);
            this.game.systems.inventory.unequipItem(`hooks_${index}`);
          }
        });
      }

      if (eq.float) {
        this.game.systems.inventory.consumeItem(eq.float.instanceId, 1);
        this.game.systems.inventory.unequipItem("float");
      }
      if (eq.sinker) {
        this.game.systems.inventory.consumeItem(eq.sinker.instanceId, 1);
        this.game.systems.inventory.unequipItem("sinker");
      }
      if (eq.feederChum) {
        this.game.systems.inventory.consumeItem(eq.feederChum.instanceId, 1);
        this.game.systems.inventory.unequipItem("feederChum");
      }
    }

    // 3. Втрата самої вудки: ТІЛЬКИ якщо вона не витримала
    if (reason === "rod") {
      if (eq.rod) {
        this.game.systems.inventory.consumeItem(eq.rod.instanceId, 1);
        // Каскадне зняття автоматично поверне котушку в рюкзак
        this.game.systems.inventory.unequipItem("rod");
      }
    }
  }

  exit() {
    this.game.systems.ui.updateContinueButtonState(false);
  }

  draw(renderer, bounds) {
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "failed",
      null,
      null,
      0,
    );

    renderer.drawGameOver(
      window.innerWidth,
      window.innerHeight,
      this.data.reason,
    );
  }
}

class VictoryState extends GameState {
  enter(data) {
    this.data = data || {};
    this.game.systems.ui.updateContinueButtonState(true);
  }

  exit() {
    this.game.systems.ui.updateContinueButtonState(false);
  }

  draw(renderer, bounds) {
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "victory",
      null,
      null,
      0,
    );

    renderer.drawVictory(window.innerWidth, window.innerHeight);
  }
}

class Game {
  #systems = {};
  #state = null;
  #gameStateName = "scouting";
  #canvas;
  #float;
  #net;
  #castManager;
  #depthUI;
  #timeUI;
  #holdUI;
  #chumUI;
  #hasEquippedNet = false;
  eatenBaits = [];

  invalidCastMarker = null;
  isAimingChum = false;
  activeBoat = null;
  castStartTime = 0;
  castDistanceRatio = 0;
  currentHookDepth = 1.0;
  lastTime = 0;

  constructor(canvasId) {
    this.#canvas = document.getElementById(canvasId);
    this.#canvas.width = window.innerWidth;
    this.#canvas.height = window.innerHeight;

    const locId = "test";
    const locCfg = CONFIG.locations.map[locId];

    const projectorInstance = new ViewportProjector(CONFIG.locations, locId);

    const inventoryManager = new InventoryManager(ITEM_DB, CONFIG.player);
    const eq = inventoryManager.getEquipped();

    // --- ДОДАНО: Формуємо міст між новим інвентарем та старою системою прикормки ---
    const chumConfigObj = {
      baits: {},
      deliveryMethods: {},
    };

    // Розгортаємо прикормки (витягуємо дані з engineStats у корінь об'єкта)
    if (typeof ITEM_DB !== "undefined" && ITEM_DB.chums) {
      for (const [key, item] of Object.entries(ITEM_DB.chums)) {
        chumConfigObj.baits[key] = { ...item, ...(item.engineStats || {}) };
      }
    }

    // Додаємо фоллбек для кораблика (щоб метод getBoatEnergy не крашився)
    if (typeof ITEM_DB !== "undefined" && ITEM_DB.deliveryMethods) {
      const firstBoatKey = Object.keys(ITEM_DB.deliveryMethods)[0];
      if (firstBoatKey) {
        const b = ITEM_DB.deliveryMethods[firstBoatKey];
        chumConfigObj.deliveryMethods.boat = { ...b, ...(b.engineStats || {}) };
      }
    }

    this.#systems = {
      renderer: new Renderer(this.#canvas),
      projector: projectorInstance,
      map: new LocationMap(locId, CONFIG.locations),
      env: new EnvironmentSystem(locCfg, CONFIG.debug?.initialTime ?? 12),
      input: new InputManager(this.#canvas, Number(CONFIG.ui?.rod?.x) || null),
      ui: new UIManager(CONFIG),

      // ВИПРАВЛЕНО: Передаємо наш новий зібраний об'єкт замість порожнього CONFIG.chum
      chum: new ChumManager(locId, chumConfigObj, projectorInstance),

      bite: new BiteSystem(CONFIG.spawns, {}),
      inventory: inventoryManager,
    };

    this.#systems.inventoryUI = new InventoryUI(this.#systems.inventory);

    this.#net = new Net(eq.net || { active: false, maxWeight: 0, length: 10 });

    document.addEventListener("inventory-changed", (e) => {
      const newEq = e.detail.equipment;

      const netConfig = newEq.net
        ? { ...newEq.net, ...(newEq.net.engineStats || {}) }
        : { active: false, maxWeight: 0, length: 10, chances: [] };

      if (this.#net && typeof this.#net.updateConfig === "function") {
        this.#net.updateConfig(netConfig);
      } else {
        this.#net = new Net(netConfig);
      }

      this.#hasEquippedNet = !!newEq.net;

      if (
        this.systems &&
        this.systems.ui &&
        typeof this.systems.ui.updateNetButtonState === "function"
      ) {
        this.systems.ui.updateNetButtonState(this.#hasEquippedNet, false);
      }

      if (this.#depthUI && typeof this.#depthUI.updateMax === "function") {
        this.#depthUI.updateMax(this.getMaxHookDepth());
      }
    });

    this.#chumUI = new ChumUI(() => this.handleChumClick());
    this.#castManager = new CastManager();
    this.#depthUI = new DepthSelectorUI();
    this.#timeUI = new TimeDisplayUI();
    this.#holdUI = new HoldChargesUI();

    this.#rebuildFloat();

    this.#initEvents();
    this.setState("scouting");
    this.start();
  }

  #rebuildFloat() {
    const eq = this.#systems.inventory.getEquipped();

    let physicsType = "float";
    let physicsConfig = {};

    if (
      eq.baits?.[0] &&
      ["spinner", "wobbler", "jig"].includes(eq.baits[0].type)
    ) {
      physicsType = eq.baits[0].type;
      physicsConfig = { ...eq.baits[0] };
    } else if (eq.float) {
      physicsType = "float";
      physicsConfig = { ...eq.float };
    } else if (eq.sinker) {
      physicsType = "float";
      physicsConfig = { ...eq.sinker };
    }

    this.#float = BaitFactory.create(physicsType, 0, 0, physicsConfig, eq);
  }

  #initEvents() {
    window.addEventListener("resize", () => {
      this.#canvas.width = window.innerWidth;
      this.#canvas.height = window.innerHeight;
      this.#systems.projector.update(this.#canvas.width, this.#canvas.height);
      this.#systems.map.recalculateZones(
        this.#systems.projector,
        CONFIG.locations.cellSize,
      );
    });

    this.#systems.ui.onNetClick = () => {
      if (this.#state && typeof this.#state.handleNetClick === "function") {
        this.#state.handleNetClick();
      }
    };

    this.#systems.ui.onContinueClick = () => this.setState("scouting");
    window.dispatchEvent(new Event("resize"));

    // --- ВІДНОВЛЕНО: Слухач оновлень конфігу з DevTools ---
    document.addEventListener("config-updated", (e) => {
      if (e.detail && e.detail.path && e.detail.path[0] === "locations") {
        if (this.#systems.projector) {
          this.#systems.projector.update(0, 0);
          this.#systems.projector.update(
            this.#canvas.width,
            this.#canvas.height,
          );
        }
        if (
          this.#systems.map &&
          typeof this.#systems.map.refreshConfig === "function"
        ) {
          // ВАЖЛИВО: Кажемо карті перечитати зони колізій і сітку!
          this.#systems.map.refreshConfig(CONFIG.locations);
        }
      }
    });
  }

  setState(name, data = {}) {
    if (this.#state) this.#state.exit();
    this.#gameStateName = name;

    if (this.#systems.inventory) {
      this.#systems.inventory.setLock(name !== "scouting");
    }

    const states = {
      scouting: ScoutingState,
      waiting: WaitingState,
      biting: BitingState,
      playing: PlayingState,
      failed: FailedState,
      victory: VictoryState,
    };

    this.#state = new states[name](this, data);
    this.#state.enter(data);
  }

  update(dt) {
    const timeScale = CONFIG.debug?.timeScale || 1;
    const input = this.#systems.input.getState();
    const bounds = this.getDynamicBounds();

    this.#systems.env.update(dt, timeScale);
    this.#systems.projector.update(this.#canvas.width, this.#canvas.height);
    this.#systems.map.update(dt, this.#systems.env.getSnapshot().time);
    this.#systems.chum.update(Date.now(), timeScale);

    this.#systems.chum.updateBoats(
      dt,
      (vx, vy) => {
        if (
          vx < bounds.left ||
          vx > bounds.right ||
          vy < bounds.top ||
          vy > bounds.bottom
        ) {
          return null;
        }
        return this.checkWater(vx, vy);
      },
      (vx, vy) => {
        const cell = this.#systems.map.getCellAtVirtualPos(
          vx,
          vy,
          CONFIG.locations.cellSize,
        );
        return cell ? cell.hasCollision : false;
      },
      CONFIG.locations.cellSize,
      { current: CONFIG.locations.map["test"].environment.current },
    );

    this.#castManager.update(dt);
    this.#timeUI.update(this.#systems.env.getSnapshot().time);
    this.updateChumUI();

    if (this.isAimingChum) {
      this.handleChumAiming(input, bounds);
    } else {
      this.handleGlobalBoatControl(input);
      this.#state.handleInput(input);
      this.#state.update(dt, bounds, {
        env: this.#systems.env.getPhysicsEnv(),
        biteEnv: this.getEnvDataForBite(),
      });
    }

    if (this.invalidCastMarker) {
      this.invalidCastMarker.timer -= dt;
      if (this.invalidCastMarker.timer <= 0) this.invalidCastMarker = null;
    }

    this.#sendDebug();
  }

  draw() {
    const r = this.#systems.renderer;
    const b = this.getDynamicBounds();

    r.clear(CONFIG.canvas.backgroundColor);

    r.drawBackground(this.#systems.map, this.#systems.projector);

    if (CONFIG.locations?.debugVisuals) {
      if (typeof r.drawLocationDebug === "function") {
        r.drawLocationDebug(
          this.#systems.map,
          this.#systems.projector,
          CONFIG.locations,
        );
      }
    }

    if (CONFIG.locations?.showChumZones !== false) {
      r.drawChumZones(this.#systems.chum, this.#systems.projector);
    }

    if (this.#systems.chum && typeof r.drawBoatWaypoints === "function") {
      r.drawBoatWaypoints(this.#systems.chum, this.#systems.projector);
    }

    if (this.#systems.chum && typeof r.drawBoats === "function") {
      r.drawBoats(this.#systems.chum, this.#systems.projector);

      const boats = this.#systems.chum.getBoats();
      for (let i = 0; i < boats.length; i++) {
        if (typeof r.renderSensors === "function") {
          r.renderSensors(boats[i], this.#systems.projector);
        }
      }
    }

    // --- ВИПРАВЛЕНО: Беремо метод доставки з інвентарю ---
    const eq = this.#systems.inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";

    if (this.isAimingChum && method === "hand") {
      if (CONFIG.locations?.showAimingZone !== false) {
        r.drawAimingZone(
          this.#systems.projector,
          b.bottom,
          CONFIG.locations.map["test"]?.chumCastDistance || 800,
          "chum",
        );
      }
    }

    if (this.invalidCastMarker) {
      r.drawInvalidCastMarker(this.invalidCastMarker);
    }

    this.#state.draw(r, b);
  }

  castLine(vx, vy, cellDepth) {
    const eq = this.#systems.inventory.getEquipped();

    // 1. ПЕРЕВІРКА ОБОВ'ЯЗКОВОГО СПОРЯДЖЕННЯ
    if (!eq.rod) {
      console.warn("❌ Відсутнє вудилище!");
      return;
    }

    // Перевіряємо, чи потрібна котушка (для pole/махових — ні)
    const needsReel =
      eq.rod.hasReel ?? eq.rod.engineStats?.hasReel ?? eq.rod.type !== "pole";
    if (needsReel && !eq.reel) {
      console.warn("❌ Для цього вудилища необхідна котушка!");
      return;
    }

    // 2. ПІДГОТОВКА ПАРАМЕТРІВ ЗАКИДАННЯ
    const rodPos = this.getRodVirtualPos(this.getDynamicBounds());
    const dist = Math.hypot(vx - rodPos.x, vy - rodPos.y);
    const maxDist = eq.rod.maxDistance || 2000;

    this.castDistanceRatio = Math.min(1, dist / maxDist);
    this.castStartTime = performance.now();

    const isFeeder = eq.rod.type === "feeder";
    if (isFeeder) {
      this.currentHookDepth = cellDepth;
    }

    // 3. ВИЗНАЧЕННЯ ТИПУ ФІЗИКИ ТА КОНФІГУ
    let physicsType = "float";
    let physicsConfig = {};

    // Пріоритет 1: Спінінгові приманки (перевіряємо просто по типу вудки)
    if (eq.rod.type === "spinning" && eq.baits?.[0]) {
      const baitStats = eq.baits[0].engineStats || eq.baits[0];
      // Беремо конкретний тип приманки (wobbler, spinner, jig)
      physicsType = baitStats.type || eq.baits[0].type || "spinner";
      physicsConfig = { ...baitStats };
    }
    // Пріоритет 2: Поплавок
    else if (eq.float) {
      physicsType = "float";
      physicsConfig = { ...eq.float.engineStats, ...eq.float };
    }
    // Пріоритет 3: Грузило/Фідер
    else if (eq.sinker) {
      physicsType = eq.rod.type === "feeder" ? "feeder" : "float";
      physicsConfig = { ...eq.sinker.engineStats, ...eq.sinker };
    }

    // 4. СТВОРЕННЯ ОБ'ЄКТА ПРИМАНКИ
    this.#float = BaitFactory.create(physicsType, vx, vy, physicsConfig, eq);

    // 5. ЗАПУСК ФІЗИКИ
    if (typeof this.#float.cast === "function") {
      // Передаємо sinkerConfig. Якщо його немає — передаємо пустий об'єкт,
      // щоб FloatEntity.cast використав свої внутрішні дефолти і не крашнувся.
      const sinkerCfg = eq.sinker
        ? { ...eq.sinker.engineStats, ...eq.sinker }
        : null;

      this.#float.cast(
        vx,
        vy,
        this.currentHookDepth,
        this.currentHookDepth > cellDepth,
        sinkerCfg, // Передаємо null або об'єкт, FloatEntity має це обробити
        this.castDistanceRatio,
      );
    } else {
      this.#float.setPosition(vx, vy);
      if (typeof this.#float.setHookDepth === "function") {
        this.#float.setHookDepth(0.1);
      }
      if (typeof this.#float.stopBite === "function") {
        this.#float.stopBite();
      }
    }

    this.setState("waiting");
  }

  drawFishingElements(
    renderer,
    bottom, // Це наш віртуальний низ (vBot)
    state,
    tMeter, // Перейменував для зручності, щоб збігалося з кодом нижче
    fCond, // Перейменував
    startTime,
  ) {
    // 1. Отримуємо екіпірування ОДИН раз
    const eq = this.#systems.inventory.getEquipped();

    const sPos = this.#systems.projector.virtualToScreen(
      this.#float.getPosition().x,
      this.#float.getPosition().y,
    );
    const elapsed = performance.now() - startTime;

    let ratio = 1.0,
      drop = 0;
    const lineCfg = CONFIG.ui.line;

    // Логіка розрахунку натягу ліски (Ratio/Drop)
    if (state === "waiting" || state === "biting") {
      const minDelay = lineCfg.distanceDelayMinMs ?? 1500;
      const maxDelay = lineCfg.distanceDelayMaxMs ?? 5000;
      const distanceDelay =
        minDelay + this.castDistanceRatio * (maxDelay - minDelay);

      const activeItem =
        (eq.rod?.type === "spinning" ? eq.baits?.[0] : eq.sinker) || {};
      const sinkRate =
        activeItem.sinkSpeed || activeItem.engineStats?.sinkSpeed || 1;

      const duration =
        (this.currentHookDepth / sinkRate) * 1000 + distanceDelay;
      const prog = duration > 0 ? Math.min(1, elapsed / duration) : 1;

      const easePower = lineCfg.shrinkEasePower ?? 4;
      const ease = 1 - Math.pow(1 - prog, easePower);

      ratio = 1.0 - ease * (1.0 - lineCfg.shrinkPercent / 100);
      drop = ease * (lineCfg.sinkDropPx || 120);

      const input = this.#systems.input.getState();
      if (input.isPulling) {
        ratio = 1.0;
        drop = 0;
      }
    } else if (state === "playing") {
      const baseSnap = lineCfg.snapDurationMs ?? 300;
      const depthRatio = Math.min(1, this.currentHookDepth / 10.0);
      const snapDuration =
        baseSnap *
        (1.0 + depthRatio * ((lineCfg.snapDepthMaxMultiplier ?? 2.0) - 1.0));

      const prog = snapDuration > 0 ? Math.min(1, elapsed / snapDuration) : 1;
      const ease = 1 - Math.pow(1 - prog, 3);
      const startR = lineCfg.shrinkPercent / 100;

      ratio = startR + ease * (1.0 - startR);
      drop = (lineCfg.sinkDropPx || 120) * (1 - ease);
    }

    // Розрахунок обмежень для ліски (щоб не провалилася крізь землю)
    const mapBottomScreenY = this.#systems.projector.virtualToScreen(
      0,
      bottom,
    ).y;
    const rodScreenY = this.#canvas.height - (CONFIG.ui?.rod?.yOffset || 0);
    const rodTopY = rodScreenY - 200;
    const distY = sPos.y - rodTopY;

    if (distY < 0) {
      const minRatio = (mapBottomScreenY - rodTopY) / distY;
      ratio = Math.max(ratio, minRatio);
    }

    const targetYAfterShrink = rodTopY + distY * ratio;
    const maxAllowedDrop = Math.max(0, mapBottomScreenY - targetYAfterShrink);
    drop = Math.min(drop, maxAllowedDrop);

    // --- МАЛЮВАННЯ ---

    renderer.drawCatchZone(
      this.#systems.projector,
      this.#net,
      bottom,
      CONFIG.locations,
      CONFIG.ui.catchZone,
    );

    renderer.drawRodLine(
      sPos,
      state,
      tMeter?.getTension() || 0,
      ratio,
      drop,
      CONFIG.ui.rod,
      lineCfg,
    );

    // ОСЬ ТУТ МИ ПЕРЕДАЄМО eq ПРАВИЛЬНО
    renderer.drawFloat(
      sPos,
      this.#float,
      eq.float || {},
      this.#systems.projector,
      eq,
    );

    if (state === "playing" && tMeter && fCond) {
      renderer.drawTensionBar(tMeter, CONFIG.tension, CONFIG.ui.indicators);
      renderer.drawFishCondition(fCond, CONFIG.ui.indicators);
    }
  }

  canPlayerCast() {
    const eq = this.#systems.inventory.getEquipped();

    if (!eq || !eq.rod) {
      return false;
    }

    const boat = this.#systems.chum.getBoats()[0];
    if (!boat) return true;
    if (boat.state === "drifting" || boat.state === "returning") return true;

    const boatItem = eq.delivery || {};
    const isManual = boatItem.manualControl ?? true;

    return !isManual && boat.remainingSections <= 0;
  }

  getDynamicBounds() {
    const b = this.#systems.map.getCastableBoundsVirtual(
      CONFIG.locations.cellSize,
    );
    const vTL = this.#systems.projector.screenToVirtual(0, 0);
    const vBR = this.#systems.projector.screenToVirtual(
      this.#canvas.width,
      this.#canvas.height,
    );

    return {
      left: CONFIG.locations.lockZoneXToScreen
        ? Math.max(vTL.x, b.left)
        : b.left,
      right: CONFIG.locations.lockZoneXToScreen
        ? Math.min(vBR.x, b.right)
        : b.right,
      top: b.top,
      bottom: b.bottom,
    };
  }

  getMaxHookDepth() {
    const eq = this.#systems.inventory.getEquipped();

    if (eq.rod?.type === "spinning" && eq.baits?.[0]?.type === "jig") {
      return eq.baits[0].engineStats?.maxDepth ?? eq.baits[0].maxDepth ?? 8.0;
    }

    if (eq.sinker) {
      return eq.sinker.engineStats?.maxDepth ?? eq.sinker.maxDepth ?? 10.0;
    }

    return CONFIG.physics?.defaultDepthNoSinker ?? 0.1;
  }

  getRodVirtualPos(bounds) {
    const rodX =
      CONFIG.ui.rod.x === "center"
        ? this.#canvas.width / 2
        : Number(CONFIG.ui.rod.x);
    return new Vector2(
      this.#systems.projector.screenToVirtual(rodX, 0).x,
      bounds.bottom,
    );
  }

  getScreenOffsetRatio(floatPos) {
    const sPos = this.#systems.projector.virtualToScreen(
      floatPos.x,
      floatPos.y,
    );
    const rodX =
      CONFIG.ui.rod.x === "center"
        ? this.#canvas.width / 2
        : Number(CONFIG.ui.rod.x);
    return Math.min(1, Math.abs(sPos.x - rodX) / (this.#canvas.width / 2));
  }

  checkWater(vx, vy) {
    const cell = this.#systems.map.getCellAtVirtualPos(
      vx,
      vy,
      CONFIG.locations.cellSize,
    );
    return cell && cell.isCastable && !cell.hasCollision ? cell : null;
  }

  getEnvDataForBite() {
    const pos = this.#float.getPosition();
    const env = this.#systems.env.getSnapshot();
    const cell = this.checkWater(pos.x, pos.y);
    const chum = this.#systems.chum.getChumDataAt(pos.x, pos.y);
    const bottomDepth = cell?.depth || 0;

    let feederBonus = 1.0;
    let feederTargets = [];
    const eq = this.#systems.inventory.getEquipped();
    const isFeeder = eq?.rod?.type === "feeder";

    if (this.#float instanceof FeederEntity && eq?.feederChum) {
      const elapsedMs = performance.now() - this.castStartTime;
      const chumData = this.#float.getChumBonus(elapsedMs, eq.feederChum);
      feederBonus = chumData.bonus;
      feederTargets = chumData.targets;
    }

    return {
      hookDepth: Math.min(this.#float.getCurrentHookDepth(), bottomDepth),
      bottomDepth: bottomDepth,
      lineLength: isFeeder ? bottomDepth : this.currentHookDepth || 0.1,
      timePhase: env.phase,
      dayOfWeek: new Date().getDay(),
      zoneBonus: cell?.multiplier || cell?.bonus || 1.0,
      chumBonus: Math.max(chum?.bonus || 1.0, feederBonus),
      chumTargets: [...new Set([...(chum?.targets || []), ...feederTargets])],
      isRaining: env.isRaining,
      isFoggy: env.isFoggy,
      castSpamMultiplier: this.#castManager.getBiteChanceMultiplier(),
    };
  }

  updateChumUI() {
    const eq = this.#systems.inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";
    const boatItem = eq.delivery || {};
    const isManual = boatItem.manualControl ?? true;
    const sections = boatItem.sections ?? boatItem.engineStats?.sections ?? 1;

    let state = "idle";
    let count = 0;

    if (method === "hand") {
      let activeChum = null;
      const items = this.#systems.inventory.getInventoryItems();
      for (const item of items) {
        const hydrated = this.#systems.inventory._hydrateInstance(
          item.instanceId,
        );
        if (hydrated && hydrated.type === "chum_mix") {
          activeChum = hydrated;
          break;
        }
      }
      count = activeChum ? activeChum.quantity || 1 : 0;
      if (count <= 0) state = "empty";
      else if (this.isAimingChum) state = "aiming";
      else state = "idle";
    } else if (method === "boat") {
      const boats = this.#systems.chum.getBoats();
      const activeBoat = boats.length > 0 ? boats[0] : null;

      if (!activeBoat) {
        const loadedCount = (eq.deliveryChums || []).filter(Boolean).length;
        count = sections;
        if (loadedCount === 0) state = "empty";
        else state = this.isAimingChum ? "aiming" : "idle";
      } else {
        count = activeBoat.remainingSections;

        if (activeBoat.state === "idle") {
          state = this.isAimingChum ? "aiming" : "idle";
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
        } else {
          if (activeBoat.state === "returning") {
            state = "moving";
          } else if (
            activeBoat.state === "deploying" ||
            activeBoat.state === "waiting"
          ) {
            state = this.isAimingChum ? "aiming" : "moving";
          }
        }
      }
    }

    this.#chumUI.setState(state, method, count, isManual);

    if (this.isAimingChum && method === "boat") {
      const boats = this.#systems.chum.getBoats();
      const activeBoat = boats.length > 0 ? boats[0] : null;
      if (activeBoat) {
        if (!isManual && activeBoat.state === "returning") {
          this.isAimingChum = false;
        } else if (
          isManual &&
          activeBoat.state !== "idle" &&
          activeBoat.state !== "waiting"
        ) {
          this.isAimingChum = false;
        }
      }
    }
  }

  handleChumClick() {
    const eq = this.#systems.inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";

    if (method === "hand") {
      let activeChum = null;
      const items = this.#systems.inventory.getInventoryItems();
      for (const item of items) {
        const hydrated = this.#systems.inventory._hydrateInstance(
          item.instanceId,
        );
        if (hydrated && hydrated.type === "chum_mix") {
          activeChum = hydrated;
          break;
        }
      }

      if (activeChum) {
        this.toggleChumAim();
      } else {
        if (this.#systems.inventoryUI) {
          this.#systems.inventoryUI.showWarning(
            "У вас немає прикормки в інвентарі!",
          );
        }
      }
    } else if (method === "boat") {
      const boats = this.#systems.chum.getBoats();

      if (boats.length === 0) {
        const loadedCount = (eq.deliveryChums || []).filter(Boolean).length;
        if (loadedCount > 0) {
          this.toggleChumAim();
        } else {
          if (this.#systems.inventoryUI) {
            this.#systems.inventoryUI.showWarning(
              "Завантажте прикормку в бункери кораблика через інвентар!",
            );
          }
        }
      } else {
        const activeBoat = boats[0];
        const boatItem = eq.delivery || {};
        const isManual = boatItem.manualControl ?? true;

        if (this.isAimingChum) {
          this.toggleChumAim();
          return;
        }

        if (isManual) {
          if (
            activeBoat.state === "waiting" &&
            activeBoat.remainingSections > 0
          ) {
            const sections =
              boatItem.sections ?? boatItem.engineStats?.sections ?? 1;
            const dropIndex = sections - activeBoat.remainingSections;
            const chumToDrop = activeBoat._loadedChums[dropIndex];

            if (chumToDrop) {
              this.#systems.chum.deployBait(
                activeBoat.pos.x,
                activeBoat.pos.y,
                chumToDrop.id,
              );
              this.#systems.inventory.unequipItem(`deliveryChums_${dropIndex}`);
              this.#systems.inventory.consumeItem(chumToDrop.instanceId, 1);
            }
            activeBoat.remainingSections--;
            if (activeBoat.remainingSections <= 0) {
              const hasAI =
                boatItem.hasAutoReturn ??
                boatItem.engineStats?.hasAutoReturn ??
                false;
              if (hasAI) {
                activeBoat.state = "returning";
              }
            }
          }
        }
      }
    }
  }

  toggleChumAim() {
    this.isAimingChum = !this.isAimingChum;
    this._uiClickLockTime = Date.now();

    if (this.isAimingChum) {
      this.#depthUI.hide();
    }

    const eq = this.#systems.inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";

    if (this.isAimingChum && method === "boat") {
      const bounds = this.getDynamicBounds();
      const rodPos = this.getRodVirtualPos(bounds);

      this.activeBoat = this.#systems.chum.spawnIdleBoat(
        rodPos.x,
        bounds.bottom - 5,
        eq.delivery,
      );

      if (this.activeBoat) {
        const boatItem = eq.delivery || {};
        this.activeBoat.remainingSections =
          boatItem.sections ?? boatItem.engineStats?.sections ?? 1;
        this.activeBoat._loadedChums = [...(eq.deliveryChums || [])];
      }
    } else if (!this.isAimingChum && this.activeBoat) {
      if (this.activeBoat.state === "idle") {
        this.#systems.chum.removeBoat(this.activeBoat);
      }
      this.activeBoat = null;
    }
  }

  handleChumAiming(input, bounds) {
    if (!input.clickPos) return;

    if (this._uiClickLockTime && Date.now() - this._uiClickLockTime < 200) {
      input.clickPos = null;
      return; // Додано return, щоб заблокований клік точно не йшов далі
    }

    const eq = this.#systems.inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";

    const vPos = this.#systems.projector.screenToVirtual(
      input.clickPos.x,
      input.clickPos.y,
    );
    const cell = this.checkWater(vPos.x, vPos.y);

    if (method === "hand") {
      let activeChum = null;
      const items = this.#systems.inventory.getInventoryItems();
      for (const item of items) {
        const hydrated = this.#systems.inventory._hydrateInstance(
          item.instanceId,
        );
        if (hydrated && hydrated.type === "chum_mix") {
          activeChum = hydrated;
          break;
        }
      }

      if (!cell || !activeChum) {
        this.markInvalidCast(input.clickPos);
        input.clickPos = null;
        this.toggleChumAim(); // Знімаємо приціл при помилці
        return;
      }

      // === МАТЕМАТИЧНЕ ОБМЕЖЕННЯ ДАЛЬНОСТІ ===
      const locId = "test"; // Якщо локація динамічна, зміни на змінну
      const chumDist = CONFIG.locations.map[locId].chumCastDistance || 300;
      const virtualLineY = bounds.bottom - chumDist;

      // Якщо клікнули вище дозволеної лінії (далі в озеро)
      if (vPos.y < virtualLineY) {
        this.markInvalidCast(input.clickPos);
        input.clickPos = null;
        this.toggleChumAim(); // Скидаємо режим прицілювання

        // Можна також додати попередження в UI
        if (this.#systems.inventoryUI) {
          this.#systems.inventoryUI.showWarning(
            "Занадто далеко для ручного закидання!",
          );
        }
        return;
      }
      // ==========================================

      this.#systems.chum.deployBait(vPos.x, vPos.y, activeChum.id);
      this.#systems.inventory.consumeItem(activeChum.instanceId, 1);
      this.toggleChumAim();
    } else if (method === "boat") {
      const reservedTargets =
        (this.activeBoat.zoneId ? 1 : 0) +
        (this.activeBoat.waypoints ? this.activeBoat.waypoints.length : 0);
      const chumToDrop = this.activeBoat._loadedChums
        ? this.activeBoat._loadedChums[reservedTargets]
        : null;

      if (!cell || !chumToDrop) {
        this.markInvalidCast(input.clickPos);
        input.clickPos = null;
        return;
      }

      this.#systems.chum.deployBait(
        vPos.x,
        vPos.y,
        chumToDrop.id,
        this.activeBoat,
      );

      this.#systems.inventory.unequipItem(`deliveryChums_${reservedTargets}`);
      this.#systems.inventory.consumeItem(chumToDrop.instanceId, 1);

      const sections =
        eq.delivery?.sections ?? eq.delivery?.engineStats?.sections ?? 1;
      if (reservedTargets + 1 >= sections) {
        this.toggleChumAim();
      }
    }
  }

  handleGlobalBoatControl(input) {
    if (
      !input.clickPos ||
      this.isAimingChum ||
      this.#gameStateName === "playing"
    )
      return;

    const boats = this.#systems.chum.getBoats();
    if (boats.length === 0) return;

    const activeBoat = boats[0];
    const vPos = this.#systems.projector.screenToVirtual(
      input.clickPos.x,
      input.clickPos.y,
    );
    let clickHandled = false;

    const distToBoat = Math.hypot(
      activeBoat.pos.x - vPos.x,
      activeBoat.pos.y - vPos.y,
    );
    const mapBounds = this.getDynamicBounds();

    if (distToBoat < 40) {
      if (activeBoat.pos.y > mapBounds.bottom - 200) {
        this.#systems.chum.removeBoat(activeBoat);
      }
      clickHandled = true;
    } else if (activeBoat.state !== "drifting") {
      const cell = this.checkWater(vPos.x, vPos.y);

      if (!cell) {
        this.markInvalidCast(input.clickPos);
        clickHandled = true;
      } else {
        const eq = this.#systems.inventory.getEquipped();
        const boatItem = eq.delivery || {};
        const isManual = boatItem.manualControl ?? true;

        if (isManual) {
          if (activeBoat.state !== "returning") {
            activeBoat.setTarget(vPos.x, vPos.y);
            clickHandled = true;
          }
        } else {
          const reservedTargets =
            (activeBoat.zoneId ? 1 : 0) +
            (activeBoat.waypoints ? activeBoat.waypoints.length : 0);
          const freeSlots = activeBoat.remainingSections - reservedTargets;

          if (freeSlots > 0 && activeBoat.state !== "returning") {
            const chumToDrop = eq.deliveryChum;

            if (chumToDrop) {
              this.#systems.chum.deployBait(
                vPos.x,
                vPos.y,
                chumToDrop.id,
                activeBoat,
              );
              this.#systems.inventory.consumeItem(chumToDrop.instanceId, 1);
              clickHandled = true;
            }
          }
        }
      }
    }

    if (clickHandled) {
      input.clickPos = null;
    } else if (!this.canPlayerCast()) {
      input.clickPos = null;
    }
  }

  markInvalidCast(p) {
    this.invalidCastMarker = { x: p.x, y: p.y, timer: 500 };
  }

  #sendDebug() {
    if (!CONFIG.debug?.overlay) return;

    const env = this.#systems.env.getSnapshot();
    const pos = this.#float.getPosition();
    const ed = this.getEnvDataForBite();

    const eq = this.#systems.inventory.getEquipped();
    const currentBaits = (eq?.baits || []).map((b) => b?.id).filter(Boolean);
    const currentHookSize = eq?.hook?.level || 1;

    let detail = {
      gameState: this.#gameStateName,
      floatX: Math.round(pos.x),
      floatY: Math.round(pos.y),
      hookDepth: ed.hookDepth,
      bottomDepth: ed.bottomDepth,
      lineLength: ed.lineLength,
      baits: currentBaits,
      phase: env.phase,
      isRaining: env.isRaining,
      isFoggy: env.isFoggy,
      liveChances: this.#systems.bite.getLiveChances(ed, {
        hookSize: currentHookSize,
        baits: currentBaits,
      }),
      chumZones: this.#systems.chum?.getZones
        ? this.#systems.chum.getZones()
        : [],
    };

    const boats = this.#systems.chum?.getBoats() || [];
    const activeBoat = boats[0];
    const boatItem = eq.delivery || {};
    const boatHasSonar = boatItem.hasSonar ?? false;

    if (activeBoat && boatHasSonar && this.#gameStateName === "scouting") {
      const boatCell = this.checkWater(activeBoat.pos.x, activeBoat.pos.y);
      const boatChum = this.#systems.chum.getChumDataAt(
        activeBoat.pos.x,
        activeBoat.pos.y,
      );

      detail.isBoatSonar = true;
      detail.floatX = Math.round(activeBoat.pos.x);
      detail.floatY = Math.round(activeBoat.pos.y);
      detail.bottomDepth = boatCell?.depth || 0;

      const boatEd = {
        ...ed,
        bottomDepth: detail.bottomDepth,
        hookDepth: detail.bottomDepth,
        zoneBonus: boatCell?.multiplier || boatCell?.bonus || 1.0,
        chumBonus: boatChum.bonus || 1.0,
        chumTargets: boatChum.targets || [],
      };

      detail.liveChances = this.#systems.bite.getLiveChances(boatEd, {
        hookSize: currentHookSize,
        baits: currentBaits,
      });
    }

    if (this.#state && typeof this.#state.getDebugData === "function") {
      Object.assign(detail, this.#state.getDebugData());
    }

    document.dispatchEvent(new CustomEvent("debug-live-update", { detail }));
  }

  start() {
    const loop = (t) => {
      this.update(t - (this.lastTime || t));
      this.draw();
      this.lastTime = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  get gameStateName() {
    return this.#gameStateName;
  }
  get systems() {
    return this.#systems;
  }
  get float() {
    return this.#float;
  }
  get castManager() {
    return this.#castManager;
  }
  get depthUI() {
    return this.#depthUI;
  }
  get holdUI() {
    return this.#holdUI;
  }
  get net() {
    return this.#net;
  }
}

const game = new Game("gameCanvas");
if (typeof CacheManager !== "undefined" && CacheManager.printStorageUsage) {
  CacheManager.printStorageUsage();
}

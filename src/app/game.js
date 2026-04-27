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
    this.game.systems.ui.updateNetButtonState(CONFIG, false);
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
      const vPos = this.game.systems.projector.screenToVirtual(
        input.clickPos.x,
        input.clickPos.y,
      );
      const cell = this.game.checkWater(vPos.x, vPos.y);
      const bounds = this.game.getDynamicBounds();

      let rawDist = CONFIG.player?.equipment?.rod?.maxDistance;
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
    const baitId = eq?.baits?.[0];
    const baitCfg = CONFIG.baitsData?.[baitId];
    const baitType = baitCfg?.type;

    const isFeeder = rodType === "feeder";
    const isSpinning = rodType === "spinning";
    const isJig = baitType === "jig";

    const canSelectDepth = !isFeeder && (!isSpinning || isJig);

    if (!this.game.canPlayerCast() || !canSelectDepth) {
      if (this.game.depthUI.isActive) {
        this.game.depthUI.hide();
      }
      if (isSpinning && !isJig) {
        this.game.currentHookDepth = 0.1;
      }
      return;
    }

    const maxDepth =
      (isSpinning ? baitCfg?.maxDepth : CONFIG.sinker?.maxDepth) || 8.0;

    if (!this.game.depthUI.isActive) {
      this.game.depthUI.show(
        maxDepth,
        this.game.currentHookDepth,
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
      if (CONFIG.locations?.showAimingZone !== false) {
        let rawDist = CONFIG.player?.equipment?.rod?.maxDistance;
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

  enter(data) {
    this.#startTime = performance.now();

    // ЗМІНЕНО ТУТ: читаємо fish безпосередньо з data, як ми робили в BitingState
    this.data = data || {};
    const fishData = this.data.fish;

    const eq = this.game.systems.inventory.getEquipped();

    this.#rod = new Rod(
      eq.rod.level,
      eq.rod.basePower,
      eq.rod.compensation,
      eq.rod.type,
      eq.rod.maxDistance,
      eq.rod.hasReel !== false,
    );

    this.#reel = this.#rod.hasReel()
      ? new Reel(eq.reel.level, eq.reel.basePower, eq.reel.hold)
      : new Reel(0, 0, null);

    const hook = new Hook(eq.hook.level, eq.hook.weight, eq.hook.quality);

    const fish = new Fish(
      fishData.level,
      fishData.weight,
      fishData.resistance,
      fishData.physics,
    );

    this.#fishingSystem = new FishingSystem(this.#rod, this.#reel, fish);

    this.#tensionMeter = new TensionMeter(
      eq.rod.level,
      this.#rod.hasReel() ? eq.reel.level : 0,
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
      new CustomEvent("debug-fish-hooked", { detail: fishData }),
    );
  }

  handleNetClick() {
    if (!this.#isNetReady) return;

    const fishWeight = this.#fishingSystem.getFishWeight();
    const chance = this.game.net.calculateCatchChance(fishWeight);
    const roll = Math.random() * 100;
    const success = roll <= chance;

    document.dispatchEvent(
      new CustomEvent("netCatchRoll", {
        detail: {
          chance: chance,
          roll: roll,
          success: success,
        },
      }),
    );

    this.game.setState(success ? "victory" : "failed", {
      reason: success ? null : "net_escape",
    });
  }

  handleInput(input) {
    const isHold = this.#fishingSystem.isHoldActive();
    const eq = this.game.systems.inventory.getEquipped();
    const swipeThreshold = eq?.reel?.hold?.swipeThresholdPx || 100;

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
        eq?.reel?.pumpLevel || 0,
        eq?.reel?.pumpPowerPerLevel || 10,
      );
      if (red > 0) this.#tensionMeter.applyPump(red);
      if (input.swipeDeltaY) this.game.systems.input.consumeSwipe();
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

    // ВІДНОВЛЕНО БЛОК НАПРЯМКУ ТЯГИ!
    let pullDirection = null;
    if (input.isPulling) {
      pullDirection = new Vector2(
        rodPos.x - floatPos.x,
        rodPos.y - floatPos.y,
      ).normalize();
    }

    // ВІДНОВЛЕНО ПЕРЕДАЧУ ВСІХ ПАРАМЕТРІВ!
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
    this.game.systems.ui.updateNetButtonState(CONFIG, this.#isNetReady);

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

    if (floatPos.y >= autoY) this.game.setState("victory");
    this.game.holdUI.update(this.#fishingSystem.getHoldUIState());
  }

  exit() {
    this.game.holdUI.update(null);
    this.game.systems.ui.hideNetButton();
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
    };
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

    const isSpinning = CONFIG.player?.equipment?.rod?.type === "spinning";

    if (!isSpinning && input.longPressPos && this.game.canPlayerCast()) {
      const vPos = this.game.systems.projector.screenToVirtual(
        input.longPressPos.x,
        input.longPressPos.y,
      );
      const cell = this.game.checkWater(vPos.x, vPos.y);

      if (cell) {
        this.game.castManager.registerCast(performance.now());
        this.game.castLine(vPos.x, vPos.y, cell.depth);
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
    const reelPower = eq?.rod?.hasReel ? eq?.reel?.basePower || 0 : 0;

    // 1. ДІЗНАЄМОСЯ ТИП ВУДКИ
    const isSpinning = eq?.rod?.type === "spinning";

    // 2. БЛОКУЄМО ТЯГУ ДЛЯ ФІДЕРА/ПОПЛАВКА
    // Створюємо "безпечний" інпут. Якщо це не спінінг, наживка ніколи не дізнається, що ти затиснув екран.
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
      effectiveInput, // Передаємо наш безпечний інпут
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

    let hooked = this.game.systems.bite.evaluateBite(dt, envData.biteEnv, {
      hookSize: eq?.hook?.level || 1,
      baits: eq?.baits || ["oil_worm"],
      isPulling: effectiveInput.isPulling, // ЗМІНЕНО: щоб хижак не клював на фідер під час перекидання
    });

    if (hooked && CONFIG.debug?.fixedCatch?.enabled) {
      const fixed = CONFIG.debug.fixedCatch;
      const template =
        CONFIG.spawns.fishes.find((f) => f.id === fixed.fishId) ||
        CONFIG.spawns.fishes[0];

      hooked = {
        id: template.id,
        name: template.name + " (TEST)",
        physics: template.physics,
        level: fixed.level,
        weight: fixed.weight,
        resistance: fixed.resistance,
      };
    }

    if (hooked) {
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

  // Цей метод обробляє лише РУЧНЕ підсікання (для поплавка/фідера)
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
    const reelPower = eq?.rod?.hasReel ? eq?.reel?.basePower || 0 : 0;

    let pullDirection = null;
    if (input.isPulling) {
      const rodPos = this.game.getRodVirtualPos(bounds);
      pullDirection = new Vector2(
        rodPos.x - pos.x,
        rodPos.y - pos.y,
      ).normalize();
    }

    // Передаємо всі параметри, щоб спінінг міг плисти під час клювання
    this.game.float.update(
      bounds,
      dt,
      envData.env,
      (vx, vy) => this.game.checkWater(vx, vy),
      input,
      reelPower,
      pullDirection,
    );

    // Логіка АВТОПІДСІКАННЯ для спінінга
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

    if (!this.game.float.isBiting()) {
      this.game.setState("waiting");
      return;
    }

    // Захист: якщо під час клювання блешня виїхала на берег
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

    // Аудіо фідера
    if (this.#feederAudioTemplate && stepInfo) {
      if (stepInfo.id !== this.#lastStepId) {
        this.#lastStepId = stepInfo.id;
        if (stepInfo.isAction) {
          this.#scheduleRings(stepInfo);
        }
      }
      this.#processRingQueue(dt);
    }
  }

  #scheduleRings(stepInfo) {
    this.#ringQueue = [];
    this.#stepTimeElapsed = 0;

    const cfg = CONFIG.ui?.audio?.feederConfig || {
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
  enter() {
    this.game.systems.ui.updateContinueButtonState(true);
  }
  exit() {
    this.game.systems.ui.updateContinueButtonState(false);
  }
  draw(renderer, bounds) {
    // --- ВІДНОВЛЕНО: Малюємо вудку та зону підсаки на фоні ---
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "failed",
      null,
      null,
      0,
    );

    // Малюємо сам попап
    renderer.drawGameOver(
      window.innerWidth,
      window.innerHeight,
      this.data.reason,
    );
  }
}

class VictoryState extends GameState {
  enter() {
    this.game.systems.ui.updateContinueButtonState(true);
  }
  exit() {
    this.game.systems.ui.updateContinueButtonState(false);
  }
  draw(renderer, bounds) {
    // --- ВІДНОВЛЕНО: Малюємо вудку та зону підсаки на фоні ---
    this.game.drawFishingElements(
      renderer,
      bounds.bottom,
      "victory",
      null,
      null,
      0,
    );

    // Малюємо сам попап
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

    this.#systems = {
      renderer: new Renderer(this.#canvas),
      projector: projectorInstance,
      map: new LocationMap(locId, CONFIG.locations),
      env: new EnvironmentSystem(locCfg, CONFIG.debug?.initialTime ?? 12),
      input: new InputManager(this.#canvas, Number(CONFIG.ui?.rod?.x) || null),
      ui: new UIManager(CONFIG),
      chum: new ChumManager(locId, CONFIG.chum, projectorInstance),
      bite: new BiteSystem(CONFIG.spawns, CONFIG.float),

      inventory: new InventoryManager(ITEM_DB, CONFIG.player),
    };

    this.#systems.inventoryUI = new InventoryUI(this.#systems.inventory);

    // Слухаємо подію зміни інвентарю
    document.addEventListener("inventory-changed", () => {
      console.log("Інвентар оновлено! Треба перемалювати вудку.");
      // Якщо ми в стані scouting, можна викликати this.setState("scouting"), щоб оновити снасті
      if (this.#gameStateName === "scouting") {
        this.setState("scouting");
      }
    });

    this.#chumUI = new ChumUI(() => this.handleChumClick());
    this.#net = new Net(CONFIG.net);
    this.#castManager = new CastManager();
    this.#depthUI = new DepthSelectorUI();
    this.#timeUI = new TimeDisplayUI();
    this.#holdUI = new HoldChargesUI();

    const eq = this.#systems.inventory.getEquipped();
    const baitId = eq?.baits?.[0] || "oil_worm";
    let baitCfg = CONFIG.baitsData?.[baitId] || CONFIG.float;

    // ДОДАНО: Якщо це поплавок, зливаємо його з базовим CONFIG.float
    if (!baitCfg.type || baitCfg.type === "float") {
      baitCfg = { ...CONFIG.float, ...baitCfg };
    }

    this.#float = BaitFactory.create(
      baitCfg.type || "float",
      0,
      0,
      baitCfg,
      eq,
    );

    this.#initEvents();
    this.setState("scouting");
    this.start();
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
      r.drawChumZones(
        this.#systems.chum,
        this.#systems.projector,
        // ВИДАЛЕНО: b.top, b.bottom
      );
    }

    if (this.#systems.chum && typeof r.drawBoatWaypoints === "function") {
      r.drawBoatWaypoints(this.#systems.chum, this.#systems.projector);
    }

    if (this.#systems.chum && typeof r.drawBoats === "function") {
      r.drawBoats(this.#systems.chum, this.#systems.projector); // ВИДАЛЕНО: b.top, b.bottom

      const boats = this.#systems.chum.getBoats();
      for (let i = 0; i < boats.length; i++) {
        if (typeof r.renderSensors === "function") {
          r.renderSensors(boats[i], this.#systems.projector);
        }
      }
    }

    if (this.isAimingChum && CONFIG.chum.currentMethod === "hand") {
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
    const rodPos = this.getRodVirtualPos(this.getDynamicBounds());
    const dist = Math.hypot(vx - rodPos.x, vy - rodPos.y);
    const maxDist = 2000;

    this.castDistanceRatio = Math.min(1, dist / maxDist);
    this.castStartTime = performance.now();

    const eq = this.#systems.inventory.getEquipped();
    const isFeeder = eq?.rod?.type === "feeder";

    if (isFeeder) {
      this.currentHookDepth = cellDepth;
    }

    const baitId = eq?.baits?.[0] || "oil_worm";
    let baitCfg = CONFIG.baitsData?.[baitId] || CONFIG.float;

    // ДОДАНО: Те саме об'єднання для закидання
    if (!baitCfg.type || baitCfg.type === "float") {
      baitCfg = { ...CONFIG.float, ...baitCfg };
    }

    this.#float = BaitFactory.create(
      baitCfg.type || "float",
      vx,
      vy,
      baitCfg,
      eq,
    );

    if (typeof this.#float.cast === "function") {
      this.#float.cast(
        vx,
        vy,
        this.currentHookDepth,
        this.currentHookDepth > cellDepth,
        CONFIG.sinker,
        this.castDistanceRatio,
      );
    } else {
      this.#float.setPosition(vx, vy);
      this.#float.setHookDepth(0.1);
      this.#float.stopBite?.();
    }

    this.setState("waiting");
  }

  drawFishingElements(renderer, vBot, state, tMeter, fCond, startTime) {
    const sPos = this.#systems.projector.virtualToScreen(
      this.#float.getPosition().x,
      this.#float.getPosition().y,
    );
    const elapsed = performance.now() - startTime;

    let ratio = 1.0,
      drop = 0;
    const lineCfg = CONFIG.ui.line;

    if (state === "waiting" || state === "biting") {
      const minDelay = lineCfg.distanceDelayMinMs ?? 1500;
      const maxDelay = lineCfg.distanceDelayMaxMs ?? 5000;
      const distanceDelay =
        minDelay + this.castDistanceRatio * (maxDelay - minDelay);

      const duration =
        (this.currentHookDepth / (CONFIG.sinker.sinkRate || 1)) * 1000 +
        distanceDelay;
      const prog = duration > 0 ? Math.min(1, elapsed / duration) : 1;

      const easePower = lineCfg.shrinkEasePower ?? 4;
      const ease = 1 - Math.pow(1 - prog, easePower);

      ratio = 1.0 - ease * (1.0 - lineCfg.shrinkPercent / 100);
      drop = ease * (lineCfg.sinkDropPx || 120);

      const input = this.#systems.input.getState();

      if (input.isPulling) {
        // Забрав перевірку на isSpinning
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

    // --- Захист від провисання волосіні під берег (зелену зону) ---
    // 1. Знаходимо екранну координату низу зеленої зони (берега)
    const mapBottomScreenY = this.#systems.projector.virtualToScreen(0, vBot).y;

    // 2. Знаходимо екранну координату кінчика вудки
    const rodScreenY = this.#canvas.height - (CONFIG.ui?.rod?.yOffset || 0);
    const rodTopY = rodScreenY - 200; // Висота кінчика вудки (200px)

    const distY = sPos.y - rodTopY;

    // 3. Захищаємо ratio (стиснення), якщо поплавець знаходиться вище за вудку на екрані
    if (distY < 0) {
      const minRatio = (mapBottomScreenY - rodTopY) / distY;
      ratio = Math.max(ratio, minRatio);
    }

    // 4. Жорстко обмежуємо drop (провисання), щоб волосінь не провалилася нижче mapBottomScreenY
    const targetYAfterShrink = rodTopY + distY * ratio;
    const maxAllowedDrop = Math.max(0, mapBottomScreenY - targetYAfterShrink);
    drop = Math.min(drop, maxAllowedDrop);
    // ------------------------------------------------------------------------

    renderer.drawCatchZone(
      this.#systems.projector,
      this.#net,
      vBot,
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

    renderer.drawFloat(
      sPos,
      this.#float,
      CONFIG.float,
      this.#systems.projector,
    );

    if (state === "playing" && tMeter && fCond) {
      renderer.drawTensionBar(tMeter, CONFIG.tension, CONFIG.ui.indicators);
      renderer.drawFishCondition(fCond, CONFIG.ui.indicators);
    }
  }

  canPlayerCast() {
    const boat = this.#systems.chum.getBoats()[0];
    if (!boat) return true;
    if (boat.state === "drifting" || boat.state === "returning") return true;
    return (
      !CONFIG.chum.deliveryMethods.boat.manualControl &&
      boat.remainingSections <= 0
    );
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

    if (isFeeder && eq?.feeder?.chumId) {
      const chumCfg = CONFIG.chum.baits[eq.feeder.chumId];
      const elapsedMs = performance.now() - this.castStartTime;

      // Оскільки в конфігу немає durationMs, беремо 5 реальних хвилин (300000 мс) за замовчуванням
      // Пізніше можеш додати feederDurationMs прямо в налаштування кожної прикормки
      const duration = chumCfg.feederDurationMs || 300000;

      if (chumCfg && elapsedMs < duration) {
        const progress = elapsedMs / duration;
        feederBonus = chumCfg.maxBonus - (chumCfg.maxBonus - 1.0) * progress;
        feederTargets = chumCfg.targetFishes || []; // Читаємо правильний ключ з конфігу!
      }
    }

    return {
      hookDepth: Math.min(this.#float.getCurrentHookDepth(), bottomDepth),
      bottomDepth: bottomDepth,

      // Для фідера ліска завжди натягнута по дну (немає штрафу за провисання)
      lineLength: isFeeder ? bottomDepth : this.currentHookDepth,

      timePhase: env.phase,
      dayOfWeek: new Date().getDay(),
      zoneBonus: cell?.multiplier || cell?.bonus || 1.0,
      chumBonus: Math.max(chum.bonus || 1.0, feederBonus),
      chumTargets: [...new Set([...(chum.targets || []), ...feederTargets])],
      isRaining: env.isRaining,
      isFoggy: env.isFoggy,
      castSpamMultiplier: this.#castManager.getBiteChanceMultiplier(),
    };
  }

  updateChumUI() {
    const method = CONFIG.chum.currentMethod;
    const isManual = CONFIG.chum?.deliveryMethods?.boat?.manualControl;
    let state = "idle";
    let count = 0;

    if (method === "hand") {
      count = this.#systems.chum.handUses;
      if (count <= 0) state = "empty";
      else if (this.isAimingChum) state = "aiming";
      else state = "idle";
    } else if (method === "boat") {
      const boats = this.#systems.chum.getBoats();
      const activeBoat = boats.length > 0 ? boats[0] : null;

      if (!activeBoat) {
        count = CONFIG.chum.deliveryMethods.boat.sections;
        state = this.isAimingChum ? "aiming" : "idle";
      } else {
        count = activeBoat.remainingSections;

        if (activeBoat.state === "idle") {
          state = this.isAimingChum ? "aiming" : "idle";
        } else if (activeBoat.state === "drifting") {
          state = "empty";
        } else if (isManual) {
          // РУЧНИЙ РЕЖИМ
          if (
            activeBoat.state === "deploying" ||
            activeBoat.state === "returning"
          ) {
            state = "moving"; // ⏩ (рухається)
          } else if (activeBoat.state === "waiting") {
            state = count > 0 ? "ready" : "empty"; // 🍞 (зупинився)
          }
        } else {
          // АВТО-РЕЖИМ
          if (activeBoat.state === "returning") {
            state = "moving"; // ⏩ ТІЛЬКИ коли повертається на базу!
          } else if (
            activeBoat.state === "deploying" ||
            activeBoat.state === "waiting"
          ) {
            state = this.isAimingChum ? "aiming" : "ready"; // 🚫 або 🍞(count) поки виконує місію
          }
        }
      }
    }

    this.#chumUI.setState(state, method, count, isManual);

    // АВТО-ВИМКНЕННЯ ПРИЦІЛУ
    if (this.isAimingChum && method === "boat") {
      const boats = this.#systems.chum.getBoats();
      const activeBoat = boats.length > 0 ? boats[0] : null;
      if (activeBoat) {
        if (!isManual && activeBoat.state === "returning") {
          this.isAimingChum = false; // Вимикаємо приціл, якщо авто-кораблик поплив додому
        } else if (
          isManual &&
          activeBoat.state !== "idle" &&
          activeBoat.state !== "waiting"
        ) {
          this.isAimingChum = false; // Вимикаємо приціл для ручного під час руху
        }
      }
    }
  }

  handleChumClick() {
    const method = CONFIG.chum.currentMethod;
    console.log("--- DEBUG 2: handleChumClick викликано! Метод:", method);
    if (method === "hand") {
      if (this.#systems.chum.handUses > 0) this.toggleChumAim();
    } else if (method === "boat") {
      const boats = this.#systems.chum.getBoats();

      if (boats.length === 0) {
        this.toggleChumAim();
      } else {
        const activeBoat = boats[0];
        const isManual = CONFIG.chum.deliveryMethods.boat.manualControl;

        // Якщо приціл увімкнено (кнопка 🚫) — натискання скасовує його
        if (this.isAimingChum) {
          this.toggleChumAim();
          return;
        }

        if (isManual) {
          // Логіка ручного скидання
          if (
            activeBoat.state === "waiting" &&
            activeBoat.remainingSections > 0
          ) {
            this.#systems.chum.deployBait(
              activeBoat.pos.x,
              activeBoat.pos.y,
              "carp_mix_basic",
            );
            activeBoat.remainingSections--;
            if (activeBoat.remainingSections <= 0) {
              const hasAI = CONFIG.chum.deliveryMethods.boat.hasAutoReturn;
              if (hasAI) {
                activeBoat.state = "returning";
              }
            }
          }
        } else {
          // Логіка АВТО-режиму: клік по 🍞 вмикає приціл для ДОДАВАННЯ точки
          if (activeBoat.state === "deploying" || activeBoat.state === "idle") {
            // Рахуємо, скільки точок вже задано (поточна ціль + черга)
            const reservedTargets =
              (activeBoat.zoneId ? 1 : 0) +
              (activeBoat.waypoints ? activeBoat.waypoints.length : 0);
            const freeSlots = activeBoat.remainingSections - reservedTargets;

            if (freeSlots > 0) {
              this.toggleChumAim(); // Дозволяємо цілитися (кнопка стане 🚫)
            } else {
              console.log(
                "Маршрут вже повністю заповнений! Чекайте на скидання.",
              );
            }
          }
        }
      }
    }
  }

  toggleChumAim() {
    this.isAimingChum = !this.isAimingChum;
    this._uiClickLockTime = Date.now();

    // ДОДАНО: Миттєво ховаємо шкалу глибини при увімкненні прицілу
    if (this.isAimingChum) {
      this.#depthUI.hide();
    }

    if (this.isAimingChum && CONFIG.chum.currentMethod === "boat") {
      const bounds = this.getDynamicBounds();
      const rodPos = this.getRodVirtualPos(bounds);

      this.activeBoat = this.#systems.chum.spawnIdleBoat(
        rodPos.x,
        bounds.bottom - 5,
      );
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
    }

    const method = CONFIG.chum.currentMethod || "hand";
    const vPos = this.#systems.projector.screenToVirtual(
      input.clickPos.x,
      input.clickPos.y,
    );
    const cell = this.checkWater(vPos.x, vPos.y);

    if (!cell) {
      this.markInvalidCast(input.clickPos);
      input.clickPos = null;
      return;
    }

    if (method === "hand") {
      const maxDist = CONFIG.locations.map["test"]?.chumCastDistance || 800;
      const throwLineY = bounds.bottom - maxDist; // ПРОСТА ПЕРЕВІРКА ПО Y

      if (vPos.y >= throwLineY) {
        if (this.#systems.chum.useHandBait()) {
          this.#systems.chum.deployBait(vPos.x, vPos.y, "carp_mix_basic");
          this.toggleChumAim();
        } else {
          this.isAimingChum = false;
        }
      } else {
        this.markInvalidCast(input.clickPos);
      }
    } else if (method === "boat" && this.activeBoat) {
      const isManual = CONFIG.chum?.deliveryMethods?.boat?.manualControl;

      this.#systems.chum.deployBait(
        vPos.x,
        vPos.y,
        "carp_mix_basic",
        this.activeBoat,
      );

      this.isAimingChum = false;

      if (isManual) {
        this.activeBoat = null;
      }
    }

    input.clickPos = null;
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

    // 1. Перевіряємо, чи клікаємо ми ПО САМОМУ КОРАБЛИКУ, щоб його забрати
    if (distToBoat < 40) {
      if (activeBoat.pos.y > mapBounds.bottom - 200) {
        this.#systems.chum.removeBoat(activeBoat);
        console.log("Кораблик забрано в інвентар!");
      } else {
        console.log("Кораблик занадто далеко, підпливіть ближче до берега!");
      }
      clickHandled = true;
    }
    // 2. Якщо клікаємо кудись на карту, щоб задати ціль
    else if (activeBoat.state !== "drifting") {
      const cell = this.checkWater(vPos.x, vPos.y);

      if (!cell) {
        this.markInvalidCast(input.clickPos);
        clickHandled = true;
      } else {
        const isManual = CONFIG.chum?.deliveryMethods?.boat?.manualControl;

        if (isManual) {
          if (activeBoat.state !== "returning") {
            activeBoat.setTarget(vPos.x, vPos.y);
            clickHandled = true;
          }
        } else {
          // АВТО-РЕЖИМ: Додавання точок "на льоту"

          // РАХУЄМО ВІЛЬНІ СЛОТИ:
          const reservedTargets =
            (activeBoat.zoneId ? 1 : 0) +
            (activeBoat.waypoints ? activeBoat.waypoints.length : 0);
          const freeSlots = activeBoat.remainingSections - reservedTargets;

          if (
            freeSlots > 0 && // Перевіряємо саме freeSlots!
            activeBoat.state !== "returning"
          ) {
            this.#systems.chum.deployBait(
              vPos.x,
              vPos.y,
              "carp_mix_basic",
              activeBoat,
            );
            clickHandled = true;
          } else if (activeBoat.state !== "returning") {
            console.log("Всі прикормки вже розплановані!");
          }
        }
      }
    }

    if (clickHandled) {
      input.clickPos = null;
    } else if (!this.canPlayerCast()) {
      console.log("Дія заблокована: спочатку задайте всі точки маршруту!");
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

    // Тепер ми просто беремо дані з ed, оскільки getEnvDataForBite
    // вже враховує і пляму на воді, і годівницю фідера
    const currentBaits = CONFIG.player?.equipment?.baits || ["oil_worm"];

    let detail = {
      gameState: this.#gameStateName,
      floatX: Math.round(pos.x),
      floatY: Math.round(pos.y),
      hookDepth: ed.hookDepth,
      bottomDepth: ed.bottomDepth,
      lineLength: ed.lineLength, // Беремо з ed, бо там вже враховано лежить фідер на дні чи ні
      baits: currentBaits, // Передаємо масив для EchoModule
      phase: env.phase,
      isRaining: env.isRaining,
      isFoggy: env.isFoggy,
      liveChances: this.#systems.bite.getLiveChances(ed, {
        hookSize: CONFIG.player?.equipment?.hook?.level || 1,
        baits: currentBaits, // Передаємо масив наживок
      }),
      chumZones: this.#systems.chum?.getZones
        ? this.#systems.chum.getZones()
        : [],
    };

    const boats = this.#systems.chum?.getBoats() || [];
    const activeBoat = boats[0];
    const boatHasSonar = CONFIG.chum?.deliveryMethods?.boat?.hasSonar;

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
        hookSize: CONFIG.player?.equipment?.hook?.level || 1,
        baits: currentBaits, // Передаємо масив наживок
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
CacheManager.printStorageUsage();

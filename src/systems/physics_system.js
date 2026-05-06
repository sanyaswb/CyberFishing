class FishingSystem {
  #rod;
  #reel;
  #buffs;
  #fish;

  #playerForceResult = new Vector2(0, 0);
  #fishForceResult = new Vector2(0, 0);
  #pullDirScratch = new Vector2(0, 0);

  #lastFishState = "unknown";
  #lastFishBasePower = 0;
  #lastPullMult = 0;
  #lastMoveMult = 0;

  #holdConfig = null;
  #maxHoldCharges = 0;
  #currentHoldCharges = 0;
  #isHoldActive = false;
  #holdRestoreTimers = [];
  #manualCooldownTimer = 0;
  #hasUsedPumpThisHold = false;

  constructor(rod, reel, fish) {
    this.#rod = rod;
    this.#reel = reel;
    this.#buffs = new BuffManager();
    this.#fish = fish;

    if (typeof this.#reel.getHoldStats === "function") {
      this.#holdConfig = this.#reel.getHoldStats();
    }

    if (this.#holdConfig) {
      this.#maxHoldCharges = this.#holdConfig.maxCharges;
      this.#currentHoldCharges = this.#maxHoldCharges;
    }
  }

  updateEquipment(rod, reel) {
    this.#rod = rod;
    this.#reel = reel;

    if (typeof this.#reel.getHoldStats === "function") {
      this.#holdConfig = this.#reel.getHoldStats();
    }

    if (this.#holdConfig) {
      this.#maxHoldCharges = this.#holdConfig.maxCharges;
      // Не даємо зарядам перевищити новий максимум
      this.#currentHoldCharges = Math.min(
        this.#currentHoldCharges,
        this.#maxHoldCharges,
      );
    } else {
      this.#maxHoldCharges = 0;
      this.#currentHoldCharges = 0;
      this.#isHoldActive = false;
    }
  }

  activateHold() {
    if (!this.#holdConfig) return false;
    if (this.#manualCooldownTimer > 0) return false;
    if (this.#isHoldActive) return true;
    if (this.#currentHoldCharges <= 0) return false;

    this.#isHoldActive = true;
    this.#currentHoldCharges--;
    this.#hasUsedPumpThisHold = false;
    return true;
  }

  tryUsePump(pumpLevel, powerPerLevel = 10) {
    if (!this.#isHoldActive) return 0; // Працює тільки під час блокування
    if (this.#hasUsedPumpThisHold) return 0; // Вже використано
    if (!pumpLevel || pumpLevel <= 0) return 0; // Немає прокачки

    this.#hasUsedPumpThisHold = true; // Блокуємо повторне використання

    return pumpLevel * powerPerLevel;
  }

  deactivateHold() {
    if (this.#isHoldActive) {
      this.#isHoldActive = false;
      this.#currentHoldCharges++; // Повертаємо цілий блок
      this.#manualCooldownTimer = this.#holdConfig.manualCooldownMs || 500;
    }
  }

  isHoldActive() {
    return this.#isHoldActive;
  }

  #breakHold() {
    this.#isHoldActive = false;
    // Запускаємо таймер відновлення (блок згорів)
    const restoreTime = Math.max(500, this.#holdConfig.restoreTimeMs || 5000);
    this.#holdRestoreTimers.push(restoreTime);
  }

  getHoldTensionMultiplier() {
    if (this.#holdConfig && this.#holdConfig.tensionMultiplier !== undefined) {
      return this.#holdConfig.tensionMultiplier;
    }
    return 1.0;
  }

  getHoldUIState() {
    return {
      hasHold: !!this.#holdConfig,
      max: this.#maxHoldCharges,
      current: this.#currentHoldCharges,
      isActive: this.#isHoldActive,
      restoring: [...this.#holdRestoreTimers],
      restoreMaxTime: this.#holdConfig?.restoreTimeMs || 5000,
    };
  }

  triggerFishLastDash() {
    if (this.#fish && typeof this.#fish.triggerLastDash === "function") {
      this.#fish.triggerLastDash();
    }
  }

  tryTriggerFishLastDash(dt) {
    if (this.#fish && typeof this.#fish.tryTriggerLastDash === "function") {
      this.#fish.tryTriggerLastDash(dt);
    }
  }

  getBuffManager() {
    return this.#buffs;
  }

  getReelPower() {
    return this.#reel.getPower();
  }

  getCurrentState() {
    return this.#lastFishState;
  }

  getFishBasePower() {
    return this.#lastFishBasePower;
  }

  getFishWeight() {
    return this.#fish ? this.#fish.getWeight() : 0;
  }

  getFishInitialPower() {
    return this.#fish && typeof this.#fish.getInitialPower === "function"
      ? this.#fish.getInitialPower()
      : 0;
  }

  getPullMultiplier() {
    return this.#lastPullMult;
  }

  getMoveMultiplier() {
    return this.#lastMoveMult;
  }

  getActiveDebuffName() {
    return this.#fish ? this.#fish.activeDebuffName : "Немає";
  }

  getMasteryMultiplier() {
    return this.#fish ? this.#fish.getMasteryMultiplier() : 1.0;
  }

  calculatePlayerForce(
    inputDirection,
    floatX,
    floatY,
    rodVirtualPos,
    screenOffsetRatio,
    physicsConfig,
    bounds,
  ) {
    const basePower = this.#rod.getPower() + this.#reel.getPower();
    const totalPower = basePower * this.#buffs.getTotalMultiplier();

    const maxPenalty = physicsConfig.edgePullPenalty || 0.0;
    const rodComp = this.#rod.getCompensation();
    const effectivePenalty = maxPenalty * screenOffsetRatio * (1 - rodComp);
    const penaltyMultiplier = Math.max(0.1, 1.0 - effectivePenalty);

    const effectivePower = totalPower * penaltyMultiplier;

    this.#pullDirScratch
      .set(rodVirtualPos.x - floatX, rodVirtualPos.y - floatY)
      .normalize();

    this.#playerForceResult.set(0, 0);
    this.#playerForceResult.x =
      this.#pullDirScratch.x * inputDirection.y * effectivePower;
    this.#playerForceResult.y =
      this.#pullDirScratch.y * inputDirection.y * effectivePower;

    const distRatio = Math.max(
      0,
      Math.min(1.0, (floatY - bounds.top) / (bounds.bottom - bounds.top)),
    );
    const xRange = physicsConfig.distanceXMultiplier || [1.0, 1.0];
    const depthScaleX = xRange[0] + distRatio * (xRange[1] - xRange[0]);

    this.#playerForceResult.x +=
      inputDirection.x *
      totalPower *
      physicsConfig.playerSteeringMultiplier *
      depthScaleX;

    return this.#playerForceResult;
  }

  calculateFishForce(dt, floatPos, bounds, staminaMechanicsConfig, checkWater) {
    const floatX = floatPos.x;
    const floatY = floatPos.y;
    const centerX = (bounds.left + bounds.right) / 2;
    const halfWidth = (bounds.right - bounds.left) / 2;

    let rawPenalty = Math.abs(floatX - centerX) / (halfWidth || 1);
    let spatialPenalty = Math.max(
      0,
      (rawPenalty - staminaMechanicsConfig.centerSweetSpot) /
        (1 - staminaMechanicsConfig.centerSweetSpot),
    );
    spatialPenalty = Math.min(1, spatialPenalty);

    const basePower = this.#fish.getPower();
    const behavior = this.#fish.getBehavior(dt);

    const isAtLeftWall =
      floatX <= bounds.left + 5 ||
      (checkWater && !checkWater(floatX - 10, floatY));
    const isAtRightWall =
      floatX >= bounds.right - 5 ||
      (checkWater && !checkWater(floatX + 10, floatY));

    if (isAtLeftWall && behavior.moveX < 0) this.#fish.reactToWall(-1);
    else if (isAtRightWall && behavior.moveX > 0) this.#fish.reactToWall(1);

    const finalBehavior = this.#fish.getBehavior(0);
    this.#lastFishState = finalBehavior.name;
    this.#lastFishBasePower = basePower;
    this.#lastPullMult = finalBehavior.pullMult;
    this.#lastMoveMult = Math.abs(finalBehavior.moveX);

    if (this.#holdConfig) {
      if (this.#manualCooldownTimer > 0) this.#manualCooldownTimer -= dt;

      for (let i = this.#holdRestoreTimers.length - 1; i >= 0; i--) {
        this.#holdRestoreTimers[i] -= dt;
        if (this.#holdRestoreTimers[i] <= 0) {
          this.#holdRestoreTimers.splice(i, 1);
          if (this.#currentHoldCharges < this.#maxHoldCharges) {
            this.#currentHoldCharges++;
          }
        }
      }

      if (this.#isHoldActive) {
        const fishPower = basePower * finalBehavior.pullMult;
        const playerForceMult =
          typeof CONFIG !== "undefined" && CONFIG.physics
            ? CONFIG.physics.playerForceMultiplier
            : 1;
        const fishForceMult =
          typeof CONFIG !== "undefined" && CONFIG.physics
            ? CONFIG.physics.fishForceMultiplier
            : 0.01;

        const reelForce = this.#holdConfig.totalHoldForce * playerForceMult;
        const fishForceScaled = fishPower * fishForceMult;

        let breakChancePerSec = 0;
        const stateName = finalBehavior.name;

        if (stateName === "dash" || stateName === "lastDash") {
          if (fishForceScaled > reelForce * 2) {
            breakChancePerSec = 100.0;
          } else if (fishForceScaled > reelForce) {
            breakChancePerSec = 0.5;
          }
        } else {
          if (fishForceScaled > reelForce) {
            breakChancePerSec = 0.01;
          }
        }

        if (breakChancePerSec > 0) {
          const chanceThisFrame = breakChancePerSec * (dt / 1000);

          if (Math.random() <= chanceThisFrame) {
            this.#breakHold();

            if (window.DEBUG_MODULES && window.DEBUG_MODULES.forces) {
              console.log(
                "%c====================================",
                "color: #ff0055;",
              );
              console.log(
                "💥 %cБЛОК ПРОБИТО!",
                "color: #ff0055; font-size: 14px; font-weight: bold;",
              );
              console.log(
                `%c🎣 Опір котушки (Scaled): ${reelForce.toFixed(4)}`,
                "color: #00ff80;",
              );
              console.log(
                `%c🦈 Сила удару риби (Scaled): ${fishForceScaled.toFixed(4)}`,
                "color: #ff4444;",
              );
              console.log(
                `%c📊 Стан: [${stateName.toUpperCase()}] | Базовий шанс: ${breakChancePerSec}%/сек`,
                "color: #ffaa00;",
              );
              console.log(
                "%c====================================",
                "color: #ff0055;",
              );
            }
          }
        }
      }
    }

    this.#fishForceResult.set(0, 0);
    this.#fishForceResult.y = -basePower * finalBehavior.pullMult;

    const pushDirection = Math.sign(floatX - centerX);
    let escapeForceX = 0;

    const isSwimmingToCenter =
      Math.sign(finalBehavior.moveX) === -pushDirection &&
      finalBehavior.moveX !== 0;

    if (!isSwimmingToCenter) {
      escapeForceX =
        pushDirection *
        spatialPenalty *
        finalBehavior.edgePowerMultiplier *
        basePower;
    }

    this.#fishForceResult.x = finalBehavior.moveX * basePower + escapeForceX;

    const distRatio = Math.max(
      0,
      Math.min(1.0, (floatY - bounds.top) / (bounds.bottom - bounds.top)),
    );
    const xRange =
      typeof CONFIG !== "undefined" && CONFIG.physics?.distanceXMultiplier
        ? CONFIG.physics.distanceXMultiplier
        : [1.0, 1.0];
    const depthScaleX = xRange[0] + distRatio * (xRange[1] - xRange[0]);

    this.#fishForceResult.x *= depthScaleX;

    return this.#fishForceResult;
  }
}

class TensionMeter {
  #slackTimer;
  #tension;
  #targetTension;
  #pulsePhase;
  #currentColor;
  #currentStatusLabel;
  #currentStatusColor;
  #lastCalculatedTension;
  #lineBreakTimer;
  #isBroken;
  #breakReason;
  #highestTierRolled;
  #equipmentLevelSum;
  #maxBreakTime;
  #hookPower;
  #hookCheckTimer;
  #holdFloorTension = 0;
  #isHoldCurrentlyActive = false;
  #pumpGraceTimer = 0;

  constructor(rodLevel, reelLevel, hook, tensionConfig) {
    this.#tension = 0;
    this.#targetTension = 0;
    this.#pulsePhase = 0;
    this.#currentColor = "rgb(0, 0, 255)";
    this.#currentStatusLabel = "Idle";
    this.#currentStatusColor = "#4a5b6c";
    this.#lastCalculatedTension = -1;
    this.#lineBreakTimer = 0;
    this.#isBroken = false;
    this.#breakReason = null;
    this.#highestTierRolled = 0;

    this.#equipmentLevelSum = rodLevel + reelLevel;
    this.#maxBreakTime =
      tensionConfig.baseBreakTime +
      this.#equipmentLevelSum * tensionConfig.timePerEquipmentLevel;

    this.#hookPower = hook.getPower();
    this.#hookCheckTimer = 0;
    this.#slackTimer = 0;
  }

  updateEquipment(rodLevel, reelLevel, hook, tensionConfig) {
    this.#equipmentLevelSum = rodLevel + reelLevel;
    this.#maxBreakTime =
      tensionConfig.baseBreakTime +
      this.#equipmentLevelSum * tensionConfig.timePerEquipmentLevel;
    this.#hookPower = hook.getPower();
  }

  update(
    isPulling,
    playerMaxPower,
    fishPowerMag,
    reelPower,
    fishMaxForceScaled,
    dt,
    tensionConfig,
    hookMechanicsConfig,
    isHoldActive = false,
  ) {
    if (this.#isBroken) return;

    if (isHoldActive && !this.#isHoldCurrentlyActive) {
      this.#holdFloorTension = this.#targetTension;
    } else if (!isHoldActive) {
      this.#holdFloorTension = 0;
    }
    this.#isHoldCurrentlyActive = isHoldActive;

    const powerRatio = fishPowerMag / Math.max(0.001, playerMaxPower);
    const speedMultiplier = Math.pow(powerRatio, 2);
    const baseForce = playerMaxPower + fishPowerMag;

    let forceBalance = baseForce * speedMultiplier;

    if (!isPulling) {
      const recoveryBonus =
        1 + reelPower * (tensionConfig.reelRecoveryMultiplier || 0);
      forceBalance = -(forceBalance * recoveryBonus);
    }

    const tensionChange = forceBalance * tensionConfig.sensitivityMultiplier;

    let calculatedTarget = Math.max(
      0,
      Math.min(100, this.#targetTension + tensionChange),
    );

    if (this.#pumpGraceTimer > 0) {
      this.#pumpGraceTimer -= dt;
    }

    if (isHoldActive) {
      if (
        tensionChange > 0 &&
        calculatedTarget > this.#holdFloorTension &&
        this.#pumpGraceTimer <= 0
      ) {
        this.#holdFloorTension = calculatedTarget;
      }

      if (calculatedTarget < this.#holdFloorTension) {
        calculatedTarget = this.#holdFloorTension;
      }
    }

    this.#targetTension = calculatedTarget;

    let nextTension =
      this.#tension +
      (this.#targetTension - this.#tension) * tensionConfig.smoothApproach;

    if (isHoldActive && nextTension < this.#holdFloorTension) {
      nextTension = this.#holdFloorTension;
    }

    this.#tension = nextTension;

    if (this.#tension <= 0.1) {
      this.#slackTimer += dt;
    } else {
      this.#slackTimer = 0;
    }

    this.#pulsePhase +=
      Math.max(
        1,
        tensionConfig.pulseSpeedMax -
          this.#tension / tensionConfig.pulseTensionDivisor,
      ) * tensionConfig.pulseSpeedBaseMultiplier;
    if (this.#pulsePhase > Math.PI * 2) this.#pulsePhase -= Math.PI * 2;

    if (this.#tension >= tensionConfig.breakThreshold - 0.1) {
      this.#lineBreakTimer += dt;
      this.#evaluateBreakRisk();
    } else {
      this.#lineBreakTimer = Math.max(0, this.#lineBreakTimer - dt * 3);
      if (this.#lineBreakTimer === 0) {
        this.#highestTierRolled = 0;
      }
    }

    this.#hookCheckTimer += dt;
    if (this.#hookCheckTimer >= hookMechanicsConfig.checkIntervalMs) {
      this.#hookCheckTimer = 0;
      this.#evaluateHookRisk(fishMaxForceScaled, hookMechanicsConfig);
    }

    const intTension = Math.round(this.#tension);
    if (intTension !== this.#lastCalculatedTension) {
      this.#updateVisualStates(intTension, tensionConfig);
      this.#lastCalculatedTension = intTension;
    }
  }

  #evaluateHookRisk(fishMaxForceScaled, hookMechanicsConfig) {
    let chance = 0;
    let isSlackPenalty = false;

    const currentFishPower = fishMaxForceScaled;
    const isFishDominant = currentFishPower > this.#hookPower;

    const currentThreshold = isFishDominant
      ? hookMechanicsConfig.safeTensionThreshold
      : hookMechanicsConfig.safeTensionThresholdWeakFish;

    const isDebugTension =
      typeof window.DEBUG_MODULES !== "undefined" &&
      window.DEBUG_MODULES.tension;

    if (this.#slackTimer >= hookMechanicsConfig.slackLinePenaltyTimeMs) {
      chance = hookMechanicsConfig.slackLineEscapeChance;
      isSlackPenalty = true;

      if (isDebugTension) {
        console.log(
          `%c[Гачок] ⚠️ ПРОБЛЕМА: Ліска провисла! Таймер: ${(this.#slackTimer / 1000).toFixed(1)}с. Шанс сходу: ${(chance * 100).toFixed(1)}%`,
          "color: #ffaa00;",
        );
      }
    } else if (this.#tension > currentThreshold) {
      const tensionAboveSafe = this.#tension - currentThreshold;
      const steps = Math.floor(tensionAboveSafe / 10);

      chance =
        hookMechanicsConfig.baseEscapeChance +
        steps * hookMechanicsConfig.chancePer10Tension;

      if (isFishDominant) {
        if (currentFishPower >= this.#hookPower * 2) {
          chance *=
            hookMechanicsConfig.fishDominanceMultiplier +
            hookMechanicsConfig.extremeDominanceBonus;
        } else {
          chance *= hookMechanicsConfig.fishDominanceMultiplier;
        }
      }

      if (isDebugTension) {
        console.log(
          `%c[Гачок] 🔥 НЕБЕЗПЕКА: Натяг ${this.#tension.toFixed(1)}% (Межа: ${currentThreshold}%). Шанс: ${(chance * 100).toFixed(1)}% | Гачок: ${this.#hookPower.toFixed(3)} vs Риба: ${currentFishPower.toFixed(3)}`,
          "color: #ff4444;",
        );
      }
    }

    if (chance > 0 && Math.random() <= chance) {
      this.#isBroken = true;
      this.#breakReason = "hook";

      if (isDebugTension) {
        console.log(
          "%c====================================",
          "color: #ff4444;",
        );
        console.log(
          "%c🎣 ЗРИВ ГАЧКА!",
          "color: #ff4444; font-size: 14px; font-weight: bold;",
        );
        console.log(
          `%cПричина: ${isSlackPenalty ? "Провисання ліски (>10с)" : "Перетягування"}`,
          "color: #ffaa00;",
        );
        console.log(`%cНатяг: ${this.#tension.toFixed(1)}%`, "color: #e6e6e6;");
        console.log(`%cШанс: ${(chance * 100).toFixed(1)}%`, "color: #e6e6e6;");
        console.log(
          `%cСила Риби в цей момент: ${currentFishPower.toFixed(3)}`,
          "color: #ff4444;",
        );
        console.log(
          `%cСила Гачка: ${this.#hookPower.toFixed(3)}`,
          "color: #00ccff;",
        );
        console.log(
          "%c====================================",
          "color: #ff4444;",
        );
      }
    }
  }

  #evaluateBreakRisk() {
    const progress = this.#lineBreakTimer / this.#maxBreakTime;
    let currentTier = 0;

    if (progress >= 1.0) currentTier = 5;
    else if (progress >= 0.6) currentTier = 4;
    else if (progress >= 0.4) currentTier = 3;
    else if (progress >= 0.2) currentTier = 2;
    else if (progress > 0) currentTier = 1;

    if (currentTier > this.#highestTierRolled && !this.#isBroken) {
      this.#highestTierRolled = currentTier;
      this.#rollForBreak(currentTier);
    }
  }

  #rollForBreak(tier) {
    let breakChance = 0;
    let rodBreakChance = 0;

    if (tier === 1) breakChance = 0.2;
    else if (tier === 2) breakChance = 0.4;
    else if (tier === 3) breakChance = 0.6;
    else if (tier === 4) {
      breakChance = 0.8;
      rodBreakChance = 0.2;
    } else if (tier === 5) {
      breakChance = 1.0;
      rodBreakChance = 0.5;
    }

    if (Math.random() <= breakChance) {
      this.#isBroken = true;
      if (Math.random() <= rodBreakChance) {
        this.#breakReason = "rod";
      } else {
        this.#breakReason = "line";
      }
    }
  }

  #updateVisualStates(tension, tensionConfig) {
    let status = tensionConfig.statuses[0];
    for (let i = tensionConfig.statuses.length - 1; i >= 0; i--) {
      if (tension >= tensionConfig.statuses[i].threshold) {
        status = tensionConfig.statuses[i];
        break;
      }
    }
    this.#currentStatusLabel = status.label;
    this.#currentStatusColor = status.color;

    const gradient = tensionConfig.colorGradient;
    let r, g, b;

    if (tension < gradient.breakpoints.low) {
      const ratio = tension / gradient.breakpoints.low;
      r = Math.round(
        gradient.low.start[0] +
          (gradient.low.end[0] - gradient.low.start[0]) * ratio,
      );
      g = Math.round(
        gradient.low.start[1] +
          (gradient.low.end[1] - gradient.low.start[1]) * ratio,
      );
      b = Math.round(
        gradient.low.start[2] +
          (gradient.low.end[2] - gradient.low.start[2]) * ratio,
      );
    } else if (tension < gradient.breakpoints.mid) {
      const ratio =
        (tension - gradient.breakpoints.low) /
        (gradient.breakpoints.mid - gradient.breakpoints.low);
      r = Math.round(
        gradient.mid.start[0] +
          (gradient.mid.end[0] - gradient.mid.start[0]) * ratio,
      );
      g = Math.round(
        gradient.mid.start[1] +
          (gradient.mid.end[1] - gradient.mid.start[1]) * ratio,
      );
      b = Math.round(
        gradient.mid.start[2] +
          (gradient.mid.end[2] - gradient.mid.start[2]) * ratio,
      );
    } else {
      const ratio =
        (tension - gradient.breakpoints.mid) / (100 - gradient.breakpoints.mid);
      r = Math.round(
        gradient.high.start[0] +
          (gradient.high.end[0] - gradient.high.start[0]) * ratio,
      );
      g = Math.round(
        gradient.high.start[1] +
          (gradient.high.end[1] - gradient.high.start[1]) * ratio,
      );
      b = Math.round(
        gradient.high.start[2] +
          (gradient.high.end[2] - gradient.high.start[2]) * ratio,
      );
    }

    this.#currentColor = `rgb(${r}, ${g}, ${b})`;
  }

  // ДОДАНО: Механіка Підтяжки (опускаємо "підлогу" блокування)
  applyPump(percentAmount) {
    if (this.#isBroken || !this.#isHoldCurrentlyActive) return;

    this.#holdFloorTension = Math.max(
      0,
      this.#holdFloorTension - percentAmount,
    );

    this.#pumpGraceTimer = 500;

    if (window.DEBUG_MODULES && window.DEBUG_MODULES.tension) {
      console.log(
        `%c[Натяг] Підлога знижена до ${this.#holdFloorTension.toFixed(1)}%`,
        "color: #00ccff;",
      );
    }
  }

  getCurrentColor() {
    return this.#currentColor;
  }
  getCurrentStatusLabel() {
    return this.#currentStatusLabel;
  }
  getCurrentStatusColor() {
    return this.#currentStatusColor;
  }
  getTension() {
    return this.#tension;
  }
  getLineBreakProgress() {
    return this.#lineBreakTimer / this.#maxBreakTime;
  }
  isBroken() {
    return this.#isBroken;
  }
  getBreakReason() {
    return this.#breakReason;
  }

  getPulseIntensity(tensionConfig) {
    return (
      1 -
      tensionConfig.pulseMagnitude +
      Math.sin(this.#pulsePhase) * tensionConfig.pulseMagnitude
    );
  }

  reset() {
    this.#tension = 0;
    this.#targetTension = 0;
    this.#pulsePhase = 0;
    this.#lineBreakTimer = 0;
    this.#isBroken = false;
    this.#breakReason = null;
    this.#highestTierRolled = 0;
    this.#lastCalculatedTension = -1;
    this.#hookCheckTimer = 0;
    this.#slackTimer = 0;
  }
}

class StaminaController {
  #condition;
  #mechanicsConfig;
  #playerBasePower;
  #fish;
  #masteryTimer = 0;
  #isMasteryActive = false;
  #isFullyRecovered = false;

  constructor(condition, fish, playerBasePower, mechanicsConfig) {
    this.#condition = condition;
    this.#fish = fish;
    this.#playerBasePower = playerBasePower;
    this.#mechanicsConfig = mechanicsConfig;
  }

  updatePlayerPower(newPower) {
    this.#playerBasePower = newPower;
  }

  getMasteryTimer() {
    return this.#masteryTimer;
  }

  isMasteryActive() {
    return this.#isMasteryActive;
  }

  getExhaustionDurationMs() {
    if (!this.#fish) return 1000;
    const idealDps =
      this.#mechanicsConfig.baseDepletionRate * this.#playerBasePower;
    const idealTimeSec = this.#condition.maxPoints / Math.max(1, idealDps);
    return idealTimeSec * this.#fish.getInitialPower() * 1000;
  }

  evaluate(tension, playerPowerIsPulling, dt, floatX, bounds) {
    const timeScale = dt / 1000;
    const centerX = (bounds.left + bounds.right) / 2;
    const halfWidth = (bounds.right - bounds.left) / 2;
    let rawPenalty = Math.abs(floatX - centerX) / (halfWidth || 1);
    let spatialPenalty = Math.max(
      0,
      (rawPenalty - this.#mechanicsConfig.centerSweetSpot) /
        (1 - this.#mechanicsConfig.centerSweetSpot),
    );
    spatialPenalty = Math.min(1, spatialPenalty);

    if (this.#condition.phase === "exhaustion") {
      if (
        spatialPenalty > 0 ||
        tension > this.#mechanicsConfig.exhaustionOptimalMax
      ) {
        this.#condition.breakExhaustion();
        return;
      }
      if (!playerPowerIsPulling) return;

      const idealDps =
        this.#mechanicsConfig.baseDepletionRate * this.#playerBasePower;
      const idealTimeSec = this.#condition.maxPoints / Math.max(1, idealDps);
      const exhaustionDurationSec = idealTimeSec * this.#fish.getInitialPower();
      const exhaustionDurationMs = exhaustionDurationSec * 1000;

      if (this.#condition.currentExhaustion <= 0 && spatialPenalty === 0) {
        const masteryRatio = this.#mechanicsConfig.masteryTimeRatio ?? 0.5;
        const targetPhaseTimeMs = exhaustionDurationMs * masteryRatio;

        this.#masteryTimer += dt;

        if (this.#masteryTimer > targetPhaseTimeMs) {
          this.#isMasteryActive = true;

          const drainElapsed = this.#masteryTimer - targetPhaseTimeMs;
          const drainProgress = Math.min(1, drainElapsed / targetPhaseTimeMs);

          const maxDebuffDrop =
            this.#mechanicsConfig.masteryPowerMultiplier ?? 0.2;

          const currentMult = 1.0 - maxDebuffDrop * drainProgress;

          this.#fish.setMasteryMultiplier(currentMult);
        } else {
          this.#fish.setMasteryMultiplier(1.0);
        }
      } else {
        this.#masteryTimer = 0;
        if (this.#isMasteryActive) {
          this.#isMasteryActive = false;
          this.#fish.clearMasteryDebuff();
        }
      }

      if (this.#condition.currentExhaustion > 0) {
        const pointsPerSec = this.#condition.maxPoints / exhaustionDurationSec;
        const damage = pointsPerSec * timeScale;
        const debuff = this.#mechanicsConfig.basePowerDropPerSec * timeScale;

        if (this.#condition.currentExhaustion <= damage) {
          const ratio = this.#condition.currentExhaustion / damage;
          this.#condition.applyExhaustionDamage(
            this.#condition.currentExhaustion,
          );
          this.#fish.applyPowerDebuff(debuff * ratio);

          if (!this.#fish.hasActiveDebuff) {
            this.#fish.applyRandomDebuff(this.#mechanicsConfig.debuffs);
          }
        } else {
          this.#condition.applyExhaustionDamage(damage);
          this.#fish.applyPowerDebuff(debuff);
        }
      }
      return;
    }

    if (this.#condition.phase === "stamina") {
      const regenMult =
        this.#condition.currentExhaustion > 0
          ? this.#mechanicsConfig.regenMultiplierPhase1 || 1.5
          : 1.0;

      if (spatialPenalty > 0) {
        this.#condition.applyStaminaRegen(
          this.#mechanicsConfig.edgeRegenRate *
            spatialPenalty *
            timeScale *
            regenMult,
        );
      }

      if (!playerPowerIsPulling) {
        const regenFactor = Math.max(0, 1 - tension / 100);
        this.#condition.applyStaminaRegen(
          this.#mechanicsConfig.baseRegenRate *
            regenFactor *
            timeScale *
            regenMult,
        );
      } else if (tension <= this.#mechanicsConfig.optimalMax) {
        const efficiency = Math.max(
          0,
          1 - tension / this.#mechanicsConfig.optimalMax,
        );
        const damage =
          this.#mechanicsConfig.baseDepletionRate *
          efficiency *
          this.#playerBasePower *
          timeScale *
          (1 - spatialPenalty);
        this.#condition.applyStaminaDamage(damage);
      }

      if (this.#condition.currentStamina >= this.#condition.maxPoints) {
        if (!this.#isFullyRecovered) {
          this.#isFullyRecovered = true;

          const punishmentCap = this.#mechanicsConfig.punishmentCap || 0.8;

          this.#condition.applyPunishment(punishmentCap);

          if (this.#fish.hasActiveDebuff) {
            this.#fish.clearDebuff();
          }

          const idealDps =
            this.#mechanicsConfig.baseDepletionRate * this.#playerBasePower;
          const idealTimeSec =
            this.#condition.maxPoints / Math.max(1, idealDps);
          const exhaustionDurationSec =
            idealTimeSec * this.#fish.getInitialPower();
          const maxPowerDropPerSec = this.#mechanicsConfig.basePowerDropPerSec;

          this.#fish.setPowerDebuffByExhaustionRatio(
            punishmentCap,
            maxPowerDropPerSec,
            exhaustionDurationSec,
          );

          console.log(
            `[STAMINA] Риба відновила сили! Виснаження ${punishmentCap * 100}%, сила синхронізована.`,
          );
        }
      } else {
        this.#isFullyRecovered = false;
      }
    }
  }
}

class BuffManager {
  #activeBuffs;

  constructor() {
    this.#activeBuffs = [];
  }

  addBuff(multiplier, duration) {
    this.#activeBuffs.push({ multiplier, expires: Date.now() + duration });
  }

  getTotalMultiplier() {
    const now = Date.now();
    this.#activeBuffs = this.#activeBuffs.filter((b) => b.expires > now);
    return this.#activeBuffs.reduce((acc, curr) => acc * curr.multiplier, 1.0);
  }
}

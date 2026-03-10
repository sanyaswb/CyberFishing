class FishingSystem {
    #rod;
    #reel;
    #buffs;
    #fish;

    #lastFishState = 'unknown';
    #lastFishBasePower = 0;
    #lastPullMult = 0;
    #lastMoveMult = 0;

    constructor(rod, reel, fish) {
        this.#rod = rod;
        this.#reel = reel;
        this.#buffs = new BuffManager();
        this.#fish = fish;
    }

    triggerFishLastDash() {
        if (this.#fish && typeof this.#fish.triggerLastDash === 'function') {
            this.#fish.triggerLastDash();
        }
    }

    tryTriggerFishLastDash(dt) {
        if (this.#fish && typeof this.#fish.tryTriggerLastDash === 'function') {
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
        return this.#fish && typeof this.#fish.getInitialPower === 'function' ? this.#fish.getInitialPower() : 0;
    }

    getPullMultiplier() {
        return this.#lastPullMult;
    }

    getMoveMultiplier() {
        return this.#lastMoveMult;
    }

    getActiveDebuffName() { 
        return this.#fish ? this.#fish.activeDebuffName : 'Немає'; 
    }
    
    getMasteryMultiplier() { 
        return this.#fish ? this.#fish.getMasteryMultiplier() : 1.0; 
    }

    calculatePlayerForce(inputDirection, floatX, floatY, rodVirtualPos, screenOffsetRatio, config) {
        const basePower = this.#rod.getPower() + this.#reel.getPower();
        const totalPower = basePower * this.#buffs.getTotalMultiplier();
        
        const maxPenalty = config.physics.edgePullPenalty || 0.0;
        const rodComp = this.#rod.getCompensation();
        const effectivePenalty = maxPenalty * screenOffsetRatio * (1 - rodComp);
        const penaltyMultiplier = Math.max(0.1, 1.0 - effectivePenalty);
        
        const effectivePower = totalPower * penaltyMultiplier;
        
        const pullDir = new Vector2(rodVirtualPos.x - floatX, rodVirtualPos.y - floatY).normalize();
        
        let force = new Vector2(0, 0);
        force.x = pullDir.x * inputDirection.y * effectivePower;
        force.y = pullDir.y * inputDirection.y * effectivePower;

        force.x += inputDirection.x * totalPower * config.physics.playerSteeringMultiplier;
        
        return force;
    }

    calculateFishForce(dt, floatPos, bounds, config, checkWater) {
        const floatX = floatPos.x;
        const floatY = floatPos.y;
        const centerX = (bounds.left + bounds.right) / 2;
        const halfWidth = (bounds.right - bounds.left) / 2;
        let rawPenalty = Math.abs(floatX - centerX) / (halfWidth || 1);
        let spatialPenalty = Math.max(0, (rawPenalty - config.stamina.mechanics.centerSweetSpot) / (1 - config.stamina.mechanics.centerSweetSpot));
        spatialPenalty = Math.min(1, spatialPenalty);

        const basePower = this.#fish.getPower();
        const behavior = this.#fish.getBehavior(dt);
        
        const isAtLeftWall = floatX <= bounds.left + 5 || (checkWater && !checkWater(floatX - 10, floatY));
        const isAtRightWall = floatX >= bounds.right - 5 || (checkWater && !checkWater(floatX + 10, floatY));

        if (isAtLeftWall && behavior.moveX < 0) {
            this.#fish.reactToWall(-1);
        } else if (isAtRightWall && behavior.moveX > 0) {
            this.#fish.reactToWall(1);
        }
        
        const finalBehavior = this.#fish.getBehavior(0); 

        this.#lastFishState = finalBehavior.name;
        this.#lastFishBasePower = basePower;
        this.#lastPullMult = finalBehavior.pullMult;
        this.#lastMoveMult = Math.abs(finalBehavior.moveX);

        let force = new Vector2(0, 0);
        force.y = -basePower * finalBehavior.pullMult;
        
        const pushDirection = Math.sign(floatX - centerX);
        let escapeForceX = 0;
        
        const isSwimmingToCenter = Math.sign(finalBehavior.moveX) === -pushDirection && finalBehavior.moveX !== 0;
        
        if (!isSwimmingToCenter) {
            escapeForceX = pushDirection * spatialPenalty * finalBehavior.edgePowerMultiplier * basePower;
        }
        
        force.x = (finalBehavior.moveX * basePower) + escapeForceX;
        
        return force;
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

    constructor(rodLevel, reelLevel, hook, config) {
        this.#tension = 0;
        this.#targetTension = 0;
        this.#pulsePhase = 0;
        this.#currentColor = 'rgb(0, 0, 255)';
        this.#currentStatusLabel = 'Idle';
        this.#currentStatusColor = '#4a5b6c';
        this.#lastCalculatedTension = -1;
        this.#lineBreakTimer = 0;
        this.#isBroken = false;
        this.#breakReason = null;
        this.#highestTierRolled = 0;
        
        this.#equipmentLevelSum = rodLevel + reelLevel;
        this.#maxBreakTime = config.tension.baseBreakTime + (this.#equipmentLevelSum * config.tension.timePerEquipmentLevel);
        
        this.#hookPower = hook.getPower();
        this.#hookCheckTimer = 0;
        this.#slackTimer = 0;
    }

    update(isPulling, playerMaxPower, fishPowerMag, reelPower, fishMaxForceScaled, dt, config) { 
        if (this.#isBroken) return;

        const powerRatio = fishPowerMag / Math.max(0.001, playerMaxPower);
        const speedMultiplier = Math.pow(powerRatio, 2);
        const baseForce = playerMaxPower + fishPowerMag;

        let forceBalance = baseForce * speedMultiplier;
        
        if (!isPulling) {
            const recoveryBonus = 1 + (reelPower * (config.tension.reelRecoveryMultiplier || 0));
            forceBalance = -(forceBalance * recoveryBonus);
        }

        const tensionChange = forceBalance * config.tension.sensitivityMultiplier;

        this.#targetTension = Math.max(0, Math.min(100, this.#targetTension + tensionChange));
        this.#tension += (this.#targetTension - this.#tension) * config.tension.smoothApproach;

        if (this.#tension <= 0.1) {
            this.#slackTimer += dt;
        } else {
            this.#slackTimer = 0; // Як тільки натягнули ліску - скидаємо таймер
        }

        this.#pulsePhase += Math.max(1, config.tension.pulseSpeedMax - (this.#tension / config.tension.pulseTensionDivisor)) * config.tension.pulseSpeedBaseMultiplier;
        if (this.#pulsePhase > Math.PI * 2) this.#pulsePhase -= Math.PI * 2;
        if (this.#tension >= config.tension.breakThreshold - 0.1) {
            this.#lineBreakTimer += dt;
            this.#evaluateBreakRisk();
        } else {
            this.#lineBreakTimer = Math.max(0, this.#lineBreakTimer - dt * 3);
            if (this.#lineBreakTimer === 0) {
                this.#highestTierRolled = 0;
            }
        }
        this.#hookCheckTimer += dt;
        if (this.#hookCheckTimer >= config.hookMechanics.checkIntervalMs) {
            this.#hookCheckTimer = 0;
            this.#evaluateHookRisk(fishMaxForceScaled, config);
        }

        const intTension = Math.round(this.#tension);
        if (intTension !== this.#lastCalculatedTension) {
            this.#updateVisualStates(intTension, config);
            this.#lastCalculatedTension = intTension;
        }
    }

    #evaluateHookRisk(fishMaxForceScaled, config) {
        let chance = 0;
        let isSlackPenalty = false;
        
        const currentFishPower = fishMaxForceScaled;
        const isFishDominant = currentFishPower > this.#hookPower;
        
        const currentThreshold = isFishDominant 
            ? config.hookMechanics.safeTensionThreshold 
            : config.hookMechanics.safeTensionThresholdWeakFish;

        const isDebugTension = typeof window.DEBUG_MODULES !== 'undefined' && window.DEBUG_MODULES.tension;

        if (this.#slackTimer >= config.hookMechanics.slackLinePenaltyTimeMs) {
            chance = config.hookMechanics.slackLineEscapeChance;
            isSlackPenalty = true;
            
            if (isDebugTension) {
                console.log(`%c[Гачок] ⚠️ ПРОБЛЕМА: Ліска провисла! Таймер: ${(this.#slackTimer/1000).toFixed(1)}с. Шанс сходу: ${(chance * 100).toFixed(1)}%`, 'color: #ffaa00;');
            }
        } else if (this.#tension > currentThreshold) {
            const tensionAboveSafe = this.#tension - currentThreshold;
            const steps = Math.floor(tensionAboveSafe / 10);
            
            chance = config.hookMechanics.baseEscapeChance + (steps * config.hookMechanics.chancePer10Tension);

            if (isFishDominant) {
                if (currentFishPower >= this.#hookPower * 2) {
                    chance *= (config.hookMechanics.fishDominanceMultiplier + config.hookMechanics.extremeDominanceBonus);
                } else {
                    chance *= config.hookMechanics.fishDominanceMultiplier;
                }
            }
            
            if (isDebugTension) {
                console.log(`%c[Гачок] 🔥 НЕБЕЗПЕКА: Натяг ${this.#tension.toFixed(1)}% (Межа: ${currentThreshold}%). Шанс: ${(chance * 100).toFixed(1)}% | Гачок: ${this.#hookPower.toFixed(3)} vs Риба: ${currentFishPower.toFixed(3)}`, 'color: #ff4444;');
            }
        }

        if (chance > 0 && Math.random() <= chance) {
            this.#isBroken = true;
            this.#breakReason = 'hook';
            
            if (isDebugTension) {
                console.log('%c====================================', 'color: #ff4444;');
                console.log('%c🎣 ЗРИВ ГАЧКА!', 'color: #ff4444; font-size: 14px; font-weight: bold;');
                console.log(`%cПричина: ${isSlackPenalty ? 'Провисання ліски (>10с)' : 'Перетягування'}`, 'color: #ffaa00;');
                console.log(`%cНатяг: ${this.#tension.toFixed(1)}%`, 'color: #e6e6e6;');
                console.log(`%cШанс: ${(chance * 100).toFixed(1)}%`, 'color: #e6e6e6;');
                console.log(`%cСила Риби в цей момент: ${currentFishPower.toFixed(3)}`, 'color: #ff4444;');
                console.log(`%cСила Гачка: ${this.#hookPower.toFixed(3)}`, 'color: #00ccff;');
                console.log('%c====================================', 'color: #ff4444;');
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

        if (tier === 1) breakChance = 0.20;
        else if (tier === 2) breakChance = 0.40;
        else if (tier === 3) breakChance = 0.60;
        else if (tier === 4) { breakChance = 0.80; rodBreakChance = 0.20; }
        else if (tier === 5) { breakChance = 1.00; rodBreakChance = 0.50; }

        if (Math.random() <= breakChance) {
            this.#isBroken = true;
            if (Math.random() <= rodBreakChance) {
                this.#breakReason = 'rod';
            } else {
                this.#breakReason = 'line';
            }
        }
    }

    #updateVisualStates(tension, config) {
        let status = config.tension.statuses[0];
        for (let i = config.tension.statuses.length - 1; i >= 0; i--) {
            if (tension >= config.tension.statuses[i].threshold) {
                status = config.tension.statuses[i];
                break;
            }
        }
        this.#currentStatusLabel = status.label;
        this.#currentStatusColor = status.color;

        const gradient = config.tension.colorGradient;
        let r, g, b;

        if (tension < gradient.breakpoints.low) {
            const ratio = tension / gradient.breakpoints.low;
            r = Math.round(gradient.low.start[0] + (gradient.low.end[0] - gradient.low.start[0]) * ratio);
            g = Math.round(gradient.low.start[1] + (gradient.low.end[1] - gradient.low.start[1]) * ratio);
            b = Math.round(gradient.low.start[2] + (gradient.low.end[2] - gradient.low.start[2]) * ratio);
        } else if (tension < gradient.breakpoints.mid) {
            const ratio = (tension - gradient.breakpoints.low) / (gradient.breakpoints.mid - gradient.breakpoints.low);
            r = Math.round(gradient.mid.start[0] + (gradient.mid.end[0] - gradient.mid.start[0]) * ratio);
            g = Math.round(gradient.mid.start[1] + (gradient.mid.end[1] - gradient.mid.start[1]) * ratio);
            b = Math.round(gradient.mid.start[2] + (gradient.mid.end[2] - gradient.mid.start[2]) * ratio);
        } else {
            const ratio = (tension - gradient.breakpoints.mid) / (100 - gradient.breakpoints.mid);
            r = Math.round(gradient.high.start[0] + (gradient.high.end[0] - gradient.high.start[0]) * ratio);
            g = Math.round(gradient.high.start[1] + (gradient.high.end[1] - gradient.high.start[1]) * ratio);
            b = Math.round(gradient.high.start[2] + (gradient.high.end[2] - gradient.high.start[2]) * ratio);
        }

        this.#currentColor = `rgb(${r}, ${g}, ${b})`;
    }

    getCurrentColor() { return this.#currentColor; }
    getCurrentStatusLabel() { return this.#currentStatusLabel; }
    getCurrentStatusColor() { return this.#currentStatusColor; }
    getTension() { return this.#tension; }
    getLineBreakProgress() { return this.#lineBreakTimer / this.#maxBreakTime; }
    isBroken() { return this.#isBroken; }
    getBreakReason() { return this.#breakReason; }

    getPulseIntensity(config) {
        return (1 - config.tension.pulseMagnitude) + Math.sin(this.#pulsePhase) * config.tension.pulseMagnitude;
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
        this.#hookCheckTimer = 0;
        this.#slackTimer = 0;
    }
}

class StaminaController {
    #condition;
    #config;
    #playerBasePower;
    #fish;
    #masteryTimer = 0;
    #isMasteryActive = false;

    constructor(condition, fish, playerBasePower, config) {
        this.#condition = condition;
        this.#fish = fish;
        this.#playerBasePower = playerBasePower;
        this.#config = config.stamina.mechanics;
    }

    getMasteryTimer() { return this.#masteryTimer; }
    isMasteryActive() { return this.#isMasteryActive; }
    
    getExhaustionDurationMs() { 
        if (!this.#fish) return 1000;
        const idealDps = this.#config.baseDepletionRate * this.#playerBasePower;
        const idealTimeSec = this.#condition.maxPoints / Math.max(1, idealDps);
        return (idealTimeSec * this.#fish.getInitialPower()) * 1000;
    }

    evaluate(tension, playerPowerIsPulling, dt, floatX, bounds) {
        const timeScale = dt / 1000;
        const centerX = (bounds.left + bounds.right) / 2;
        const halfWidth = (bounds.right - bounds.left) / 2;
        let rawPenalty = Math.abs(floatX - centerX) / (halfWidth || 1);
        let spatialPenalty = Math.max(0, (rawPenalty - this.#config.centerSweetSpot) / (1 - this.#config.centerSweetSpot));
        spatialPenalty = Math.min(1, spatialPenalty); 

        if (this.#condition.phase === 'exhaustion') {
            if (spatialPenalty > 0 || tension > this.#config.exhaustionOptimalMax) {
                this.#condition.breakExhaustion();
                return;
            }
            if (!playerPowerIsPulling) return; 

            const idealDps = this.#config.baseDepletionRate * this.#playerBasePower;
            const idealTimeSec = this.#condition.maxPoints / Math.max(1, idealDps);
            const exhaustionDurationSec = idealTimeSec * this.#fish.getInitialPower();
            const exhaustionDurationMs = exhaustionDurationSec * 1000;

            // 2. --- ДВОХЕТАПНА ЛОГІКА MASTERY ---
            if (this.#condition.currentExhaustion <= 0 && spatialPenalty === 0) {
                const masteryRatio = this.#config.masteryTimeRatio ?? 0.5;
                const targetPhaseTimeMs = exhaustionDurationMs * masteryRatio; 
                
                this.#masteryTimer += dt;
                
                if (this.#masteryTimer > targetPhaseTimeMs) {
                    // ЕТАП 2: Захват пройдено, починається плавне здавлювання (дебаф)
                    this.#isMasteryActive = true;
                    
                    const drainElapsed = this.#masteryTimer - targetPhaseTimeMs;
                    // Прогрес здавлювання (від 0 до 1) за такий самий проміжок часу
                    const drainProgress = Math.min(1, drainElapsed / targetPhaseTimeMs); 
                    
                    // Якщо конфіг 0.2, максимальне падіння це 20%
                    const maxDebuffDrop = this.#config.masteryPowerMultiplier ?? 0.2; 
                    
                    // Віднімаємо відсоток від 1.0 (наприклад, 1.0 - (0.2 * 1) = 0.8)
                    const currentMult = 1.0 - (maxDebuffDrop * drainProgress);
                    
                    this.#fish.setMasteryMultiplier(currentMult);
                } else {
                    // ЕТАП 1: Очікування (накопичення таймеру перед стартом здавлювання)
                    // Риба ще має 100% сили
                    this.#fish.setMasteryMultiplier(1.0);
                }
            } else {
                // Якщо риба вийшла з центру — все миттєво злітає
                this.#masteryTimer = 0;
                if (this.#isMasteryActive) {
                    this.#isMasteryActive = false;
                    this.#fish.clearMasteryDebuff();
                }
            }

            // 3. --- ЛОГІКА НАНЕСЕННЯ ШКОДИ В ФАЗІ 2 ---
            if (this.#condition.currentExhaustion > 0) {
                const pointsPerSec = this.#condition.maxPoints / exhaustionDurationSec;
                const damage = pointsPerSec * timeScale;
                const debuff = this.#config.basePowerDropPerSec * timeScale;
                
                if (this.#condition.currentExhaustion <= damage) {
                    const ratio = this.#condition.currentExhaustion / damage;
                    this.#condition.applyExhaustionDamage(this.#condition.currentExhaustion);
                    this.#fish.applyPowerDebuff(debuff * ratio);
                    
                    if (!this.#fish.hasActiveDebuff) {
                        this.#fish.applyRandomDebuff(this.#config.debuffs);
                    }
                } else {
                    this.#condition.applyExhaustionDamage(damage);
                    this.#fish.applyPowerDebuff(debuff);
                }
            }
            return;
        }

        if (this.#condition.phase === 'stamina') {
            const regenMult = this.#condition.currentExhaustion > 0 ? (this.#config.regenMultiplierPhase1 || 1.5) : 1.0;

            if (spatialPenalty > 0) {
                this.#condition.applyStaminaRegen(this.#config.edgeRegenRate * spatialPenalty * timeScale * regenMult);
            }

            if (!playerPowerIsPulling) {
                const regenFactor = Math.max(0, 1 - (tension / 100));
                this.#condition.applyStaminaRegen(this.#config.baseRegenRate * regenFactor * timeScale * regenMult);
            } else if (tension <= this.#config.optimalMax) {
                const efficiency = Math.max(0, 1 - (tension / this.#config.optimalMax));
                const damage = this.#config.baseDepletionRate * efficiency * this.#playerBasePower * timeScale * (1 - spatialPenalty);
                this.#condition.applyStaminaDamage(damage);
            }

            if (this.#condition.currentStamina >= this.#condition.maxPoints) {
                this.#condition.applyPunishment(this.#config.punishmentCap || 0.8);
                if (this.#fish.hasActiveDebuff) {
                    this.#fish.clearDebuff();
                }
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
        this.#activeBuffs = this.#activeBuffs.filter(b => b.expires > now);
        return this.#activeBuffs.reduce((acc, curr) => acc * curr.multiplier, 1.0);
    }
}
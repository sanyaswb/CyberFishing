class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    multiplyScalar(s) {
        this.x *= s;
        this.y *= s;
        return this;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    normalize() {
        const length = Math.hypot(this.x, this.y);
        if (length > 0) {
            this.x /= length;
            this.y /= length;
        }
        return this;
    }

    length() {
        return Math.hypot(this.x, this.y);
    }
}

class InputManager {
    #canvas;
    #isPulling;
    #pullDirection;
    #isDragging;
    #startX;
    #startY;
    #lastPointerX;
    #panDeltaX;
    #clickPos;
    #config;

    constructor(canvas, config) {
        this.#canvas = canvas;
        this.#config = config;
        this.#isPulling = false;
        this.#pullDirection = new Vector2(0, 1);
        
        this.#isDragging = false;
        this.#startX = 0;
        this.#startY = 0;
        this.#lastPointerX = 0;
        this.#panDeltaX = 0;
        this.#clickPos = null;

        this.#bindEvents();
    }

    #bindEvents() {
        this.#canvas.addEventListener('pointerdown', (e) => {
            this.#isPulling = true;
            this.#isDragging = false;
            this.#startX = e.clientX;
            this.#startY = e.clientY;
            this.#lastPointerX = e.clientX;
            this.#updateDirection(e);
        });

        this.#canvas.addEventListener('pointermove', (e) => {
            const dist = Math.hypot(e.clientX - this.#startX, e.clientY - this.#startY);
            if (dist > 5) {
                this.#isDragging = true;
            }

            if (this.#isDragging) {
                this.#panDeltaX = this.#lastPointerX - e.clientX;
                this.#lastPointerX = e.clientX;
            }
            if (this.#isPulling) {
                this.#updateDirection(e);
            }
        });

        window.addEventListener('pointerup', (e) => {
            if (!this.#isDragging) {
                this.#clickPos = { x: e.clientX, y: e.clientY };
            }
            
            this.#isPulling = false;
            this.#isDragging = false;
            this.#pullDirection = new Vector2(0, 1);
        });

        this.#canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    #updateDirection(e) {
        const rect = this.#canvas.getBoundingClientRect();
        
        let anchorX = rect.width / 2;
        if (this.#config.ui?.rod?.x && this.#config.ui.rod.x !== 'center') {
            anchorX = Number(this.#config.ui.rod.x);
        }
        
        const dx = e.clientX - rect.left - anchorX;
        const dy = rect.height / 2; 
        
        const length = Math.hypot(dx, dy);
        if (length > 0) {
            this.#pullDirection = new Vector2(dx / length, dy / length);
        }
    }

    getState() {
        const state = {
            isPulling: this.#isPulling,
            pullDirection: this.#pullDirection,
            panDeltaX: this.#panDeltaX,
            clickPos: this.#clickPos
        };
        this.#panDeltaX = 0;
        this.#clickPos = null; 
        return state;
    }
}

class Equipment {
    #level;
    #basePower;

    constructor(level, basePower) {
        this.#level = level;
        this.#basePower = basePower;
    }

    getPower() {
        return this.#level * this.#basePower;
    }
}

class Rod extends Equipment {
    #compensation;

    constructor(level, power, compensation = 0) {
        super(level, power);
        this.#compensation = compensation;
    }

    getCompensation() {
        return this.#compensation;
    }
}

class Reel extends Equipment {
    constructor(level, power) {
        super(level, power);
    }
}

class Hook {
    #level;
    #weight;
    #quality;

    constructor(level, weight, quality) {
        this.#level = level;
        this.#weight = weight;
        this.#quality = quality;
    }

    getPower() {
        return ((this.#level * this.#weight) + this.#quality) * 0.01;
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

class EventLogger {
    static async logBreakEvent(reason, tensionMeter) {
        if (typeof CONFIG === 'undefined' || !CONFIG.logs?.events) {
            return;
        }

        const data = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now(),
            timestamp: new Date().toISOString(),
            event: reason === 'rod' ? 'ROD_BROKEN' : reason === 'hook' ? 'FISH_ESCAPED' : 'LINE_BROKEN',
            location: 'Lake Whisper (Mock)',
            fish: 'Pike (Mock)',
            gameplayStats: {
                fishState: window.DEBUG_LIVE_FISH_STATE || 'unknown',
                fishCurrentBasePower: window.DEBUG_LIVE_FISH_POWER || 0,
                fishPullMultiplier: window.DEBUG_LIVE_FISH_PULL_MULT || 0,
                breakTimerProgressPercent: +(tensionMeter.getLineBreakProgress() * 100).toFixed(1)
            }
        };

        if (CONFIG.logs.endpoint) {
            try {
                const response = await fetch(CONFIG.logs.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    console.log(`[EventLogger] Event ${data.event} successfully sent to backend.`);
                }
            } catch (error) {
                console.error('[EventLogger] Failed to send event to backend.', error);
            }
        }
    }
}

class FishBehavior {
    #config;
    #currentStateName;
    #stateTimer;
    #dirTimer;
    #currentPull;
    #targetPull;
    #currentMove;
    #targetMove;
    #currentDirX;
    #targetDirX;

    constructor(config) {
        this.#config = config.fish;
        this.#currentStateName = 'swim';
        this.#stateTimer = 0;
        this.#dirTimer = 0;
        this.#currentPull = 1.0;
        this.#targetPull = 1.0;
        this.#currentMove = 0.0;
        this.#targetMove = 0.0;
        this.#currentDirX = 0;
        this.#targetDirX = 0;
        this.#pickNextState();
    }

    #pickNextState() {
        const states = this.#config.behaviors;
        const keys = Object.keys(states);
        let totalWeight = 0;
        
        for (let k of keys) {
            totalWeight += states[k].weight;
        }
        
        let r = Math.random() * totalWeight;
        for (let k of keys) {
            if (r < states[k].weight) {
                this.#currentStateName = k;
                break;
            }
            r -= states[k].weight;
        }

        const state = states[this.#currentStateName];
        this.#targetPull = state.pull;
        this.#targetMove = state.move;
        this.#stateTimer = state.minTime + Math.random() * (state.maxTime - state.minTime);
    }

    reactToWall(wallSide) {
        this.#targetDirX = wallSide === -1 ? 1 : -1;
        this.#currentDirX = this.#targetDirX;
        this.#dirTimer = this.#config.bounceCooldownMs || 2000;
        this.#stateTimer = 0;
    }

    update(dt) {
        this.#stateTimer -= dt;
        if (this.#stateTimer <= 0) {
            this.#pickNextState();
        }

        this.#dirTimer -= dt;
        if (this.#dirTimer <= 0) {
            this.#targetDirX = (Math.random() * 2) - 1;
            const minMs = this.#config.dirChangeMinMs || 500;
            const maxMs = this.#config.dirChangeMaxMs || 2000;
            this.#dirTimer = minMs + Math.random() * (maxMs - minMs);
        }

        const t = Math.min(1, (dt / 1000) * 3.0 * this.#config.agility);
        
        this.#currentPull += (this.#targetPull - this.#currentPull) * t;
        this.#currentMove += (this.#targetMove - this.#currentMove) * t;
        this.#currentDirX += (this.#targetDirX - this.#currentDirX) * t;
    }

    getStateData() {
        return {
            name: this.#currentStateName,
            pullMult: this.#currentPull,
            moveX: this.#currentMove * this.#currentDirX
        };
    }
}

class Fish {
    #level;
    #weight;
    #resistance;
    #config;
    #powerDebuff;
    #behavior;

    constructor(level, weight, resistance, config) {
        this.#level = level;
        this.#weight = weight;
        this.#resistance = resistance;
        this.#config = config;
        this.#powerDebuff = 0;
        this.#behavior = new FishBehavior(config);
    }

    getInitialPower() {
        return (this.#level * this.#weight) + this.#resistance;
    }

    getPower() {
        const initial = this.getInitialPower();
        return Math.max(0, initial - this.#powerDebuff);
    }

    applyPowerDebuff(amount) {
        this.#powerDebuff += amount;
        window.DEBUG_LIVE_FISH_POWER = this.getInitialPower() - this.#powerDebuff;
    }

    getBehavior(dt) {
        this.#behavior.update(dt);
        return this.#behavior.getStateData();
    }

    reactToWall(wallSide) {
        if (this.#behavior && typeof this.#behavior.reactToWall === 'function') {
            this.#behavior.reactToWall(wallSide);
        }
    }
}

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

    getPullMultiplier() {
        return this.#lastPullMult;
    }

    getMoveMultiplier() {
        return this.#lastMoveMult;
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

    calculateFishForce(dt, floatX, bounds, config) {
        const centerX = (bounds.left + bounds.right) / 2;
        const halfWidth = (bounds.right - bounds.left) / 2;
        let rawPenalty = Math.abs(floatX - centerX) / (halfWidth || 1);
        let spatialPenalty = Math.max(0, (rawPenalty - config.stamina.mechanics.centerSweetSpot) / (1 - config.stamina.mechanics.centerSweetSpot));
        spatialPenalty = Math.min(1, spatialPenalty);

        const basePower = this.#fish.getPower();
        const behavior = this.#fish.getBehavior(dt);
        
        const isAtLeftWall = floatX <= bounds.left + 5;
        const isAtRightWall = floatX >= bounds.right - 5;

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
            escapeForceX = pushDirection * spatialPenalty * config.fish.edgePowerMultiplier * basePower;
        }
        
        force.x = (finalBehavior.moveX * basePower) + escapeForceX;
        
        return force;
    }
}

class FloatEntity {
    #position;
    #velocity;
    #friction;

    constructor(x, y, config) {
        this.#position = new Vector2(x, y);
        this.#velocity = new Vector2(0, 0);
        this.#friction = config.float.friction;
    }

    applyForce(force) {
        this.#velocity.add(force);
    }

    update(boundsRect) {
        this.#position.add(this.#velocity);
        this.#velocity.multiplyScalar(this.#friction);

        if (this.#position.x < boundsRect.left) this.#position.x = boundsRect.left;
        if (this.#position.x > boundsRect.right) this.#position.x = boundsRect.right;
        if (this.#position.y < boundsRect.top) this.#position.y = boundsRect.top;
        if (this.#position.y > boundsRect.bottom) this.#position.y = boundsRect.bottom;
    }

    getPosition() {
        return this.#position;
    }

    setPosition(x, y) {
        this.#position.x = x;
        this.#position.y = y;
        this.#velocity = new Vector2(0, 0);
    }
}

class FishCondition {
    #maxPoints;
    #currentStamina;
    #currentExhaustion;
    #phase;

    constructor(level, weight, config) {
        this.#maxPoints = (level * weight * config.stamina.fish.baseStaminaMultiplier) + config.stamina.fish.flatBonus;
        this.#currentStamina = this.#maxPoints;
        this.#currentExhaustion = this.#maxPoints;
        this.#phase = 'stamina';
    }

    get phase() { return this.#phase; }
    get maxPoints() { return this.#maxPoints; }
    get currentStamina() { return this.#currentStamina; }
    get currentExhaustion() { return this.#currentExhaustion; }

    breakExhaustion() {
        if (this.#phase === 'exhaustion') {
            this.#phase = 'stamina';
            this.#currentStamina = this.#maxPoints * 0.05;
        }
    }

    applyStaminaDamage(amount) {
        if (this.#phase !== 'stamina') return;
        this.#currentStamina = Math.max(0, this.#currentStamina - amount);
        if (this.#currentStamina === 0) {
            this.#phase = 'exhaustion';
        }
    }

    applyStaminaRegen(amount) {
        if (this.#phase !== 'stamina') return;
        this.#currentStamina = Math.min(this.#maxPoints, this.#currentStamina + amount);
    }

    applyExhaustionDamage(amount) {
        if (this.#phase !== 'exhaustion') return;
        this.#currentExhaustion = Math.max(0, this.#currentExhaustion - amount);
    }
}

class StaminaController {
    #condition;
    #config;
    #playerBasePower;
    #fish;

    constructor(condition, fish, playerBasePower, config) {
        this.#condition = condition;
        this.#fish = fish;
        this.#playerBasePower = playerBasePower;
        this.#config = config.stamina.mechanics;
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
            if (!playerPowerIsPulling) {
                return; 
            }
            if (this.#condition.currentExhaustion > 0) {
                const idealDps = this.#config.baseDepletionRate * this.#playerBasePower;
                const idealTimeSec = this.#condition.maxPoints / Math.max(1, idealDps);
                const exhaustionDurationSec = idealTimeSec * this.#fish.getInitialPower();
                const pointsPerSec = this.#condition.maxPoints / exhaustionDurationSec;

                const damage = pointsPerSec * timeScale;
                const debuff = this.#config.basePowerDropPerSec * timeScale;
                if (this.#condition.currentExhaustion <= damage) {
                    const ratio = this.#condition.currentExhaustion / damage;
                    this.#condition.applyExhaustionDamage(this.#condition.currentExhaustion);
                    this.#fish.applyPowerDebuff(debuff * ratio);
                } else {
                    this.#condition.applyExhaustionDamage(damage);
                    this.#fish.applyPowerDebuff(debuff);
                }
            }
            return;
        }

        if (this.#condition.phase === 'stamina') {
            if (spatialPenalty > 0) {
                this.#condition.applyStaminaRegen(this.#config.edgeRegenRate * spatialPenalty * timeScale);
            }

            if (!playerPowerIsPulling) {
                const regenFactor = Math.max(0, 1 - (tension / 100));
                this.#condition.applyStaminaRegen(this.#config.baseRegenRate * regenFactor * timeScale);
            } else if (tension <= this.#config.optimalMax) {
                const efficiency = Math.max(0, 1 - (tension / this.#config.optimalMax));
                const damage = this.#config.baseDepletionRate * efficiency * this.#playerBasePower * timeScale * (1 - spatialPenalty);
                this.#condition.applyStaminaDamage(damage);
            }
        }
    }
}

class TensionMeter {
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
        if (this.#tension <= config.hookMechanics.safeTensionThreshold) return;

        const tensionAboveSafe = this.#tension - config.hookMechanics.safeTensionThreshold;
        const steps = Math.floor(tensionAboveSafe / 10);
        
        let chance = config.hookMechanics.baseEscapeChance + (steps * config.hookMechanics.chancePer10Tension);

        if (fishMaxForceScaled > this.#hookPower) {
            if (fishMaxForceScaled >= this.#hookPower * 2) {
                chance *= (config.hookMechanics.fishDominanceMultiplier + config.hookMechanics.extremeDominanceBonus);
            } else {
                chance *= config.hookMechanics.fishDominanceMultiplier;
            }
        }

        if (Math.random() <= chance) {
            this.#isBroken = true;
            this.#breakReason = 'hook';
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
    }
}

class Renderer {
    #canvas;
    #ctx;

    constructor(canvas) {
        this.#canvas = canvas;
        this.#ctx = canvas.getContext('2d', { alpha: false });
    }

    #resolveX(configValue, elementWidth = 0) {
        if (configValue === 'center') {
            return (this.#canvas.width - elementWidth) / 2;
        }
        return Number(configValue) || 0;
    }

    drawInvalidCastMarker(marker) {
        this.#ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        this.#ctx.lineWidth = 3;
        this.#ctx.beginPath();
        this.#ctx.arc(marker.x, marker.y, 15, 0, Math.PI * 2);
        this.#ctx.stroke();

        this.#ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        this.#ctx.fill();
        
        // Хрестик всередині
        this.#ctx.beginPath();
        this.#ctx.moveTo(marker.x - 8, marker.y - 8);
        this.#ctx.lineTo(marker.x + 8, marker.y + 8);
        this.#ctx.moveTo(marker.x + 8, marker.y - 8);
        this.#ctx.lineTo(marker.x - 8, marker.y + 8);
        this.#ctx.stroke();
    }

    clear(config) {
        this.#ctx.fillStyle = config.canvas.backgroundColor || '#0f171e';
        this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
    }
    
    drawBackground(locationMap, projector, config) {
        locationMap.drawBackground(this.#ctx, projector);
    }

    drawLocationDebug(locationMap, projector, config) {
        const grid = locationMap.getGrid();
        const cols = locationMap.getCols();
        const rows = locationMap.getRows();
        const cellSize = config.locations.cellSize;

        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                const cell = grid[i][j];
                const pos = projector.virtualToScreen(cell.x * cellSize, cell.y * cellSize);
                const size = cellSize * projector.getScale();

                if (cell.hasCollision) {
                    this.#ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
                } else if (cell.hasSnag) {
                    this.#ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                } else if (cell.isCastable) {
                    this.#ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
                } else {
                    this.#ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                    this.#ctx.strokeRect(pos.x, pos.y, size, size);
                    continue; 
                }
                
                this.#ctx.fillRect(pos.x, pos.y, size, size);
                this.#ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                this.#ctx.strokeRect(pos.x, pos.y, size, size);
            }
        }

        const dynamicZones = locationMap.getDynamicZones();
        for (const dz of dynamicZones) {
            const pos = projector.virtualToScreen(dz.x * cellSize, dz.y * cellSize);
            const w = dz.w * cellSize * projector.getScale();
            const h = dz.h * cellSize * projector.getScale();
            
            this.#ctx.fillStyle = 'rgba(0, 150, 255, 0.5)';
            this.#ctx.fillRect(pos.x, pos.y, w, h);
            this.#ctx.strokeStyle = '#00ffff';
            this.#ctx.lineWidth = 2;
            this.#ctx.strokeRect(pos.x, pos.y, w, h);
        }
    }

    drawCatchZone(locationMap, projector, config) {
        const bounds = locationMap.getCastableBoundsVirtual(config.locations.cellSize);
        const virtualBottomY = bounds ? bounds.bottom : Infinity;
        const mapBottomScreenY = projector.virtualToScreen(0, virtualBottomY).y;

        const catchLineY = Math.min(mapBottomScreenY, this.#canvas.height);
        const heightToDraw = this.#canvas.height - catchLineY;

        if (heightToDraw > 0) {
            this.#ctx.fillStyle = config.ui?.catchZone?.color || 'rgba(0, 150, 255, 0.3)';
            this.#ctx.fillRect(0, catchLineY, this.#canvas.width, heightToDraw);
        }

        const lineDrawY = Math.min(catchLineY, this.#canvas.height - 2); 
        this.#ctx.strokeStyle = 'rgba(0, 200, 255, 0.8)';
        this.#ctx.lineWidth = 2;
        this.#ctx.beginPath();
        this.#ctx.moveTo(0, lineDrawY);
        this.#ctx.lineTo(this.#canvas.width, lineDrawY);
        this.#ctx.stroke();

        if (config.net && config.net.active) {
            const netBonusPx = config.net.length * 10;
            const netLineY = catchLineY - netBonusPx;
            
            this.#ctx.strokeStyle = 'rgba(0, 255, 128, 0.5)';
            this.#ctx.lineWidth = 1;
            this.#ctx.setLineDash([10, 10]);
            this.#ctx.beginPath();
            this.#ctx.moveTo(0, netLineY);
            this.#ctx.lineTo(this.#canvas.width, netLineY);
            this.#ctx.stroke();
            this.#ctx.setLineDash([]);
            
            this.#ctx.fillStyle = 'rgba(0, 255, 128, 0.05)';
            this.#ctx.fillRect(0, netLineY, this.#canvas.width, netBonusPx);
        }
    }

    drawFloat(position, config) {
        this.#ctx.strokeStyle = config.float.color;
        this.#ctx.lineWidth = 4;
        this.#ctx.beginPath();
        this.#ctx.moveTo(position.x - config.float.size, position.y);
        this.#ctx.lineTo(position.x + config.float.size, position.y);
        this.#ctx.moveTo(position.x, position.y - config.float.size);
        this.#ctx.lineTo(position.x, position.y + config.float.size);
        this.#ctx.stroke();

        this.#ctx.fillStyle = config.float.circleColor;
        this.#ctx.beginPath();
        this.#ctx.arc(position.x, position.y, config.float.circleRadius, 0, Math.PI * 2);
        this.#ctx.fill();
    }

    drawRodLine(floatPos, config) {
        const rodWidth = 3;
        const rodHeight = 200;
        
        let rodBaseX = this.#resolveX(config.ui?.rod?.x, rodWidth);
        const rodBaseY = this.#canvas.height - (config.ui?.rod?.yOffset || 0);
        const rodTopY = rodBaseY - rodHeight;

        this.#ctx.fillStyle = '#000000';
        this.#ctx.fillRect(rodBaseX - (rodWidth / 2), rodTopY, rodWidth, rodHeight);

        if (config.ui?.line?.visible === false) return;

        this.#ctx.strokeStyle = config.ui?.line?.color || 'rgba(255, 255, 255, 0.3)';
        this.#ctx.lineWidth = config.ui?.line?.width || 1;
        this.#ctx.beginPath();
        this.#ctx.moveTo(rodBaseX, rodTopY);
        this.#ctx.lineTo(floatPos.x, floatPos.y);
        this.#ctx.stroke();
    }

    drawFishCondition(condition, config) {
        const barWidth = 200;
        const barHeight = 10;
        const barX = this.#resolveX(config.ui?.indicators?.x, barWidth);
        const barY = config.ui?.indicators?.y || 40;

        this.#ctx.fillStyle = '#0b1520';
        this.#ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

        if (condition.phase === 'stamina') {
            const ratio = Math.max(0, Math.min(1, condition.currentStamina / condition.maxPoints));
            this.#ctx.fillStyle = '#ffcc00';
            this.#ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
            this.#ctx.fillStyle = '#ffffff';
            this.#ctx.font = '12px monospace';
            this.#ctx.textAlign = 'center';
            this.#ctx.fillText(`STAMINA: ${Math.round(condition.currentStamina)}/${Math.round(condition.maxPoints)}`, barX + barWidth / 2, barY + barHeight + 12);
        } else {
            const ratio = Math.max(0, Math.min(1, condition.currentExhaustion / condition.maxPoints));
            this.#ctx.fillStyle = '#ff4444';
            this.#ctx.fillRect(barX, barY, barWidth * ratio, barHeight);
            this.#ctx.fillStyle = '#ffffff';
            this.#ctx.font = '12px monospace';
            this.#ctx.textAlign = 'center';
            this.#ctx.fillText(`EXHAUSTING... ${Math.round(condition.currentExhaustion)}/${Math.round(condition.maxPoints)}`, barX + barWidth / 2, barY + barHeight + 12);
        }

        this.#ctx.strokeStyle = '#333';
        this.#ctx.strokeRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
    }

    drawTensionBar(tensionMeter, config) {
        const barWidth = config.tension.barWidth;
        const barHeight = config.tension.barHeight;
        const barX = this.#resolveX(config.ui?.indicators?.x, barWidth);
        const baseY = config.ui?.indicators?.y || 40;
        const spacing = config.ui?.indicators?.spacing || 40;
        const barY = baseY + spacing;
        
        const padding = config.tension.borderPadding;
        const tension = tensionMeter.getTension();
        const pulseIntensity = tensionMeter.getPulseIntensity(config);

        this.#ctx.fillStyle = config.tension.backgroundColor;
        this.#ctx.fillRect(barX - padding, barY - padding, barWidth + padding * 2, barHeight + padding * 2);

        this.#ctx.strokeStyle = config.tension.borderColor;
        this.#ctx.lineWidth = config.tension.barBorderWidth;
        this.#ctx.strokeRect(barX - padding, barY - padding, barWidth + padding * 2, barHeight + padding * 2);

        const fillWidth = (tension / 100) * barWidth;
        const fillColor = tensionMeter.getCurrentColor();

        this.#ctx.fillStyle = fillColor;
        this.#ctx.fillRect(barX, barY, fillWidth, barHeight);

        const glowIntensity = pulseIntensity * config.tension.glowIntensity;
        this.#ctx.shadowColor = fillColor;
        this.#ctx.shadowBlur = 10 * glowIntensity;
        this.#ctx.strokeStyle = fillColor;
        this.#ctx.lineWidth = 2;
        this.#ctx.strokeRect(barX, barY, fillWidth, barHeight);
        this.#ctx.shadowBlur = 0;

        this.#ctx.fillStyle = config.tension.labelColor;
        this.#ctx.font = config.tension.labelFont;
        this.#ctx.textAlign = 'left';
        this.#ctx.fillText(`TENSION: ${Math.round(tension)}%`, barX - config.tension.labelOffsetX, barY + config.tension.labelOffsetY);

        const statusLabel = tensionMeter.getCurrentStatusLabel();
        const statusColor = tensionMeter.getCurrentStatusColor();

        this.#ctx.fillStyle = statusColor;
        this.#ctx.textAlign = 'right';
        this.#ctx.fillText(statusLabel, barX + barWidth + config.tension.labelOffsetX, barY + config.tension.labelOffsetY);

        if (tension >= config.tension.breakThreshold - 0.1) {
            const breakProgress = tensionMeter.getLineBreakProgress();
            this.#drawLineBreakWarning(barX, barY - 25, barWidth, breakProgress, config);
        }
    }

    #drawLineBreakWarning(x, y, width, progress, config) {
        this.#ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        this.#ctx.fillRect(x, y, width * progress, 8);
        this.#ctx.strokeStyle = '#ff0000';
        this.#ctx.lineWidth = 1;
        this.#ctx.strokeRect(x, y, width, 8);
        this.#ctx.fillStyle = '#ff0000';
        this.#ctx.font = 'bold 10px monospace';
        this.#ctx.textAlign = 'center';
        this.#ctx.fillText('LINE BREAK', x + width / 2, y + 18);
    }

    drawGameOver(canvasWidth, canvasHeight, reason) {
        this.#ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.#ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        let title = 'LINE SNAPPED';
        let titleColor = '#ff4444';
        let desc = 'Tension exceeded line capacity.';

        if (reason === 'rod') {
            title = 'ROD BROKEN';
            titleColor = '#ff0000';
            desc = 'Your equipment could not handle the stress.';
        } else if (reason === 'hook' || reason === 'net_escape') {
            title = 'FISH ESCAPED';
            titleColor = '#ffaa00';
            desc = reason === 'net_escape' ? 'The fish was too heavy and broke out of the net!' : 'The hook bent and the fish got away.';
        }

        this.#ctx.fillStyle = titleColor;
        this.#ctx.font = 'bold 48px monospace';
        this.#ctx.textAlign = 'center';
        this.#ctx.fillText(title, canvasWidth / 2, canvasHeight / 2 - 40);
        this.#ctx.fillStyle = '#ffaa00';
        this.#ctx.font = 'bold 20px monospace';
        this.#ctx.fillText(desc, canvasWidth / 2, canvasHeight / 2 + 20);
        this.#ctx.fillStyle = '#00ccff';
        this.#ctx.font = 'bold 16px monospace';
        this.#ctx.fillText('Refresh page to try again', canvasWidth / 2, canvasHeight / 2 + 70);
    }

    drawVictory(canvasWidth, canvasHeight) {
        this.#ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        this.#ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        this.#ctx.fillStyle = '#00ff80';
        this.#ctx.font = 'bold 48px monospace';
        this.#ctx.textAlign = 'center';
        this.#ctx.fillText('FISH EXHAUSTED', canvasWidth / 2, canvasHeight / 2 - 40);
        this.#ctx.fillStyle = '#8a9bac';
        this.#ctx.font = 'bold 20px monospace';
        this.#ctx.fillText('You wore the fish out — well played!', canvasWidth / 2, canvasHeight / 2 + 10);
        this.#ctx.fillStyle = '#00ccff';
        this.#ctx.font = 'bold 14px monospace';
        this.#ctx.fillText('Refresh page to try again', canvasWidth / 2, canvasHeight / 2 + 60);
    }
}

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
    // #cameraToggleBtn;
    #invalidCastMarker;
    #netCatchChance = null;
    #isNetReady = false;
    failReason = null;

    constructor(canvasId) {
        this.#canvas = document.getElementById(canvasId);
        
        this.#inputManager = new InputManager(this.#canvas, CONFIG);
        this.#renderer = new Renderer(this.#canvas);

        this.#uiManager = new UIManager(CONFIG);
        this.#uiManager.onNetClick = () => this.#handleNetClick();
        
        this.#locationMap = new LocationMap('test', CONFIG);
        this.#projector = new ViewportProjector(CONFIG);
        
        this.#resizeCanvas();
        window.addEventListener('resize', () => this.#resizeCanvas());

        const initialX = CONFIG.float.initialX ?? this.#canvas.width / 2;
        const initialY = CONFIG.float.initialY ?? this.#canvas.height / 2;
        this.#float = new FloatEntity(initialX, initialY, CONFIG);
        
        this.#gameState = 'scouting';
        this.#invalidCastMarker = null;
        
        this.#bounds = {
            left: 0,
            right: CONFIG.locations.baseResolution.width,
            top: 0,
            bottom: CONFIG.locations.baseResolution.height
        };

        this.#lastTime = performance.now();
        this.loop = this.loop.bind(this);
    }

    // #toggleCameraMode() {
    //     if (this.#gameState === 'scouting') {
    //         this.#gameState = 'targeting';
    //         this.#cameraToggleBtn.innerText = '📷 CAMERA: LOCKED (TAP TO CAST)';
    //         this.#cameraToggleBtn.style.backgroundColor = '#555';
    //         this.#cameraToggleBtn.style.color = '#fff';
    //     } else if (this.#gameState === 'targeting') {
    //         this.#gameState = 'scouting';
    //         this.#cameraToggleBtn.innerText = '📷 CAMERA: FREE';
    //         this.#cameraToggleBtn.style.backgroundColor = '#ffaa00';
    //         this.#cameraToggleBtn.style.color = '#111';
    //     }
    // }

    #startFishing(virtualX, virtualY) {
        this.#float.setPosition(virtualX, virtualY);
        this.#gameState = 'playing';

        this.#netCatchChance = null;
        this.#isNetReady = false;
        this.failReason = null;

        // if (this.#cameraToggleBtn) this.#cameraToggleBtn.style.display = 'none';
        const rod = new Rod(CONFIG.rod.level, CONFIG.rod.basePower);
        const reel = new Reel(CONFIG.reel.level, CONFIG.reel.basePower);
        const hook = new Hook(CONFIG.hook.level, CONFIG.hook.weight, CONFIG.hook.quality); 
        const fish = new Fish(CONFIG.fish.level, CONFIG.fish.weight, CONFIG.fish.resistance, CONFIG); 
        
        this.#fishingSystem = new FishingSystem(rod, reel, fish);
        this.#tensionMeter = new TensionMeter(CONFIG.rod.level, CONFIG.reel.level, hook, CONFIG);
        this.#fishCondition = new FishCondition(CONFIG.fish.level, CONFIG.fish.weight, CONFIG);
        
        const playerBasePower = rod.getPower() + reel.getPower();
        this.#staminaController = new StaminaController(this.#fishCondition, fish, playerBasePower, CONFIG);
    }

    #resizeCanvas() {
        this.#canvas.width = window.innerWidth;
        this.#canvas.height = window.innerHeight;
        
        if (this.#projector && this.#projector.update(this.#canvas.width, this.#canvas.height)) {
            this.#locationMap.recalculateZones(this.#projector, CONFIG.locations.cellSize);
        }
    }

    start() {
        requestAnimationFrame(this.loop);
    }

    #handleNetClick() {
        if (!this.#isNetReady || this.#gameState !== 'playing') return;

        const roll = Math.random() * 100;
        const isSuccess = roll <= this.#netCatchChance;

        document.dispatchEvent(new CustomEvent('netCatchRoll', { 
            detail: { chance: this.#netCatchChance, roll: roll, success: isSuccess } 
        }));

        if (isSuccess) {
            this.#gameState = 'victory';
        } else {
            this.#gameState = 'failed';
            this.failReason = 'net_escape';
        }
    }

    update(dt) {
        this.#projector.update(this.#canvas.width, this.#canvas.height);
        this.#locationMap.update(dt);

        const inputState = this.#inputManager.getState();
        
        if (this.#gameState === 'scouting') {
            if (inputState.panDeltaX !== 0) {
                const virtualDelta = inputState.panDeltaX / this.#projector.getScale();
                this.#projector.pan(virtualDelta);
            }
            
            if (inputState.clickPos) {
                const vPos = this.#projector.screenToVirtual(inputState.clickPos.x, inputState.clickPos.y);
                const cell = this.#locationMap.getCellAtVirtualPos(vPos.x, vPos.y, CONFIG.locations.cellSize);
                
                if (cell && cell.isCastable && !cell.hasCollision) {
                    this.#startFishing(vPos.x, vPos.y);
                } else {
                    this.#invalidCastMarker = {
                        x: inputState.clickPos.x,
                        y: inputState.clickPos.y,
                        timer: 500
                    };
                }
            }
            
            if (this.#invalidCastMarker) {
                this.#invalidCastMarker.timer -= dt;
                if (this.#invalidCastMarker.timer <= 0) this.#invalidCastMarker = null;
            }
            return; 
        }
        
        if (this.#gameState !== 'playing') return;

        // ВАЖЛИВО: Оновлена обробка обриву ліски (без старого EventLogger)
        if (this.#tensionMeter.isBroken()) {
            this.#gameState = 'failed';
            const reason = this.#tensionMeter.getBreakReason();
            this.failReason = reason;
            document.dispatchEvent(new CustomEvent('fishingFailed', { detail: { reason: reason } }));
            return;
        }

        const floatPos = this.#float.getPosition();
        const fishForceRaw = this.#fishingSystem.calculateFishForce(dt, floatPos.x, this.#bounds, CONFIG);
        const currentFishMaxForceScaled = Math.max(Math.abs(fishForceRaw.x), Math.abs(fishForceRaw.y)) * 0.01;

        const fishForce = fishForceRaw.clone().multiplyScalar(CONFIG.physics.fishForceMultiplier);
        this.#float.applyForce(fishForce);

        let rodScreenX = this.#canvas.width / 2;
        if (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== 'center') {
            rodScreenX = Number(CONFIG.ui.rod.x);
        }
        const rodScreenY = this.#canvas.height - (CONFIG.ui?.rod?.yOffset || 0);
        const rodVirtualPos = this.#projector.screenToVirtual(rodScreenX, rodScreenY);

        const floatScreenPosInitial = this.#projector.virtualToScreen(floatPos.x, floatPos.y);
        const maxOffsetDistance = Math.max(rodScreenX, this.#canvas.width - rodScreenX);
        const screenOffsetRatio = Math.min(1, Math.abs(floatScreenPosInitial.x - rodScreenX) / maxOffsetDistance);

        const rawPlayerPower = this.#fishingSystem.calculatePlayerForce(new Vector2(0, 1), floatPos.x, floatPos.y, rodVirtualPos, screenOffsetRatio, CONFIG).y;
        const playerMaxPower = Math.abs(rawPlayerPower * CONFIG.physics.playerForceMultiplier);
        const fishPowerMag = Math.abs(fishForce.y); 
        const reelPower = this.#fishingSystem.getReelPower();

        // ВАЖЛИВО: Оголошуємо playerForce ДО блоку if, щоб дебагер міг його прочитати, навіть якщо ми не тягнемо
        let playerForce = new Vector2(0, 0);

        // ВАЖЛИВО: Залишився тільки один чистий блок pulling
        if (inputState.isPulling) {
            const playerForceRaw = this.#fishingSystem.calculatePlayerForce(inputState.pullDirection, floatPos.x, floatPos.y, rodVirtualPos, screenOffsetRatio, CONFIG);
            playerForce = playerForceRaw.clone().multiplyScalar(CONFIG.physics.playerForceMultiplier);
            this.#float.applyForce(playerForce);
        }

        this.#tensionMeter.update(inputState.isPulling, playerMaxPower, fishPowerMag, reelPower, currentFishMaxForceScaled, dt, CONFIG);

        const castableBounds = this.#locationMap.getCastableBoundsVirtual(CONFIG.locations.cellSize);
        const vTopLeft = this.#projector.screenToVirtual(0, 0);
        const vBottomRight = this.#projector.screenToVirtual(this.#canvas.width, this.#canvas.height);
        
        const dynamicBounds = {
            left: Math.max(vTopLeft.x, castableBounds ? castableBounds.left : 0),
            right: Math.min(vBottomRight.x, castableBounds ? castableBounds.right : 2560),
            top: Math.max(vTopLeft.y, castableBounds ? castableBounds.top : 0),
            bottom: Math.min(vBottomRight.y, castableBounds ? castableBounds.bottom : 2560)
        };

        this.#staminaController.evaluate(this.#tensionMeter.getTension(), inputState.isPulling, dt, floatPos.x, dynamicBounds);
        this.#float.update(dynamicBounds);
        
        const updatedFloatPos = this.#float.getPosition();
        const floatScreenPos = this.#projector.virtualToScreen(updatedFloatPos.x, updatedFloatPos.y);
        
        const castableBoundsVirtual = this.#locationMap.getCastableBoundsVirtual(CONFIG.locations.cellSize);
        const mapBottomScreenY = this.#projector.virtualToScreen(0, castableBoundsVirtual.bottom).y;
        
        const catchLineY = Math.min(mapBottomScreenY, this.#canvas.height);

        if (this.#netCatchChance === null) {
            if (CONFIG.net && CONFIG.net.active) {
                const fW = CONFIG.fish.weight;
                const nW = CONFIG.net.maxWeight;
                if (fW <= nW) {
                    this.#netCatchChance = 100;
                } else {
                    const diffPercent = ((fW - nW) / nW) * 100;
                    let baseChance = 50;
                    for (const t of CONFIG.net.chances) {
                        if (diffPercent >= t.min && diffPercent <= t.max) {
                            baseChance = t.chance;
                            break;
                        }
                    }
                    const qualBonus = Math.round((CONFIG.net.quality - 1.0) * 10);
                    this.#netCatchChance = Math.min(100, baseChance + qualBonus);
                }
            } else {
                this.#netCatchChance = 100;
            }
        }

        if (CONFIG.net && CONFIG.net.active) {
            const netBonusPx = CONFIG.net.length * 10;
            const netLineY = catchLineY - netBonusPx;
            this.#isNetReady = (floatScreenPos.y >= netLineY && floatScreenPos.y < catchLineY);
        } else {
            this.#isNetReady = false;
        }

        // Відправка даних в дебагер
        if (CONFIG.debug?.overlay) {
            const debugData = {
                playerForceY: Math.abs(playerForce.y),
                playerForceX: Math.abs(playerForce.x),
                fishForceY: Math.abs(fishForce.y),
                fishForceX: Math.abs(fishForce.x),
                fishState: this.#fishingSystem.getCurrentState ? this.#fishingSystem.getCurrentState() : 'unknown',
                fishBasePower: this.#fishingSystem.getFishBasePower ? this.#fishingSystem.getFishBasePower() : 0,
                pullMult: this.#fishingSystem.getPullMultiplier ? this.#fishingSystem.getPullMultiplier() : 1,
                moveMult: this.#fishingSystem.getMoveMultiplier ? this.#fishingSystem.getMoveMultiplier() : 1
            };
            document.dispatchEvent(new CustomEvent('debug-live-update', { detail: debugData }));
        }

        this.#uiManager.updateNetButtonState(CONFIG, this.#isNetReady && this.#gameState === 'playing');

        if (floatScreenPos.y >= catchLineY) {
            this.#gameState = 'victory';
        }
    }

    draw() {
        this.#renderer.clear(CONFIG);

        // 1. ЗАВЖДИ малюємо візуальний фон локації (воду, берег)
        if (typeof this.#renderer.drawBackground === 'function') {
            this.#renderer.drawBackground(this.#locationMap, this.#projector, CONFIG);
        }

        // 2. Сітку та червоні зони малюємо ТІЛЬКИ якщо це увімкнено в конфігу
        if (CONFIG.locations && CONFIG.locations.debugVisuals) {
            this.#renderer.drawLocationDebug(this.#locationMap, this.#projector, CONFIG);
        }

        if (this.#invalidCastMarker) {
            this.#renderer.drawInvalidCastMarker(this.#invalidCastMarker);
        }

        if (this.#gameState === 'playing' || this.#gameState === 'failed' || this.#gameState === 'victory') {
            const vPos = this.#float.getPosition();
            const sPos = this.#projector.virtualToScreen(vPos.x, vPos.y);
            
            this.#renderer.drawCatchZone(this.#locationMap, this.#projector, CONFIG);
            
            this.#renderer.drawRodLine(sPos, CONFIG);
            this.#renderer.drawFloat(sPos, CONFIG);
            this.#renderer.drawTensionBar(this.#tensionMeter, CONFIG);
            this.#renderer.drawFishCondition(this.#fishCondition, CONFIG);
        }
        
        if (this.#gameState === 'failed') {
            this.#renderer.drawGameOver(this.#canvas.width, this.#canvas.height, this.failReason || this.#tensionMeter.getBreakReason());
        } else if (this.#gameState === 'victory') {
            this.#renderer.drawVictory(this.#canvas.width, this.#canvas.height);
        }
    }

    loop(timestamp) {
        const dt = timestamp - this.#lastTime;
        this.#lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame(this.loop);
    }
}

const game = new Game('gameCanvas');
game.start();
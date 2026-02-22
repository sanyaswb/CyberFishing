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
    #state;
    #canvas;

    constructor(canvas) {
        this.#canvas = canvas;
        this.#state = {
            isPulling: false,
            pullDirection: new Vector2(0, 0),
            pointerDown: false,
            pointerStart: new Vector2(0, 0),
            pointerCurrent: new Vector2(0, 0),
            keys: { left: false, right: false, space: false }
        };

        this.#bindEvents();
    }

    #bindEvents() {
        window.addEventListener('keydown', (e) => this.#handleKey(e, true));
        window.addEventListener('keyup', (e) => this.#handleKey(e, false));

        this.#canvas.addEventListener('mousedown', (e) => this.#handlePointerDown(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => this.#handlePointerMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => this.#handlePointerUp());

        this.#canvas.addEventListener('touchstart', (e) => this.#handlePointerDown(e.touches[0].clientX, e.touches[0].clientY), { passive: false });
        window.addEventListener('touchmove', (e) => this.#handlePointerMove(e.touches[0].clientX, e.touches[0].clientY), { passive: false });
        window.addEventListener('touchend', () => this.#handlePointerUp());
    }

    #handleKey(e, isPressed) {
        if (e.code === 'ArrowLeft') this.#state.keys.left = isPressed;
        if (e.code === 'ArrowRight') this.#state.keys.right = isPressed;
        if (e.code === 'Space') this.#state.keys.space = isPressed;
        this.#updateInputState();
    }

    #handlePointerDown(x, y) {
        this.#state.pointerDown = true;
        this.#state.pointerStart.x = x;
        this.#state.pointerStart.y = y;
        this.#state.pointerCurrent.x = x;
        this.#state.pointerCurrent.y = y;
        this.#updateInputState();
    }

    #handlePointerMove(x, y) {
        if (!this.#state.pointerDown) return;
        this.#state.pointerCurrent.x = x;
        this.#state.pointerCurrent.y = y;
        this.#updateInputState();
    }

    #handlePointerUp() {
        this.#state.pointerDown = false;
        this.#updateInputState();
    }

    #updateInputState() {
        this.#state.isPulling = this.#state.pointerDown || this.#state.keys.space;
        
        let rawX = 0;
        let rawY = 0;

        if (this.#state.keys.left) rawX -= 1;
        if (this.#state.keys.right) rawX += 1;
        if (this.#state.keys.space) rawY += 1;

        if (this.#state.pointerDown) {
            const diffX = this.#state.pointerCurrent.x - this.#state.pointerStart.x;
            const deadzone = CONFIG.input.pointerThreshold || 10;
            const dragRadius = CONFIG.input.dragRadius || 100;
            
            if (Math.abs(diffX) > deadzone) {
                const activeDiff = diffX > 0 ? diffX - deadzone : diffX + deadzone;
                rawX = activeDiff / dragRadius;
            }
            rawY += 1;
        }

        this.#state.pullDirection.x = Math.max(-1, Math.min(1, rawX));
        this.#state.pullDirection.y = Math.max(0, Math.min(1, rawY));
    }

    getState() {
        return this.#state;
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
    constructor(level, power) {
        super(level, power);
    }
}

class Reel extends Equipment {
    constructor(level, power) {
        super(level, power);
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

    update(dt) {
        this.#stateTimer -= dt;
        if (this.#stateTimer <= 0) {
            this.#pickNextState();
        }

        this.#dirTimer -= dt;
        if (this.#dirTimer <= 0) {
            this.#targetDirX = (Math.random() * 2) - 1;
            this.#dirTimer = 500 + Math.random() * 1500;
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
}

class FishingSystem {
    #rod;
    #reel;
    #buffs;
    #fish;

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

    calculatePlayerForce(inputDirection, config) {
        const basePower = this.#rod.getPower() + this.#reel.getPower();
        const totalPower = basePower * this.#buffs.getTotalMultiplier();
        
        let force = new Vector2(0, 0);
        force.y = inputDirection.y * totalPower;
        force.x = inputDirection.x * totalPower * config.physics.playerSteeringMultiplier;
        
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
        
        // ОПТИМІЗАЦІЯ: Експортуємо дані для віджета ТІЛЬКИ якщо він увімкнений
        if (config.debug && config.debug.overlay) {
            window.DEBUG_LIVE_FISH_STATE = behavior.name;
            window.DEBUG_LIVE_FISH_PULL_MULT = behavior.pullMult;
            window.DEBUG_LIVE_FISH_MOVE_MULT = Math.abs(behavior.moveX); // Передаємо реальний (згладжений) множник X
        }

        let force = new Vector2(0, 0);
        force.y = -basePower * behavior.pullMult;
        
        const pushDirection = Math.sign(floatX - centerX);
        const escapeForceX = pushDirection * spatialPenalty * config.fish.edgePowerMultiplier * basePower;
        
        force.x = (behavior.moveX * basePower) + escapeForceX;
        
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
            // Штраф за помилку: навіть при 0 виснаження риба отримає 5% стаміни і "оживе"
            if (spatialPenalty > 0 || tension > this.#config.exhaustionOptimalMax) {
                this.#condition.breakExhaustion();
                return;
            }

            // ФІКС БАГУ: Пауза виснаження. 
            // Якщо гравець відпустив палець (скидає натяг) — виснаження зупиняється.
            if (!playerPowerIsPulling) {
                return; 
            }

            // ЛОК ПРИ 0: віднімаємо силу тільки доки шкала виснаження не порожня
            if (this.#condition.currentExhaustion > 0) {
                const idealDps = this.#config.baseDepletionRate * this.#playerBasePower;
                const idealTimeSec = this.#condition.maxPoints / Math.max(1, idealDps);
                const exhaustionDurationSec = idealTimeSec * this.#fish.getInitialPower();
                const pointsPerSec = this.#condition.maxPoints / exhaustionDurationSec;

                const damage = pointsPerSec * timeScale;
                const debuff = this.#config.basePowerDropPerSec * timeScale;

                // Запобігаємо "перевиконанню" віднімання на останньому кадрі
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

    constructor() {
        this.#tension = 0;
        this.#targetTension = 0;
        this.#pulsePhase = 0;
        this.#currentColor = 'rgb(0, 0, 255)';
        this.#currentStatusLabel = 'Idle';
        this.#currentStatusColor = '#4a5b6c';
        this.#lastCalculatedTension = -1;
        this.#lineBreakTimer = 0;
        this.#isBroken = false;
    }

    update(isPulling, playerMaxPower, fishPowerMag, reelPower, dt, config) { 
        if (this.#isBroken) return;

        const powerRatio = fishPowerMag / Math.max(0.001, playerMaxPower);
        const speedMultiplier = Math.pow(powerRatio, 2);
        const baseForce = playerMaxPower + fishPowerMag;

        let forceBalance = baseForce * speedMultiplier;
        
        if (!isPulling) {
            // МАГІЯ КОТУШКИ: розраховуємо бонус відновлення
            const recoveryBonus = 1 + (reelPower * (config.tension.reelRecoveryMultiplier || 0));
            forceBalance = -(forceBalance * recoveryBonus);
        }

        const tensionChange = forceBalance * config.tension.sensitivityMultiplier;

        this.#targetTension = Math.max(0, Math.min(100, this.#targetTension + tensionChange));
        this.#tension += (this.#targetTension - this.#tension) * config.tension.smoothApproach;

        this.#pulsePhase += Math.max(1, config.tension.pulseSpeedMax - (this.#tension / config.tension.pulseTensionDivisor)) * config.tension.pulseSpeedBaseMultiplier;
        if (this.#pulsePhase > Math.PI * 2) this.#pulsePhase -= Math.PI * 2;

        if (this.#tension >= config.tension.breakThreshold) {
            this.#lineBreakTimer += dt;
            if (this.#lineBreakTimer >= config.tension.breakTimeout) {
                this.#isBroken = true;
            }
        } else {
            this.#lineBreakTimer = 0;
        }

        const intTension = Math.round(this.#tension);
        if (intTension !== this.#lastCalculatedTension) {
            this.#updateVisualStates(intTension, config);
            this.#lastCalculatedTension = intTension;
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
    getLineBreakProgress() { return this.#lineBreakTimer; }
    isBroken() { return this.#isBroken; }

    getPulseIntensity(config) {
        return (1 - config.tension.pulseMagnitude) + Math.sin(this.#pulsePhase) * config.tension.pulseMagnitude;
    }

    reset() {
        this.#tension = 0;
        this.#targetTension = 0;
        this.#pulsePhase = 0;
        this.#lineBreakTimer = 0;
        this.#isBroken = false;
        this.#lastCalculatedTension = -1;
    }
}

class Renderer {
    #ctx;
    #width;
    #height;

    constructor(canvas) {
        this.#ctx = canvas.getContext('2d', { alpha: false });
        this.#width = canvas.width;
        this.#height = canvas.height;
    }

    clear(config) {
        this.#ctx.fillStyle = config.canvas.backgroundColor;
        this.#ctx.fillRect(0, 0, this.#width, this.#height);
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
        const rodBaseX = this.#width / 2;
        const rodBaseY = this.#height;
        
        this.#ctx.strokeStyle = config.rod.lineColor;
        this.#ctx.lineWidth = config.rod.lineWidth;
        this.#ctx.beginPath();
        this.#ctx.moveTo(rodBaseX, rodBaseY);
        this.#ctx.lineTo(floatPos.x, floatPos.y);
        this.#ctx.stroke();
    }

    drawTensionBar(tensionMeter, config) {
        const barWidth = config.tension.barWidth;
        const barHeight = config.tension.barHeight;
        const barX = (this.#width - barWidth) / 2;
        const barY = this.#height - config.tension.barYOffset;
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

        if (tension >= config.tension.breakThreshold) {
            const breakProgress = tensionMeter.getLineBreakProgress() / config.tension.breakTimeout;
            this.#drawLineBreakWarning(barX, barY - 25, barWidth, breakProgress, config);
        }
    }

    drawFishCondition(condition, config) {
        const barWidth = 200;
        const barHeight = 10;
        const barX = (this.#width - barWidth) / 2;
        const barY = this.#height - config.tension.barYOffset - 40;

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

    drawGameOver(canvasWidth, canvasHeight) {
        this.#ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.#ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        this.#ctx.fillStyle = '#ff0000';
        this.#ctx.font = 'bold 48px monospace';
        this.#ctx.textAlign = 'center';
        this.#ctx.fillText('LINE BROKEN', canvasWidth / 2, canvasHeight / 2 - 40);

        this.#ctx.fillStyle = '#ffaa00';
        this.#ctx.font = 'bold 24px monospace';
        this.#ctx.fillText('Tension exceeded capacity', canvasWidth / 2, canvasHeight / 2 + 20);

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
    #fishingSystem;
    #float;
    #lastTime;
    #bounds;
    #tensionMeter;
    #lastPlayerForceY;
    #lastFishForceY;
    #gameState;
    #fishCondition;
    #staminaController;

    constructor(canvasId) {
        this.#canvas = document.getElementById(canvasId);
        this.#inputManager = new InputManager(this.#canvas);
        this.#renderer = new Renderer(this.#canvas);
        
        const rod = new Rod(CONFIG.rod.level, CONFIG.rod.basePower);
        const reel = new Reel(CONFIG.reel.level, CONFIG.reel.basePower);
        const fish = new Fish(CONFIG.fish.level, CONFIG.fish.weight, CONFIG.fish.resistance, CONFIG); 
        
        this.#fishingSystem = new FishingSystem(rod, reel, fish);
        
        const initialX = CONFIG.float.initialX ?? this.#canvas.width / 2;
        const initialY = CONFIG.float.initialY ?? this.#canvas.height / 2;
        this.#float = new FloatEntity(initialX, initialY, CONFIG);
        this.#tensionMeter = new TensionMeter();
        
        const playerBasePower = rod.getPower() + reel.getPower();
        this.#fishCondition = new FishCondition(CONFIG.fish.level, CONFIG.fish.weight, CONFIG);
        this.#staminaController = new StaminaController(this.#fishCondition, fish, playerBasePower, CONFIG);
        
        this.#lastPlayerForceY = 0;
        this.#lastFishForceY = 0;
        this.#gameState = 'playing';
        
        this.#bounds = {
            left: CONFIG.viewport.marginLeft,
            right: this.#canvas.width - CONFIG.viewport.marginRight,
            top: CONFIG.viewport.marginTop,
            bottom: this.#canvas.height - CONFIG.viewport.marginBottom
        };

        this.#lastTime = performance.now();
        this.loop = this.loop.bind(this);
    }

    start() {
        requestAnimationFrame(this.loop);
    }

    update(dt) {
        if (this.#gameState !== 'playing') {
            return;
        }

        if (this.#tensionMeter.isBroken()) {
            this.#gameState = 'failed';
            return;
        }

        const inputState = this.#inputManager.getState();
        const floatPos = this.#float.getPosition();

        const fishForce = this.#fishingSystem.calculateFishForce(dt, floatPos.x, this.#bounds, CONFIG);
        fishForce.multiplyScalar(CONFIG.physics.fishForceMultiplier);
        this.#lastFishForceY = fishForce.y;
        this.#float.applyForce(fishForce);

        // --- AXIS SEPARATION: Tension uses ONLY Y-axis ---
        const rawPlayerPower = this.#fishingSystem.calculatePlayerForce(new Vector2(0, 1), CONFIG).y;
        const playerMaxPower = Math.abs(rawPlayerPower * CONFIG.physics.playerForceMultiplier);
        const fishPowerMag = Math.abs(fishForce.y); // No more .length() mixing X and Y
        const reelPower = this.#fishingSystem.getReelPower();

        this.#lastPlayerForceY = 0;
        if (inputState.isPulling) {
            const playerForceRaw = this.#fishingSystem.calculatePlayerForce(inputState.pullDirection, CONFIG);
            const playerForce = playerForceRaw.clone().multiplyScalar(CONFIG.physics.playerForceMultiplier);
            this.#lastPlayerForceY = playerForce.y;
            this.#float.applyForce(playerForce);
        }

        this.#tensionMeter.update(inputState.isPulling, playerMaxPower, fishPowerMag, reelPower, dt, CONFIG);

        this.#staminaController.evaluate(this.#tensionMeter.getTension(), inputState.isPulling, dt, floatPos.x, this.#bounds);

        this.#float.update(this.#bounds);

        if (this.#float.getPosition().y >= this.#bounds.bottom) {
            this.#gameState = 'victory';
        }
    }

    draw() {
        this.#renderer.clear(CONFIG);
        const pos = this.#float.getPosition();
        this.#renderer.drawRodLine(pos, CONFIG);
        this.#renderer.drawFloat(pos, CONFIG);
        
        this.#renderer.drawTensionBar(this.#tensionMeter, CONFIG);
        this.#renderer.drawFishCondition(this.#fishCondition, CONFIG);

        if (this.#gameState === 'failed') {
            this.#renderer.drawGameOver(this.#canvas.width, this.#canvas.height);
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
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
    #isPointerDown;
    #startX;
    #startY;
    #lastPointerX;
    #panDeltaX;
    #clickPos;
    #config;
    #keys = {};
    #isDoubleClick = false;
    #longPressPos = null;
    #lastClickTime = 0;
    #longPressTimeout = null;

    constructor(canvas, config) {
        this.#canvas = canvas;
        this.#config = config;
        this.#isPulling = false;
        this.#pullDirection = new Vector2(0, 1);
        this.#isDragging = false;
        this.#isPointerDown = false;
        this.#startX = 0;
        this.#startY = 0;
        this.#lastPointerX = 0;
        this.#panDeltaX = 0;
        this.#clickPos = null;

        this.#bindEvents();
    }

    #bindEvents() {
        this.#canvas.addEventListener('pointerdown', (e) => {
            this.#isPointerDown = true;
            this.#isPulling = true;
            
            this.#isDragging = false;
            this.#startX = e.clientX;
            this.#startY = e.clientY;
            this.#lastPointerX = e.clientX;
            this.#updateDirection(e);

            if (this.#longPressTimeout) clearTimeout(this.#longPressTimeout);
            this.#longPressTimeout = setTimeout(() => {
                if (!this.#isDragging) {
                    this.#longPressPos = { x: e.clientX, y: e.clientY };
                }
            }, 500);
        });

        this.#canvas.addEventListener('pointermove', (e) => {
            if (!this.#isPointerDown) return;

            const dist = Math.hypot(e.clientX - this.#startX, e.clientY - this.#startY);
            if (dist > 5) {
                this.#isDragging = true;
                if (this.#longPressTimeout) clearTimeout(this.#longPressTimeout);
            }

            if (this.#isDragging) {
                this.#panDeltaX = this.#lastPointerX - e.clientX;
                this.#lastPointerX = e.clientX;
            }
            
            this.#updateDirection(e);
        });

        const resetInput = (e) => {
            if (this.#longPressTimeout) clearTimeout(this.#longPressTimeout);

            const isPointerEvent = e && (e.type === 'pointerup' || e.type === 'touchend' || e.type === 'pointercancel');
            
            if (isPointerEvent) {
                if (!this.#isDragging && this.#isPointerDown) {
                    const now = Date.now();
                    if (now - this.#lastClickTime < 300) {
                        this.#isDoubleClick = true;
                    } else {
                        const clientX = e.clientX || (e.changedTouches && e.changedTouches[0]?.clientX);
                        const clientY = e.clientY || (e.changedTouches && e.changedTouches[0]?.clientY);
                        this.#clickPos = { x: clientX, y: clientY };
                    }
                    this.#lastClickTime = now;
                }
                this.#isPointerDown = false;
            }
            
            this.#isPulling = this.#keys['Space'] === true || this.#isPointerDown === true;
            
            if (!this.#isPulling) {
                this.#pullDirection = new Vector2(0, 1);
            }
            this.#isDragging = false;
        };

        window.addEventListener('pointerup', resetInput, { capture: true });
        window.addEventListener('pointercancel', resetInput, { capture: true });
        window.addEventListener('touchend', resetInput, { capture: true });
        
        window.addEventListener('blur', () => {
            this.#keys = {};
            this.#isPointerDown = false;
            resetInput();
        });

        window.addEventListener('keydown', (e) => {
            this.#keys[e.code] = true;
            if (e.code === 'Space') {
                this.#isPulling = true;
                e.preventDefault(); 
            }
        });

        window.addEventListener('keyup', (e) => {
            this.#keys[e.code] = false;
            if (e.code === 'Space') {
                this.#isPulling = this.#isPointerDown;
                if (!this.#isPulling) {
                    this.#pullDirection = new Vector2(0, 1);
                }
            }
        });

        this.#canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    #updateDirection(e) {
        let keyX = 0;
        if (this.#keys['KeyA'] || this.#keys['ArrowLeft']) keyX = -1;
        if (this.#keys['KeyD'] || this.#keys['ArrowRight']) keyX = 1;

        if (keyX !== 0) {
            this.#pullDirection = new Vector2(keyX, 1).normalize();
        } else if (e && e.clientX !== undefined) {
            const rect = this.#canvas.getBoundingClientRect();
            let anchorX = rect.width / 2;
            if (this.#config.ui?.rod?.x && this.#config.ui.rod.x !== 'center') anchorX = Number(this.#config.ui.rod.x);
            
            const dx = e.clientX - rect.left - anchorX;
            const dy = rect.height / 2; 
            
            const length = Math.hypot(dx, dy);
            if (length > 0) this.#pullDirection = new Vector2(dx / length, dy / length);
        }
    }

    getState() {
        if (this.#keys['KeyA'] || this.#keys['KeyD'] || this.#keys['ArrowLeft'] || this.#keys['ArrowRight']) {
            this.#updateDirection();
        }

        const state = {
            isPulling: this.#isPulling,
            pullDirection: this.#pullDirection,
            panDeltaX: this.#panDeltaX,
            clickPos: this.#clickPos,
            isDoubleClick: this.#isDoubleClick,
            longPressPos: this.#longPressPos
        };
        
        this.#panDeltaX = 0;
        this.#clickPos = null; 
        this.#isDoubleClick = false;
        this.#longPressPos = null;

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
    #isLocked;

    constructor(config) {
        this.#config = config.fish || config;
        this.#currentStateName = 'swim';
        this.#stateTimer = 0;
        this.#dirTimer = 0;
        this.#currentPull = 1.0;
        this.#targetPull = 1.0;
        this.#currentMove = 0.0;
        this.#targetMove = 0.0;
        this.#currentDirX = 0;
        this.#targetDirX = 0;
        this.#isLocked = false;
        this.#pickNextState();
    }

    #pickNextState() {
        if (this.#isLocked) return; 

        const states = this.#config.behaviors;
        const validKeys = Object.keys(states).filter(k => states[k].weight > 0);
        
        if (validKeys.length === 0) return;

        let totalWeight = 0;
        for (let k of validKeys) {
            totalWeight += states[k].weight;
        }
        
        let r = Math.random() * totalWeight;
        let selectedKey = validKeys[0];

        for (let k of validKeys) {
            if (r < states[k].weight) {
                selectedKey = k;
                break;
            }
            r -= states[k].weight;
        }

        this.#currentStateName = selectedKey;
        const state = states[this.#currentStateName];
        this.#targetPull = state.pull;
        this.#targetMove = state.move;
        this.#stateTimer = state.minTime + Math.random() * (state.maxTime - state.minTime);
    }

    forceState(stateName, isLocked = false) {
        const state = this.#config.behaviors[stateName];
        if (!state) {
            console.error(`[BEHAVIOR ERROR] Стан ${stateName} не знайдено!`);
            return;
        }

        this.#currentStateName = stateName;
        this.#targetPull = state.pull;
        this.#targetMove = state.move;
        this.#isLocked = isLocked;
        this.#stateTimer = state.minTime + Math.random() * (state.maxTime - state.minTime);
        this.#dirTimer = 0; 
    }

    reactToWall(wallSide) {
        this.#targetDirX = wallSide === -1 ? 1 : -1;
        this.#currentDirX = this.#targetDirX;
        const stateConfig = this.#config.behaviors[this.#currentStateName];
        this.#dirTimer = stateConfig.bounceCooldownMs ?? this.#config.bounceCooldownMs ?? 2000;
        
        if (!this.#isLocked) {
            this.#stateTimer = 0;
        }
    }

    update(dt) {
        this.#stateTimer -= dt;
        if (this.#stateTimer <= 0) {
            if (this.#isLocked) this.#isLocked = false;
            this.#pickNextState();
        }

        const stateConfig = this.#config.behaviors[this.#currentStateName];

        this.#dirTimer -= dt;
        if (this.#dirTimer <= 0) {
            this.#targetDirX = (Math.random() * 2) - 1;
            const minMs = stateConfig.dirChangeMinMs ?? this.#config.dirChangeMinMs ?? 500;
            const maxMs = stateConfig.dirChangeMaxMs ?? this.#config.dirChangeMaxMs ?? 2000;
            this.#dirTimer = minMs + Math.random() * (maxMs - minMs);
        }

        const agility = stateConfig.agility ?? this.#config.agility ?? 1.0;
        const t = Math.min(1, (dt / 1000) * 3.0 * agility);
        
        this.#currentPull += (this.#targetPull - this.#currentPull) * t;
        this.#currentMove += (this.#targetMove - this.#currentMove) * t;
        this.#currentDirX += (this.#targetDirX - this.#currentDirX) * t;
    }

    getStateData() {
        const stateConfig = this.#config.behaviors[this.#currentStateName];
        return {
            name: this.#currentStateName,
            pullMult: this.#currentPull,
            moveX: this.#currentMove * this.#currentDirX,
            edgePowerMultiplier: stateConfig.edgePowerMultiplier ?? this.#config.edgePowerMultiplier ?? 1.0
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
    #isLastDashTriggered = false;
    #lastDashTimer = 0;
    #masteryPowerMult = 1.0;
    #lastDebuffName = null;
    
    // НОВІ ЗМІННІ ДЛЯ ДЕБАФІВ
    #originalBehaviors = null;
    #hasActiveDebuff = false;

    constructor(level, weight, resistance, config) {
        this.#level = level;
        this.#weight = weight;
        this.#resistance = resistance;
        this.#config = config;
        this.#powerDebuff = 0;
        this.#behavior = new FishBehavior(config);
        
        window.DEBUG_LIVE_FISH_POWER = this.getInitialPower();
    }

    getWeight() { return this.#weight; }
    getInitialPower() { return (this.#level * this.#weight) + this.#resistance; }
    getPower() { 
        const initial = this.getInitialPower();
        const current = Math.max(0, initial - this.#powerDebuff);
        return current * this.#masteryPowerMult; // Застосовуємо другий дебаф
    }

    get activeDebuffName() { 
        // Якщо є активний дебаф, повертаємо його ім'я, інакше 'Немає'
        return this.#hasActiveDebuff ? (this.#lastDebuffName || 'Невідомий') : 'Немає'; 
    }
    
    getMasteryMultiplier() { return this.#masteryPowerMult; }

    // --- ЛОГІКА ДРУГОГО ДЕБАФУ (MASTERY) ---
    setMasteryMultiplier(currentMultiplier) {
        // Оновлюється кожен кадр плавно, тому без console.log
        this.#masteryPowerMult = Number(currentMultiplier); 
    }

    clearMasteryDebuff() {
        if (this.#masteryPowerMult !== 1.0) {
            this.#masteryPowerMult = 1.0;
            console.log(`[MASTERY] Риба вирвалась з центру! Плавне підкорення скинуто.`);
        }
    }

    get hasActiveDebuff() { return this.#hasActiveDebuff; }

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

    // --- СИСТЕМА ДЕБАФІВ ---
    applyRandomDebuff(debuffsCfg) {
        const behaviors = this.#config.fish?.behaviors || this.#config.behaviors;
        if (!behaviors) return;

        // Зберігаємо оригінал при першому застосуванні
        if (!this.#originalBehaviors) {
            this.#originalBehaviors = JSON.parse(JSON.stringify(behaviors));
        }

        this.clearDebuff();
        this.#hasActiveDebuff = true;

        const types = ['swimPull', 'dashMaxTime', 'idleMaxTime', 'dashPull', 'restWeight', 'restMaxTime'];
        const debuffType = types[Math.floor(Math.random() * types.length)];
        this.#lastDebuffName = debuffType;
        console.log(`[DEBUFF] Фаза 2 виснажена! Дебаф: ${debuffType}`);

        switch(debuffType) {
            case 'swimPull': if (behaviors.swim) behaviors.swim.pull *= debuffsCfg.swimPullMult; break;
            case 'dashMaxTime': if (behaviors.dash) behaviors.dash.maxTime *= debuffsCfg.dashMaxTimeMult; break;
            case 'idleMaxTime': if (behaviors.idle) behaviors.idle.maxTime *= debuffsCfg.idleMaxTimeMult; break;
            case 'dashPull': if (behaviors.dash) behaviors.dash.pull *= debuffsCfg.dashPullMult; break;
            case 'restWeight':
                if (behaviors.rest) {
                    behaviors.rest.weight += debuffsCfg.restWeightAdd;
                    if (behaviors.swim) behaviors.swim.weight = Math.max(1, behaviors.swim.weight - debuffsCfg.restWeightAdd);
                }
                break;
            case 'restMaxTime': if (behaviors.rest) behaviors.rest.maxTime *= debuffsCfg.restMaxTimeMult; break;
        }
    }

    clearDebuff() {
        if (!this.#originalBehaviors || !this.#hasActiveDebuff) return;
        const behaviors = this.#config.fish?.behaviors || this.#config.behaviors;
        for (const key in this.#originalBehaviors) {
            if (behaviors[key]) Object.assign(behaviors[key], this.#originalBehaviors[key]);
        }
        this.#hasActiveDebuff = false;
        console.log(`[DEBUFF] Стаміна 100%. Дебафи знято.`);
    }

    // Старі методи LastDash
    tryTriggerLastDash(dt) {
        const fishCfg = this.#config.fish || this.#config;
        const triggerCfg = fishCfg.lastDashTrigger;
        if (!triggerCfg) return;
        if (this.#isLastDashTriggered && (triggerCfg.isLocked ?? true)) return;

        this.#lastDashTimer += dt;
        const interval = triggerCfg.checkIntervalMs ?? 1000;
        
        if (this.#lastDashTimer >= interval) {
            this.#lastDashTimer = 0;
            const currentBehavior = this.#behavior.getStateData();
            const targetState = triggerCfg.targetState || 'lastDash';
            
            if (currentBehavior.name === targetState) return;
            if (Math.random() <= (triggerCfg.chance ?? 0.05)) this.triggerLastDash();
        }
    }

    triggerLastDash() {
        const fishCfg = this.#config.fish || this.#config;
        const triggerCfg = fishCfg.lastDashTrigger;
        if (!this.#isLastDashTriggered) {
            this.#powerDebuff *= 0.5; 
            this.#isLastDashTriggered = true;
        }
        this.#behavior.forceState(triggerCfg?.targetState || 'lastDash', triggerCfg?.isLocked ?? false);
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
            escapeForceX = pushDirection * spatialPenalty * finalBehavior.edgePowerMultiplier * basePower;
        }
        
        force.x = (finalBehavior.moveX * basePower) + escapeForceX;
        
        return force;
    }
}
// Візуальне представлення поплавця та його поведінка під час клювання
class FloatEntity {
    #position;
    #velocity;
    #friction;
    #config;
    #sinkingDelayTimer = 0;
    
    #isBiting = false;
    #isGuaranteed = false;
    #isHooked = false;
    #currentColor;
    
    #currentAngle = 0;
    #currentScaleY = 1.0;
    
    #sequenceQueue = [];
    #animTimer = 0;
    #animDuration = 0;
    
    #currentSequenceCount = 0;
    #targetSequenceCount = 0;
    
    #startAnimState = null;
    #targetAnimState = null;

    #currentBiteMoveVelocity;
    #biteMoveTimer = 0;
    
    #baseColor;

    #currentHookDepth = 0.1;
    #targetHookDepth = 0.1;
    #isSinking = false;
    #sinkingTimer = 0;
    #sinkingTotalTime = 0;
    #sinkingStartAngle = 90;
    
    #perspectiveScale = 1.0;
    #sinkerHeightScale = 1.0;
    #isOverDepth = false;

    #windAngleOffset = 0;
    #targetWindAngle = 0;
    #windTimer = 0;
    #windFluctuationTimer = 0;

    constructor(x, y, config) {
        this.#position = new Vector2(x, y);
        this.#velocity = new Vector2(0, 0);
        this.#currentBiteMoveVelocity = new Vector2(0, 0);
        this.#friction = config.float.friction || 0.85;
        this.#config = config;
        this.#baseColor = config.float.type === 'day' ? '#ffffff' : '#00ff80';
        this.#currentColor = this.#baseColor;
    }

    applyForce(force) {
        this.#velocity.add(force);
    }

    cast(x, y, targetDepth, isOverDepth, sinkerConfig, distanceRatio) {
        this.#position.x = x;
        this.#position.y = y;
        this.#velocity = new Vector2(0, 0);
        this.#isHooked = false;
        this.#isBiting = false;
        this.stopBite();

        this.#targetHookDepth = targetDepth;
        this.#currentHookDepth = 0.1;
        this.#isOverDepth = isOverDepth;
        
        const weightCfg = sinkerConfig.weights[sinkerConfig.weight];
        this.#sinkerHeightScale = weightCfg.heightScale;
        
        const pRange = this.#config.float.perspectiveScaleRange || [1.3, 0.7];
        this.#perspectiveScale = pRange[0] + distanceRatio * (pRange[1] - pRange[0]);
        
        this.#isSinking = true;
        this.#sinkingDelayTimer = this.#config.float.sinkingDelayMs || 500;
        
        const maxDepth = sinkerConfig.maxDepth || 8.0;
        const depthRatio = Math.max(0.1, Math.min(1.0, targetDepth / maxDepth)); 
        const baseSinkingTime = (this.#config.float.sinkingDurationMs || 4000) * depthRatio;
        
        this.#sinkingTotalTime = baseSinkingTime / weightCfg.speedMult;
        this.#sinkingTimer = this.#sinkingTotalTime;
        
        this.#sinkingStartAngle = Math.random() < 0.5 ? 90 : -90;
        this.#currentAngle = this.#sinkingStartAngle;
        this.#currentScaleY = 1.0;
    }

    getCurrentHookDepth() {
        return this.#currentHookDepth;
    }

    update(boundsRect, dt, environment) {
        if (this.#isSinking) {
            if (this.#sinkingDelayTimer > 0) {
                this.#sinkingDelayTimer -= dt;
            } else {
                this.#sinkingTimer -= dt;
                let progress = 1.0 - Math.max(0, this.#sinkingTimer / this.#sinkingTotalTime);
                
                this.#currentHookDepth = this.#lerp(0.1, this.#targetHookDepth, progress);
                
                if (!this.#isBiting) {
                    if (this.#isOverDepth) {
                        this.#currentAngle = this.#sinkingStartAngle; 
                    } else {
                        this.#currentAngle = this.#lerp(this.#sinkingStartAngle, 0, progress);
                    }
                }

                if (this.#sinkingTimer <= 0) {
                    this.#isSinking = false;
                    this.#currentHookDepth = this.#targetHookDepth;
                    if (!this.#isBiting && !this.#isOverDepth) {
                        this.#currentAngle = 0;
                    }
                }
            }
        }

        if (!this.#isHooked) {
            if (environment) {
                if (environment.current) {
                    const sinkerQual = Math.max(1, Math.min(10, this.#config.sinker.quality || 1));
                    const currentCompRange = this.#config.sinker.currentCompensation || [0.1, 0.99];
                    const currentComp = this.#lerp(currentCompRange[0], currentCompRange[1], (sinkerQual - 1) / 9);
                    
                    const driftSpeed = environment.current.speedPxPerSec * (1 - currentComp);
                    this.#position.x += environment.current.direction.x * driftSpeed * (dt / 1000);
                    this.#position.y += environment.current.direction.y * driftSpeed * (dt / 1000);
                }

                const isFishActivelyPulling = this.#isBiting && (Math.abs(this.#currentAngle) > 0.5 || Math.abs(this.#currentScaleY - 1.0) > 0.02);

                // ДОДАНО: !this.#isSinking, щоб вітер не дув на поплавок, поки той ще опускається
                if (environment.wind && !isFishActivelyPulling && !this.#isSinking) {
                    const dir = environment.wind.direction;
                    const floatQual = Math.max(1, Math.min(10, this.#config.float.quality || 1));
                    const windCompRange = this.#config.float.windCompensation || [0.1, 0.99];
                    const windComp = this.#lerp(windCompRange[0], windCompRange[1], (floatQual - 1) / 9);

                    this.#windFluctuationTimer -= dt;

                    if (this.#windTimer > 0) {
                        this.#windTimer -= dt;
                        
                        // Під час пориву вітру - швидкі та сильні хитання
                        if (this.#windFluctuationTimer <= 0) {
                            const gustAngle = this.#getRandom(environment.wind.gustAngleRange) * dir;
                            this.#targetWindAngle = gustAngle * (1 - windComp);
                            this.#windFluctuationTimer = this.#getRandom(environment.wind.gustFluctuationMs);
                        }
                    } else {
                        // Спокійний вітер - плавні та легкі хитання
                        if (this.#windFluctuationTimer <= 0) {
                            const breezeAngle = this.#getRandom(environment.wind.breezeAngleRange) * dir;
                            this.#targetWindAngle = breezeAngle * (1 - windComp);
                            this.#windFluctuationTimer = this.#getRandom(environment.wind.gustFluctuationMs) * 3;
                        }

                        // Шанс на новий порив
                        if (Math.random() < environment.wind.gustChancePerSec * (dt / 1000)) {
                            this.#windTimer = this.#getRandom(environment.wind.gustDurationMs);
                            this.#windFluctuationTimer = 0; 
                        }
                    }
                } else {
                    this.#targetWindAngle = 0;
                    this.#windTimer = 0;
                    this.#windFluctuationTimer = 0;
                }
            } else {
                this.#targetWindAngle = 0;
                this.#windTimer = 0;
                this.#windFluctuationTimer = 0;
            }
        } else {
            this.#targetWindAngle = 0;
            this.#windTimer = 0;
            this.#windFluctuationTimer = 0;
        }

        // Згладжування кута завжди працює тут
        this.#windAngleOffset = this.#lerp(this.#windAngleOffset, this.#targetWindAngle, dt * 0.005);

        if (!this.#isBiting) {
            this.#position.add(this.#velocity);
            this.#velocity.multiplyScalar(this.#friction);
        }

        if (this.#position.x < boundsRect.left) this.#position.x = boundsRect.left;
        if (this.#position.x > boundsRect.right) this.#position.x = boundsRect.right;
        if (this.#position.y < boundsRect.top) this.#position.y = boundsRect.top;
        if (this.#position.y > boundsRect.bottom) this.#position.y = boundsRect.bottom;
    }

    getPosition() { return this.#position; }

    getVisualState() {
        let finalAngle = this.#currentAngle;
        
        if (!this.#isSinking && !this.#isHooked) {
            finalAngle += this.#windAngleOffset;
        }

        return {
            color: this.#currentColor,
            angle: finalAngle,
            scaleY: this.#currentScaleY * this.#sinkerHeightScale,
            perspectiveScale: this.#perspectiveScale
        };
    }

    isGuaranteedBite() { return this.#isGuaranteed; }
    isHooked() { return this.#isHooked; }
    isBiting() { return this.#isBiting; }

    hook() {
        this.#isHooked = true;
        this.#isBiting = false;
        
        this.#velocity.x = 0;
        this.#velocity.y = 0;
        
        this.#currentBiteMoveVelocity.x = 0;
        this.#currentBiteMoveVelocity.y = 0;
        this.#biteMoveTimer = 0;
    }

    startBite() {
        this.#isBiting = true;
        this.#isHooked = false;
        
        const seqCfg = this.#config.float.biteSequence;
        this.#currentSequenceCount = 1;
        this.#targetSequenceCount = Math.floor(this.#getRandom(seqCfg.maxSequences));
        
        this.#rollBiteSequence();
    }

    stopBite() {
        this.#isBiting = false;
        this.#sequenceQueue = [];
        this.#currentAngle = 0;
        this.#currentScaleY = 1.0;
        this.#currentColor = this.#baseColor;
        this.#biteMoveTimer = 0;
    }

    updateBite(dt) {
        if (!this.#isBiting) return;

        if (this.#isOverDepth) {
            this.#animTimer -= dt;
            if (this.#animTimer <= 0) {
                this.stopBite();
            }
            return;
        }

        if (this.#biteMoveTimer > 0) {
            this.#biteMoveTimer -= dt;
            this.#position.x += this.#currentBiteMoveVelocity.x * (dt / 1000);
            this.#position.y += this.#currentBiteMoveVelocity.y * (dt / 1000);
        }

        this.#animTimer -= dt;

        if (this.#animTimer <= 0) {
            if (this.#sequenceQueue.length > 0) {
                this.#nextAnimStep();
            } else {
                if (this.#currentSequenceCount >= this.#targetSequenceCount) {
                    this.stopBite(); 
                } else {
                    this.#currentSequenceCount++;
                    this.#rollBiteSequence();
                }
            }
        } else if (this.#startAnimState && this.#targetAnimState) {
            const progress = 1.0 - (this.#animTimer / this.#animDuration);
            const ease = this.#easeInOutQuad(Math.max(0, Math.min(1, progress)));

            this.#currentAngle = this.#lerp(this.#startAnimState.angle, this.#targetAnimState.angle, ease);
            this.#currentScaleY = this.#lerp(this.#startAnimState.scaleY, this.#targetAnimState.scaleY, ease);
        }
    }

    #rollBiteSequence() {
        const seqCfg = this.#config.float.biteSequence;
        const isRed = Math.random() <= seqCfg.chanceGuaranteed;
        const color = isRed ? '#ff0000' : '#ffff00';
        const range = isRed ? seqCfg.guaranteedIters : seqCfg.normalIters;
        const iters = Math.floor(this.#getRandom(range));

        if (this.#currentSequenceCount > 1) {
            this.#sequenceQueue.push({
                duration: this.#getRandom(seqCfg.sequenceIntervalMs),
                angle: 0,
                scaleY: 1.0,
                startMove: false,
                color: this.#baseColor,
                isGuaranteed: false
            });
        }

        for (let i = 0; i < iters; i++) {
            const steps = this.#generateRandomAnim(isRed);
            steps.forEach(s => {
                s.color = color;
                s.isGuaranteed = isRed;
                this.#sequenceQueue.push(s);
            });

            this.#sequenceQueue.push({
                duration: this.#getRandom(seqCfg.intervalMs),
                angle: 0,
                scaleY: 1.0,
                startMove: false,
                color: color,
                isGuaranteed: isRed
            });
        }
        
        this.#nextAnimStep();
    }

    #generateRandomAnim(isRed) {
        const seqCfg = this.#config.float.biteSequence;
        const animsCfg = seqCfg.animations;
        const mods = seqCfg.guaranteedModifiers;
        
        const types = ['bob', 'sink', 'rise', 'tilt', 'slide'];
        const chosen = types[Math.floor(Math.random() * types.length)];
        const cfg = animsCfg[chosen] || {};

        let targetAngle = 0;
        let targetScaleY = 1.0;
        let holdDuration = 0;
        let duration = this.#getRandom(seqCfg.animDurationMs);

        if (chosen === 'bob') {
            let range = [...cfg.heightPercent];
            if (isRed) {
                range[0] -= mods.bobAmpAdd;
                range[1] += mods.bobAmpAdd;
            }
            targetScaleY = Math.max(0, 1.0 + (this.#getRandom(range) / 100));
        } else if (chosen === 'sink') {
            let range = isRed ? mods.sinkHeightPercent : cfg.heightPercent;
            targetScaleY = Math.max(0, 1.0 + (this.#getRandom(range) / 100));
            if (isRed) holdDuration = this.#getRandom(mods.holdDurationMs);
        } else if (chosen === 'rise') {
            let range = isRed ? mods.riseHeightPercent : cfg.heightPercent;
            targetScaleY = Math.max(0, 1.0 + (this.#getRandom(range) / 100));
            if (isRed) holdDuration = this.#getRandom(mods.holdDurationMs);
        } else if (chosen === 'tilt') {
            if (isRed) {
                targetAngle = this.#getRandom(mods.tiltAngle);
                holdDuration = this.#getRandom(mods.holdDurationMs); 
            } else {
                targetAngle = this.#getRandom(cfg.angle);
            }
        }

        let moveVelX = 0, moveVelY = 0, moveTime = 0;
        let startMove = false;

        if (chosen === 'slide' || Math.random() <= seqCfg.movementChance) {
            startMove = true;
            moveTime = this.#getRandom(seqCfg.movementDurationMs);
            let speed = this.#getRandom(seqCfg.movementSpeedPx);
            
            if (isRed) {
                const speedMult = this.#getRandom(mods.movementSpeedMult);
                const durationMult = this.#getRandom(mods.movementDurationMult);
                moveTime *= durationMult;
                speed *= speedMult;
            }
            
            const dirAngle = Math.random() * Math.PI * 2;
            moveVelX = Math.cos(dirAngle) * speed;
            moveVelY = Math.sin(dirAngle) * speed;

            duration = Math.max(100, moveTime - holdDuration);
        }

        if (targetAngle !== 0) {
            if (startMove && moveVelX !== 0) {
                const isMovingRight = moveVelX > 0;
                targetAngle = Math.abs(targetAngle) * (isMovingRight ? -1 : 1);
            } else {
                if (Math.random() < 0.5) targetAngle = -targetAngle;
            }
        }

        const steps = [];
        
        steps.push({
            duration: duration,
            angle: targetAngle,
            scaleY: targetScaleY,
            startMove: startMove,
            moveVelX: moveVelX,
            moveVelY: moveVelY,
            moveTime: moveTime
        });

        if (holdDuration > 0) {
            steps.push({
                duration: holdDuration,
                angle: targetAngle,
                scaleY: targetScaleY,
                startMove: false
            });
        }

        return steps;
    }

    #nextAnimStep() {
        const anim = this.#sequenceQueue.shift();
        
        // Запам'ятовуємо, чи була попередня фаза гарантованою
        const wasGuaranteed = this.#isGuaranteed; 

        this.#animDuration = anim.duration;
        this.#animTimer = anim.duration;
        this.#currentColor = anim.color || this.#baseColor;
        this.#isGuaranteed = anim.isGuaranteed || false;

        // --- ДОДАНО: Запобіжник ---
        // Якщо червона фаза закінчилася, примусово гасимо залишковий рух, 
        // щоб поплавок не "летів", коли він вже жовтий
        if (wasGuaranteed && !this.#isGuaranteed) {
            this.#biteMoveTimer = 0;
            this.#currentBiteMoveVelocity.x = 0;
            this.#currentBiteMoveVelocity.y = 0;
        }

        this.#startAnimState = {
            angle: this.#currentAngle,
            scaleY: this.#currentScaleY
        };

        this.#targetAnimState = {
            angle: anim.angle,
            scaleY: anim.scaleY
        };

        if (anim.startMove) {
            this.#currentBiteMoveVelocity.x = anim.moveVelX;
            this.#currentBiteMoveVelocity.y = anim.moveVelY;
            this.#biteMoveTimer = anim.moveTime;
        }
    }

    #easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    #lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    #getRandom(arr) {
        return arr[0] + Math.random() * (arr[1] - arr[0]);
    }
}
// Логіка витривалості риби та її виснаження під час боротьби
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
            // БАГ ВИПРАВЛЕНО: Миттєві 5% прибрано. Тепер стаміна починається з 0, що дає плавний перехід.
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

    // НОВИЙ МЕТОД: Карає гравця, відновлюючи Фазу 2
    applyPunishment(capPercent) {
        const cap = this.#maxPoints * capPercent;
        if (this.#currentExhaustion < cap) {
            this.#currentExhaustion = cap;
            console.log(`[STAMINA] Риба відновилася! Виснаження повернулося до ${(capPercent*100)}%`);
        }
    }
}
// Контролер, який керує логікою витривалості риби та її виснаження
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
        // 1. Малюємо кешовану статичну сітку (з цифрами та зонами) одним викликом!
        const debugCanvas = locationMap.getDebugCanvas();
        if (debugCanvas) {
            const pos = projector.virtualToScreen(0, 0);
            const scale = projector.getScale();
            const w = debugCanvas.width * scale;
            const h = debugCanvas.height * scale;
            
            const prevAlpha = this.#ctx.globalAlpha;
            this.#ctx.globalAlpha = config.locations.debugOpacity || 0.7; // Застосовуємо прозорість з конфігу
            this.#ctx.drawImage(debugCanvas, pos.x, pos.y, w, h);
            this.#ctx.globalAlpha = prevAlpha;
        }

        // 2. Динамічні зони (зграї риб або буфи) малюємо кадр за кадром, бо вони рухаються
        const dynamicZones = locationMap.getDynamicZones();
        const cellSize = config.locations.cellSize;
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
        if (!config.locations.debugVisuals) return;

        const bounds = locationMap.getCastableBoundsVirtual(config.locations.cellSize);
        const virtualBottomY = bounds ? bounds.bottom : Infinity;
        const mapBottomScreenY = projector.virtualToScreen(0, virtualBottomY).y;

        const catchLineY = Math.min(mapBottomScreenY, this.#canvas.height);
        const heightToDraw = this.#canvas.height - catchLineY;

        // Зчитуємо стани прямо з конфігу локацій
        const showCatch = config.locations.showCatchZone !== false; 
        const showNet = config.locations.showNetZone !== false;     

        // 1. МАЛЮЄМО СИНЮ ЗОНУ
        if (showCatch) {
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
        }

        // 2. МАЛЮЄМО ЗЕЛЕНУ ЗОНУ
        if (showNet && config.net && config.net.active) {
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

    drawFloat(screenPos, floatEntity, config) {
        const visualState = floatEntity.getVisualState();
        const pScale = visualState.perspectiveScale;
        const width = config.float.width * pScale;
        const length = config.float.length * pScale;

        this.#ctx.save();
        this.#ctx.translate(screenPos.x, screenPos.y);

        if (floatEntity.isHooked()) {
            this.#ctx.fillStyle = visualState.color;
            this.#ctx.fillRect(-1.5 * pScale, -3 * pScale, 3 * pScale, 3 * pScale);
            this.#ctx.restore();
            return;
        }

        this.#ctx.rotate((visualState.angle * Math.PI) / 180);
        this.#ctx.fillStyle = visualState.color;

        const currentLength = length * visualState.scaleY;
        this.#ctx.fillRect(-width / 2, -currentLength, width, currentLength);

        this.#ctx.restore();
    }

    drawRodLine(floatPos, gameState, tension, lineLengthRatio, lineDropOffset, config) { 
        // 1. Відмальовуємо саму вудку
        const rodWidth = 3;
        const rodHeight = 200;
        
        let rodBaseX = this.#resolveX(config.ui?.rod?.x, rodWidth);
        const rodBaseY = this.#canvas.height - (config.ui?.rod?.yOffset || 0);
        const rodTopY = rodBaseY - rodHeight;

        this.#ctx.fillStyle = '#000000';
        this.#ctx.fillRect(rodBaseX - (rodWidth / 2), rodTopY, rodWidth, rodHeight);

        if (config.ui?.line?.visible === false) return;

        // 2. Динамічне занурення ліски (довжина + глибина тонення)
        // Рахуємо так завжди, бо якщо lineLengthRatio = 1 і lineDropOffset = 0, 
        // то targetX/Y будуть ідеально дорівнювати floatPos.x/y
        let targetX = rodBaseX + (floatPos.x - rodBaseX) * lineLengthRatio;
        let targetY = rodTopY + (floatPos.y - rodTopY) * lineLengthRatio;
        
        // Магія тонення: тягнемо візуальний кінчик ліски на дно
        targetY += lineDropOffset;

        // 3. Динамічний колір та товщина від натягу
        let lineColor = config.ui?.line?.color || 'rgba(255, 255, 255, 0.3)';
        let lineWidth = config.ui?.line?.width || 1;

        if (gameState === 'playing') {
            if (tension >= 100) {
                const isRed = Math.floor(performance.now() / 80) % 2 === 0;
                lineColor = isRed ? 'rgba(255, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)';
                lineWidth = Math.max(lineWidth, 2);
            } else if (tension >= 90) {
                const intensity = (tension - 90) / 10;
                const r = Math.floor(150 + (105 * intensity));
                lineColor = `rgba(${r}, 0, 0, ${0.5 + 0.4 * intensity})`;
                lineWidth = Math.max(lineWidth, 1.5);
            }
        }

        // 4. Малюємо саму ліску з плавним провисанням
        this.#ctx.save();
        this.#ctx.beginPath();
        this.#ctx.moveTo(rodBaseX, rodTopY); 

        const straightenThreshold = config.ui?.line?.straightenTension || 50;
        const sagOffset = config.ui?.line?.sagOffset || 60;
        
        let straightFactor = 0;
        if (gameState === 'playing') {
            straightFactor = Math.min(1, Math.max(0, tension / straightenThreshold));
        }

        const cpX = (rodBaseX + targetX) / 2;
        const straightCpY = (rodTopY + targetY) / 2;
        const slackCpY = Math.max(rodTopY, targetY) + sagOffset;

        const currentCpY = slackCpY + (straightCpY - slackCpY) * straightFactor;

        this.#ctx.quadraticCurveTo(cpX, currentCpY, targetX, targetY);

        this.#ctx.strokeStyle = lineColor;
        this.#ctx.lineWidth = lineWidth;
        this.#ctx.stroke();
        this.#ctx.restore();
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

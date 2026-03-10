class Fish {
    #level;
    #weight;
    #resistance;
    #fishConfig;
    #powerDebuff;
    #behavior;
    #isLastDashTriggered = false;
    #lastDashTimer = 0;
    #masteryPowerMult = 1.0;
    #lastDebuffName = null;
    
    #originalBehaviors = null;
    #hasActiveDebuff = false;

    constructor(level, weight, resistance, fishConfig) {
        this.#level = level;
        this.#weight = weight;
        this.#resistance = resistance;
        this.#fishConfig = fishConfig;
        this.#powerDebuff = 0;
        this.#behavior = new FishBehavior(this.#fishConfig);
    }

    getWeight() { return this.#weight; }
    getInitialPower() { return (this.#level * this.#weight) + this.#resistance; }
    
    getPower() { 
        const initial = this.getInitialPower();
        const current = Math.max(0, initial - this.#powerDebuff);
        return current * this.#masteryPowerMult;
    }

    get activeDebuffName() { 
        return this.#hasActiveDebuff ? (this.#lastDebuffName || 'Невідомий') : 'Немає'; 
    }
    
    getMasteryMultiplier() { return this.#masteryPowerMult; }

    setMasteryMultiplier(currentMultiplier) {
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

    applyRandomDebuff(debuffsCfg) {
        const behaviors = this.#fishConfig.behaviors;
        if (!behaviors) return;

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
        const behaviors = this.#fishConfig.behaviors;
        for (const key in this.#originalBehaviors) {
            if (behaviors[key]) Object.assign(behaviors[key], this.#originalBehaviors[key]);
        }
        this.#hasActiveDebuff = false;
        console.log(`[DEBUFF] Стаміна 100%. Дебафи знято.`);
    }

    tryTriggerLastDash(dt) {
        const triggerCfg = this.#fishConfig.lastDashTrigger;
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
        const triggerCfg = this.#fishConfig.lastDashTrigger;
        if (!this.#isLastDashTriggered) {
            this.#powerDebuff *= 0.5; 
            this.#isLastDashTriggered = true;
        }
        this.#behavior.forceState(triggerCfg?.targetState || 'lastDash', triggerCfg?.isLocked ?? false);
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

    constructor(fishConfig) {
        this.#config = fishConfig;
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
        if (!states) return;
        
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

class FishCondition {
    #maxPoints;
    #currentStamina;
    #currentExhaustion;
    #phase;

    constructor(level, weight, staminaFishConfig) {
        this.#maxPoints = (level * weight * staminaFishConfig.baseStaminaMultiplier) + staminaFishConfig.flatBonus;
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

    applyPunishment(capPercent) {
        const cap = this.#maxPoints * capPercent;
        if (this.#currentExhaustion < cap) {
            this.#currentExhaustion = cap;
            console.log(`[STAMINA] Риба відновилася! Виснаження повернулося до ${(capPercent*100)}%`);
        }
    }
}
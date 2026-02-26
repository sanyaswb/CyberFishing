class CastManager {
    #baseCooldown;
    #penaltyStep;
    #resetTime;
    #currentPenalty;
    #lastCastTime;
    #cooldownTimer;

    constructor(config) {
        this.#baseCooldown = config.spawns.antiSpam.baseCooldownMs;
        this.#penaltyStep = config.spawns.antiSpam.penaltyStepMs;
        this.#resetTime = config.spawns.antiSpam.resetTimeMs;
        this.#currentPenalty = 0;
        this.#lastCastTime = 0;
        this.#cooldownTimer = 0;
    }

    update(dt) {
        if (this.#cooldownTimer > 0) {
            this.#cooldownTimer -= dt;
        }
    }

    canCast() {
        return this.#cooldownTimer <= 0;
    }

    registerCast(currentTimeMs) {
        const timeSinceLast = currentTimeMs - this.#lastCastTime;

        if (timeSinceLast > this.#resetTime) {
            this.#currentPenalty = 0;
        } else {
            this.#currentPenalty += this.#penaltyStep;
        }

        this.#lastCastTime = currentTimeMs;
        this.#cooldownTimer = this.#baseCooldown + this.#currentPenalty;
        
        if (typeof DEBUG_MODULES !== 'undefined' && DEBUG_MODULES.forces) {
            console.log(`[CastManager] Закидання. Кулдаун: ${this.#cooldownTimer}мс`);
        }
    }
}
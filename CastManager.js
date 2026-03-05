class CastManager {
    #penaltyLevel;
    #timer;
    #lastCastTime;

    constructor(config) {
        this.#penaltyLevel = 0;
        this.#timer = 0;
        this.#lastCastTime = 0;
    }

    update(dt) {
        if (this.#timer > 0) {
            this.#timer -= dt;
            
            if (this.#timer <= 0 && this.#penaltyLevel > 0) {
                this.#penaltyLevel--;
                if (this.#penaltyLevel > 0) {
                    this.#timer = 2000;
                }
            }
        }
    }

    canCast() {
        return true; 
    }

    registerCast(currentTimeMs) {
        const timeSinceLast = currentTimeMs - this.#lastCastTime;
        this.#lastCastTime = currentTimeMs;

        const spamWindow = Math.max(2000, this.#timer);

        if (timeSinceLast <= spamWindow) {
            this.#penaltyLevel = Math.min(4, this.#penaltyLevel + 1);
            
            if (this.#penaltyLevel === 4) {
                this.#timer = 5000;
            } else {
                this.#timer = 2000;
            }
        }
        
        if (typeof window.DEBUG_MODULES !== 'undefined' && window.DEBUG_MODULES.forces) {
            console.log(`[CastManager] Закидання. Штраф: -${this.#penaltyLevel * 25}%. Таймер: ${this.#timer}мс`);
        }
    }

    getBiteChanceMultiplier() {
        return Math.max(0, 1.0 - (this.#penaltyLevel * 0.25));
    }
}
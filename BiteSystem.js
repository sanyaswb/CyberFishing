class BiteSystem {
    #config;
    #fishDatabase;
    #tickRate;
    #timer;

    constructor(config) {
        this.#config = config;
        this.#fishDatabase = config.spawns.fishes;
        this.#tickRate = config.spawns.tickRateMs;
        this.#timer = 0;
    }

    reset() {
        this.#timer = 0;
    }

    #lerp(start, end, t) {
        return start * (1 - t) + end * t;
    }

    #generateFishInstance(fish, currentDepth) {
        const dc = fish.depthConfig;
        const wc = fish.weightConfig;

        let t = (currentDepth - dc.minDepth) / (dc.maxDepth - dc.minDepth);
        t = Math.max(0, Math.min(1, t));

        const currentMinWeight = this.#lerp(dc.minWeightAtMinDepth, dc.minWeightAtMaxDepth, t);
        const currentMaxWeight = this.#lerp(dc.maxWeightAtMinDepth, dc.maxWeightAtMaxDepth, t);

        const roll = Math.pow(Math.random(), wc.rarityCurve);
        const generatedWeight = currentMinWeight + (currentMaxWeight - currentMinWeight) * roll;

        const absoluteMin = dc.minWeightAtMinDepth;
        const absoluteMax = dc.maxWeightAtMaxDepth;
        const weightRatio = (generatedWeight - absoluteMin) / (absoluteMax - absoluteMin);

        const generatedLevel = Math.max(1, Math.round(weightRatio * wc.maxLevel));
        const generatedResistance = this.#lerp(wc.baseResistance, wc.maxResistance, weightRatio);

        return {
            id: fish.id,
            name: fish.name,
            weight: generatedWeight,
            level: generatedLevel,
            resistance: generatedResistance,
            physics: fish.physics
        };
    }

    evaluateBite(dt, envData, playerGear) {
        this.#timer += dt;
        
        if (this.#timer < this.#tickRate) return null;
        this.#timer -= this.#tickRate;

        let possibleBites = [];

        for (const fish of this.#fishDatabase) {
            const dc = fish.depthConfig;

            if (playerGear.hookSize > fish.maxHookSize) continue;
            if (envData.depth < dc.minDepth || envData.depth > dc.maxDepth) continue;

            const baitMult = fish.baitMultipliers[playerGear.baitId] || 0;
            if (baitMult === 0) continue;

            let t = (envData.depth - dc.minDepth) / (dc.maxDepth - dc.minDepth);
            t = Math.max(0, Math.min(1, t));

            const depthChanceMult = this.#lerp(1.0, dc.chanceMultAtMaxDepth, t);

            let finalChance = fish.baseChance;
            finalChance *= baitMult;
            finalChance *= fish.timeMultipliers[envData.timePhase] || 1.0;
            finalChance *= fish.dayMultipliers[envData.dayOfWeek] || 1.0;
            finalChance *= envData.zoneMultiplier || 1.0;
            finalChance *= depthChanceMult; 

            if (envData.isRaining) {
                finalChance *= fish.weatherMultipliers?.rain ?? 1.0;
            }
            if (envData.isFoggy) {
                finalChance *= fish.weatherMultipliers?.fog ?? 1.0;
            }
            // apply spam multiplier penalty/bonus
            finalChance *= (envData.castSpamMultiplier ?? 1.0);
            if (Math.random() <= finalChance) {
                possibleBites.push(fish);
            }
        }

        if (possibleBites.length > 0) {
            const randomIndex = Math.floor(Math.random() * possibleBites.length);
            const selectedFishTemplate = possibleBites[randomIndex];
            
            return this.#generateFishInstance(selectedFishTemplate, envData.depth);
        }

        return null;
    }

    getLiveChances(envData, playerGear) {
        let chances = [];
        
        for (const fish of this.#fishDatabase) {
            const dc = fish.depthConfig;

            if (playerGear.hookSize > fish.maxHookSize) continue;
            if (envData.depth < dc.minDepth || envData.depth > dc.maxDepth) continue;

            const baitMult = fish.baitMultipliers[playerGear.baitId] || 0;
            if (baitMult === 0) continue;

            let t = (envData.depth - dc.minDepth) / (dc.maxDepth - dc.minDepth);
            t = Math.max(0, Math.min(1, t));
            const depthChanceMult = this.#lerp(1.0, dc.chanceMultAtMaxDepth, t);

            let finalChance = fish.baseChance;
            finalChance *= baitMult;
            finalChance *= fish.timeMultipliers[envData.timePhase] || 1.0;
            finalChance *= fish.dayMultipliers[envData.dayOfWeek] || 1.0;
            finalChance *= envData.zoneMultiplier || 1.0;
            finalChance *= depthChanceMult;
            // include cast spam multiplier for display purposes as well
            finalChance *= (envData.castSpamMultiplier ?? 1.0);

            chances.push({ 
                name: fish.name, 
                chance: (finalChance * 100).toFixed(2) + '%' 
            });
        }
        
        return chances;
    }
}
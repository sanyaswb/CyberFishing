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

class FloatEntity {
    #position;
    #velocity;
    #friction;
    #floatConfig;
    #sinkerConfig;
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

    constructor(x, y, floatConfig) {
        this.#position = new Vector2(x, y);
        this.#velocity = new Vector2(0, 0);
        this.#currentBiteMoveVelocity = new Vector2(0, 0);
        this.#floatConfig = floatConfig;
        this.#sinkerConfig = null;
        this.#friction = floatConfig.friction || 0.85;
        this.#baseColor = floatConfig.type === 'day' ? '#ffffff' : '#00ff80';
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
        this.#sinkerConfig = sinkerConfig;
        
        const weightCfg = sinkerConfig.weights[sinkerConfig.weight];
        this.#sinkerHeightScale = weightCfg.heightScale;
        
        const pRange = this.#floatConfig.perspectiveScaleRange || [1.3, 0.7];
        this.#perspectiveScale = pRange[0] + distanceRatio * (pRange[1] - pRange[0]);
        
        this.#isSinking = true;
        this.#sinkingDelayTimer = this.#floatConfig.sinkingDelayMs || 500;
        
        const maxDepth = sinkerConfig.maxDepth || 8.0;
        const depthRatio = Math.max(0.1, Math.min(1.0, targetDepth / maxDepth)); 
        const baseSinkingTime = (this.#floatConfig.sinkingDurationMs || 4000) * depthRatio;
        
        this.#sinkingTotalTime = baseSinkingTime / weightCfg.speedMult;
        this.#sinkingTimer = this.#sinkingTotalTime;
        
        this.#sinkingStartAngle = Math.random() < 0.5 ? 90 : -90;
        this.#currentAngle = this.#sinkingStartAngle;
        this.#currentScaleY = 1.0;
    }

    getCurrentHookDepth() {
        return this.#currentHookDepth;
    }

    update(boundsRect, dt, environment, checkWater) {
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
                if (environment.current && this.#sinkerConfig) {
                    const sinkerQual = Math.max(1, Math.min(10, this.#sinkerConfig.quality || 1));
                    const currentCompRange = this.#sinkerConfig.currentCompensation || [0.1, 0.99];
                    const currentComp = this.#lerp(currentCompRange[0], currentCompRange[1], (sinkerQual - 1) / 9);
                    
                    const driftSpeed = environment.current.speedPxPerSec * (1 - currentComp);
                    const dx = environment.current.direction.x * driftSpeed * (dt / 1000);
                    const dy = environment.current.direction.y * driftSpeed * (dt / 1000);
                    
                    let nextX = this.#position.x + dx;
                    let nextY = this.#position.y + dy;

                    if (checkWater) {
                        if (!checkWater(nextX, this.#position.y)) nextX = this.#position.x;
                        if (!checkWater(this.#position.x, nextY)) nextY = this.#position.y;
                    }

                    this.#position.x = nextX;
                    this.#position.y = nextY;
                }

                const isFishActivelyPulling = this.#isBiting && (Math.abs(this.#currentAngle) > 0.5 || Math.abs(this.#currentScaleY - 1.0) > 0.02);

                if (environment.wind && !isFishActivelyPulling && !this.#isSinking) {
                    const dir = environment.wind.direction;
                    const floatQual = Math.max(1, Math.min(10, this.#floatConfig.quality || 1));
                    const windCompRange = this.#floatConfig.windCompensation || [0.1, 0.99];
                    const windComp = this.#lerp(windCompRange[0], windCompRange[1], (floatQual - 1) / 9);

                    this.#windFluctuationTimer -= dt;

                    if (this.#windTimer > 0) {
                        this.#windTimer -= dt;
                        
                        if (this.#windFluctuationTimer <= 0) {
                            const gustAngle = this.#getRandom(environment.wind.gustAngleRange) * dir;
                            this.#targetWindAngle = gustAngle * (1 - windComp);
                            this.#windFluctuationTimer = this.#getRandom(environment.wind.gustFluctuationMs);
                        }
                    } else {
                        if (this.#windFluctuationTimer <= 0) {
                            const breezeAngle = this.#getRandom(environment.wind.breezeAngleRange) * dir;
                            this.#targetWindAngle = breezeAngle * (1 - windComp);
                            this.#windFluctuationTimer = this.#getRandom(environment.wind.gustFluctuationMs) * 3;
                        }

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

        this.#windAngleOffset = this.#lerp(this.#windAngleOffset, this.#targetWindAngle, dt * 0.005);

        if (!this.#isBiting) {
            let nextX = this.#position.x + this.#velocity.x;
            let nextY = this.#position.y + this.#velocity.y;

            if (checkWater) {
                if (!checkWater(nextX, this.#position.y)) {
                    this.#velocity.x = 0; 
                    nextX = this.#position.x;
                }
                if (!checkWater(this.#position.x, nextY)) {
                    this.#velocity.y = 0; 
                    nextY = this.#position.y;
                }
            }

            this.#position.x = nextX;
            this.#position.y = nextY;
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
        
        const seqCfg = this.#floatConfig.biteSequence;
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

    updateBite(dt, checkWater) {
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
            let nextX = this.#position.x + this.#currentBiteMoveVelocity.x * (dt / 1000);
            let nextY = this.#position.y + this.#currentBiteMoveVelocity.y * (dt / 1000);

            if (checkWater) {
                if (!checkWater(nextX, this.#position.y)) {
                    this.#currentBiteMoveVelocity.x *= -1; 
                    nextX = this.#position.x;
                }
                if (!checkWater(this.#position.x, nextY)) {
                    this.#currentBiteMoveVelocity.y *= -1;
                    nextY = this.#position.y;
                }
            }

            this.#position.x = nextX;
            this.#position.y = nextY;
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
        const seqCfg = this.#floatConfig.biteSequence;
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
        const seqCfg = this.#floatConfig.biteSequence;
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
        
        const wasGuaranteed = this.#isGuaranteed; 

        this.#animDuration = anim.duration;
        this.#animTimer = anim.duration;
        this.#currentColor = anim.color || this.#baseColor;
        this.#isGuaranteed = anim.isGuaranteed || false;

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
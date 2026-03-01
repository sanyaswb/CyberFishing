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
    #invalidCastMarker;
    #netCatchChance = null;
    #isNetReady = false;
    failReason = null;
    #castManager;
    #biteSystem;
    #isRaining = false;
    #isFoggy = false;
    #weatherTimer = 0;
    #currentBitingFish = null;
    #currentHookDepth = 1.0;
    #depthUI;
    #windState = { direction: 0, rainMult: 1.0, timer: 0 };

    constructor(canvasId) {
        this.#canvas = document.getElementById(canvasId);
        
        this.#inputManager = new InputManager(this.#canvas, CONFIG);
        this.#renderer = new Renderer(this.#canvas);

        this.#uiManager = new UIManager(CONFIG);
        this.#uiManager.onNetClick = () => this.#handleNetClick();
        
        this.#locationMap = new LocationMap('test', CONFIG);
        this.#projector = new ViewportProjector(CONFIG);
        
        this.#depthUI = new DepthSelectorUI();

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
        this.#castManager = new CastManager(CONFIG);
        this.#biteSystem = new BiteSystem(CONFIG);
    }

    #castLine(virtualX, virtualY, bottomDepth) {
        const isOverDepth = this.#currentHookDepth > bottomDepth;
        
        let rodScreenX = this.#canvas.width / 2;
        if (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== 'center') {
            rodScreenX = Number(CONFIG.ui.rod.x);
        }
        const rodScreenY = this.#canvas.height - (CONFIG.ui?.rod?.yOffset || 0);
        const rodVirtualPos = this.#projector.screenToVirtual(rodScreenX, rodScreenY);
        
        const castableBounds = this.#locationMap.getCastableBoundsVirtual(CONFIG.locations.cellSize);
        const maxDistX = Math.max(Math.abs(castableBounds.left - rodVirtualPos.x), Math.abs(castableBounds.right - rodVirtualPos.x));
        const maxDistY = Math.max(Math.abs(castableBounds.top - rodVirtualPos.y), Math.abs(castableBounds.bottom - rodVirtualPos.y));
        const maxPossibleDist = Math.hypot(maxDistX, maxDistY);
        
        const currentDist = Math.hypot(virtualX - rodVirtualPos.x, virtualY - rodVirtualPos.y);
        const distanceRatio = Math.max(0, Math.min(1, currentDist / maxPossibleDist));

        this.#float.cast(virtualX, virtualY, this.#currentHookDepth, isOverDepth, CONFIG.sinker, distanceRatio);
        
        this.#gameState = 'waiting';
        this.#biteSystem.reset();
        this.failReason = null;
    }

    #hookFish(hookedFish) {
        this.#gameState = 'playing';
        this.#netCatchChance = null;
        this.#isNetReady = false;

        const rod = new Rod(CONFIG.rod.level, CONFIG.rod.basePower);
        const reel = new Reel(CONFIG.reel.level, CONFIG.reel.basePower);
        const hook = new Hook(CONFIG.hook.level, CONFIG.hook.weight, CONFIG.hook.quality); 
        
        // 1. Формуємо унікальний конфіг фізики саме для цієї риби
        const fishSpecificConfig = { fish: hookedFish.physics };
        
        // 2. Створюємо рибу з її унікальною вагою, рівнем та опором!
        const fish = new Fish(hookedFish.level, hookedFish.weight, hookedFish.resistance, fishSpecificConfig); 
        
        this.#fishingSystem = new FishingSystem(rod, reel, fish);
        this.#tensionMeter = new TensionMeter(CONFIG.rod.level, CONFIG.reel.level, hook, CONFIG);
        
        // 3. UI теж повинен знати про унікальну вагу
        this.#fishCondition = new FishCondition(hookedFish.level, hookedFish.weight, CONFIG);
        
        const playerBasePower = rod.getPower() + reel.getPower();
        this.#staminaController = new StaminaController(this.#fishCondition, fish, playerBasePower, CONFIG);
        
        // 4. Виводимо паспорт згенерованої риби в консоль
        console.log(`%c🎣 КЛЮНУВ: ${hookedFish.name}!`, 'color: #00ff00; font-size: 16px; font-weight: bold;');
        console.table({
            "Згенерована Вага": hookedFish.weight.toFixed(3) + " кг",
            "Рівень (Складність)": hookedFish.level,
            "Базовий Опір": hookedFish.resistance.toFixed(2)
        });

        document.dispatchEvent(new CustomEvent('debug-fish-hooked', { detail: hookedFish }));
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

        if (inputState.isDoubleClick) {
            if (this.#gameState === 'waiting') {
                this.#gameState = 'scouting';
                if (this.#tensionMeter) this.#tensionMeter.reset();
                if (this.#biteSystem) this.#biteSystem.reset();
                return; 
            }
        }

        if (inputState.longPressPos && this.#gameState === 'waiting') {
            const vPos = this.#projector.screenToVirtual(inputState.longPressPos.x, inputState.longPressPos.y);
            const cell = this.#locationMap.getCellAtVirtualPos(vPos.x, vPos.y, CONFIG.locations.cellSize);
            
            if (cell && cell.isCastable && !cell.hasCollision) {
                this.#castManager.registerCast(performance.now());
                this.#castLine(vPos.x, vPos.y, cell.depth);
            } else {
                this.#invalidCastMarker = { x: inputState.longPressPos.x, y: inputState.longPressPos.y, timer: 500 };
            }
        }
        
        if (this.#gameState === 'scouting') {
            if (!this.#depthUI.isActive) {
                const maxDepth = CONFIG.sinker.maxDepth || 8.0;
                this.#depthUI.show(maxDepth, this.#currentHookDepth, (newDepth) => {
                    this.#currentHookDepth = newDepth;
                });
            }

            if (inputState.panDeltaX !== 0) {
                const virtualDelta = inputState.panDeltaX / this.#projector.getScale();
                this.#projector.pan(virtualDelta);
            }
            
            if (inputState.clickPos) {
                const vPos = this.#projector.screenToVirtual(inputState.clickPos.x, inputState.clickPos.y);
                const cell = this.#locationMap.getCellAtVirtualPos(vPos.x, vPos.y, CONFIG.locations.cellSize);
                
                if (cell && cell.isCastable && !cell.hasCollision) {
                    if (this.#castManager.canCast()) {
                        this.#castManager.registerCast(performance.now());
                        this.#depthUI.hide(); 
                        this.#castLine(vPos.x, vPos.y, cell.depth);
                    } else {
                        this.#invalidCastMarker = { x: inputState.clickPos.x, y: inputState.clickPos.y, timer: 500 };
                    }
                } else {
                    this.#invalidCastMarker = { x: inputState.clickPos.x, y: inputState.clickPos.y, timer: 500 };
                }
            }
            
            if (this.#invalidCastMarker) {
                this.#invalidCastMarker.timer -= dt;
                if (this.#invalidCastMarker.timer <= 0) this.#invalidCastMarker = null;
            }
            return; 
        } else {
            if (this.#depthUI.isActive) {
                this.#depthUI.hide();
            }
        }

        this.#castManager.update(dt);

        const windCfg = CONFIG.locations.map.test.environment.wind;
        
        this.#windState.timer -= dt;
        if (this.#windState.timer <= 0) {
            const changes = windCfg.changesPerDay[0] + Math.random() * (windCfg.changesPerDay[1] - windCfg.changesPerDay[0]);
            this.#windState.timer = (24 * 60 * 60 * 1000) / changes;
            
            const dirs = [-1, 0, 1];
            this.#windState.direction = dirs[Math.floor(Math.random() * dirs.length)];
        }

        this.#weatherTimer -= dt;
        if (this.#weatherTimer <= 0) {
            const weatherCfg = CONFIG.locations.map.test.weather;
            
            this.#isRaining = Math.random() < weatherCfg.chances.rain;
            this.#isFoggy = Math.random() < weatherCfg.chances.fog;
            this.#weatherTimer = weatherCfg.updateIntervalMs;
            
            if (this.#isRaining && windCfg.rainMultiplier) {
                this.#windState.rainMult = windCfg.rainMultiplier[0] + Math.random() * (windCfg.rainMultiplier[1] - windCfg.rainMultiplier[0]);
            } else {
                this.#windState.rainMult = 1.0;
            }
        }

        const baseEnv = CONFIG.locations.map.test.environment || null;
        let dynamicEnv = null;

        if (baseEnv) {
            dynamicEnv = { current: baseEnv.current, wind: null };
            if (baseEnv.wind && this.#windState.direction !== 0) {
                dynamicEnv.wind = {
                    direction: this.#windState.direction,
                    baseAngle: baseEnv.wind.baseAngle * this.#windState.rainMult,
                    gustChancePerSec: baseEnv.wind.gustChancePerSec * this.#windState.rainMult,
                    gustDurationMs: baseEnv.wind.gustDurationMs
                };
            }
        }

        const currentHour = new Date().getHours();
        let currentPhase = 'day';
        for (const [phase, times] of Object.entries(CONFIG.spawns.timePhases)) {
            if (times.startHour < times.endHour) {
                if (currentHour >= times.startHour && currentHour < times.endHour) currentPhase = phase;
            } else {
                if (currentHour >= times.startHour || currentHour < times.endHour) currentPhase = phase;
            }
        }

        const floatPos = this.#float.getPosition();
        const floatScreenPos = this.#projector.virtualToScreen(floatPos.x, floatPos.y);

        const currentCell = this.#locationMap.getCellAtVirtualPos(floatPos.x, floatPos.y, CONFIG.locations.cellSize);
        const currentDepth = currentCell ? currentCell.depth : 0; 

        const envData = {
            hookDepth: this.#float.getCurrentHookDepth(),
            bottomDepth: currentDepth,
            timePhase: currentPhase,
            dayOfWeek: new Date().getDay(),
            zoneMultiplier: 1.0, 
            isRaining: this.#isRaining,
            isFoggy: this.#isFoggy,
            castSpamMultiplier: this.#castManager.getBiteChanceMultiplier()
        };

        const playerGear = {
            hookSize: CONFIG.hook.level,
            baitId: 'oil_worm' 
        };

        const castableBounds = this.#locationMap.getCastableBoundsVirtual(CONFIG.locations.cellSize);
        const vTopLeft = this.#projector.screenToVirtual(0, 0);
        const vBottomRight = this.#projector.screenToVirtual(this.#canvas.width, this.#canvas.height);
        
        const dynamicBounds = {
            left: Math.max(vTopLeft.x, castableBounds ? castableBounds.left : 0),
            right: Math.min(vBottomRight.x, castableBounds ? castableBounds.right : 2560),
            top: Math.max(vTopLeft.y, castableBounds ? castableBounds.top : 0),
            bottom: Math.min(vBottomRight.y, castableBounds ? castableBounds.bottom : 2560)
        };

        if (this.#gameState === 'waiting') {
            this.#float.update(dynamicBounds, dt, dynamicEnv); 
            const hookedFish = this.#biteSystem.evaluateBite(dt, envData, playerGear);
            
            if (hookedFish) {
                this.#gameState = 'biting';
                this.#currentBitingFish = hookedFish;
                this.#float.startBite();
                return;
            }
            
            if (CONFIG.debug?.overlay) {
                const liveChances = this.#biteSystem.getLiveChances(envData, playerGear);
                const debugData = {
                    gameState: this.#gameState,
                    floatX: Math.round(floatPos.x), floatY: Math.round(floatPos.y),
                    hookDepth: envData.hookDepth,
                    bottomDepth: envData.bottomDepth,
                    bait: playerGear.baitId, 
                    phase: envData.timePhase,
                    liveChances: liveChances,
                    isRaining: this.#isRaining,
                    isFoggy: this.#isFoggy,
                    playerForceY: 0, playerForceX: 0, fishForceY: 0, fishForceX: 0, fishState: 'N/A', fishBasePower: 0, pullMult: 1, moveMult: 1
                };
                document.dispatchEvent(new CustomEvent('debug-live-update', { detail: debugData }));
            }
            return; 
        }

        if (this.#gameState === 'biting') {
            this.#float.updateBite(dt);
            this.#float.update(dynamicBounds, dt, dynamicEnv);

            if (!this.#float.isBiting()) {
                this.#gameState = 'waiting';
                this.#currentBitingFish = null;
                if (this.#biteSystem) this.#biteSystem.reset();
                if (this.#tensionMeter) this.#tensionMeter.reset();
                return;
            }

            if (inputState.isPulling) {
                const isGuaranteed = this.#float.isGuaranteedBite();
                const catchChance = isGuaranteed ? 0.99 : 0.01;

                if (Math.random() <= catchChance) {
                    this.#float.hook(); 
                    this.#hookFish(this.#currentBitingFish);
                } else {
                    this.#float.stopBite();
                    this.#gameState = 'scouting';
                    this.#currentBitingFish = null;
                    if (this.#tensionMeter) this.#tensionMeter.reset();
                }
            }
            return;
        }

        if (this.#gameState !== 'playing') return;

        if (this.#tensionMeter.isBroken()) {
            this.#gameState = 'failed';
            const reason = this.#tensionMeter.getBreakReason();
            this.failReason = reason;
            document.dispatchEvent(new CustomEvent('fishingFailed', { detail: { reason: reason } }));
            return;
        }

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

        let playerForce = new Vector2(0, 0);

        if (inputState.isPulling) {
            const playerForceRaw = this.#fishingSystem.calculatePlayerForce(inputState.pullDirection, floatPos.x, floatPos.y, rodVirtualPos, screenOffsetRatio, CONFIG);
            playerForce = playerForceRaw.clone().multiplyScalar(CONFIG.physics.playerForceMultiplier);
            this.#float.applyForce(playerForce);
        }

        this.#tensionMeter.update(inputState.isPulling, playerMaxPower, fishPowerMag, reelPower, currentFishMaxForceScaled, dt, CONFIG);

        this.#staminaController.evaluate(this.#tensionMeter.getTension(), inputState.isPulling, dt, floatPos.x, dynamicBounds);

        if (CONFIG.debug?.overlay) {
            const liveChances = this.#biteSystem.getLiveChances(envData, playerGear);
            const debugData = {
                gameState: this.#gameState,
                floatX: Math.round(floatPos.x), floatY: Math.round(floatPos.y),
                depth: envData.depth, bait: playerGear.baitId, phase: envData.timePhase,
                isRaining: this.#isRaining,
                isFoggy: this.#isFoggy,
                liveChances: liveChances,
                
                playerForceY: Math.abs(playerForce.y),
                playerForceX: Math.abs(playerForce.x),
                fishForceY: Math.abs(fishForce.y),
                fishForceX: Math.abs(fishForce.x),
                fishState: this.#fishingSystem.getCurrentState ? this.#fishingSystem.getCurrentState() : 'unknown',
                fishBasePower: this.#fishingSystem.getFishBasePower ? this.#fishingSystem.getFishBasePower() : 0,
                fishInitialPower: this.#fishingSystem.getFishInitialPower ? this.#fishingSystem.getFishInitialPower() : 0,
                pullMult: this.#fishingSystem.getPullMultiplier ? this.#fishingSystem.getPullMultiplier() : 1,
                moveMult: this.#fishingSystem.getMoveMultiplier ? this.#fishingSystem.getMoveMultiplier() : 1
            };
            document.dispatchEvent(new CustomEvent('debug-live-update', { detail: debugData }));
        }

        this.#float.update(dynamicBounds, dt, dynamicEnv);
        
        const updatedFloatPos = this.#float.getPosition();
        const updatedFloatScreenPos = this.#projector.virtualToScreen(updatedFloatPos.x, updatedFloatPos.y);
        
        const castableBoundsVirtual = this.#locationMap.getCastableBoundsVirtual(CONFIG.locations.cellSize);
        const mapBottomScreenY = this.#projector.virtualToScreen(0, castableBoundsVirtual.bottom).y;
        
        const catchLineY = Math.min(mapBottomScreenY, this.#canvas.height);

        if (this.#netCatchChance === null) {
            if (CONFIG.net && CONFIG.net.active && this.#fishingSystem) {
                const fW = this.#fishingSystem.getFishWeight();
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

        let triggerLineY = catchLineY - (this.#canvas.height * 0.10);

        if (CONFIG.net && CONFIG.net.active) {
            const netBonusPx = CONFIG.net.length * 10;
            triggerLineY = catchLineY - netBonusPx;
            this.#isNetReady = (updatedFloatScreenPos.y >= triggerLineY && updatedFloatScreenPos.y < catchLineY);
        } else {
            this.#isNetReady = false;
        }

        if (updatedFloatScreenPos.y >= triggerLineY && updatedFloatScreenPos.y < catchLineY) {
            if (typeof this.#fishingSystem.tryTriggerFishLastDash === 'function') {
                this.#fishingSystem.tryTriggerFishLastDash(dt);
            }
        }

        if (updatedFloatScreenPos.y >= catchLineY) {
            this.#gameState = 'victory';
        }

        this.#uiManager.updateNetButtonState(CONFIG, this.#isNetReady && this.#gameState === 'playing');
    }

    draw() {
        this.#renderer.clear(CONFIG);

        if (typeof this.#renderer.drawBackground === 'function') {
            this.#renderer.drawBackground(this.#locationMap, this.#projector, CONFIG);
        }

        if (CONFIG.locations && CONFIG.locations.debugVisuals) {
            this.#renderer.drawLocationDebug(this.#locationMap, this.#projector, CONFIG);
        }

        if (this.#invalidCastMarker) {
            this.#renderer.drawInvalidCastMarker(this.#invalidCastMarker);
        }

        if (this.#gameState === 'waiting' || this.#gameState === 'biting' || this.#gameState === 'playing' || this.#gameState === 'failed' || this.#gameState === 'victory') {
            const vPos = this.#float.getPosition();
            const sPos = this.#projector.virtualToScreen(vPos.x, vPos.y);
            
            this.#renderer.drawCatchZone(this.#locationMap, this.#projector, CONFIG);
            this.#renderer.drawRodLine(sPos, CONFIG);
            this.#renderer.drawFloat(sPos, this.#float, CONFIG);
            
            if (this.#gameState === 'playing' && this.#tensionMeter && this.#fishCondition) {
                this.#renderer.drawTensionBar(this.#tensionMeter, CONFIG);
                this.#renderer.drawFishCondition(this.#fishCondition, CONFIG);
            }
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
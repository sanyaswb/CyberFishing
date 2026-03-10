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
    #gameTimeHours = 0;
    #castManager;
    #biteSystem;
    #isRaining = false;
    #isFoggy = false;
    #weatherTimer = 0;
    #currentBitingFish = null;
    #currentHookDepth = 1.0;
    #depthUI;
    #timeUI;
    #windState = { direction: 0, rainMult: 1.0, timer: 0 };
    #lastHour = -1;
    #currentPhase = 'day';
    #castStartTime = 0;
    #castDistanceRatio = 0;
    #lastGameState = null;
    #playStartTime = 0;
    #chumManager;
    #chumUI;
    #isAimingChum = false;
    #activeBoat = null;

    constructor(canvasId) {
        this.#canvas = document.getElementById(canvasId);
        
        let anchorX = null;
        if (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== 'center') {
            anchorX = Number(CONFIG.ui.rod.x);
        }
        this.#inputManager = new InputManager(this.#canvas, anchorX);
        
        this.#renderer = new Renderer(this.#canvas);

        this.#uiManager = new UIManager(CONFIG);
        this.#uiManager.onNetClick = () => this.#handleNetClick();
        this.#uiManager.onContinueClick = () => this.#resetGame();

        this.#chumManager = new ChumManager('test');
        this.#chumUI = new ChumUI(() => this.#toggleChumAim());
        this.#isAimingChum = false;
        
        this.#locationMap = new LocationMap('test', CONFIG.locations);
        this.#projector = new ViewportProjector(CONFIG.locations, 'test');

        // --- ОНОВЛЕНИЙ СЛУХАЧ ДЛЯ DEVTOOLS ---
        document.addEventListener('config-updated', (e) => {
            if (e.detail && e.detail.path && e.detail.path[0] === 'locations') {
                if (this.#projector) {
                    this.#projector.update(0, 0); 
                    this.#projector.update(this.#canvas.width, this.#canvas.height);
                }
                // Миттєво оновлюємо зони, коли тягнемо повзунки в DevTools
                if (this.#locationMap) {
                    this.#locationMap.refreshConfig(CONFIG.locations);
                }
            }
        });
        
        this.#depthUI = new DepthSelectorUI();
        this.#timeUI = new TimeDisplayUI(); // <--- ДОДАНО ОСЬ ЦЕ

        this.#resizeCanvas();
        window.addEventListener('resize', () => this.#resizeCanvas());

        const initialX = CONFIG.float.initialX ?? this.#canvas.width / 2;
        const initialY = CONFIG.float.initialY ?? this.#canvas.height / 2;
        this.#float = new FloatEntity(initialX, initialY, CONFIG.float);
        
        const now = new Date();
        this.#gameTimeHours = CONFIG.debug?.initialTime ?? (now.getHours() + (now.getMinutes() / 60));

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

        this.#castStartTime = performance.now();
        this.#castDistanceRatio = distanceRatio;
    }

    #hookFish(hookedFish) {
        this.#gameState = 'playing';
        this.#netCatchChance = null;
        this.#isNetReady = false;

        const rod = new Rod(CONFIG.rod.level, CONFIG.rod.basePower);
        const reel = new Reel(CONFIG.reel.level, CONFIG.reel.basePower);
        const hook = new Hook(CONFIG.hook.level, CONFIG.hook.weight, CONFIG.hook.quality); 
        
        const fish = new Fish(hookedFish.level, hookedFish.weight, hookedFish.resistance, hookedFish.physics); 
        
        this.#fishingSystem = new FishingSystem(rod, reel, fish);
        this.#tensionMeter = new TensionMeter(CONFIG.rod.level, CONFIG.reel.level, hook, CONFIG.tension);
        
        this.#fishCondition = new FishCondition(hookedFish.level, hookedFish.weight, CONFIG.stamina.fish);
        
        const playerBasePower = rod.getPower() + reel.getPower();
        this.#staminaController = new StaminaController(this.#fishCondition, fish, playerBasePower, CONFIG.stamina.mechanics);
        
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

        if (CONFIG.debug?.overlay) {
            document.dispatchEvent(new CustomEvent('debug-live-update', { detail: { gameState: this.#gameState } }));
        }
    }

    #resetGame() {
        this.#gameState = 'scouting';
        this.failReason = null;
        this.#currentBitingFish = null;
        this.#netCatchChance = null;
        this.#isNetReady = false;
        
        if (this.#tensionMeter) this.#tensionMeter.reset();
        if (this.#biteSystem) this.#biteSystem.reset();
        this.#float.stopBite();
        if (CONFIG.debug?.overlay) {
            document.dispatchEvent(new CustomEvent('debug-live-update', { detail: { gameState: 'scouting' } }));
        }
    }

    #toggleChumAim() {
        // ✅ ДОДАНО 'biting' у список дозволених станів!
        // Тепер пульт дістається під час очікування, прицілювання та клювання.
        if (this.#gameState !== 'scouting' && this.#gameState !== 'waiting' && this.#gameState !== 'biting') return;

        if (this.#chumManager.getWaitingBoat()) {
            this.#chumManager.activateWaitingBoat();
            return;
        }

        if (this.#chumManager.isBoatMoving()) {
            console.log("Кораблик в русі, зачекайте!");
            return; 
        }

        const method = CONFIG.chum.currentMethod || 'hand';

        this.#isAimingChum = !this.#isAimingChum;

        if (this.#isAimingChum && method === 'boat') {
            const rodScreenX = (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== 'center') ? Number(CONFIG.ui.rod.x) : this.#canvas.width / 2;
            const rodVirtualPos = this.#projector.screenToVirtual(rodScreenX, 0);
            
            const mapBounds = this.#locationMap.getCastableBoundsVirtual(CONFIG.locations.cellSize);
            const startY = mapBounds ? mapBounds.bottom - 5 : 1440;
            const startX = Math.max(mapBounds ? mapBounds.left : 0, Math.min(mapBounds ? mapBounds.right : 2560, rodVirtualPos.x));

            this.#activeBoat = this.#chumManager.spawnIdleBoat(startX, startY);

        } else if (!this.#isAimingChum && this.#activeBoat) {
            if (this.#activeBoat.state === 'idle') {
                this.#chumManager.removeBoat(this.#activeBoat);
            }
            this.#activeBoat = null;
        }
    }

    update(dt) {
        const timeScale = CONFIG.debug?.timeScale || 1;
        this.#gameTimeHours += (dt / 1000 / 3600) * timeScale;
        if (this.#gameTimeHours >= 24) this.#gameTimeHours %= 24;

        this.#timeUI.update(this.#gameTimeHours);
        this.#projector.update(this.#canvas.width, this.#canvas.height);
        this.#locationMap.update(dt, this.#gameTimeHours);

        const inputState = this.#inputManager.getState();

        const checkWater = (vx, vy) => {
            const cell = this.#locationMap.getCellAtVirtualPos(vx, vy, CONFIG.locations.cellSize);
            return cell && cell.isCastable && !cell.hasCollision;
        };

        const boatBaseEnv = CONFIG.locations.map.test.environment || null;
        const boatEnv = boatBaseEnv ? { current: boatBaseEnv.current } : null;

        if (this.#chumManager) {
            this.#chumManager.update(Date.now(), timeScale);
            this.#chumManager.updateBoats(dt, checkWater, CONFIG.locations.cellSize, boatEnv); 
            
            const bounds = this.#locationMap.getCastableBoundsVirtual(CONFIG.locations.cellSize);
            if (bounds) {
                const mapBottomScreenY = this.#projector.virtualToScreen(0, bounds.bottom).y;
                const catchLineY = Math.min(mapBottomScreenY, this.#canvas.height);
                
                let triggerLineY = catchLineY - (this.#canvas.height * 0.10); 
                
                if (CONFIG.net && CONFIG.net.active) {
                    triggerLineY = catchLineY - (CONFIG.net.length * 10); 
                }

                const boats = this.#chumManager.getBoats();
                for (const boat of boats) {
                    if (boat.state === 'drifting') {
                        const boatScreenY = this.#projector.virtualToScreen(boat.pos.x, boat.pos.y).y;
                        
                        if (boatScreenY >= triggerLineY) {
                            boat.isFinished = true;
                        }
                    }
                }
            }
        }

        if (this.#chumUI && typeof this.#chumUI.setState === 'function') {
            const isBoatMethod = (CONFIG.chum.currentMethod === 'boat');
            const boats = this.#chumManager ? this.#chumManager.getBoats() : [];
            const activeBoat = boats.length > 0 ? boats[0] : null;

            if (this.#gameState === 'playing') { 
                if (this.#isAimingChum) {
                    this.#isAimingChum = false; 
                }
                this.#chumUI.setState('disabled'); 
            } 
            else if (this.#chumManager && this.#chumManager.hasDriftingBoat()) {
                this.#chumUI.setState('empty');
            } else if (activeBoat && activeBoat.state === 'waiting' && !activeBoat.zoneId) {
                this.#chumUI.setState('empty');    
            } else if (this.#chumManager && this.#chumManager.getWaitingBoat()) {
                this.#chumUI.setState('ready');
            } else if (this.#chumManager && this.#chumManager.isBoatMoving()) {
                this.#chumUI.setState('moving');
            } else if (isBoatMethod && this.#chumManager && this.#chumManager.getBoatEnergy() <= 0) {
                this.#chumUI.setState('empty');
            } else if (this.#isAimingChum) {
                this.#chumUI.setState('aiming');
            } else {
                this.#chumUI.setState('idle');
            }
        }

        // --- ДОДАНО 2: Перехоплення кліку для кидка прикормки ---
        if (this.#isAimingChum) {
            inputState.isPulling = false; 
            inputState.longPressPos = null;

            const method = CONFIG.chum.currentMethod || 'hand';
            const maxHandDist = CONFIG.chum.deliveryMethods.hand.maxDistanceVirtual;

            if (inputState.clickPos) {
                const vPos = this.#projector.screenToVirtual(inputState.clickPos.x, inputState.clickPos.y);
                const cell = this.#locationMap.getCellAtVirtualPos(vPos.x, vPos.y, CONFIG.locations.cellSize);
                
                const rodScreenX = (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== 'center') ? Number(CONFIG.ui.rod.x) : this.#canvas.width / 2;
                const rodScreenY = this.#canvas.height - (CONFIG.ui?.rod?.yOffset || 0);
                const rodVirtualPos = this.#projector.screenToVirtual(rodScreenX, rodScreenY);
                const distToClick = Math.hypot(vPos.x - rodVirtualPos.x, vPos.y - rodVirtualPos.y);

                if (cell && cell.isCastable && !cell.hasCollision) {
                    if (method === 'boat' && this.#activeBoat) {
                        this.#chumManager.deployBait(vPos.x, vPos.y, 'carp_mix_basic', method, this.#activeBoat);
                        this.#activeBoat = null;
                        this.#isAimingChum = false;

                    } else if (method === 'hand' && distToClick <= maxHandDist) {
                        this.#chumManager.deployBait(vPos.x, vPos.y, 'carp_mix_basic', 'hand'); 
                        this.#toggleChumAim(); 
                    } else {
                        console.log("Задалеко для кидка рукою!");
                        this.#invalidCastMarker = { x: inputState.clickPos.x, y: inputState.clickPos.y, timer: 500 };
                    }
                } else {
                    this.#invalidCastMarker = { x: inputState.clickPos.x, y: inputState.clickPos.y, timer: 500 };
                }
                return;
            }
        }

        // --- ДОДАНО: Перехоплення кліку для ручного керування КОРАБЛИКОМ ---
        if (!this.#isAimingChum) {
            const method = CONFIG.chum.currentMethod || 'hand';
            const isManual = CONFIG.chum.deliveryMethods.boat?.manualControl;
            const boats = this.#chumManager ? this.#chumManager.getBoats() : [];
            
            if (method === 'boat' && isManual && boats.length > 0) {
                const boat = boats[0];
                
                // Якщо кораблик живий і слухається пульта (не дрейфує)
                if (boat.state !== 'drifting') {
                    
                    // 1. БЛОКУЄМО ВУДКУ: руки зайняті пультом!
                    // Скасовуємо спроби підсікати, тягнути або закидати по-новій
                    inputState.isPulling = false; 
                    inputState.longPressPos = null;

                    // 2. КЕРУВАННЯ КОРАБЛИКОМ (реагуємо на кліки)
                    if (inputState.clickPos) {
                        const clickY = inputState.clickPos.y;
                        const vPos = this.#projector.screenToVirtual(inputState.clickPos.x, clickY);
                        const cell = this.#locationMap.getCellAtVirtualPos(vPos.x, vPos.y, CONFIG.locations.cellSize);
                        
                        const isBottomClick = clickY > this.#canvas.height * 0.85 || (cell && !cell.isCastable && clickY > this.#canvas.height * 0.7);

                        if (isBottomClick) {
                            boat.setTarget(boat.startPos.x, boat.startPos.y, null, true); 
                        } 
                        else if (cell && cell.isCastable && !cell.hasCollision) {
                            boat.setTarget(vPos.x, vPos.y, boat.zoneId, false);
                        }
                        inputState.clickPos = null; // Поглинаємо клік, щоб він не пішов далі
                    }
                }
            }
        }

        if (inputState.isDoubleClick) {
            if (this.#gameState === 'waiting') {

                if (this.#chumManager && this.#chumManager.isBoatMoving()) return;

                this.#gameState = 'scouting';
                if (this.#tensionMeter) this.#tensionMeter.reset();
                if (this.#biteSystem) this.#biteSystem.reset();

                if (CONFIG.debug?.overlay) {
                    document.dispatchEvent(new CustomEvent('debug-live-update', { detail: { gameState: 'scouting' } }));
                }
                return;
            }
        }

        if (inputState.longPressPos && this.#gameState === 'waiting') {
            if (this.#chumManager && this.#chumManager.isBoatMoving()) {
                console.log("Закидання заблоковано: кораблик у русі!");
                return; 
            }

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
            const maxDepth = CONFIG.sinker.maxDepth || 8.0;
            
            if (!this.#depthUI.isActive) {
                this.#depthUI.show(maxDepth, this.#currentHookDepth, (newDepth) => {
                    this.#currentHookDepth = newDepth;
                });
            } else {
                if (typeof this.#depthUI.updateMax === 'function') {
                    this.#depthUI.updateMax(maxDepth);
                }
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
                const mult = this.#windState.rainMult;
                dynamicEnv.wind = {
                    direction: this.#windState.direction,
                    breezeAngleRange: [baseEnv.wind.breezeAngleRange[0] * mult, baseEnv.wind.breezeAngleRange[1] * mult],
                    gustAngleRange: [baseEnv.wind.gustAngleRange[0] * mult, baseEnv.wind.gustAngleRange[1] * mult],
                    gustFluctuationMs: baseEnv.wind.gustFluctuationMs,
                    gustChancePerSec: baseEnv.wind.gustChancePerSec * mult,
                    gustDurationMs: baseEnv.wind.gustDurationMs
                };
            }
        }

        const currentHour = Math.floor(this.#gameTimeHours);
        
        if (currentHour !== this.#lastHour) {
            this.#lastHour = currentHour;
            for (const [phase, times] of Object.entries(CONFIG.spawns.timePhases)) {
                if (times.startHour < times.endHour) {
                    if (currentHour >= times.startHour && currentHour < times.endHour) this.#currentPhase = phase;
                } else {
                    if (currentHour >= times.startHour || currentHour < times.endHour) this.#currentPhase = phase;
                }
            }
        }

        const floatPos = this.#float.getPosition();
        const floatScreenPos = this.#projector.virtualToScreen(floatPos.x, floatPos.y);

        const currentCell = this.#locationMap.getCellAtVirtualPos(floatPos.x, floatPos.y, CONFIG.locations.cellSize);
        const currentDepth = currentCell ? currentCell.depth : 0; 
        
        const chumBounds = this.#locationMap.getCastableBoundsVirtual(CONFIG.locations.cellSize);
        const vTop = chumBounds ? chumBounds.top : 0;
        const virtualBottomY = chumBounds ? chumBounds.bottom : 1440;
        
        const rawChumBonus = this.#chumManager ? this.#chumManager.getMultiplier(floatPos.x, floatPos.y, null, vTop, virtualBottomY) : 1.0;
        
        let activeTargets = null;
        if (rawChumBonus > 1.0 && this.#chumManager) {
            activeTargets = this.#chumManager.getActiveChumTargets(floatPos.x, floatPos.y, vTop, virtualBottomY);
        }

        const envData = {
            hookDepth: this.#float.getCurrentHookDepth(),
            bottomDepth: currentDepth,
            timePhase: this.#currentPhase,
            dayOfWeek: new Date().getDay(),
            zoneMultiplier: 1.0,
            chumBonus: rawChumBonus,
            chumTargets: activeTargets,
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
            this.#float.update(dynamicBounds, dt, dynamicEnv, checkWater);

            let hookedFish = this.#biteSystem.evaluateBite(dt, envData, playerGear);
            
            if (hookedFish && CONFIG.debug?.fixedCatch?.enabled) {
                const fixed = CONFIG.debug.fixedCatch;
                const template = CONFIG.spawns.fishes.find(f => f.id === fixed.fishId) || CONFIG.spawns.fishes[0];
                
                hookedFish = {
                    id: template.id,
                    name: template.name + ' (TEST)',
                    physics: template.physics,
                    level: fixed.level,
                    weight: fixed.weight,
                    resistance: fixed.resistance
                };
                console.log(`%c[DEBUG] Рандом відключено. Згенеровано тестову рибу:`, 'color: #ffaa00; font-weight: bold;', hookedFish);
            }

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
                    chumZones: this.#chumManager ? this.#chumManager.getZones() : [],
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
            this.#float.updateBite(dt, checkWater);
            this.#float.update(dynamicBounds, dt, dynamicEnv, checkWater);

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
                    if (CONFIG.debug?.overlay) {
                        document.dispatchEvent(new CustomEvent('debug-live-update', { detail: { gameState: 'scouting' } }));
                    }
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
            
            if (CONFIG.debug?.overlay) {
                document.dispatchEvent(new CustomEvent('debug-live-update', { detail: { gameState: 'failed' } }));
            }
            return;
        }

        const fishForceRaw = this.#fishingSystem.calculateFishForce(dt, floatPos, this.#bounds, CONFIG.stamina.mechanics, checkWater);
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

        const rawPlayerPower = this.#fishingSystem.calculatePlayerForce(new Vector2(0, 1), floatPos.x, floatPos.y, rodVirtualPos, screenOffsetRatio, CONFIG.physics).y;
        const playerMaxPower = Math.abs(rawPlayerPower * CONFIG.physics.playerForceMultiplier);
        const fishPowerMag = Math.abs(fishForce.y); 
        const reelPower = this.#fishingSystem.getReelPower();

        let playerForce = new Vector2(0, 0);

        if (inputState.isPulling) {
            const playerForceRaw = this.#fishingSystem.calculatePlayerForce(inputState.pullDirection, floatPos.x, floatPos.y, rodVirtualPos, screenOffsetRatio, CONFIG.physics);
            playerForce = playerForceRaw.clone().multiplyScalar(CONFIG.physics.playerForceMultiplier);
            this.#float.applyForce(playerForce);
        }

        this.#tensionMeter.update(inputState.isPulling, playerMaxPower, fishPowerMag, reelPower, currentFishMaxForceScaled, dt, CONFIG.hookMechanics);

        this.#staminaController.evaluate(this.#tensionMeter.getTension(), inputState.isPulling, dt, floatPos.x, dynamicBounds);

        if (CONFIG.debug?.overlay) {
            const liveChances = this.#biteSystem.getLiveChances(envData, playerGear);
            const debugData = {
                gameState: this.#gameState,
                chumZones: this.#chumManager ? this.#chumManager.getZones() : [],
                floatX: Math.round(floatPos.x), floatY: Math.round(floatPos.y),
                hookDepth: envData.hookDepth, bottomDepth: envData.bottomDepth, bait: playerGear.baitId, phase: envData.timePhase,
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
                moveMult: this.#fishingSystem.getMoveMultiplier ? this.#fishingSystem.getMoveMultiplier() : 1,

                hookedFish: this.#currentBitingFish,
                
                activeDebuffName: this.#fishingSystem.getActiveDebuffName ? this.#fishingSystem.getActiveDebuffName() : 'Немає',
                masteryCurrentMult: this.#fishingSystem.getMasteryMultiplier ? this.#fishingSystem.getMasteryMultiplier() : 1.0,
                masteryTimerMs: this.#staminaController.getMasteryTimer ? this.#staminaController.getMasteryTimer() : 0,
                isMasteryActive: this.#staminaController.isMasteryActive ? this.#staminaController.isMasteryActive() : false,
                exhaustionDurationMs: this.#staminaController.getExhaustionDurationMs ? this.#staminaController.getExhaustionDurationMs() : 1000
            };
            document.dispatchEvent(new CustomEvent('debug-live-update', { detail: debugData }));
        }

        this.#float.update(dynamicBounds, dt, dynamicEnv, checkWater);
        
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

        const catchLineOffset = CONFIG.locations.catchLineOffsetPx ?? 5;

        if (updatedFloatScreenPos.y >= triggerLineY && updatedFloatScreenPos.y < catchLineY - catchLineOffset) {
            if (typeof this.#fishingSystem.tryTriggerFishLastDash === 'function') {
                this.#fishingSystem.tryTriggerFishLastDash(dt);
            }
        }

        if (updatedFloatScreenPos.y >= catchLineY - catchLineOffset) {
            this.#gameState = 'victory';

            if (CONFIG.debug?.overlay) {
                document.dispatchEvent(new CustomEvent('debug-live-update', { detail: { gameState: 'victory' } }));
            }
        }
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

        // --- ДОДАНО 4: Відмальовка зон прикормки ---
        if (CONFIG.locations.showChumZones !== false && this.#chumManager && typeof this.#renderer.drawChumZones === 'function') {
            const mapBounds = this.#locationMap.getCastableBoundsVirtual(CONFIG.locations.cellSize);
            const vTop = mapBounds ? mapBounds.top : 0;
            const vBottom = mapBounds ? mapBounds.bottom : 1440;
            this.#renderer.drawChumZones(this.#chumManager, this.#projector, vTop, vBottom);
        }

        // --- ДОДАНО 5: Відмальовка Корабликів ---
        if (this.#chumManager && typeof this.#renderer.drawBoats === 'function') {
            const mapBounds = this.#locationMap.getCastableBoundsVirtual(CONFIG.locations.cellSize);
            const vTop = mapBounds ? mapBounds.top : 0;
            const vBottom = mapBounds ? mapBounds.bottom : 1440;
            this.#renderer.drawBoats(this.#chumManager, this.#projector, vTop, vBottom);
        }

        // Малюємо зону закидання ТІЛЬКИ якщо режим "hand" (руками)
        if (this.#isAimingChum && typeof this.#renderer.drawChumAiming === 'function') {
            const method = CONFIG.chum.currentMethod || 'hand';
            
            if (method === 'hand') {
                const rodScreenX = (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== 'center') ? Number(CONFIG.ui.rod.x) : this.#canvas.width / 2;
                const rodScreenY = this.#canvas.height - (CONFIG.ui?.rod?.yOffset || 0);
                const rodVirtualPos = this.#projector.screenToVirtual(rodScreenX, rodScreenY);
                this.#renderer.drawChumAiming(this.#projector, rodVirtualPos, CONFIG.chum.deliveryMethods.hand.maxDistanceVirtual);
            }
        }

        if (this.#gameState === 'waiting' || this.#gameState === 'biting' || this.#gameState === 'playing' || this.#gameState === 'failed' || this.#gameState === 'victory') {
            const vPos = this.#float.getPosition();
            const sPos = this.#projector.virtualToScreen(vPos.x, vPos.y);
            
            this.#renderer.drawCatchZone(this.#locationMap, this.#projector, CONFIG);

            let lineLengthRatio = 1.0;
            let lineDropOffset = 0;

            if (this.#gameState === 'waiting' || this.#gameState === 'biting') {
                const targetDepth = this.#currentHookDepth || 1.0;
                const sinkRate = CONFIG.sinker?.sinkRate || 1.0; 
                const baseSinkTimeMs = (targetDepth / sinkRate) * 1000;
                
                const minDelay = CONFIG.ui?.line?.distanceDelayMinMs ?? 500;
                const maxDelay = CONFIG.ui?.line?.distanceDelayMaxMs ?? 2000;
                const distanceDelayMs = minDelay + (this.#castDistanceRatio * (maxDelay - minDelay));
                
                const durationMs = baseSinkTimeMs + distanceDelayMs;
                
                const elapsed = performance.now() - this.#castStartTime;
                let progress = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
                
                const easePower = CONFIG.ui?.line?.shrinkEasePower ?? 3;
                let easeOutProgress = progress; 
                if (easePower > 1) {
                    easeOutProgress = 1 - Math.pow(1 - progress, easePower);
                }
                
                const targetPercent = (CONFIG.ui?.line?.shrinkPercent ?? 60) / 100;
                lineLengthRatio = 1.0 - (easeOutProgress * (1.0 - targetPercent));
                
                lineDropOffset = easeOutProgress * (CONFIG.ui?.line?.sinkDropPx ?? 40);

            } else if (this.#gameState === 'playing') {
                if (this.#lastGameState !== 'playing') {
                    this.#playStartTime = performance.now();
                }
                
                const elapsed = performance.now() - this.#playStartTime;
                const baseSnapDuration = CONFIG.ui?.line?.snapDurationMs ?? 500;
                const maxMult = CONFIG.ui?.line?.snapDepthMaxMultiplier ?? 2.0;
                const currentDepth = this.#currentHookDepth || 0;
                
                const depthRatio = Math.min(1, currentDepth / 10.0);
                const dynamicMult = 1.0 + (depthRatio * (maxMult - 1.0));
                const snapDuration = baseSnapDuration * dynamicMult;
                
                let progress = snapDuration > 0 ? Math.min(1, elapsed / snapDuration) : 1;
                const easeProgress = 1 - Math.pow(1 - progress, 3);
                const targetPercent = (CONFIG.ui?.line?.shrinkPercent ?? 60) / 100;
                
                lineLengthRatio = targetPercent + (easeProgress * (1.0 - targetPercent));
                
                const maxDrop = CONFIG.ui?.line?.sinkDropPx ?? 40;
                lineDropOffset = maxDrop * (1 - easeProgress);
            }

            this.#lastGameState = this.#gameState;

            // --- ДОДАНО: КОМПЛЕКСНИЙ ЗАПОБІЖНИК ВІД ВИХОДУ НА БЕРЕГ ---
            const bounds = this.#locationMap.getCastableBoundsVirtual(CONFIG.locations.cellSize);
            const virtualBottomY = bounds ? bounds.bottom : Infinity;
            const mapBottomScreenY = this.#projector.virtualToScreen(0, virtualBottomY).y;
            
            const rodScreenY = this.#canvas.height - (CONFIG.ui?.rod?.yOffset || 0);
            const rodTopY = rodScreenY - 200;
            
            const distY = sPos.y - rodTopY;

            if (distY < 0) { 
                const minRatio = (mapBottomScreenY - rodTopY) / distY;
                lineLengthRatio = Math.max(lineLengthRatio, minRatio);
            }

            const targetYAfterShrink = rodTopY + distY * lineLengthRatio;
            const maxAllowedDrop = Math.max(0, mapBottomScreenY - targetYAfterShrink);
            
            lineDropOffset = Math.min(lineDropOffset, maxAllowedDrop);

            const currentTension = this.#tensionMeter ? this.#tensionMeter.getTension() : 0;
            this.#renderer.drawRodLine(sPos, this.#gameState, currentTension, lineLengthRatio, lineDropOffset, CONFIG);
            
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

        // Оновлення UI перенесено сюди, щоб гарантовано працювати кожен кадр
        if (this.#uiManager) {
            this.#uiManager.updateNetButtonState(CONFIG, this.#isNetReady && this.#gameState === 'playing');
            this.#uiManager.updateContinueButtonState(this.#gameState === 'failed' || this.#gameState === 'victory');
        }

        requestAnimationFrame(this.loop);
    }
}
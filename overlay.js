class DebugOverlay {
    #container;
    #intervalId;

    constructor() {
        this.#initDOM();
        this.#start();
    }

    #initDOM() {
        this.#container = document.createElement('div');
        this.#container.style.cssText = 'position: absolute; top: 10px; left: 10px; background: rgba(11, 21, 32, 0.95); color: #ffffff; padding: 15px; font-family: monospace; font-size: 14px; border: 1px solid #4a5b6c; border-radius: 8px; pointer-events: none; z-index: 1000; display: none; box-shadow: 0 4px 15px rgba(0,0,0,0.6); min-width: 280px;';
        document.body.appendChild(this.#container);
    }

    #getStateColor(state) {
        switch(state) {
            case 'dash': return '#ff4444';
            case 'swim': return '#ffaa00';
            case 'rest': return '#00ff80';
            case 'idle': return '#00ccff';
            default: return '#8a9bac';
        }
    }

    #update() {
        if (typeof CONFIG === 'undefined' || !CONFIG.debug?.overlay || window.DEBUG_LIVE_FISH_STATE === undefined) {
            this.#container.style.display = 'none';
            return;
        }

        const initialFishBase = (CONFIG.fish.level * CONFIG.fish.weight) + CONFIG.fish.resistance;
        const currentFishBase = window.DEBUG_LIVE_FISH_BASE_POWER !== undefined ? window.DEBUG_LIVE_FISH_BASE_POWER : initialFishBase;
        const lostFishBase = initialFishBase - currentFishBase;

        const currentState = window.DEBUG_LIVE_FISH_STATE;
        const currentPullMult = window.DEBUG_LIVE_FISH_PULL_MULT || 0;
        const currentMoveMult = window.DEBUG_LIVE_FISH_MOVE_MULT || 0;

        const playerPullForce = window.DEBUG_LIVE_PLAYER_FORCE_Y || 0;
        const currentFishPullForce = window.DEBUG_LIVE_FISH_FORCE_Y || 0;
        const playerSteerForce = window.DEBUG_LIVE_PLAYER_FORCE_X || 0;
        const currentFishEscapeForce = window.DEBUG_LIVE_FISH_FORCE_X || 0;

        const totalPullForce = playerPullForce + currentFishPullForce;
        const playerPctY = totalPullForce > 0 ? (playerPullForce / totalPullForce) * 100 : 0;
        const fishPctY = totalPullForce > 0 ? (currentFishPullForce / totalPullForce) * 100 : 0;

        const totalSteerForce = playerSteerForce + currentFishEscapeForce;
        const playerPctX = totalSteerForce > 0 ? (playerSteerForce / totalSteerForce) * 100 : 0;
        const fishPctX = totalSteerForce > 0 ? (currentFishEscapeForce / totalSteerForce) * 100 : 0;

        const stateColor = this.#getStateColor(currentState);

        const leaderTextY = fishPctY > playerPctY 
            ? `<span style="color: #ff4444;">🚨 Риба тягне сильніше на ${(fishPctY - playerPctY).toFixed(1)}%</span>` 
            : `<span style="color: #00ff80;">💪 Гравець тягне сильніше на ${(playerPctY - fishPctY).toFixed(1)}%</span>`;

        const leaderTextX = fishPctX > playerPctX 
            ? `<span style="color: #ff4444;">🚨 Риба втікає (Домінує на ${(fishPctX - playerPctX).toFixed(1)}%)</span>` 
            : `<span style="color: #00ff80;">✅ Керування стабільне (Перевага ${(playerPctX - fishPctX).toFixed(1)}%)</span>`;

        const behaviors = CONFIG.fish.behaviors || {};
        const getFishStateForce = (stateName) => {
            if (!behaviors[stateName]) return '<span style="color: #666;">відсутній стан</span>';
            const statePullMult = behaviors[stateName].pull;
            const stateForce = currentFishBase * statePullMult * CONFIG.physics.fishForceMultiplier;
            return `<span style="color: ${this.#getStateColor(stateName)}; font-weight: bold;">${stateForce.toFixed(3)}</span>`;
        };

        const dashForceStr = getFishStateForce('dash');
        const swimForceStr = getFishStateForce('swim');
        const idleForceStr = getFishStateForce('idle');
        const restForceStr = getFishStateForce('rest');

        let maxPull = 0;
        let minPull = Infinity;
        const behaviorKeys = Object.keys(behaviors);
        if (behaviorKeys.length > 0) {
            behaviorKeys.forEach(k => {
                if (behaviors[k].pull > maxPull) maxPull = behaviors[k].pull;
                if (behaviors[k].pull < minPull) minPull = behaviors[k].pull;
            });
        } else {
            minPull = 0;
        }
        
        const maxPossibleForceY = currentFishBase * maxPull * CONFIG.physics.fishForceMultiplier;
        const minPossibleForceY = currentFishBase * minPull * CONFIG.physics.fishForceMultiplier;
        // --- РОЗРАХУНОК МЕЖ СИЛИ ГРАВЦЯ ---
        const rPower = (CONFIG.rod.level * CONFIG.rod.basePower);
        const rlPower = (CONFIG.reel.level * CONFIG.reel.basePower);
        const pPower = rPower + rlPower; // Базова сила гравця
        
        // МАКСИМУМ Y (По центру, 0% штрафу)
        const playerMaxForceY = pPower * CONFIG.physics.playerForceMultiplier;

        const maxPenalty = CONFIG.physics.edgePullPenalty || 0.0;
        const rodComp = CONFIG.rod.compensation || 0.0;
        const worstPenaltyMult = Math.max(0.1, 1.0 - (maxPenalty * 1.0 * (1 - rodComp)));
        const worstEffectivePower = pPower * worstPenaltyMult;

        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const rodScreenX = (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== 'center') ? Number(CONFIG.ui.rod.x) : screenW / 2;
        const maxOffsetDistance = Math.max(rodScreenX, screenW - rodScreenX);
        const rodY = screenH - (CONFIG.ui?.catchZone?.height || 150);
        const fishSpawnY = screenH * 0.2; 
        const distanceY = rodY - fishSpawnY;

        const worstPullDirLength = Math.hypot(maxOffsetDistance, distanceY);
        const worstPullDirY = distanceY / worstPullDirLength;
        const playerMinForceY = worstEffectivePower * worstPullDirY * CONFIG.physics.playerForceMultiplier;

        // РОЗРАХУНОК ОСІ X (ГРАВЕЦЬ ТА РИБА)
        // Кермування гравця: (Загальна сила) * Множник кермування * Фізичний множник
        const playerSteerForceBase = pPower * CONFIG.physics.playerSteeringMultiplier * CONFIG.physics.playerForceMultiplier;
        const playerSteerForceMin = worstEffectivePower * CONFIG.physics.playerSteeringMultiplier * CONFIG.physics.playerForceMultiplier;

        // Ривок риби (Втеча): Залежить від edgePowerMultiplier
        const fishEscapeForceMax = (currentFishBase * CONFIG.fish.edgePowerMultiplier) * CONFIG.physics.fishForceMultiplier;

        this.#container.innerHTML = `
            <div style="color: #00ccff; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">🧠 ПОВЕДІНКА (STATE)</div>
            <div style="margin-bottom: 4px;">Стан: <span style="color: ${stateColor}; text-transform: uppercase; font-weight: bold;">${currentState}</span></div>
            <div style="margin-bottom: 4px;">Множник Тяги (Y): <span style="color: ${stateColor};">x${currentPullMult.toFixed(2)}</span></div>
            <div style="margin-bottom: 12px;">Множник Втечі (X): <span style="color: ${stateColor};">x${currentMoveMult.toFixed(2)}</span></div>
            
            <div style="color: #ffaa00; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">🔥 ПОТОЧНА БАЗОВА СИЛА РИБИ</div>
            <div style="margin-bottom: 4px;">Початкова база: <span style="color: #8a9bac;">${initialFishBase.toFixed(2)}</span></div>
            <div style="margin-bottom: 4px;">Втрачено (Виснаження): <span style="color: #ff4444; font-weight: bold;">-${lostFishBase.toFixed(2)}</span></div>
            <div style="margin-bottom: 12px; font-size: 16px;">Поточна: <span style="color: #00ff80; font-weight: bold;">${currentFishBase.toFixed(2)}</span></div>

            <div style="color: #ffaa00; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">📊 СИЛА РИБИ ЗА СТАНАМИ (MAX Y)</div>
            <div style="margin-bottom: 2px;">DASH: ${dashForceStr}</div>
            <div style="margin-bottom: 2px;">SWIM: ${swimForceStr}</div>
            <div style="margin-bottom: 2px;">IDLE: ${idleForceStr}</div>
            <div style="margin-bottom: 6px;">REST: ${restForceStr}</div>
            <div style="margin-bottom: 4px; padding-top: 4px; border-top: 1px dashed #4a5b6c; font-size: 13px; font-weight: bold;">
                АБС. МІНІМУМ (Y): <span style="color: #00ff80;">${minPossibleForceY.toFixed(3)}</span><br>
                АБС. МАКСИМУМ (Y): <span style="color: #ff4444;">${maxPossibleForceY.toFixed(3)}</span>
            </div>
            <div style="margin-bottom: 12px; font-size: 13px; font-weight: bold;">
                ВТЕЧА В КУТ (MAX X): <span style="color: #ff4444;">${fishEscapeForceMax.toFixed(3)}</span>
            </div>

            <div style="color: #00ff80; margin-top: 12px; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">📊 СИЛА ГРАВЦЯ (MAX Y & X)</div>
            <div style="margin-bottom: 2px;">ТЯГА МІНІМУМ (Кут Y): <span style="color: #ffaa00; font-weight: bold;">${playerMinForceY.toFixed(3)}</span></div>
            <div style="margin-bottom: 6px;">ТЯГА МАКСИМУМ (Центр Y): <span style="color: #00ff80; font-weight: bold;">${playerMaxForceY.toFixed(3)}</span></div>
            <div style="margin-bottom: 2px;">КЕРМО МІНІМУМ (Кут X): <span style="color: #ffaa00; font-weight: bold;">${playerSteerForceMin.toFixed(3)}</span></div>
            <div style="margin-bottom: 12px;">КЕРМО МАКСИМУМ (Центр X): <span style="color: #00ff80; font-weight: bold;">${playerSteerForceBase.toFixed(3)}</span></div>
            
            <div style="color: #00ccff; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">⚖️ LIVE: ТЯГА (Вісь Y)</div>
            <div style="margin-bottom: 4px;">Гравець: <span style="color: #00ff80;">${playerPullForce.toFixed(3)}</span> | Риба: <span style="color: #ff4444;">${currentFishPullForce.toFixed(3)}</span></div>
            <div style="margin-bottom: 4px; font-weight: bold;">
                <span style="color: #ff4444;">Риба ${fishPctY.toFixed(1)}%</span> VS <span style="color: #00ff80;">Гравець ${playerPctY.toFixed(1)}%</span>
            </div>
            <div style="font-weight: bold; font-size: 13px; margin-bottom: 12px;">${leaderTextY}</div>

            <div style="color: #00ccff; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">⚖️ LIVE: КЕРУВАННЯ (Вісь X)</div>
            <div style="margin-bottom: 4px;">Гравець: <span style="color: #00ff80;">${playerSteerForce.toFixed(3)}</span> | Риба: <span style="color: #ff4444;">${currentFishEscapeForce.toFixed(3)}</span></div>
            <div style="margin-bottom: 4px; font-weight: bold;">
                <span style="color: #ff4444;">Риба ${fishPctX.toFixed(1)}%</span> VS <span style="color: #00ff80;">Гравець ${playerPctX.toFixed(1)}%</span>
            </div>
            <div style="font-weight: bold; font-size: 13px;">${leaderTextX}</div>
        `;
        
        this.#container.style.display = 'block';
    }

    #start() {
        this.#intervalId = setInterval(() => this.#update(), 100);
    }
}

new DebugOverlay();
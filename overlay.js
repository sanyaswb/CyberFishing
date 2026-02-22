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
        const currentFishBase = window.DEBUG_LIVE_FISH_POWER !== undefined ? window.DEBUG_LIVE_FISH_POWER : initialFishBase;
        const lostFishBase = initialFishBase - currentFishBase;

        const pPower = (CONFIG.rod.level * CONFIG.rod.basePower) + (CONFIG.reel.level * CONFIG.reel.basePower);
        const playerPullForce = pPower * CONFIG.physics.playerForceMultiplier;
        const playerSteerForce = pPower * CONFIG.physics.playerSteeringMultiplier * CONFIG.physics.playerForceMultiplier;

        const currentState = window.DEBUG_LIVE_FISH_STATE;
        const currentPullMult = window.DEBUG_LIVE_FISH_PULL_MULT || 0;
        const currentMoveMult = window.DEBUG_LIVE_FISH_MOVE_MULT || 0;

        const currentFishPullForce = currentFishBase * currentPullMult * CONFIG.physics.fishForceMultiplier;
        const currentFishEscapeForce = currentFishBase * currentMoveMult * CONFIG.physics.fishForceMultiplier;

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

        this.#container.innerHTML = `
            <div style="color: #00ccff; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">🧠 ПОВЕДІНКА (STATE)</div>
            <div style="margin-bottom: 4px;">Стан: <span style="color: ${stateColor}; text-transform: uppercase; font-weight: bold;">${currentState}</span></div>
            <div style="margin-bottom: 4px;">Множник Тяги (Y): <span style="color: ${stateColor};">x${currentPullMult.toFixed(2)}</span></div>
            <div style="margin-bottom: 12px;">Множник Втечі (X): <span style="color: ${stateColor};">x${currentMoveMult.toFixed(2)}</span></div>
            
            <div style="color: #ffaa00; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">🔥 ДЕБАФ СИЛИ</div>
            <div style="margin-bottom: 4px;">Базова сила: <span style="color: #8a9bac;">${initialFishBase.toFixed(2)}</span></div>
            <div style="margin-bottom: 4px;">Втрачено: <span style="color: #ff4444; font-weight: bold;">-${lostFishBase.toFixed(2)}</span></div>
            <div style="margin-bottom: 12px;">Поточна база: <span style="color: #00ff80; font-weight: bold;">${currentFishBase.toFixed(2)}</span></div>
            
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
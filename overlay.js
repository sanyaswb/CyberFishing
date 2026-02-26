// // Зручний конфіг для увімкнення/вимкнення блоків оверлею
// const OVERLAY_MODULES = {
//     echo: true,          // 📡 ЕХОЛОТ (Глибина, Шанси кльову)
//     state: true,         // 🧠 ПОВЕДІНКА (STATE)
//     fishBase: true,      // 🔥 ПОТОЧНА БАЗОВА СИЛА РИБИ
//     fishStates: true,    // 📊 СИЛА РИБИ ЗА СТАНАМИ (MAX Y та X)
//     worstCase: true,     // 💀 НАЙГІРШИЙ СЦЕНАРІЙ (НИЖНІЙ КУТ)
//     playerMax: true,     // 📊 СИЛА ГРАВЦЯ (MAX Y & X)
//     liveY: true,         // ⚖️ LIVE: ТЯГА (Вісь Y)
//     liveX: true          // ⚖️ LIVE: КЕРУВАННЯ (Вісь X)
// };

// class DebugOverlay {
//     #container;
//     #content;
//     #intervalId;
//     #data = {};
//     #userScale = 1.0; // Додана змінна для ручного керування масштабом

//     constructor() {
//         this.#initDOM();
//         this.#initListener();
//         this.#start();
//     }

//     #initDOM() {
//         this.#container = document.createElement('div');
//         this.#container.style.cssText = 'position: absolute; top: 10px; left: 10px; background: rgba(11, 21, 32, 0.95); color: #ffffff; padding: 15px 15px 50px 15px; font-family: monospace; font-size: 14px; border: 1px solid #4a5b6c; border-radius: 8px; z-index: 10000; display: none; box-shadow: 0 4px 15px rgba(0,0,0,0.6); min-width: 280px; transform-origin: top left; touch-action: none; pointer-events: all;';
        
//         // Використовуємо універсальний щит
//         UIUtils.makeSolid(this.#container);

//         this.#content = document.createElement('div');
//         this.#content.style.pointerEvents = 'none'; 
//         this.#container.appendChild(this.#content);

//         const controlsDiv = document.createElement('div');
//         controlsDiv.style.cssText = 'position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 15px; z-index: 10001; pointer-events: all;';

//         const btnMinus = document.createElement('button');
//         btnMinus.innerHTML = '-';
//         this.#styleZoomBtn(btnMinus);
        
//         const btnPlus = document.createElement('button');
//         btnPlus.innerHTML = '+';
//         this.#styleZoomBtn(btnPlus);

//         const handleZoom = (e, delta) => {
//             e.preventDefault();
//             e.stopPropagation();
//             e.stopImmediatePropagation(); 
//             this.#userScale = Math.max(0.3, Math.min(3.0, this.#userScale + delta));
//             this.#forceScaleUpdate();
//         };

//         // ВАЖЛИВО: додано { capture: true } для кнопок
//         [ {btn: btnMinus, d: -0.1}, {btn: btnPlus, d: 0.1} ].forEach(({btn, d}) => {
//             btn.addEventListener('pointerdown', (e) => handleZoom(e, d), { capture: true, passive: false });
//             btn.addEventListener('touchstart', (e) => handleZoom(e, d), { capture: true, passive: false });
            
//             ['pointerup', 'touchend', 'click', 'mousedown', 'mouseup'].forEach(evt => {
//                 btn.addEventListener(evt, (e) => {
//                     e.preventDefault();
//                     e.stopPropagation();
//                     e.stopImmediatePropagation();
//                 }, { capture: true });
//             });
//         });

//         controlsDiv.appendChild(btnMinus);
//         controlsDiv.appendChild(btnPlus);
//         this.#container.appendChild(controlsDiv);
//         document.body.appendChild(this.#container);

//         if (typeof UIDraggableButton !== 'undefined' && typeof CONFIG !== 'undefined') {
//             new UIDraggableButton(this.#container, null, CONFIG, { noTransform: true });
//         }
//     }

//     #styleZoomBtn(btn) {
//         Object.assign(btn.style, {
//             width: '32px',
//             height: '32px',
//             backgroundColor: 'rgba(0, 204, 255, 0.1)',
//             color: '#00ccff',
//             border: '1px solid #00ccff',
//             borderRadius: '6px',
//             fontFamily: 'monospace',
//             fontWeight: 'bold',
//             fontSize: '20px',
//             cursor: 'pointer',
//             display: 'flex',
//             justifyContent: 'center',
//             alignItems: 'center',
//             touchAction: 'none'
//         });

//         btn.addEventListener('mouseenter', () => btn.style.backgroundColor = 'rgba(0, 204, 255, 0.3)');
//         btn.addEventListener('mouseleave', () => btn.style.backgroundColor = 'rgba(0, 204, 255, 0.1)');
//     }

//     #initListener() {
//         document.addEventListener('debug-live-update', (e) => {
//             this.#data = e.detail; 
//             if (this.#container.style.display === 'none') {
//                 this.#container.style.display = 'block';
//             }
//         });
//     }

//     #getStateColor(state) {
//         switch(state.toLowerCase()) {
//             case 'dash': return '#ff4444';
//             case 'lastdash': return '#ff00ff';
//             case 'panic': return '#ff0055';
//             case 'megadash': return '#ff2222';
//             case 'surrender': return '#888888';
//             case 'swim': return '#ffaa00';
//             case 'rest': return '#00ff80';
//             case 'idle': return '#00ccff';
//             default: return '#8a9bac';
//         }
//     }

//     #forceScaleUpdate() {
//         this.#container.style.transform = 'none';
//         const rect = this.#container.getBoundingClientRect();
//         const availableW = window.innerWidth - 20; 
//         const availableH = window.innerHeight - 20;
        
//         const scaleX = availableW / rect.width;
//         const scaleY = availableH / rect.height;
        
//         // Додаємо множник ручного масштабу userScale
//         const finalScale = Math.min(1, scaleX, scaleY) * this.#userScale;
//         this.#container.style.transform = `scale(${finalScale})`;
//     }

//     #update() {
//         if (typeof CONFIG === 'undefined' || !CONFIG.debug?.overlay) {
//             this.#container.style.display = 'none';
//             return;
//         }

//         const d = this.#data;
        
//         // --- БАЗОВІ ЗМІННІ ---
//         const initialFishBase = (CONFIG.fish.level * CONFIG.fish.weight) + CONFIG.fish.resistance;
//         const currentFishBase = d.fishBasePower || initialFishBase;
//         const lostFishBase = initialFishBase - currentFishBase;

//         const currentState = d.fishState || '---';
//         const currentPullMult = d.pullMult || 0;
//         const currentMoveMult = d.moveMult || 0;
//         const stateColor = this.#getStateColor(currentState);

//         const playerPullForce = d.playerForceY || 0;
//         const currentFishPullForce = d.fishForceY || 0;
//         const playerSteerForce = d.playerForceX || 0;
//         const currentFishEscapeForce = d.fishForceX || 0;

//         const totalPullForce = playerPullForce + currentFishPullForce;
//         const playerPctY = totalPullForce > 0 ? (playerPullForce / totalPullForce) * 100 : 0;
//         const fishPctY = totalPullForce > 0 ? (currentFishPullForce / totalPullForce) * 100 : 0;

//         const totalSteerForce = playerSteerForce + currentFishEscapeForce;
//         const playerPctX = totalSteerForce > 0 ? (playerSteerForce / totalSteerForce) * 100 : 0;
//         const fishPctX = totalSteerForce > 0 ? (currentFishEscapeForce / totalSteerForce) * 100 : 0;

//         // --- ЛОГІКА ДЛЯ РИБИ ---
//         const behaviors = CONFIG.fish.behaviors || {};
//         let maxPull = 0, minPull = Infinity, maxMove = 0;
//         const behaviorKeys = Object.keys(behaviors);
        
//         if (behaviorKeys.length > 0) {
//             behaviorKeys.forEach(k => {
//                 if (behaviors[k].pull > maxPull) maxPull = behaviors[k].pull;
//                 if (behaviors[k].pull < minPull) minPull = behaviors[k].pull;
                
//                 const edgeMult = behaviors[k].edgePowerMultiplier ?? CONFIG.fish.edgePowerMultiplier ?? 1.0;
//                 const effectiveMove = Math.abs(behaviors[k].move || 0) * edgeMult;
//                 if (effectiveMove > maxMove) maxMove = effectiveMove;
//             });
//         } else {
//             minPull = 0;
//         }

//         const getFishStateForceCompact = (stateName) => {
//             if (!behaviors[stateName]) return '';
            
//             const edgeMult = behaviors[stateName].edgePowerMultiplier ?? CONFIG.fish.edgePowerMultiplier ?? 1.0;
//             const yForce = currentFishBase * behaviors[stateName].pull * CONFIG.physics.fishForceMultiplier;
//             const xForce = currentFishBase * Math.abs(behaviors[stateName].move || 0) * edgeMult * CONFIG.physics.fishForceMultiplier;
            
//             return `
//                 <div style="margin-bottom: 2px; display: flex; justify-content: space-between;">
//                     <span style="color: ${this.#getStateColor(stateName)}; font-weight: bold;">${stateName.toUpperCase()}</span>
//                     <span style="color: #e6e6e6;">Y: <span style="color: ${this.#getStateColor(stateName)}; font-weight: bold;">${yForce.toFixed(3)}</span> | X: <span style="color: ${this.#getStateColor(stateName)}; font-weight: bold;">${xForce.toFixed(3)}</span></span>
//                 </div>
//             `;
//         };

//         const maxPossibleForceY = currentFishBase * maxPull * CONFIG.physics.fishForceMultiplier;
//         const worstFishX = currentFishBase * maxMove * CONFIG.physics.fishForceMultiplier;

//         let dynamicStatesHtml = '';
//         behaviorKeys.forEach(k => {
//             dynamicStatesHtml += getFishStateForceCompact(k);
//         });

//         // --- ЛОГІКА ДЛЯ ГРАВЦЯ ---
//         const rPower = (CONFIG.rod.level * CONFIG.rod.basePower);
//         const rlPower = (CONFIG.reel.level * CONFIG.reel.basePower);
//         const pPower = rPower + rlPower;

//         const maxPenalty = CONFIG.physics.edgePullPenalty || 0.0;
//         const rodComp = CONFIG.rod.compensation || 0.0;
//         const worstPenaltyMult = Math.max(0.1, 1.0 - (maxPenalty * (1 - rodComp)));
//         const worstEffectivePower = pPower * worstPenaltyMult;

//         const screenW = window.innerWidth;
//         const screenH = window.innerHeight;
//         const rodScreenX = (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== 'center') ? Number(CONFIG.ui.rod.x) : screenW / 2;
//         const maxOffsetDistance = Math.max(rodScreenX, screenW - rodScreenX);
//         const worstDistanceY = 50; 
        
//         const worstPullDirLength = Math.hypot(maxOffsetDistance, worstDistanceY);
//         const worstPullDirY = worstDistanceY / worstPullDirLength; 

//         const worstPlayerY = worstEffectivePower * worstPullDirY * CONFIG.physics.playerForceMultiplier;
//         const playerSteerForceBase = pPower * CONFIG.physics.playerSteeringMultiplier * CONFIG.physics.playerForceMultiplier;
//         const playerSteerForceMin = worstEffectivePower * CONFIG.physics.playerSteeringMultiplier * CONFIG.physics.playerForceMultiplier;
//         const bestPlayerY = pPower * CONFIG.physics.playerForceMultiplier;

//         // --- ЗБІРКА МОДУЛЬНОГО HTML ---
//         let html = '';

//         // --- БЛОК 1: ЕХОЛОТ (Тільки коли риба не на гачку) ---
//         if (OVERLAY_MODULES.echo && (d.gameState === 'scouting' || d.gameState === 'waiting')) {
//             html += `<div style="color: #00ff80; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">📡 ЕХОЛОТ</div>`;
//             html += `<div style="margin-bottom: 4px;">Стан: <span style="color: #00ccff; text-transform: uppercase;">${d.gameState}</span></div>`;
            
//             if (d.gameState === 'waiting') {
//                 html += `<div style="margin-bottom: 4px;">Глибина: <span style="color: #ffaa00;">${d.depth ? d.depth.toFixed(2) : 0} м</span></div>`;
//                 html += `<div style="margin-bottom: 4px;">Наживка: <span style="color: #b066ff;">${d.bait}</span></div>`;
//                 html += `<div style="margin-bottom: 8px;">Фаза: <span style="color: #ffff00;">${d.phase}</span></div>`;
                
//                 html += `<div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Шанси кльову:</div>`;
//                 if (d.liveChances && d.liveChances.length > 0) {
//                     d.liveChances.forEach(fish => {
//                         html += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
//                             <span>${fish.name}</span>
//                             <span style="color: #00ff80; font-weight: bold;">${fish.chance}</span>
//                         </div>`;
//                     });
//                 } else {
//                     html += `<div style="color: #ff4444; font-weight: bold; margin-bottom: 2px;">Тут риби немає!</div>`;
//                 }
//             } else {
//                 html += `<div style="color: #8a9bac; margin-bottom: 4px;">Закиньте вудку для аналізу...</div>`;
//             }
//             html += `<div style="margin-bottom: 12px;"></div>`;
//         }

//         if (OVERLAY_MODULES.state) {
//             html += `
//                 <div style="color: #00ccff; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">🧠 ПОВЕДІНКА (STATE)</div>
//                 <div style="margin-bottom: 4px;">Стан: <span style="color: ${stateColor}; text-transform: uppercase; font-weight: bold;">${currentState}</span></div>
//                 <div style="margin-bottom: 4px;">Множник Тяги (Y): <span style="color: ${stateColor};">x${currentPullMult.toFixed(2)}</span></div>
//                 <div style="margin-bottom: 12px;">Множник Втечі (X): <span style="color: ${stateColor};">x${currentMoveMult.toFixed(2)}</span></div>
//             `;
//         }

//         if (OVERLAY_MODULES.fishBase) {
//             html += `
//                 <div style="color: #ffaa00; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">🔥 ПОТОЧНА БАЗОВА СИЛА РИБИ</div>
//                 <div style="margin-bottom: 4px;">Початкова база: <span style="color: #8a9bac;">${initialFishBase.toFixed(2)}</span></div>
//                 <div style="margin-bottom: 4px;">Втрачено (Виснаження): <span style="color: #ff4444; font-weight: bold;">-${lostFishBase.toFixed(2)}</span></div>
//                 <div style="margin-bottom: 12px; font-size: 16px;">Поточна: <span style="color: #00ff80; font-weight: bold;">${currentFishBase.toFixed(2)}</span></div>
//             `;
//         }

//         if (OVERLAY_MODULES.fishStates) {
//             html += `
//                 <div style="color: #ffaa00; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">📊 СИЛА РИБИ ЗА СТАНАМИ (MAX Y та X)</div>
//                 ${dynamicStatesHtml}
//                 <div style="margin-bottom: 12px;"></div>
//             `;
//         }

//         if (OVERLAY_MODULES.worstCase) {
//             html += `
//                 <div style="color: #ff4444; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">💀 НАЙГІРШІ УМОВИ (КУТ)</div>
//                 <div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Максимальна тяга X:</div>
//                 <div style="margin-bottom: 2px; display: flex; justify-content: space-between;">
//                     <span>Риба:</span> <span style="color: #ff4444; font-weight: bold;">${worstFishX.toFixed(3)}</span>
//                 </div>
//                 <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
//                     <span>Гравець:</span> <span style="color: #ffaa00; font-weight: bold;">${playerSteerForceMin.toFixed(3)}</span>
//                 </div>
                
//                 <div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Максимальна тяга Y:</div>
//                 <div style="margin-bottom: 2px; display: flex; justify-content: space-between;">
//                     <span>Риба:</span> <span style="color: #ff4444; font-weight: bold;">${maxPossibleForceY.toFixed(3)}</span>
//                 </div>
//                 <div style="margin-bottom: 12px; display: flex; justify-content: space-between;">
//                     <span>Гравець:</span> <span style="color: #ffaa00; font-weight: bold;">${worstPlayerY.toFixed(3)}</span>
//                 </div>
//             `;
//         }

//         if (OVERLAY_MODULES.playerMax) {
//             html += `
//                 <div style="color: #00ff80; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">📊 СИЛА ГРАВЦЯ (MAX Y & X)</div>
//                 <div style="margin-bottom: 2px; display: flex; justify-content: space-between;"><span>ТЯГА МІН (Кут Y):</span> <span style="color: #ffaa00; font-weight: bold;">${worstPlayerY.toFixed(3)}</span></div>
//                 <div style="margin-bottom: 6px; display: flex; justify-content: space-between;"><span>ТЯГА МАКС (Центр Y):</span> <span style="color: #00ff80; font-weight: bold;">${bestPlayerY.toFixed(3)}</span></div>
//                 <div style="margin-bottom: 2px; display: flex; justify-content: space-between;"><span>КЕРМО МІН (Кут X):</span> <span style="color: #ffaa00; font-weight: bold;">${playerSteerForceMin.toFixed(3)}</span></div>
//                 <div style="margin-bottom: 12px; display: flex; justify-content: space-between;"><span>КЕРМО МАКС (Центр X):</span> <span style="color: #00ff80; font-weight: bold;">${playerSteerForceBase.toFixed(3)}</span></div>
//             `;
//         }

//         if (OVERLAY_MODULES.liveY) {
//             const leaderTextY = fishPctY > playerPctY 
//                 ? `<span style="color: #ff4444;">🚨 Риба тягне сильніше на ${(fishPctY - playerPctY).toFixed(1)}%</span>` 
//                 : `<span style="color: #00ff80;">💪 Гравець тягне сильніше на ${(playerPctY - fishPctY).toFixed(1)}%</span>`;

//             html += `
//                 <div style="color: #00ccff; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">⚖️ LIVE: ТЯГА (Вісь Y)</div>
//                 <div style="margin-bottom: 4px;">Гравець: <span style="color: #00ff80;">${playerPullForce.toFixed(3)}</span> | Риба: <span style="color: #ff4444;">${currentFishPullForce.toFixed(3)}</span></div>
//                 <div style="margin-bottom: 4px; font-weight: bold;">
//                     <span style="color: #ff4444;">Риба ${fishPctY.toFixed(1)}%</span> VS <span style="color: #00ff80;">Гравець ${playerPctY.toFixed(1)}%</span>
//                 </div>
//                 <div style="font-weight: bold; font-size: 13px; margin-bottom: 12px;">${leaderTextY}</div>
//             `;
//         }

//         if (OVERLAY_MODULES.liveX) {
//             const leaderTextX = fishPctX > playerPctX 
//                 ? `<span style="color: #ff4444;">🚨 Риба втікає (Домінує на ${(fishPctX - playerPctX).toFixed(1)}%)</span>` 
//                 : `<span style="color: #00ff80;">✅ Керування стабільне (Перевага ${(playerPctX - fishPctX).toFixed(1)}%)</span>`;

//             html += `
//                 <div style="color: #00ccff; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">⚖️ LIVE: КЕРУВАННЯ (Вісь X)</div>
//                 <div style="margin-bottom: 4px;">Гравець: <span style="color: #00ff80;">${playerSteerForce.toFixed(3)}</span> | Риба: <span style="color: #ff4444;">${currentFishEscapeForce.toFixed(3)}</span></div>
//                 <div style="margin-bottom: 4px; font-weight: bold;">
//                     <span style="color: #ff4444;">Риба ${fishPctX.toFixed(1)}%</span> VS <span style="color: #00ff80;">Гравець ${playerPctX.toFixed(1)}%</span>
//                 </div>
//                 <div style="font-weight: bold; font-size: 13px;">${leaderTextX}</div>
//             `;
//         }

//         // Оновлюємо контент лише якщо є що показати
//         if (html !== '') {
//             this.#content.innerHTML = html;
//             this.#container.style.display = 'block';
//             this.#forceScaleUpdate();
//         } else {
//             this.#container.style.display = 'none';
//         }
//     } 

//     #start() {
//         this.#intervalId = setInterval(() => this.#update(), 100);
//     }
// }

// new DebugOverlay();

// Зручний конфіг для увімкнення/вимкнення блоків оверлею
const OVERLAY_MODULES = {
    echo: true,          // 📡 ЕХОЛОТ (Глибина, Шанси кльову)
    state: true,         // 🧠 ПОВЕДІНКА (STATE)
    fishBase: true,      // 🔥 ПОТОЧНА БАЗОВА СИЛА РИБИ
    fishStates: true,    // 📊 СИЛА РИБИ ЗА СТАНАМИ (MAX Y та X)
    worstCase: true,     // 💀 НАЙГІРШИЙ СЦЕНАРІЙ (НИЖНІЙ КУТ)
    playerMax: true,     // 📊 СИЛА ГРАВЦЯ (MAX Y & X)
    liveY: true,         // ⚖️ LIVE: ТЯГА (Вісь Y)
    liveX: true          // ⚖️ LIVE: КЕРУВАННЯ (Вісь X)
};

class DebugOverlay {
    #container;
    #content;
    #intervalId;
    #data = {};
    #userScale = 1.0; 

    constructor() {
        this.#initDOM();
        this.#initListener();
        this.#start();
    }

    #initDOM() {
        this.#container = document.createElement('div');
        this.#container.style.cssText = 'position: absolute; top: 10px; left: 10px; background: rgba(11, 21, 32, 0.95); color: #ffffff; padding: 15px 15px 50px 15px; font-family: monospace; font-size: 14px; border: 1px solid #4a5b6c; border-radius: 8px; z-index: 10000; display: none; box-shadow: 0 4px 15px rgba(0,0,0,0.6); min-width: 280px; transform-origin: top left; touch-action: none; pointer-events: all;';
        
        UIUtils.makeSolid(this.#container);

        this.#content = document.createElement('div');
        this.#content.style.pointerEvents = 'none'; 
        this.#container.appendChild(this.#content);

        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = 'position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 15px; z-index: 10001; pointer-events: all;';

        const btnMinus = document.createElement('button');
        btnMinus.innerHTML = '-';
        this.#styleZoomBtn(btnMinus);
        
        const btnPlus = document.createElement('button');
        btnPlus.innerHTML = '+';
        this.#styleZoomBtn(btnPlus);

        const handleZoom = (e, delta) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); 
            this.#userScale = Math.max(0.3, Math.min(3.0, this.#userScale + delta));
            this.#forceScaleUpdate();
        };

        [ {btn: btnMinus, d: -0.1}, {btn: btnPlus, d: 0.1} ].forEach(({btn, d}) => {
            btn.addEventListener('pointerdown', (e) => handleZoom(e, d), { capture: true, passive: false });
            btn.addEventListener('touchstart', (e) => handleZoom(e, d), { capture: true, passive: false });
            
            ['pointerup', 'touchend', 'click', 'mousedown', 'mouseup'].forEach(evt => {
                btn.addEventListener(evt, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }, { capture: true });
            });
        });

        controlsDiv.appendChild(btnMinus);
        controlsDiv.appendChild(btnPlus);
        this.#container.appendChild(controlsDiv);
        document.body.appendChild(this.#container);

        if (typeof UIDraggableButton !== 'undefined' && typeof CONFIG !== 'undefined') {
            new UIDraggableButton(this.#container, null, CONFIG, { noTransform: true });
        }
    }

    #styleZoomBtn(btn) {
        Object.assign(btn.style, {
            width: '32px',
            height: '32px',
            backgroundColor: 'rgba(0, 204, 255, 0.1)',
            color: '#00ccff',
            border: '1px solid #00ccff',
            borderRadius: '6px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            fontSize: '20px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            touchAction: 'none'
        });

        btn.addEventListener('mouseenter', () => btn.style.backgroundColor = 'rgba(0, 204, 255, 0.3)');
        btn.addEventListener('mouseleave', () => btn.style.backgroundColor = 'rgba(0, 204, 255, 0.1)');
    }

    #initListener() {
        document.addEventListener('debug-live-update', (e) => {
            this.#data = e.detail; 
            if (this.#container.style.display === 'none') {
                this.#container.style.display = 'block';
            }
        });
    }

    #getStateColor(state) {
        switch(state.toLowerCase()) {
            case 'dash': return '#ff4444';
            case 'lastdash': return '#ff00ff';
            case 'panic': return '#ff0055';
            case 'megadash': return '#ff2222';
            case 'surrender': return '#888888';
            case 'swim': return '#ffaa00';
            case 'rest': return '#00ff80';
            case 'idle': return '#00ccff';
            default: return '#8a9bac';
        }
    }

    #forceScaleUpdate() {
        this.#container.style.transform = 'none';
        const rect = this.#container.getBoundingClientRect();
        const availableW = window.innerWidth - 20; 
        const availableH = window.innerHeight - 20;
        
        const scaleX = availableW / rect.width;
        const scaleY = availableH / rect.height;
        
        const finalScale = Math.min(1, scaleX, scaleY) * this.#userScale;
        this.#container.style.transform = `scale(${finalScale})`;
    }

    #update() {
        if (typeof CONFIG === 'undefined' || !CONFIG.debug?.overlay) {
            this.#container.style.display = 'none';
            return;
        }

        const d = this.#data;
        let html = '';

        // --- БЛОК 1: ЕХОЛОТ (Тільки коли риба не на гачку) ---
        if (OVERLAY_MODULES.echo && (d.gameState === 'scouting' || d.gameState === 'waiting')) {
            html += `<div style="color: #00ff80; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">📡 ЕХОЛОТ</div>`;
            html += `<div style="margin-bottom: 4px;">Стан: <span style="color: #00ccff; text-transform: uppercase;">${d.gameState}</span></div>`;
            
            if (d.gameState === 'waiting') {
                html += `<div style="margin-bottom: 4px;">Глибина: <span style="color: #ffaa00;">${d.depth ? d.depth.toFixed(2) : 0} м</span></div>`;
                html += `<div style="margin-bottom: 4px;">Наживка: <span style="color: #b066ff;">${d.bait}</span></div>`;
                html += `<div style="margin-bottom: 8px;">Фаза: <span style="color: #ffff00;">${d.phase}</span></div>`;
                
                html += `<div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Шанси кльову:</div>`;
                if (d.liveChances && d.liveChances.length > 0) {
                    d.liveChances.forEach(fish => {
                        html += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                            <span>${fish.name}</span>
                            <span style="color: #00ff80; font-weight: bold;">${fish.chance}</span>
                        </div>`;
                    });
                } else {
                    html += `<div style="color: #ff4444; font-weight: bold; margin-bottom: 2px;">Тут риби немає!</div>`;
                }
            } else {
                html += `<div style="color: #8a9bac; margin-bottom: 4px;">Закиньте вудку для аналізу...</div>`;
            }
            html += `<div style="margin-bottom: 12px;"></div>`;
        }

        // --- БЛОК 2: БОРОТЬБА (Тільки коли риба на гачку) ---
        if (d.gameState === 'playing') {
            const initialFishBase = d.fishInitialPower || ((CONFIG.fish.level * CONFIG.fish.weight) + CONFIG.fish.resistance);
            const currentFishBase = d.fishBasePower || initialFishBase;
            const lostFishBase = initialFishBase - currentFishBase;

            const currentState = d.fishState || '---';
            const currentPullMult = d.pullMult || 0;
            const currentMoveMult = d.moveMult || 0;
            const stateColor = this.#getStateColor(currentState);

            const playerPullForce = d.playerForceY || 0;
            const currentFishPullForce = d.fishForceY || 0;
            const playerSteerForce = d.playerForceX || 0;
            const currentFishEscapeForce = d.fishForceX || 0;

            const totalPullForce = playerPullForce + currentFishPullForce;
            const playerPctY = totalPullForce > 0 ? (playerPullForce / totalPullForce) * 100 : 0;
            const fishPctY = totalPullForce > 0 ? (currentFishPullForce / totalPullForce) * 100 : 0;

            const totalSteerForce = playerSteerForce + currentFishEscapeForce;
            const playerPctX = totalSteerForce > 0 ? (playerSteerForce / totalSteerForce) * 100 : 0;
            const fishPctX = totalSteerForce > 0 ? (currentFishEscapeForce / totalSteerForce) * 100 : 0;

            const behaviors = CONFIG.fish.behaviors || {};
            let maxPull = 0, minPull = Infinity, maxMove = 0;
            const behaviorKeys = Object.keys(behaviors);
            
            if (behaviorKeys.length > 0) {
                behaviorKeys.forEach(k => {
                    if (behaviors[k].pull > maxPull) maxPull = behaviors[k].pull;
                    if (behaviors[k].pull < minPull) minPull = behaviors[k].pull;
                    const edgeMult = behaviors[k].edgePowerMultiplier ?? CONFIG.fish.edgePowerMultiplier ?? 1.0;
                    const effectiveMove = Math.abs(behaviors[k].move || 0) * edgeMult;
                    if (effectiveMove > maxMove) maxMove = effectiveMove;
                });
            } else {
                minPull = 0;
            }

            const getFishStateForceCompact = (stateName) => {
                if (!behaviors[stateName]) return '';
                const edgeMult = behaviors[stateName].edgePowerMultiplier ?? CONFIG.fish.edgePowerMultiplier ?? 1.0;
                const yForce = currentFishBase * behaviors[stateName].pull * CONFIG.physics.fishForceMultiplier;
                const xForce = currentFishBase * Math.abs(behaviors[stateName].move || 0) * edgeMult * CONFIG.physics.fishForceMultiplier;
                return `
                    <div style="margin-bottom: 2px; display: flex; justify-content: space-between;">
                        <span style="color: ${this.#getStateColor(stateName)}; font-weight: bold;">${stateName.toUpperCase()}</span>
                        <span style="color: #e6e6e6;">Y: <span style="color: ${this.#getStateColor(stateName)}; font-weight: bold;">${yForce.toFixed(3)}</span> | X: <span style="color: ${this.#getStateColor(stateName)}; font-weight: bold;">${xForce.toFixed(3)}</span></span>
                    </div>
                `;
            };

            const maxPossibleForceY = currentFishBase * maxPull * CONFIG.physics.fishForceMultiplier;
            const worstFishX = currentFishBase * maxMove * CONFIG.physics.fishForceMultiplier;

            let dynamicStatesHtml = '';
            behaviorKeys.forEach(k => { dynamicStatesHtml += getFishStateForceCompact(k); });

            const rPower = (CONFIG.rod.level * CONFIG.rod.basePower);
            const rlPower = (CONFIG.reel.level * CONFIG.reel.basePower);
            const pPower = rPower + rlPower;

            const maxPenalty = CONFIG.physics.edgePullPenalty || 0.0;
            const rodComp = CONFIG.rod.compensation || 0.0;
            const worstPenaltyMult = Math.max(0.1, 1.0 - (maxPenalty * (1 - rodComp)));
            const worstEffectivePower = pPower * worstPenaltyMult;

            const screenW = window.innerWidth;
            const screenH = window.innerHeight;
            const rodScreenX = (CONFIG.ui?.rod?.x && CONFIG.ui.rod.x !== 'center') ? Number(CONFIG.ui.rod.x) : screenW / 2;
            const maxOffsetDistance = Math.max(rodScreenX, screenW - rodScreenX);
            const worstDistanceY = 50; 
            const worstPullDirLength = Math.hypot(maxOffsetDistance, worstDistanceY);
            const worstPullDirY = worstDistanceY / worstPullDirLength; 

            const worstPlayerY = worstEffectivePower * worstPullDirY * CONFIG.physics.playerForceMultiplier;
            const playerSteerForceBase = pPower * CONFIG.physics.playerSteeringMultiplier * CONFIG.physics.playerForceMultiplier;
            const playerSteerForceMin = worstEffectivePower * CONFIG.physics.playerSteeringMultiplier * CONFIG.physics.playerForceMultiplier;
            const bestPlayerY = pPower * CONFIG.physics.playerForceMultiplier;

            if (OVERLAY_MODULES.state) {
                html += `
                    <div style="color: #00ccff; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">🧠 ПОВЕДІНКА (STATE)</div>
                    <div style="margin-bottom: 4px;">Стан: <span style="color: ${stateColor}; text-transform: uppercase; font-weight: bold;">${currentState}</span></div>
                    <div style="margin-bottom: 4px;">Множник Тяги (Y): <span style="color: ${stateColor};">x${currentPullMult.toFixed(2)}</span></div>
                    <div style="margin-bottom: 12px;">Множник Втечі (X): <span style="color: ${stateColor};">x${currentMoveMult.toFixed(2)}</span></div>
                `;
            }

            if (OVERLAY_MODULES.fishBase) {
                html += `
                    <div style="color: #ffaa00; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">🔥 ПОТОЧНА БАЗОВА СИЛА РИБИ</div>
                    <div style="margin-bottom: 4px;">Початкова база: <span style="color: #8a9bac;">${initialFishBase.toFixed(2)}</span></div>
                    <div style="margin-bottom: 4px;">Втрачено (Виснаження): <span style="color: #ff4444; font-weight: bold;">-${lostFishBase.toFixed(2)}</span></div>
                    <div style="margin-bottom: 12px; font-size: 16px;">Поточна: <span style="color: #00ff80; font-weight: bold;">${currentFishBase.toFixed(2)}</span></div>
                `;
            }

            if (OVERLAY_MODULES.fishStates) {
                html += `
                    <div style="color: #ffaa00; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">📊 СИЛА РИБИ ЗА СТАНАМИ</div>
                    ${dynamicStatesHtml}
                    <div style="margin-bottom: 12px;"></div>
                `;
            }

            if (OVERLAY_MODULES.worstCase) {
                html += `
                    <div style="color: #ff4444; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">💀 НАЙГІРШІ УМОВИ (КУТ)</div>
                    <div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Максимальна тяга X:</div>
                    <div style="margin-bottom: 2px; display: flex; justify-content: space-between;">
                        <span>Риба:</span> <span style="color: #ff4444; font-weight: bold;">${worstFishX.toFixed(3)}</span>
                    </div>
                    <div style="margin-bottom: 8px; display: flex; justify-content: space-between;">
                        <span>Гравець:</span> <span style="color: #ffaa00; font-weight: bold;">${playerSteerForceMin.toFixed(3)}</span>
                    </div>
                    <div style="color: #8a9bac; font-size: 12px; margin-bottom: 4px;">Максимальна тяга Y:</div>
                    <div style="margin-bottom: 2px; display: flex; justify-content: space-between;">
                        <span>Риба:</span> <span style="color: #ff4444; font-weight: bold;">${maxPossibleForceY.toFixed(3)}</span>
                    </div>
                    <div style="margin-bottom: 12px; display: flex; justify-content: space-between;">
                        <span>Гравець:</span> <span style="color: #ffaa00; font-weight: bold;">${worstPlayerY.toFixed(3)}</span>
                    </div>
                `;
            }

            if (OVERLAY_MODULES.playerMax) {
                html += `
                    <div style="color: #00ff80; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">📊 СИЛА ГРАВЦЯ</div>
                    <div style="margin-bottom: 2px; display: flex; justify-content: space-between;"><span>ТЯГА МІН:</span> <span style="color: #ffaa00; font-weight: bold;">${worstPlayerY.toFixed(3)}</span></div>
                    <div style="margin-bottom: 6px; display: flex; justify-content: space-between;"><span>ТЯГА МАКС:</span> <span style="color: #00ff80; font-weight: bold;">${bestPlayerY.toFixed(3)}</span></div>
                    <div style="margin-bottom: 2px; display: flex; justify-content: space-between;"><span>КЕРМО МІН:</span> <span style="color: #ffaa00; font-weight: bold;">${playerSteerForceMin.toFixed(3)}</span></div>
                    <div style="margin-bottom: 12px; display: flex; justify-content: space-between;"><span>КЕРМО МАКС:</span> <span style="color: #00ff80; font-weight: bold;">${playerSteerForceBase.toFixed(3)}</span></div>
                `;
            }

            if (OVERLAY_MODULES.liveY) {
                const leaderTextY = fishPctY > playerPctY 
                    ? `<span style="color: #ff4444;">🚨 Риба тягне сильніше на ${(fishPctY - playerPctY).toFixed(1)}%</span>` 
                    : `<span style="color: #00ff80;">💪 Гравець тягне сильніше на ${(playerPctY - fishPctY).toFixed(1)}%</span>`;
                html += `
                    <div style="color: #00ccff; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">⚖️ LIVE: ТЯГА (Y)</div>
                    <div style="margin-bottom: 4px;">Гравець: <span style="color: #00ff80;">${playerPullForce.toFixed(3)}</span> | Риба: <span style="color: #ff4444;">${currentFishPullForce.toFixed(3)}</span></div>
                    <div style="font-weight: bold; font-size: 13px; margin-bottom: 12px;">${leaderTextY}</div>
                `;
            }

            if (OVERLAY_MODULES.liveX) {
                const leaderTextX = fishPctX > playerPctX 
                    ? `<span style="color: #ff4444;">🚨 Риба втікає (Домінує на ${(fishPctX - playerPctX).toFixed(1)}%)</span>` 
                    : `<span style="color: #00ff80;">✅ Керування стабільне</span>`;
                html += `
                    <div style="color: #00ccff; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">⚖️ LIVE: КЕРУВАННЯ (X)</div>
                    <div style="margin-bottom: 4px;">Гравець: <span style="color: #00ff80;">${playerSteerForce.toFixed(3)}</span> | Риба: <span style="color: #ff4444;">${currentFishEscapeForce.toFixed(3)}</span></div>
                    <div style="font-weight: bold; font-size: 13px;">${leaderTextX}</div>
                `;
            }
        }

        // Оновлюємо контент лише якщо є що показати
        if (html !== '') {
            this.#content.innerHTML = html;
            this.#container.style.display = 'block';
            this.#forceScaleUpdate();
        } else {
            this.#container.style.display = 'none';
        }
    }

    #start() {
        this.#intervalId = setInterval(() => this.#update(), 100);
    }
}

new DebugOverlay();
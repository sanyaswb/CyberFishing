setTimeout(() => {
    console.group('%c🐟 Аналіз Балансу Механіки Риболовлі', 'color: #00ff80; font-size: 16px; font-weight: bold;');

    const rPower = (CONFIG.rod.level * CONFIG.rod.basePower);
    const rlPower = (CONFIG.reel.level * CONFIG.reel.basePower);
    const pPower = rPower + rlPower;
    const fPower = (CONFIG.fish.level * CONFIG.fish.weight) + CONFIG.fish.resistance;

    const playerPullForce = pPower * CONFIG.physics.playerForceMultiplier;
    const playerSteerForce = pPower * CONFIG.physics.playerSteeringMultiplier * 4.0 * CONFIG.physics.playerForceMultiplier;
    const fishPullForce = fPower * CONFIG.physics.fishForceMultiplier;
    const fishEscapeForce = (fPower * CONFIG.fish.edgePowerMultiplier) * CONFIG.physics.fishForceMultiplier;

    const recoveryBonus = 1 + (rlPower * (CONFIG.tension.reelRecoveryMultiplier || 0));
    const pullUptime = 1 / (1 + (1 / recoveryBonus)); 

    const powerRatio = fishPullForce / Math.max(0.001, playerPullForce);
    
    const maxStamina = (CONFIG.fish.level * CONFIG.fish.weight * CONFIG.stamina.fish.baseStaminaMultiplier) + CONFIG.stamina.fish.flatBonus;
    const maxDps = CONFIG.stamina.mechanics.baseDepletionRate * pPower; 
    const idealTimeSec = maxStamina / Math.max(1, maxDps);
    const exhaustionTime = idealTimeSec * fPower;
    const powerDropTotal = exhaustionTime * CONFIG.stamina.mechanics.basePowerDropPerSec;

    console.log('%c--- ДЕТАЛЬНИЙ РОЗРАХУНОК СИЛ ---', 'color: #00ccff; font-weight: bold;');
    
    const rodStr = `(${CONFIG.rod.level} * ${CONFIG.rod.basePower.toFixed(1)})`;
    const reelStr = `(${CONFIG.reel.level} * ${CONFIG.reel.basePower.toFixed(1)})`;
    console.log(`%c🎣 Гравець: ${rodStr} + ${reelStr} = ${pPower.toFixed(1)} (Базова сила гравця)`, 'color: #e6e6e6;');

    const fishStr = `(${CONFIG.fish.level} * ${CONFIG.fish.weight})`;
    console.log(`%c🦈 Риба: ${fishStr} + ${CONFIG.fish.resistance} = ${fPower.toFixed(1)} (Базова сила риби)`, 'color: #e6e6e6;');

    console.log(`%c⚙️ Множимо на рушій: Гравець тягне на ${pPower.toFixed(1)} * ${CONFIG.physics.playerForceMultiplier} = ${playerPullForce.toFixed(3)}. Риба тягне від тебе на ${fPower.toFixed(1)} * ${CONFIG.physics.fishForceMultiplier} = ${fishPullForce.toFixed(3)}.`, 'color: #e6e6e6;');
    console.log('%c--------------------------------', 'color: #00ccff; font-weight: bold;');

    console.log('%c--- ЕФЕКТИВНІСТЬ КОТУШКИ ---', 'color: #ffaa00; font-weight: bold;');
    console.log(`%c🔄 Швидкість скидання натягу: 1 + (${rlPower.toFixed(1)} * ${CONFIG.tension.reelRecoveryMultiplier}) = x${recoveryBonus.toFixed(1)}`, 'color: #ffff00;');
    console.log(`%c   -> 1: Базова швидкість скидання\n   -> ${rlPower.toFixed(1)}: Сила котушки (Reel Power)\n   -> ${CONFIG.tension.reelRecoveryMultiplier}: Множник з конфігу (reelRecoveryMultiplier)`, 'color: #8a9bac;');
    
    console.log(`%c⏱️ Корисний час тяги (Uptime): 1 / (1 + (1 / ${recoveryBonus.toFixed(1)})) = ${(pullUptime * 100).toFixed(1)}%`, 'color: #00ff80;');
    console.log(`%c   -> 1: Час витрачений на натягування\n   -> (1 / ${recoveryBonus.toFixed(1)}): Пропорційний час, який йде на скидання натягу`, 'color: #8a9bac;');
    console.log('%c--------------------------------', 'color: #00ccff; font-weight: bold;');

    const totalForceY = playerPullForce + fishPullForce;
    const playerPercentY = (playerPullForce / totalForceY) * 100;
    const fishPercentY = (fishPullForce / totalForceY) * 100;
    const diffPercentY = Math.abs(playerPercentY - fishPercentY);

    console.log(`%c⚖️ Співвідношення сил (на осі Y - Тяга):`, 'color: #ffaa00; font-weight: bold;');
    console.log(`%cРиба = ${fishPercentY.toFixed(1)}%`, 'color: #ff4444;');
    console.log(`%cГравець = ${playerPercentY.toFixed(1)}%`, 'color: #00ff80;');
    
    if (playerPercentY > fishPercentY) {
        console.log(`%c💪 Гравець сильніший на = ${diffPercentY.toFixed(1)}%`, 'color: #00ff80; font-weight: bold;');
    } else if (fishPercentY > playerPercentY) {
        console.log(`%c⚠️ Риба сильніша на = ${diffPercentY.toFixed(1)}%`, 'color: #ff4444; font-weight: bold;');
    } else {
        console.log(`%c🤝 Сили абсолютно рівні (0% різниці)`, 'color: #ffff00; font-weight: bold;');
    }
    console.log('%c--------------------------------', 'color: #00ccff; font-weight: bold;');

    const totalForceX = playerSteerForce + fishEscapeForce;
    const playerPercentX = (playerSteerForce / totalForceX) * 100;
    const fishPercentX = (fishEscapeForce / totalForceX) * 100;
    const diffPercentX = Math.abs(playerPercentX - fishPercentX);

    console.log(`%c⚖️ Співвідношення сил (на осі X - Керування):`, 'color: #ffaa00; font-weight: bold;');
    console.log(`%cРиба = ${fishPercentX.toFixed(1)}%`, 'color: #ff4444;');
    console.log(`%cГравець = ${playerPercentX.toFixed(1)}%`, 'color: #00ff80;');
    
    if (playerPercentX > fishPercentX) {
        console.log(`%c💪 Гравець сильніший на = ${diffPercentX.toFixed(1)}%`, 'color: #00ff80; font-weight: bold;');
    } else if (fishPercentX > playerPercentX) {
        console.log(`%c⚠️ Риба сильніша на = ${diffPercentX.toFixed(1)}%`, 'color: #ff4444; font-weight: bold;');
    } else {
        console.log(`%c🤝 Сили абсолютно рівні (0% різниці)`, 'color: #ffff00; font-weight: bold;');
    }
    console.log('%c--------------------------------', 'color: #00ccff; font-weight: bold;');

    console.table({
        "🎣 Тяга на себе (Y)": { "Значення": playerPullForce.toFixed(3), "Опис": "Сила витягування до берега" },
        "🎣 Керування (X)": { "Значення": playerSteerForce.toFixed(3), "Опис": "Сила утримання по центру" },
        "🦈 Опір (Y)": { "Значення": fishPullForce.toFixed(3), "Опис": "Сила віддалення від берега" },
        "🦈 Втеча (X)": { "Значення": fishEscapeForce.toFixed(3), "Опис": "Максимальна сила ривка в кут" },
    });

    console.log('%c====================================', 'color: #4a5b6c;');
    console.log('%c📈 Аналіз Прогрес Бару (Натяг)', 'color: #00ccff; font-size: 14px; font-weight: bold;');
    
    const fps = 60;
    const speedMultiplier = Math.pow(powerRatio, 2);
    const forceBalanceUp = totalForceY * speedMultiplier;
    
    const rateUpPerSec = forceBalanceUp * CONFIG.tension.sensitivityMultiplier * fps;
    const rateDownPerSecBase = forceBalanceUp * CONFIG.tension.sensitivityMultiplier * fps;
    const rateDownPerSecBuffed = rateDownPerSecBase * recoveryBonus;

    const timeToFill = 100 / rateUpPerSec;
    const timeToRecoverBase = 100 / rateDownPerSecBase;
    const timeToRecoverBuffed = 100 / rateDownPerSecBuffed;

    console.table({
        "Формула швидкості (Pumping)": { "Значення": `Ratio^2 = ${speedMultiplier.toFixed(2)}`, "Опис": `(Риба/Гравець)^2 -> (${powerRatio.toFixed(2)})^2` },
        "Час до повного заповнення (0->100%)": { "Значення": timeToFill.toFixed(2) + " сек", "Опис": `100 / (СумаСилY * Ratio^2 * Sens * 60FPS)` },
        "Час до скидання (БЕЗ котушки)": { "Значення": timeToRecoverBase.toFixed(2) + " сек", "Опис": `Додаткового прискорення немає (базовий час)` },
        "Час до скидання (З котушкою)": { "Значення": timeToRecoverBuffed.toFixed(2) + " сек", "Опис": `ЧасБЕЗКотушки / БонусВідновлення (x${recoveryBonus.toFixed(1)})` }
    });

    console.log('%c====================================', 'color: #4a5b6c;');
    console.log('%c❤️ Аналіз Стаміни (Фаза 1)', 'color: #ffcc00; font-size: 14px; font-weight: bold;');
    
    console.table({
        "Максимальне здоров'я риби": { "Значення": maxStamina.toFixed(0), "Опис": "Залежить від маси та рівня" },
        "Макс. Шкода (Натяг 0%)": { "Значення": maxDps.toFixed(1) + " / сек", "Опис": "Шкода при ідеальному таймінгу (свіжі руки)" },
        "Межа втоми (0 шкоди)": { "Значення": CONFIG.stamina.mechanics.optimalMax + "%", "Опис": "Натяг, після якого сили йдуть лише на утримання" },
        "Відновлення (Відпущена кнопка)": { "Значення": `до ${CONFIG.stamina.mechanics.baseRegenRate} / сек`, "Опис": "Лікування риби при повному відпусканні" },
        "Штрафне Відновлення (В кутку)": { "Значення": CONFIG.stamina.mechanics.edgeRegenRate + " / сек", "Опис": "Додаткове лікування на краях екрану" },
        "Час до виснаження (Ідеальний)": { "Значення": idealTimeSec.toFixed(1) + " сек", "Опис": "Мінімальний час боротьби при 0% натягу" }
    });

    console.log('%c====================================', 'color: #4a5b6c;');
    console.log('%c🔥 Аналіз Виснаження (Фаза 2)', 'color: #ff4444; font-size: 14px; font-weight: bold;');
    
    const finalFPower = Math.max(0, fPower - powerDropTotal);

    console.table({
        "Початкова Базова Сила Риби": { "Значення": (fPower).toFixed(2), "Опис": "До початку виснаження" },
        "Динамічний час виснаження": { "Значення": exhaustionTime.toFixed(1) + " сек", "Опис": "Ідеальний час * Силу риби" },
        "Швидкість падіння шкали": { "Значення": (maxStamina / exhaustionTime).toFixed(1) + " поінтів/сек", "Опис": "Згідно з формулою" },
        "Втрата сили за секунду": { "Значення": CONFIG.stamina.mechanics.basePowerDropPerSec + " од.", "Опис": "Зменшення базової сили кожну секунду" },
        "Орієнтовна сила ПІСЛЯ виснаження": { "Значення": finalFPower.toFixed(2), "Опис": "Фінальна сила риби після збиття червоної шкали" }
    });

    console.log('%c====================================', 'color: #4a5b6c;');
    console.log('%c🏆 ПРОГНОЗ РЕЗУЛЬТАТУ', 'color: #00ccff; font-size: 16px; font-weight: bold;');

    const effectivePlayerPull = playerPullForce * pullUptime;
    const finalFishPullForce = finalFPower * CONFIG.physics.fishForceMultiplier;

    if (effectivePlayerPull > fishPullForce) {
        console.log('%c✅ ГРАВЕЦЬ ПЕРЕМАГАЄ ЗІ СТАРТУ', 'color: #00ff80; font-size: 13px; font-weight: bold;');
        console.log(`%cВаша ефективна тяга (${effectivePlayerPull.toFixed(3)}) більша за стартовий опір риби (${fishPullForce.toFixed(3)}). Риба буде витягнута до берега навіть без виснаження.`, 'color: #8a9bac;');
    } else if (effectivePlayerPull > finalFishPullForce) {
        console.log('%c⚠️ ПЕРЕМОГА ТІЛЬКИ ПІСЛЯ ВИСНАЖЕННЯ', 'color: #ffff00; font-size: 13px; font-weight: bold;');
        console.log(`%cЗі старту риба сильніша, але після знищення червоної шкали її опір впаде, і ви зможете її витягнути.`, 'color: #8a9bac;');
        console.log(`%c-> Зі старту: Ефективна тяга ${effectivePlayerPull.toFixed(3)} | Риба ${fishPullForce.toFixed(3)}`, 'color: #ff4444;');
        console.log(`%c-> Після виснаження: Ефективна тяга ${effectivePlayerPull.toFixed(3)} | Риба ${finalFishPullForce.toFixed(3)}`, 'color: #00ff80;');
    } else {
        console.log('%c❌ ГРАВЕЦЬ ПРОГРАЄ: АБСОЛЮТНИЙ ДЕДЛОК', 'color: #ff4444; font-size: 13px; font-weight: bold;');
        console.log(`%cРибу НЕМОЖЛИВО витягнути. Навіть при повному виснаженні її залишкова сила (${finalFishPullForce.toFixed(3)}) перевищує вашу ефективну тягу з урахуванням котушки (${effectivePlayerPull.toFixed(3)}).`, 'color: #ffaa00;');
        console.log('%cПОРАДА: Прокачайте Вудилище (щоб збільшити сиру тягу) або Котушку (щоб збільшити Uptime).', 'color: #8a9bac;');
    }

    if (playerSteerForce < fishEscapeForce) {
        console.log('%c🚨 КРИТИЧНЕ ПОПЕРЕДЖЕННЯ: ПРОБЛЕМА З КЕРУВАННЯМ', 'color: #ff4444; font-size: 13px; font-weight: bold;');
        console.log(`%cСила вашого керування (${playerSteerForce.toFixed(3)}) менша за максимальну силу втечі риби (${fishEscapeForce.toFixed(3)}). Якщо риба потрапить у крайній лівий або правий кут екрану, ви не зможете витягти її назад у центр.`, 'color: #ffaa00;');
    } else {
        console.log('%c✅ КЕРУВАННЯ СТАБІЛЬНЕ: Ви достатньо сильні, щоб витягнути рибу з будь-якого кута локації.', 'color: #00ff80; font-size: 12px;');
    }

    console.groupEnd();
}, 500);

// ============================================================================
// LIVE OVERLAY: Віджет живої статистики виснаження
// ============================================================================
const liveDebugContainer = document.createElement('div');
liveDebugContainer.style.cssText = 'position: absolute; top: 10px; left: 10px; background: rgba(11, 21, 32, 0.9); color: #ffffff; padding: 12px; font-family: monospace; font-size: 14px; border: 1px solid #4a5b6c; border-radius: 5px; pointer-events: none; z-index: 1000; display: none; box-shadow: 0 0 10px rgba(0,0,0,0.5);';
document.body.appendChild(liveDebugContainer);

setInterval(() => {
    // Розрахунок поточних сил
    const initialFishBase = (CONFIG.fish.level * CONFIG.fish.weight) + CONFIG.fish.resistance;
    const currentFishBase = window.DEBUG_LIVE_FISH_POWER !== undefined ? window.DEBUG_LIVE_FISH_POWER : initialFishBase;
    const lostFishBase = initialFishBase - currentFishBase;

    const pPower = (CONFIG.rod.level * CONFIG.rod.basePower) + (CONFIG.reel.level * CONFIG.reel.basePower);
    const playerPullForce = pPower * CONFIG.physics.playerForceMultiplier;
    const currentFishPullForce = currentFishBase * CONFIG.physics.fishForceMultiplier;

    // Співвідношення у відсотках
    const totalPullForce = playerPullForce + currentFishPullForce;
    const playerPct = (playerPullForce / totalPullForce) * 100;
    const fishPct = (currentFishPullForce / totalPullForce) * 100;

    const leaderText = fishPct > playerPct 
        ? `<span style="color: #ff4444;">🚨 Риба все ще сильніша</span>` 
        : `<span style="color: #00ff80;">✅ Гравець сильніший! (Тягніть)</span>`;

    if (lostFishBase > 0.001) {
        liveDebugContainer.innerHTML = `
            <div style="color: #ffaa00; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">🔥 LIVE: ДЕБАФ СИЛИ</div>
            <div style="margin-bottom: 4px;">Базова сила риби: <span style="color: #8a9bac;">${initialFishBase.toFixed(2)}</span></div>
            <div style="margin-bottom: 4px;">Віднято сили: <span style="color: #ff4444; font-weight: bold;">-${lostFishBase.toFixed(2)}</span></div>
            <div style="margin-bottom: 8px;">Поточна базова сила: <span style="color: #00ff80; font-weight: bold;">${currentFishBase.toFixed(2)}</span></div>
            
            <div style="color: #00ccff; margin-bottom: 4px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">⚖️ LIVE: СПІВВІДНОШЕННЯ</div>
            <div style="margin-bottom: 4px;">Риба (Тяга Y): <span style="color: #ff4444;">${currentFishPullForce.toFixed(3)}</span></div>
            <div style="margin-bottom: 4px;">Гравець (Тяга Y): <span style="color: #00ff80;">${playerPullForce.toFixed(3)}</span></div>
            <div style="margin-bottom: 4px; font-weight: bold;">Риба ${fishPct.toFixed(1)}% VS Гравець ${playerPct.toFixed(1)}%</div>
            <div style="font-weight: bold; font-size: 12px; margin-top: 6px;">${leaderText}</div>
        `;
        liveDebugContainer.style.display = 'block';
    } else {
        liveDebugContainer.style.display = 'none';
    }
}, 100);
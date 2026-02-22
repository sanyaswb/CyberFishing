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

    console.log('%c--- ДЕТАЛЬНИЙ РОЗРАХУНОК СИЛ ---', 'color: #00ccff; font-weight: bold;');
    
    const rodStr = `(${CONFIG.rod.level} * ${CONFIG.rod.basePower.toFixed(1)})`;
    const reelStr = `(${CONFIG.reel.level} * ${CONFIG.reel.basePower.toFixed(1)})`;
    console.log(`%c🎣 Гравець: ${rodStr} + ${reelStr} = ${pPower.toFixed(1)} (Базова сила гравця)`, 'color: #e6e6e6;');

    const fishStr = `(${CONFIG.fish.level} * ${CONFIG.fish.weight})`;
    console.log(`%c🦈 Риба: ${fishStr} + ${CONFIG.fish.resistance} = ${fPower.toFixed(1)} (Базова сила риби)`, 'color: #e6e6e6;');

    console.log(`%c⚙️ Множимо на рушій: Гравець тягне на ${pPower.toFixed(1)} * ${CONFIG.physics.playerForceMultiplier} = ${playerPullForce.toFixed(3)}. Риба тягне від тебе на ${fPower.toFixed(1)} * ${CONFIG.physics.fishForceMultiplier} = ${fishPullForce.toFixed(3)}.`, 'color: #e6e6e6;');
    console.log('%c--------------------------------', 'color: #00ccff; font-weight: bold;');

    console.log('%c--- ЕФЕКТИВНІСТЬ КОТУШКИ ---', 'color: #ffaa00; font-weight: bold;');
    console.log(`%c🔄 Швидкість скидання натягу: x${recoveryBonus.toFixed(1)}`, 'color: #ffff00;');
    console.log(`%c⏱️ Корисний час тяги (Uptime): ${(pullUptime * 100).toFixed(1)}%`, 'color: #00ff80;');
    console.log('%c--------------------------------', 'color: #00ccff; font-weight: bold;');

    const totalForce = playerPullForce + fishPullForce;
    const playerPercent = (playerPullForce / totalForce) * 100;
    const fishPercent = (fishPullForce / totalForce) * 100;
    const diffPercent = Math.abs(playerPercent - fishPercent);

    console.log(`%c⚖️ Співвідношення сил (на осі Y):`, 'color: #ffaa00; font-weight: bold;');
    console.log(`%cРиба = ${fishPercent.toFixed(1)}%`, 'color: #ff4444;');
    console.log(`%cГравець = ${playerPercent.toFixed(1)}%`, 'color: #00ff80;');
    
    if (playerPercent > fishPercent) {
        console.log(`%c💪 Гравець сильніший на = ${diffPercent.toFixed(1)}%`, 'color: #00ff80; font-weight: bold;');
    } else if (fishPercent > playerPercent) {
        console.log(`%c⚠️ Риба сильніша на = ${diffPercent.toFixed(1)}%`, 'color: #ff4444; font-weight: bold;');
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

    console.log(`%c📊 Коефіцієнт складності (Риба / Гравець): ${powerRatio.toFixed(2)}x`, 'color: #00ccff; font-size: 14px; font-weight: bold;');
    
    const practicalDeadlockThreshold = pullUptime; 

    if (powerRatio >= 1.0) {
        console.log('%c⚠️ АБСОЛЮТНИЙ ДЕДЛОК: Риба сильніша за гравця. Навіть ідеальна котушка не допоможе, риба просто тягне вас.', 'color: #ff4444; font-size: 12px;');
    } else if (powerRatio >= practicalDeadlockThreshold) {
        console.log(`%c⚠️ ПРАКТИЧНИЙ ДЕДЛОК: Вашої котушки (Uptime ${(pullUptime*100).toFixed(0)}%) недостатньо. За час скидання натягу риба встигає відплисти далі.`, 'color: #ffaa00; font-size: 12px;');
    } else if (powerRatio >= practicalDeadlockThreshold * 0.7) {
        console.log('%c✅ ІДЕАЛЬНИЙ БОС: Складна, напружена боротьба. Ви ледь перетягуєте рибу завдяки котушці.', 'color: #ffff00; font-size: 12px;');
    } else {
        console.log('%c✅ ЛЕГКА ЗДОБИЧ: Спорядження значно переважає рибу.', 'color: #00ff80; font-size: 12px;');
    }

    console.log('%c====================================', 'color: #4a5b6c;');
    console.log('%c❤️ Аналіз Стаміни (Фаза 1)', 'color: #ffcc00; font-size: 14px; font-weight: bold;');
    
    const maxStamina = (CONFIG.fish.level * CONFIG.fish.weight * CONFIG.stamina.fish.baseStaminaMultiplier) + CONFIG.stamina.fish.flatBonus;
    const maxDps = CONFIG.stamina.mechanics.baseDepletionRate * pPower; 

    console.table({
        "Максимальне здоров'я риби": { "Значення": maxStamina.toFixed(0), "Опис": "Залежить від маси та рівня" },
        "Макс. Шкода (Натяг 0%)": { "Значення": maxDps.toFixed(1) + " / сек", "Опис": "Шкода при ідеальному таймінгу (свіжі руки)" },
        "Межа втоми (0 шкоди)": { "Значення": CONFIG.stamina.mechanics.optimalMax + "%", "Опис": "Натяг, після якого сили йдуть лише на утримання" },
        "Відновлення (Відпущена кнопка)": { "Значення": `до ${CONFIG.stamina.mechanics.baseRegenRate} / сек`, "Опис": "Лікування риби при повному відпусканні" },
        "Штрафне Відновлення (В кутку)": { "Значення": CONFIG.stamina.mechanics.edgeRegenRate + " / сек", "Опис": "Додаткове лікування на краях екрану" },
        "Час до виснаження (Ідеальний)": { "Значення": (maxStamina / maxDps).toFixed(1) + " сек", "Опис": "Мінімальний час боротьби при 0% натягу" }
    });

    console.log('%c====================================', 'color: #4a5b6c;');
    console.log('%c🔥 Аналіз Виснаження (Фаза 2)', 'color: #ff4444; font-size: 14px; font-weight: bold;');
    
    const idealTimeSec = maxStamina / Math.max(1, maxDps);
    const exhaustionTime = idealTimeSec * fPower;
    const powerDropTotal = exhaustionTime * CONFIG.stamina.mechanics.basePowerDropPerSec;
    
    console.table({
        "Початкова Базова Сила Риби": { "Значення": (fPower).toFixed(2), "Опис": "До початку виснаження" },
        "Динамічний час виснаження": { "Значення": exhaustionTime.toFixed(1) + " сек", "Опис": "Ідеальний час * Силу риби" },
        "Швидкість падіння шкали": { "Значення": (maxStamina / exhaustionTime).toFixed(1) + " поінтів/сек", "Опис": "Згідно з формулою" },
        "Втрата сили за секунду": { "Значення": CONFIG.stamina.mechanics.basePowerDropPerSec + " од.", "Опис": "Зменшення базової сили кожну секунду" },
        "Орієнтовна сила ПІСЛЯ виснаження": { "Значення": Math.max(fPower * CONFIG.stamina.mechanics.minBasePowerRatio, fPower - powerDropTotal).toFixed(2), "Опис": "Фінальна сила риби після збиття червоної шкали" }
    });

    console.groupEnd();
}, 500);

// ============================================================================
// LIVE OVERLAY: Віджет живої статистики виснаження
// ============================================================================
const liveDebugContainer = document.createElement('div');
liveDebugContainer.style.cssText = 'position: absolute; top: 10px; left: 10px; background: rgba(11, 21, 32, 0.9); color: #ffffff; padding: 12px; font-family: monospace; font-size: 14px; border: 1px solid #4a5b6c; border-radius: 5px; pointer-events: none; z-index: 1000; display: none; box-shadow: 0 0 10px rgba(0,0,0,0.5);';
document.body.appendChild(liveDebugContainer);

// Оновлюємо віджет кожні 100 мс
setInterval(() => {
    const initial = (CONFIG.fish.level * CONFIG.fish.weight) + CONFIG.fish.resistance;
    const current = window.DEBUG_LIVE_FISH_POWER !== undefined ? window.DEBUG_LIVE_FISH_POWER : initial;
    const lost = initial - current;

    // Показуємо віджет тільки якщо риба отримала хоча б мінімальний дебаф
    if (lost > 0.001) {
        liveDebugContainer.innerHTML = `
            <div style="color: #ffaa00; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px;">🔥 LIVE: ДЕБАФ СИЛИ</div>
            <div style="margin-bottom: 4px;">Початкова сила: <span style="color: #8a9bac;">${initial.toFixed(2)}</span></div>
            <div style="margin-bottom: 4px;">Віднято сили: <span style="color: #ff4444; font-weight: bold;">-${lost.toFixed(2)}</span></div>
            <div>Поточна сила: <span style="color: #00ff80; font-weight: bold;">${current.toFixed(2)}</span></div>
        `;
        liveDebugContainer.style.display = 'block';
    } else {
        liveDebugContainer.style.display = 'none';
    }
}, 100);
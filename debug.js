setTimeout(() => {
    console.group('%c🐟 Аналіз Балансу Механіки Риболовлі', 'color: #00ff80; font-size: 16px; font-weight: bold;');

    const rPower = (CONFIG.rod.level * CONFIG.rod.basePower);
    const rlPower = (CONFIG.reel.level * CONFIG.reel.basePower);
    const pPower = rPower + rlPower;
    const fPower = (CONFIG.fish.level * CONFIG.fish.weight) + CONFIG.fish.resistance;

    const playerPullForce = pPower * CONFIG.physics.playerForceMultiplier;
    const playerSteerForce = pPower * CONFIG.physics.playerSteeringMultiplier;
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
    console.log('%c❤️ Аналіз Стаміни (Виснаження)', 'color: #ffcc00; font-size: 14px; font-weight: bold;');
    
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

    console.groupEnd();
}, 500);
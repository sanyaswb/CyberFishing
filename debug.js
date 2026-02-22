setTimeout(() => {
    console.group('%c🐟 Аналіз Балансу Механіки Риболовлі', 'color: #00ff80; font-size: 16px; font-weight: bold;');

    const pPower = (CONFIG.rod.level * CONFIG.rod.basePower) + (CONFIG.reel.level * CONFIG.reel.basePower);
    const fPower = (CONFIG.fish.level * CONFIG.fish.weight) + CONFIG.fish.resistance;

    const playerPullForce = pPower * CONFIG.physics.playerForceMultiplier;
    const playerSteerForce = pPower * CONFIG.physics.playerSteeringMultiplier;
    
    const fishPullForce = fPower * CONFIG.physics.fishForceMultiplier;
    const fishEscapeForce = (fPower * CONFIG.fish.edgePowerMultiplier) * CONFIG.physics.fishForceMultiplier;

    // Співвідношення ФІНАЛЬНИХ сил (Риба / Гравець)
    const powerRatio = fishPullForce / Math.max(0.001, playerPullForce);

    console.log('%c--- ДЕТАЛЬНИЙ РОЗРАХУНОК СИЛ ---', 'color: #00ccff; font-weight: bold;');
    
    const rodStr = `(${CONFIG.rod.level} * ${CONFIG.rod.basePower.toFixed(1)})`;
    const reelStr = `(${CONFIG.reel.level} * ${CONFIG.reel.basePower.toFixed(1)})`;
    console.log(`%c🎣 Гравець: ${rodStr} + ${reelStr} = ${pPower.toFixed(1)} (Базова сила гравця)`, 'color: #e6e6e6;');

    const fishStr = `(${CONFIG.fish.level} * ${CONFIG.fish.weight})`;
    console.log(`%c🦈 Риба: ${fishStr} + ${CONFIG.fish.resistance} = ${fPower.toFixed(1)} (Базова сила риби)`, 'color: #e6e6e6;');

    console.log(`%c⚙️ Множимо на рушій: Гравець тягне на ${pPower.toFixed(1)} * ${CONFIG.physics.playerForceMultiplier} = ${playerPullForce.toFixed(3)}. Риба тягне від тебе на ${fPower.toFixed(1)} * ${CONFIG.physics.fishForceMultiplier} = ${fishPullForce.toFixed(3)}.`, 'color: #e6e6e6;');
    console.log('%c--------------------------------', 'color: #00ccff; font-weight: bold;');

    const totalForce = playerPullForce + fishPullForce;
    const playerPercent = (playerPullForce / totalForce) * 100;
    const fishPercent = (fishPullForce / totalForce) * 100;
    const diffPercent = Math.abs(playerPercent - fishPercent);

    console.log(`%c⚖️ Співвідношення сил:`, 'color: #ffaa00; font-weight: bold;');
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
        "🎣 Тяга на себе (Y)": { "Значення": playerPullForce.toFixed(3), "Опис": "Сила витягування" },
        "🎣 Керування (X)": { "Значення": playerSteerForce.toFixed(3), "Опис": "Сила утримання по центру" },
        "🦈 Опір (Y)": { "Значення": fishPullForce.toFixed(3), "Опис": "Сила віддалення від берега" },
        "🦈 Втеча (X)": { "Значення": fishEscapeForce.toFixed(3), "Опис": "Сила ривка в кут" },
    });

    console.log(`%c📊 Коефіцієнт складності (Риба / Гравець): ${powerRatio.toFixed(2)}x`, 'color: #00ccff; font-size: 14px; font-weight: bold;');
    
    // ПРАВИЛЬНІ ТРИГЕРИ АНАЛІЗУ БАЛАНСУ
    if (powerRatio >= 1.0) {
        console.log('%c⚠️ АБСОЛЮТНИЙ ДЕДЛОК: Риба фізично сильніша за гравця (або рівна). Вона завжди буде віддалятися.', 'color: #ff4444; font-size: 12px;');
    } else if (powerRatio >= 0.5) {
        console.log('%c⚠️ ПРАКТИЧНИЙ ДЕДЛОК: Через паузи на скидання натягу риба встигає відпливати далі, ніж ви її підтягуєте. Можна лише втомити.', 'color: #ffaa00; font-size: 12px;');
    } else if (powerRatio >= 0.35) {
        console.log('%c✅ ІДЕАЛЬНИЙ БОС: Складна, напружена боротьба. Поплавець наближатиметься дуже повільно при ідеальних таймінгах.', 'color: #ffff00; font-size: 12px;');
    } else {
        console.log('%c✅ ЛЕГКА ЗДОБИЧ: Гравець значно сильніший, риба швидко підтягується до берега.', 'color: #00ff80; font-size: 12px;');
    }

    console.log('%c====================================', 'color: #4a5b6c;');
    console.log('%c❤️ Аналіз Стаміни (Виснаження)', 'color: #ffcc00; font-size: 14px; font-weight: bold;');
    
    const maxStamina = (CONFIG.fish.level * CONFIG.fish.weight * CONFIG.stamina.fish.baseStaminaMultiplier) + CONFIG.stamina.fish.flatBonus;
    const maxDps = CONFIG.stamina.mechanics.baseDepletionRate * pPower; 

    console.table({
        "Максимальне здоров'я риби": { "Значення": maxStamina.toFixed(0), "Опис": "Залежить від маси та рівня" },
        "Макс. Шкода (Натяг 0%)": { "Значення": maxDps.toFixed(1) + " / сек", "Опис": "DPS при максимальній силі" },
        "Відновлення (Відпущена кнопка)": { "Значення": CONFIG.stamina.mechanics.baseRegenRate + " / сек", "Опис": "Лікування при падінні натягу" },
        "Штрафне Відновлення (В кутку)": { "Значення": CONFIG.stamina.mechanics.edgeRegenRate + " / сек", "Опис": "Додаткове лікування на краях екрану" },
        "Час до виснаження (Ідеальний)": { "Значення": (maxStamina / maxDps).toFixed(1) + " сек", "Опис": "Скільки тримати на 0% без перерв" }
    });

    console.groupEnd();
}, 500);
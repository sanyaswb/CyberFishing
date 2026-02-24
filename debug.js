setTimeout(() => {
    console.group('%c🐟 Аналіз Балансу Механіки Риболовлі (Векторна RPG-версія)', 'color: #00ff80; font-size: 16px; font-weight: bold;');

    const rPower = (CONFIG.rod.level * CONFIG.rod.basePower);
    const rlPower = (CONFIG.reel.level * CONFIG.reel.basePower);
    const pPower = rPower + rlPower;
    const fPower = (CONFIG.fish.level * CONFIG.fish.weight) + CONFIG.fish.resistance;

    const playerPullForceBase = pPower * CONFIG.physics.playerForceMultiplier;
    const playerSteerForceBase = pPower * CONFIG.physics.playerSteeringMultiplier * CONFIG.physics.playerForceMultiplier;
    const fishPullForce = fPower * CONFIG.physics.fishForceMultiplier;
    const fishEscapeForce = (fPower * CONFIG.fish.edgePowerMultiplier) * CONFIG.physics.fishForceMultiplier;

    const recoveryBonus = 1 + (rlPower * (CONFIG.tension.reelRecoveryMultiplier || 0));
    const pullUptime = 1 / (1 + (1 / recoveryBonus)); 

    const powerRatio = fishPullForce / Math.max(0.001, playerPullForceBase);
    
    const maxStamina = (CONFIG.fish.level * CONFIG.fish.weight * CONFIG.stamina.fish.baseStaminaMultiplier) + CONFIG.stamina.fish.flatBonus;
    const maxDps = CONFIG.stamina.mechanics.baseDepletionRate * pPower; 
    const idealTimeSec = maxStamina / Math.max(1, maxDps);
    const exhaustionTime = idealTimeSec * fPower;
    const powerDropTotal = exhaustionTime * CONFIG.stamina.mechanics.basePowerDropPerSec;
    const finalFPower = Math.max(0, fPower - powerDropTotal);
    const finalFishPullForce = finalFPower * CONFIG.physics.fishForceMultiplier;

    console.log('%c--- ДЕТАЛЬНИЙ РОЗРАХУНОК СИЛ ---', 'color: #00ccff; font-weight: bold;');
    const rodStr = `(${CONFIG.rod.level} * ${CONFIG.rod.basePower.toFixed(1)})`;
    const reelStr = `(${CONFIG.reel.level} * ${CONFIG.reel.basePower.toFixed(1)})`;
    console.log(`%c🎣 Гравець: ${rodStr} + ${reelStr} = ${pPower.toFixed(1)} (Базова сила гравця)`, 'color: #e6e6e6;');
    const fishStr = `(${CONFIG.fish.level} * ${CONFIG.fish.weight})`;
    console.log(`%c🦈 Риба: ${fishStr} + ${CONFIG.fish.resistance} = ${fPower.toFixed(1)} (Базова сила риби)`, 'color: #e6e6e6;');
    console.log(`%c⚙️ Множимо на рушій: Гравець тягне на ${pPower.toFixed(1)} * ${CONFIG.physics.playerForceMultiplier} = ${playerPullForceBase.toFixed(3)}. Риба тягне від тебе на ${fPower.toFixed(1)} * ${CONFIG.physics.fishForceMultiplier} = ${fishPullForce.toFixed(3)}.`, 'color: #e6e6e6;');
    
    console.log('%c--- ПІСЛЯ ВИСНАЖЕННЯ ---', 'color: #ff4444; font-weight: bold;');
    console.log(`%c📉 Риба: Базова сила впаде до ${finalFPower.toFixed(2)}.`, 'color: #e6e6e6;');
    console.log(`%c⚙️ Множимо на рушій: Риба тягнутиме від тебе на ${finalFPower.toFixed(2)} * ${CONFIG.physics.fishForceMultiplier} = ${finalFishPullForce.toFixed(3)}.`, 'color: #e6e6e6;');
    console.log('%c--------------------------------', 'color: #00ccff; font-weight: bold;');

    console.log('%c--- ЕФЕКТИВНІСТЬ КОТУШКИ ---', 'color: #ffaa00; font-weight: bold;');
    console.log(`%c🔄 Швидкість скидання натягу: 1 + (${rlPower.toFixed(1)} * ${CONFIG.tension.reelRecoveryMultiplier}) = x${recoveryBonus.toFixed(1)}`, 'color: #ffff00;');
    console.log(`%c   -> 1.0 - це базова швидкість відновлення\n   -> ${rlPower.toFixed(1)} - це сила вашої котушки\n   -> ${CONFIG.tension.reelRecoveryMultiplier} - це множник котушки з конфігу`, 'color: #8a9bac;');
    console.log(`%c⏱️ Корисний час тяги (Uptime): 1 / (1 + (1 / ${recoveryBonus.toFixed(1)})) = ${(pullUptime * 100).toFixed(1)}%`, 'color: #00ff80;');
    console.log(`%c   -> 1.0 - це час, витрачений на натягування\n   -> ${recoveryBonus.toFixed(1)} - це ваша прискорена швидкість скидання натягу`, 'color: #8a9bac;');
    console.log('%c--------------------------------', 'color: #00ccff; font-weight: bold;');

    const totalForceY = playerPullForceBase + fishPullForce;
    const playerPercentY = (playerPullForceBase / totalForceY) * 100;
    const fishPercentY = (fishPullForce / totalForceY) * 100;
    const diffPercentY = Math.abs(playerPercentY - fishPercentY);

    console.log(`%c⚖️ Співвідношення сил (на осі Y - Тяга):`, 'color: #ffaa00; font-weight: bold;');
    console.log(`%cРиба = ${fishPercentY.toFixed(1)}%`, 'color: #ff4444;');
    console.log(`%cГравець = ${playerPercentY.toFixed(1)}%`, 'color: #00ff80;');
    console.log(`%cЯк розраховано = (Сила Гравця ${playerPullForceBase.toFixed(3)} / Суму Сил ${totalForceY.toFixed(3)}) * 100`, 'color: #8a9bac;');
    if (playerPercentY > fishPercentY) console.log(`%c💪 Гравець сильніший на = ${diffPercentY.toFixed(1)}%`, 'color: #00ff80; font-weight: bold;');
    else if (fishPercentY > playerPercentY) console.log(`%c⚠️ Риба сильніша на = ${diffPercentY.toFixed(1)}%`, 'color: #ff4444; font-weight: bold;');
    else console.log(`%c🤝 Сили абсолютно рівні (0% різниці)`, 'color: #ffff00; font-weight: bold;');
    console.log('%c--------------------------------', 'color: #00ccff; font-weight: bold;');

    const totalForceX = playerSteerForceBase + fishEscapeForce;
    const playerPercentX = (playerSteerForceBase / totalForceX) * 100;
    const fishPercentX = (fishEscapeForce / totalForceX) * 100;
    const diffPercentX = Math.abs(playerPercentX - fishPercentX);

    console.log(`%c⚖️ Співвідношення сил (на осі X - Керування):`, 'color: #ffaa00; font-weight: bold;');
    console.log(`%cРиба = ${fishPercentX.toFixed(1)}%`, 'color: #ff4444;');
    console.log(`%cГравець = ${playerPercentX.toFixed(1)}%`, 'color: #00ff80;');
    console.log(`%cЯк розраховано = (Керування Гравця ${playerSteerForceBase.toFixed(3)} / Суму Сил ${totalForceX.toFixed(3)}) * 100`, 'color: #8a9bac;');
    if (playerPercentX > fishPercentX) console.log(`%c💪 Гравець сильніший на = ${diffPercentX.toFixed(1)}%`, 'color: #00ff80; font-weight: bold;');
    else if (fishPercentX > playerPercentX) console.log(`%c⚠️ Риба сильніша на = ${diffPercentX.toFixed(1)}%`, 'color: #ff4444; font-weight: bold;');
    else console.log(`%c🤝 Сили абсолютно рівні (0% різниці)`, 'color: #ffff00; font-weight: bold;');
    console.log('%c--------------------------------', 'color: #00ccff; font-weight: bold;');

    console.table({
        "🎣 Тяга на себе (Y)": { "Значення": playerPullForceBase.toFixed(3), "Опис": "Сила витягування до берега" },
        "🎣 Керування (X)": { "Значення": playerSteerForceBase.toFixed(3), "Опис": "Сила утримання по центру" },
        "🦈 Опір (Y)": { "Значення": fishPullForce.toFixed(3), "Опис": "Сила віддалення від берега" },
        "🦈 Втеча (X)": { "Значення": fishEscapeForce.toFixed(3), "Опис": "Максимальна сила ривка в кут" },
    });

    console.log('%c====================================', 'color: #4a5b6c;');
    console.log('%c📐 ВПЛИВ ВІДХИЛЕННЯ ТА RPG-КОМПЕНСАЦІЇ', 'color: #ffaa00; font-size: 14px; font-weight: bold;');
    
    const rodComp = CONFIG.rod.compensation || 0;
    const maxPenalty = CONFIG.physics.edgePullPenalty || 0.0;
    console.log(`%cВудочка компенсує: ${rodComp * 100}% штрафу. Глобальний макс. штраф: ${maxPenalty * 100}%`, 'color: #8a9bac;');

    const deviations = [0, 0.1, 0.3, 0.5, 1.0];
    const devTable = {};
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const rodY = screenH - (CONFIG.ui?.catchZone?.height || 150); 
    const fishSpawnY = screenH * 0.2; 
    const distanceY = rodY - fishSpawnY;

    deviations.forEach(ratio => {
        const effectivePenalty = maxPenalty * ratio * (1 - rodComp);
        const penaltyMult = Math.max(0.1, 1.0 - effectivePenalty);
        const effectivePower = pPower * penaltyMult;
        
        const fishXOffset = (screenW / 2) * ratio; 
        const pullDirLength = Math.hypot(fishXOffset, distanceY);
        const pullDirY = distanceY / pullDirLength; 

        const forceY = pullDirY * 1.0 * effectivePower * CONFIG.physics.playerForceMultiplier;
        const baseForceX = (fishXOffset / pullDirLength) * 1.0 * effectivePower * CONFIG.physics.playerForceMultiplier;
        const steerForce = effectivePower * CONFIG.physics.playerSteeringMultiplier * CONFIG.physics.playerForceMultiplier;

        devTable[`Відхилення ${ratio * 100}%`] = {
            "Штраф Сили": `-${(effectivePenalty * 100).toFixed(1)}%`,
            "Тяга вниз (Y)": forceY.toFixed(3),
            "Кермування (X)": steerForce.toFixed(3),
            "Стягування до центру (X)": baseForceX.toFixed(3)
        };
    });
    console.table(devTable);

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
        "Формула швидкості (Pumping)": { "Значення": `Ratio^2 = ${speedMultiplier.toFixed(2)}`, "Опис": `(Риба / Гравець)^2 -> (${powerRatio.toFixed(2)})^2` },
        "Час до заповнення (0->100%)": { "Значення": timeToFill.toFixed(2) + " сек", "Опис": `100 / (Сума Сил Y * Ratio^2 * Чутливість Натягу * 60FPS)` },
        "Час до скидання (Без котушки)": { "Значення": timeToRecoverBase.toFixed(2) + " сек", "Опис": `Скидання без урахування бонусу котушки (швидкість = заповненню)` },
        "Час до скидання (З котушкою)": { "Значення": timeToRecoverBuffed.toFixed(2) + " сек", "Опис": `Час Без Котушки / Бонус Відновлення (x${recoveryBonus.toFixed(1)})` }
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
    console.table({
        "Початкова Базова Сила Риби": { "Значення": (fPower).toFixed(2), "Опис": "До початку виснаження" },
        "Динамічний час виснаження": { "Значення": exhaustionTime.toFixed(1) + " сек", "Опис": "Ідеальний час * Силу риби" },
        "Швидкість падіння шкали": { "Значення": (maxStamina / exhaustionTime).toFixed(1) + " поінтів/сек", "Опис": "Згідно з формулою" },
        "Втрата сили за секунду": { "Значення": CONFIG.stamina.mechanics.basePowerDropPerSec + " од.", "Опис": "Зменшення базової сили кожну секунду" },
        "Орієнтовна сила ПІСЛЯ виснаження": { "Значення": finalFPower.toFixed(2), "Опис": "Фінальна сила риби після збиття червоної шкали" }
    });

    console.log('%c====================================', 'color: #4a5b6c;');
    console.log('%c⏱️ ЧАС ВИТЯГУВАННЯ (Максимальна дистанція)', 'color: #00ff80; font-size: 14px; font-weight: bold;');
    
    const currentMap = Object.values(CONFIG.locations.map)[0]; 
    const castableZones = currentMap.zones.castable;
    const cellSize = CONFIG.locations.cellSize;
    const catchZoneHeight = CONFIG.ui?.catchZone?.height || 150;
    
    let minVirtualY = Infinity;
    let maxVirtualY = 0;
    
    castableZones.forEach(z => {
        const top = z.y * cellSize;
        const bottom = (z.y + z.h) * cellSize;
        if (top < minVirtualY) minVirtualY = top;
        if (bottom > maxVirtualY) maxVirtualY = bottom;
    });
    
    const virtualDistanceY = Math.max(0, (maxVirtualY - minVirtualY) - catchZoneHeight); 

    const netForceFresh = playerPullForceBase - fishPullForce;
    const netForceExhausted = playerPullForceBase - finalFishPullForce;
    
    const avgVelocityFresh = (netForceFresh * 0.5) / (1 - CONFIG.float.friction);
    const avgVelocityExhausted = (netForceExhausted * 0.5) / (1 - CONFIG.float.friction);

    const timeToCatchFresh = netForceFresh > 0 ? (virtualDistanceY / (avgVelocityFresh * fps)).toFixed(1) + " сек" : "НІКОЛИ (Блок)";
    const timeToCatchExhausted = netForceExhausted > 0 ? (virtualDistanceY / (avgVelocityExhausted * fps)).toFixed(1) + " сек" : "НІКОЛИ (Блок)";

    const worstPenaltyMult = Math.max(0.1, 1.0 - (maxPenalty * 1.0 * (1 - rodComp)));
    const worstEffectivePower = pPower * worstPenaltyMult;
    
    const worstFishXOffset = window.innerWidth / 2;
    const worstPullDirLength = Math.hypot(worstFishXOffset, distanceY);
    const worstPullDirY = distanceY / worstPullDirLength; 
    
    const worstPlayerPullForceY = worstPullDirY * worstEffectivePower * CONFIG.physics.playerForceMultiplier;

    const netForceWorstFresh = worstPlayerPullForceY - fishPullForce;
    const netForceWorstExhausted = worstPlayerPullForceY - finalFishPullForce;

    const avgVelocityWorstFresh = (netForceWorstFresh * 0.5) / (1 - CONFIG.float.friction);
    const avgVelocityWorstExhausted = (netForceWorstExhausted * 0.5) / (1 - CONFIG.float.friction);

    const timeToCatchWorstFresh = netForceWorstFresh > 0 ? (virtualDistanceY / (avgVelocityWorstFresh * fps)).toFixed(1) + " сек" : "НІКОЛИ (Блок)";
    const timeToCatchWorstExhausted = netForceWorstExhausted > 0 ? (virtualDistanceY / (avgVelocityWorstExhausted * fps)).toFixed(1) + " сек" : "НІКОЛИ (Блок)";

    console.table({
        "Дистанція (Максимальна)": { "Значення": virtualDistanceY + " px", "Опис": `Від найвищої до найнижчої межі castable зони` },
        "ІДЕАЛЬНО (0% кут): Свіжа риба": { "Значення": timeToCatchFresh, "Опис": "Тяга по центру (натяг стабільно 50%)" },
        "ІДЕАЛЬНО (0% кут): Виснажена": { "Значення": timeToCatchExhausted, "Опис": "Тяга по центру після втрати стаміни" },
        "НАЙГІРШЕ (100% кут): Свіжа": { "Значення": timeToCatchWorstFresh, "Опис": "Риба на краю екрана (максимальний штраф сили)" },
        "НАЙГІРШЕ (100% кут): Виснажена": { "Значення": timeToCatchWorstExhausted, "Опис": "Риба на краю екрана (після втрати стаміни)" }
    });

    console.log('%c====================================', 'color: #4a5b6c;');
    console.log('%c🏆 ПРОГНОЗ РЕЗУЛЬТАТУ (По центру)', 'color: #00ccff; font-size: 16px; font-weight: bold;');

    if (playerPullForceBase > fishPullForce) {
        console.log('%c✅ ГРАВЕЦЬ ПЕРЕМАГАЄ ЗІ СТАРТУ', 'color: #00ff80; font-size: 13px; font-weight: bold;');
        console.log(`%cТяга (${playerPullForceBase.toFixed(3)}) більша за опір (${fishPullForce.toFixed(3)}). Риба буде витягнута.`, 'color: #8a9bac;');
    } else if (playerPullForceBase > finalFishPullForce) {
        console.log('%c⚠️ ПЕРЕМОГА ТІЛЬКИ ПІСЛЯ ВИСНАЖЕННЯ', 'color: #ffff00; font-size: 13px; font-weight: bold;');
        console.log(`%c-> Зі старту: Гравець ${playerPullForceBase.toFixed(3)} | Риба ${fishPullForce.toFixed(3)}`, 'color: #ff4444;');
        console.log(`%c-> Після виснаження: Гравець ${playerPullForceBase.toFixed(3)} | Риба ${finalFishPullForce.toFixed(3)}`, 'color: #00ff80;');
    } else {
        console.log('%c❌ ГРАВЕЦЬ ПРОГРАЄ: АБСОЛЮТНИЙ ДЕДЛОК', 'color: #ff4444; font-size: 13px; font-weight: bold;');
    }

    if (playerSteerForceBase < fishEscapeForce) {
        console.log('%c🚨 ПОПЕРЕДЖЕННЯ: КЕРУВАННЯ СЛАБКЕ', 'color: #ff4444; font-size: 13px; font-weight: bold;');
        console.log(`%cСили кермування (${playerSteerForceBase.toFixed(3)}) не вистачить, щоб зупинити ривок риби (${fishEscapeForce.toFixed(3)}).`, 'color: #ffaa00;');
    } else {
        console.log('%c✅ КЕРУВАННЯ СТАБІЛЬНЕ', 'color: #00ff80; font-size: 12px;');
    }

    console.groupEnd();
}, 500);
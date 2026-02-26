const DEBUG_MODULES = {
    location: false, // Виводить детальну інформацію про локацію, зони та об'єкти
    forces: false, // Включає детальний розрахунок сил гравця та риби
    deviations: false, // Включає аналіз впливу відхилень кидка на сили та результат
    tension: true, // Включає детальний аналіз натягу та гачка
    stamina: false, // Включає аналіз стаміни та виснаження риби
    exhaustion: false, // Включає аналіз фази виснаження риби
    catchTime: false, // Включає аналіз часу витягування риби
    prediction: false, // Виводить прогноз результату на основі поточних сил
    net: false, // Включає аналіз підсаки та її впливу на результат
};

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
    const totalForceY = playerPullForceBase + fishPullForce;
    const totalForceX = playerSteerForceBase + fishEscapeForce;

    if (DEBUG_MODULES.location) {
        console.log('%c====================================', 'color: #4a5b6c;');
        console.log('%c🗺️ ІНФОРМАЦІЯ ПРО ЛОКАЦІЮ', 'color: #b066ff; font-size: 14px; font-weight: bold;');
        
        const map = Object.values(CONFIG.locations.map)[0];
        const res = CONFIG.locations.baseResolution;
        const cSize = CONFIG.locations.cellSize;
        const gridW = res.width / cSize;
        const gridH = res.height / cSize;
        
        console.table({
            "Розмір локації (px)": { "Значення": `${res.width} x ${res.height}` },
            "Сітка (Grid)": { "Значення": `${gridW} x ${gridH} квадратів` },
            "Розмір квадрата": { "Значення": `${cSize} px` },
            "Видиме вікно (Browser)": { "Значення": `${window.innerWidth} x ${window.innerHeight} px` }
        });

        if (map.zones.castable && map.zones.castable.length > 0) {
            console.log('%c🟩 ЗЕЛЕНА ЗОНА (Castable):', 'color: #00ff80;');
            console.table(map.zones.castable);
        }

        if (map.zones.collisions && map.zones.collisions.length > 0) {
            console.log(`%c🟥 КОЛІЗІЇ (Кількість: ${map.zones.collisions.length}):`, 'color: #ff4444;');
            console.table(map.zones.collisions);
        }

        if (map.zones.snags && map.zones.snags.length > 0) {
            console.log(`%c🟫 КОРЯГИ / SNAGS (Кількість: ${map.zones.snags.length}):`, 'color: #ffaa00;');
            console.table(map.zones.snags);
        }

        if (map.zones.dynamic && map.zones.dynamic.length > 0) {
            console.log(`%c🟦 ДИНАМІЧНІ ОБ'ЄКТИ (Кількість: ${map.zones.dynamic.length}):`, 'color: #00ccff;');
            console.table(map.zones.dynamic);
        }
    }

    if (DEBUG_MODULES.forces) {
        console.log('%c====================================', 'color: #4a5b6c;');
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

        console.log('%c--- ЕФЕКТИВНІСТЬ КОТУШКИ ---', 'color: #ffaa00; font-weight: bold;');
        console.log(`%c🔄 Швидкість скидання натягу: 1 + (${rlPower.toFixed(1)} * ${CONFIG.tension.reelRecoveryMultiplier}) = x${recoveryBonus.toFixed(1)}`, 'color: #ffff00;');
        console.log(`%c⏱️ Корисний час тяги (Uptime): 1 / (1 + (1 / ${recoveryBonus.toFixed(1)})) = ${(pullUptime * 100).toFixed(1)}%`, 'color: #00ff80;');

        const playerPercentY = (playerPullForceBase / totalForceY) * 100;
        const fishPercentY = (fishPullForce / totalForceY) * 100;
        const diffPercentY = Math.abs(playerPercentY - fishPercentY);

        console.log(`%c--- СПІВВІДНОШЕННЯ СИЛ (на осі Y - Тяга) ---`, 'color: #ffaa00; font-weight: bold;');
        console.log(`%cРиба = ${fishPercentY.toFixed(1)}%`, 'color: #ff4444;');
        console.log(`%cГравець = ${playerPercentY.toFixed(1)}%`, 'color: #00ff80;');
        if (playerPercentY > fishPercentY) console.log(`%c💪 Гравець сильніший на = ${diffPercentY.toFixed(1)}%`, 'color: #00ff80; font-weight: bold;');
        else if (fishPercentY > playerPercentY) console.log(`%c⚠️ Риба сильніша на = ${diffPercentY.toFixed(1)}%`, 'color: #ff4444; font-weight: bold;');
        else console.log(`%c🤝 Сили абсолютно рівні (0% різниці)`, 'color: #ffff00; font-weight: bold;');

        const playerPercentX = (playerSteerForceBase / totalForceX) * 100;
        const fishPercentX = (fishEscapeForce / totalForceX) * 100;
        const diffPercentX = Math.abs(playerPercentX - fishPercentX);

        console.log(`%c--- СПІВВІДНОШЕННЯ СИЛ (на осі X - Керування) ---`, 'color: #ffaa00; font-weight: bold;');
        console.log(`%cРиба = ${fishPercentX.toFixed(1)}%`, 'color: #ff4444;');
        console.log(`%cГравець = ${playerPercentX.toFixed(1)}%`, 'color: #00ff80;');
        if (playerPercentX > fishPercentX) console.log(`%c💪 Гравець сильніший на = ${diffPercentX.toFixed(1)}%`, 'color: #00ff80; font-weight: bold;');
        else if (fishPercentX > playerPercentX) console.log(`%c⚠️ Риба сильніша на = ${diffPercentX.toFixed(1)}%`, 'color: #ff4444; font-weight: bold;');

        else console.log(`%c🤝 Сили абсолютно рівні (0% різниці)`, 'color: #ffff00; font-weight: bold;');

        console.table({
            "СИЛА ГРАВЦЯ": {
                "🎣 Тяга (Y)": playerPullForceBase.toFixed(3),
                "🎣 Керування (X)": playerSteerForceBase.toFixed(3),
                "З Котушкою (X)": (playerSteerForceBase * recoveryBonus).toFixed(3),
            },
            "СИЛА РИБИ": {
                "🦈 Опір (Y)": fishPullForce.toFixed(3),
                "🦈 Втеча (X)": fishEscapeForce.toFixed(3),
            },
            "ПІСЛЯ ВИСНАЖЕННЯ": {
                "🦈 Опір (Y)": finalFishPullForce.toFixed(3),
            },
        });
    }

    if (DEBUG_MODULES.deviations) {
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
                "Стягування (X)": baseForceX.toFixed(3)
            };
        });
        console.table(devTable);
    }

    if (DEBUG_MODULES.tension) {
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
            "Формула швидкості": { "Значення": `Ratio^2 = ${speedMultiplier.toFixed(2)}` },
            "Час до заповнення (0->100%)": { "Значення": timeToFill.toFixed(2) + " сек" },
            "Час до скидання (Без котушки)": { "Значення": timeToRecoverBase.toFixed(2) + " сек" },
            "Час до скидання (З котушкою)": { "Значення": timeToRecoverBuffed.toFixed(2) + " сек" }
        });
    }

    if (DEBUG_MODULES.stamina) {
        console.log('%c====================================', 'color: #4a5b6c;');
        console.log('%c❤️ Аналіз Стаміни (Фаза 1)', 'color: #ffcc00; font-size: 14px; font-weight: bold;');
        console.table({
            "Максимальне здоров'я": { "Значення": maxStamina.toFixed(0) },
            "Макс. Шкода (Натяг 0%)": { "Значення": maxDps.toFixed(1) + " / сек" },
            "Межа втоми (0 шкоди)": { "Значення": CONFIG.stamina.mechanics.optimalMax + "%" },
            "Відновлення (Відпущена)": { "Значення": `до ${CONFIG.stamina.mechanics.baseRegenRate} / сек` },
            "Штрафне Відновлення (Кут)": { "Значення": CONFIG.stamina.mechanics.edgeRegenRate + " / сек" },
            "Час до виснаження": { "Значення": idealTimeSec.toFixed(1) + " сек" }
        });
    }

    if (DEBUG_MODULES.exhaustion) {
        console.log('%c====================================', 'color: #4a5b6c;');
        console.log('%c🔥 Аналіз Виснаження (Фаза 2)', 'color: #ff4444; font-size: 14px; font-weight: bold;');
        console.table({
            "Початкова База Риби": { "Значення": (fPower).toFixed(2) },
            "Динамічний час виснаження": { "Значення": exhaustionTime.toFixed(1) + " сек" },
            "Швидкість падіння шкали": { "Значення": (maxStamina / exhaustionTime).toFixed(1) + " од/сек" },
            "Втрата сили за секунду": { "Значення": CONFIG.stamina.mechanics.basePowerDropPerSec + " од." },
            "Орієнтовна сила ПІСЛЯ": { "Значення": finalFPower.toFixed(2) }
        });
    }

    if (DEBUG_MODULES.catchTime) {
        console.log('%c====================================', 'color: #4a5b6c;');
        console.log('%c⏱️ ЧАС ВИТЯГУВАННЯ', 'color: #00ff80; font-size: 14px; font-weight: bold;');
        
        const fps = 60;
        const rodComp = CONFIG.rod.compensation || 0;
        const maxPenalty = CONFIG.physics.edgePullPenalty || 0.0;
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const rodY = screenH - (CONFIG.ui?.catchZone?.height || 150); 
        const fishSpawnY = screenH * 0.2; 
        const distanceY = rodY - fishSpawnY;

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
            "Дистанція": { "Значення": virtualDistanceY + " px" },
            "ІДЕАЛЬНО: Свіжа риба": { "Значення": timeToCatchFresh },
            "ІДЕАЛЬНО: Виснажена": { "Значення": timeToCatchExhausted },
            "НАЙГІРШЕ: Свіжа": { "Значення": timeToCatchWorstFresh },
            "НАЙГІРШЕ: Виснажена": { "Значення": timeToCatchWorstExhausted }
        });
    }

    if (DEBUG_MODULES.net) {
        console.log('%c====================================', 'color: #4a5b6c;');
        console.log('%c🕸️ АНАЛІЗ ПІДСАКИ (NET)', 'color: #b066ff; font-size: 14px; font-weight: bold;');

        if (!CONFIG.net || !CONFIG.net.active) {
            console.log('%cПідсака вимкнена (active: false)', 'color: #8a9bac;');
        } else {
            const fW = CONFIG.fish.weight;
            const nW = CONFIG.net.maxWeight;
            let chance = 100;
            let diffStr = 'Немає (100% успіх)';

            if (fW > nW) {
                const diffPercent = ((fW - nW) / nW) * 100;
                diffStr = `+${diffPercent.toFixed(1)}% перевантаження`;
                
                let baseChance = 50;
                for (const t of CONFIG.net.chances) {
                    if (diffPercent >= t.min && diffPercent <= t.max) {
                        baseChance = t.chance;
                        break;
                    }
                }
                const qualBonus = Math.round((CONFIG.net.quality - 1.0) * 10);
                chance = Math.min(100, baseChance + qualBonus);
            }

            console.table({
                "Статус": { "Значення": "Активна" },
                "Додаткова Зона (px)": { "Значення": `+${CONFIG.net.length * 10}` },
                "Вага Риби / Ліміт": { "Значення": `${fW} кг / ${nW} кг` },
                "Перевантаження": { "Значення": diffStr },
                "Якість (Бонус)": { "Значення": `${CONFIG.net.quality} (+${Math.round((CONFIG.net.quality - 1.0) * 10)}%)` },
                "ТЕОРЕТИЧНИЙ ШАНС": { "Значення": `${chance}%` }
            });
        }
    }

    if (DEBUG_MODULES.prediction) {
        console.log('%c====================================', 'color: #4a5b6c;');
        console.log('%c🏆 ПРОГНОЗ РЕЗУЛЬТАТУ (По центру)', 'color: #00ccff; font-size: 16px; font-weight: bold;');

        if (playerPullForceBase > fishPullForce) {
            console.log('%c✅ ГРАВЕЦЬ ПЕРЕМАГАЄ ЗІ СТАРТУ', 'color: #00ff80; font-size: 13px; font-weight: bold;');
        } else if (playerPullForceBase > finalFishPullForce) {
            console.log('%c⚠️ ПЕРЕМОГА ТІЛЬКИ ПІСЛЯ ВИСНАЖЕННЯ', 'color: #ffff00; font-size: 13px; font-weight: bold;');
        } else {
            console.log('%c❌ ГРАВЕЦЬ ПРОГРАЄ: АБСОЛЮТНИЙ ДЕДЛОК', 'color: #ff4444; font-size: 13px; font-weight: bold;');
        }

        if (playerSteerForceBase < fishEscapeForce) {
            console.log('%c🚨 ПОПЕРЕДЖЕННЯ: КЕРУВАННЯ СЛАБКЕ', 'color: #ff4444; font-size: 13px; font-weight: bold;');
        } else {
            console.log('%c✅ КЕРУВАННЯ СТАБІЛЬНЕ', 'color: #00ff80; font-size: 12px;');
        }
    }

    console.groupEnd();
}, 500);

document.addEventListener('netCatchRoll', (e) => {
    if (!DEBUG_MODULES.net) return;
    const { chance, roll, success } = e.detail;
    
    console.log(`%c[NET] Спроба піймати! Шанс: ${chance}%`, 'color: #b066ff; font-weight: bold;');
    
    if (success) {
        console.log(`%c[NET] Успіх! Випало: ${roll.toFixed(1)} <= ${chance}`, 'color: #00ff80;');
    } else {
        console.log(`%c[NET] Провал! Випало: ${roll.toFixed(1)} > ${chance}. Підсака порвана.`, 'color: #ff4444;');
    }
});

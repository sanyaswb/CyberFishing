# Spec 168 — Вікна оверлея «ACTIVE FISH» і «ACTIVE ROD» для балансу бою (TK-254)

Статус: власник 2026-11-08 «Yes, as recommended» — Q1 (в), Q2 (а), Q3 (б), Q4 (б), Q5 лишити; реалізовано v0.50.43;
перевірка власника відкрита. Правила: DEVELOPMENT_RULES
(production не залежить від DEV), DESIGN_RULES.md і docs/styles.md (DEV-інтерфейс), incidents R17 (DEV-інструмент сам
просить живі дані).

## Запит власника (2026-11-08)

«можеш додати в overlay новий параметр який відображає параметри риби по розділам в real live так як в active fish тільки
так щоб я міг зручно керувати повзунками всі параметри які впливають на fight, це для балансу, також окремо active rod
щоб я міг його теж ввімкнути і крутити параметри, тільки active fish і rod це окремі вікна overlay»

Результат для власника: в оверлеї два нові перемикачі — «🐟 ACTIVE FISH» і «🎣 ACTIVE ROD». Кожен відкриває **окреме
вікно** (своє перетягування, масштаб − / +, позиція запам'ятовується), де параметри, що впливають на бій, згруповані по
розділах і змінюються **повзунками** (з полем числа поруч); зміна діє в бою одразу, значення оновлюються наживо.

## Як це влаштовано зараз (v0.50.42, з коду)

- Оверлей — одне вікно `#debugOverlay` (`OverlayDomAdapter`, `OverlayWindowDragController`, `OverlayScaleControls`);
  модулі (`OVERLAY_MODULES`, `overlay_modules_config.js`) віддають HTML-рядок, вікно переписує вміст раз на
  `overlayUpdateMs` (150 мс). Елементи керування в такому HTML не переживають оновлення (повзунок під пальцем
  перемальовувався б) — оверлей зараз лише читає (TK-202).
- DevTools «ACTIVE FISH (…)» (`dev_tools.js #renderActiveFishSection`) будує дерево `HOOKED_FISH` з
  `debug-live-update` (з v0.50.40 і при вимкненому Overlay, поки відкрита панель) полями вводу; приховані поля —
  `ActiveFishDevToolsVisibilityPolicy`; правка йде через `DevTools.updateConfig(path, value)` → синхронізація аліасів
  профілю, рівня й ваги (`HookedFishProfileSynchronizer`), подія `debug-hooked-fish-updated` → `GameApplication`
  оновлює бій. Під рибою — ярлики `CONFIG.physics.fight / tension / retrieve`.
- Параметри риби, що діють у бою (`FishPhysicsProfile.toRuntimeConfig`): вага, рівень (`levelBasePower`), аномалія;
  `forceProfile` (basePower, levelBasePower), `staminaProfile` (baseStamina, staminaWeightMultiplier,
  staminaBossMultiplier, staminaRatioFromEndurance, minStaminaActivityMultiplier, exhaustedSpeedRatio),
  `movementProfile` (baseSpeed, agility, bounceCooldownMs, dirChangeMinMs/MaxMs, lastDashTrigger, radialRange,
  lateralRange), `behaviorProfile.behaviors` (idle / rest / swim / dash / lastDash: forceMultiplier, speedMultiplier,
  тривалості, direction).
- Вудилище в бою: `ITEM_DB.<rod>.gameplayStats` → `effectiveStats` (basePower, compensation, maxLoadKg,
  holdTensionRatio, lengthMeters, quality, durability, durabilityMaxLoadLossPerPercent; `RodPullSystem` читає
  lengthMeters, maxLoadKg, holdTensionRatio); правка `ITEM_DB` → `GameApplication #handleItemDatabaseUpdate` оновлює
  інвентар і `fightService.syncEquipment`. Спільні правила вудилища в бою — `CONFIG.physics.fight.rodHold`,
  `rodStroke`, `rodControl` (raw/physics/fight_physics.js).

## Рішення (пропозиція агента)

| # | Питання | Рішення |
| --- | --- | --- |
| D1 | Окремі вікна | Два нові DEV-вікна поруч з оверлеєм, кожне — свій `OverlayDomAdapter`-подібний контейнер з тим самим перетягуванням (`OverlayWindowDragController`, власний id для позиції) і масштабом − / +. Перемикачі «ACTIVE FISH» і «ACTIVE ROD» — у списку модулів оверлея (той самий `OverlaySettingsStore`), вікно видно лише коли перемикач увімкнений. Головне вікно оверлея не змінюється. |
| D2 | Повзунки, що не зриваються | Вікна будуються з DOM-рядків один раз на «форму» об'єкта (набір шляхів), як секції DevTools; наживо оновлюються лише значення за шляхом (без перебудови DOM), і рядок, який зараз тягнуть або редагують, не перезаписується. Перебудова — лише коли змінилася риба / вудилище або набір полів. |
| D3 | Один шлях правки | Кожна зміна йде через `DevTools.updateConfig(path, value)` — та сама валідація, синхронізація аліасів і рівня, ті самі події для бою, що й у DevTools. Вікна не пишуть у гру напряму. |
| D4 | Живі дані | Вікна самі просять `debug-live-update` (порт `isLiveDataRequested`, R17): дані йдуть, поки відкрита панель DevTools **або** увімкнене будь-яке з двох вікон. |
| D5 | Розділи риби | Зверху — лише читання: вид, стан поведінки, поточна витривалість і сила. Далі розділи з повзунками: «Рівень і вага» (weight, level, hasAnomaly — перемикач), «Сила» (forceProfile), «Витривалість» (staminaProfile), «Рух» (movementProfile; діапазони radial/lateral — два повзунки), «Поведінка» — підрозділ на кожен стан (forceMultiplier, speedMultiplier, тривалості, direction). Розділи згортаються, стан згортання запам'ятовується. Приховані поля — як у DevTools (`ActiveFishDevToolsVisibilityPolicy`). |
| D6 | Повзунок | Кожен числовий параметр — повзунок + поле числа. Межі й крок — зі схеми параметрів (`fight_balance_parameter_schema.js`: min / max / step для відомих ключів); для ключа без схеми — від 0 до max(2 × базове значення, 1), крок за порядком величини; поле числа приймає й значення поза повзунком. Кнопка «↺» повертає базове значення (з конфігу виду / предмета). Логічні — перемикачі, рядки — перемикач варіантів, якщо варіанти відомі. |
| D7 | Перевірки | Сценарії без браузера: схема меж; вікно будує розділи з реальних `FISH_DB` / `ITEM_DB`; оновлення значень не перебудовує DOM і не чіпає рядок під пальцем; правка доходить до `updateConfig` з правильним шляхом; дані просяться, коли вікно увімкнене. Візуальна перевірка — власника. |

## Питання власнику

- **Q1. Куди пишуться зміни риби?** (а) лише в поточну спійману рибу — наступна знову з конфігу виду; (б) у вид
  (`FISH_DB`, усі наступні риби цього виду, експортується з DevTools); (в) обидва: зміна діє на поточну рибу одразу, а
  кнопка «Записати у вид» переносить зміни в конфіг виду. **Рекомендація: (в)** — крутиш у бою, а вдале записуєш.
- **Q2. Куди пишуться зміни вудилища?** (а) у предмет каталогу (`ITEM_DB.<rod>.gameplayStats`: усі вудилища цього
  типу, наявний шлях оновлює спорядження й бій, експортується); (б) лише в екземпляр у руках (повернеться після
  переспорядження). **Рекомендація: (а).**
- **Q3. Що ще у вікні ACTIVE ROD?** (а) лише параметри предмета-вудилища; (б) ще й спільні правила вудилища в бою —
  `CONFIG.physics.fight.rodHold`, `rodStroke`, `rodControl` (окремими розділами); (в) ще й котушка й ліска в руках
  (окремі розділи). **Рекомендація: (б)**; котушку й ліску — окремими вікнами пізніше, якщо потрібно.
- **Q4. Що показує ACTIVE FISH поза боєм?** (а) «риба не спіймана»; (б) вид із Fixed Catch (якщо увімкнений) — його
  можна крутити до клювання, зміни йдуть у вид. **Рекомендація: (б)** для балансу без очікування клювання.
- **Q5. Розділ «ACTIVE FISH» у DevTools лишається?** **Рекомендація:** лишити (там повне дерево полів), вікно оверлея —
  зручне керування повзунками.

## Модель (після відповідей)

- `src/dev/overlay/windows/` — `OverlayToolWindow` (контейнер, перетягування, масштаб, згортання розділів) і два
  наповнювачі `ActiveFishWindowContent`, `ActiveRodWindowContent`; `FightBalanceParameterSchema` (межі, кроки, підписи
  з `parameter_labels.json`).
- Композиція — `createDebugOverlayRuntime` у `debug_overlay_bootstrap.js` (DEV); порт правки — `devTools.updateConfig`,
  порт даних — та сама подія `debug-live-update`.
- Production не змінюється (усе в `src/dev` і DEV-композиції; guard архітектури).

## Перевірки

Нова перевірка `overlay-balance-windows` (Quick): D2, D3, D4, D6, розділи D5 на реальних каталогах; падає без
реалізації. Full; game-cycle без змін (лише DEV).

## Реалізовано (v0.50.43)

- `src/dev/overlay/windows/`: `OverlayToolWindow` (окреме вікно: заголовок, вміст, − / +, перетягування з власним id
  позиції `overlay_active_fish` / `overlay_active_rod`; класи `debug-overlay--tool`, `--active-fish` (праворуч зверху),
  `--active-rod` (праворуч посередині)), `BalanceControlPanel` (DOM один раз на ключ форми, далі лише значення; повзунок під
  пальцем і поле у фокусі не перезаписуються; стан розділів — `overlay_balance_sections`), `BalanceFormRows` (числа →
  повзунки, логічні → перемикачі, пари чисел → два повзунки, об'єкти → підрозділи), `FightBalanceParameterSchema` (D6),
  `ActiveFishWindowContent`, `ActiveRodWindowContent`, `FightBalanceWindows` (показ за перемикачем, оновлення на
  `OverlayUpdateLoop` з `overlayUpdateMs`, `isLiveDataRequested`).
- Перемикачі `activeFish` / `activeRod` — у DevTools → OVERLAY → OVERLAY MODULES → група «Вікна балансу»; вікна не
  залежать від головного перемикача Overlay.
- Риба в бою: рядки `HOOKED_FISH.*` (вага, рівень, hasAnomaly, forceProfile, staminaProfile, movementProfile, кожен стан
  поведінки); ↺ — значення виду; «💾 Записати у вид» пише змінені `physics.*` у `FISH_DB.<i>.physics.*` (крім
  `forceProfile.levelBasePower`, що залежить від рівня). Поза боєм — вид Fixed Catch (`FISH_DB`), ↺ — значення на старті.
- Вудилище: `ITEM_DB.rods.<id>.gameplayStats.*` (крім `durability` — стан, не баланс), ↺ — значення предмета при першому
  показі; `CONFIG.physics.fight.rodHold / rodStroke / rodControl`, ↺ — базовий конфіг. Наживо: ефективні
  `maxLoadKg`, `holdTensionRatio`.
- Композиція: `src/bootstrap/development/fight_balance_windows_composition.js`; `isLiveDataRequested` у DEV-старті —
  відкриті DevTools або увімкнене вікно. Перевірка `overlay-balance-windows` (набір tools), `config-runtime` (композиція,
  правка через DevTools, dispose).

## TK-254.1 — стаміна в бою й більше параметрів стаміни (v0.50.44)

Власник: «стаміна не працює не змінюється і додай більше параметрів для стаміни це важливо». Причина: межі стаміни й
витривалості (`FishCondition`) рахувались лише при підсіканні, правка риби їх не оновлювала (incidents I-17). Зроблено:
`FishCondition.updateLimits` + `FightService.refreshStaminaLimits` (після правки риби й `CONFIG.stamina.fish`); у вікні —
усі значення staminaProfile, які читає бій (baseStamina, staminaRatioFromEndurance, staminaBossMultiplier,
minStaminaActivityMultiplier, exhaustedSpeedRatio; відсутнє — з ефективним значенням), наживо фаза / стаміна /
витривалість, розділ «Правила витривалості» (`CONFIG.stamina`, ↺ — базовий конфіг).

## Приймання власником

`dev.html`: оверлей → увімкнути «ACTIVE FISH» і «ACTIVE ROD» — два окремі вікна, перетягуються, масштабуються; у бою
повзунки змінюють поведінку риби й вудилища одразу, значення живуть; повзунок не зривається під час руху риби; ↺ повертає
базове. Телефон і ПК. Продуктивність — «ПРОДУКТИВНІСТЬ» з відкритими вікнами в бою.

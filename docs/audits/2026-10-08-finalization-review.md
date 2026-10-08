# Огляд для фіналізації архітектури (2026-10-08)

Доповнює [post-closure audit](2026-10-08-stage7-post-closure.md): той аудит закрив поля, локальні значення, fallback,
тестові припущення і CSS (019, 018). Тут — структурні місця, яких він не торкався.

## Стан на момент огляду

- Робоче дерево: 38/38 checks, guard (19 fixtures, production 463 модулі / 654 imports, DEV 568 / 838),
  game-cycle SHA256 `7b9baea3…ed5b6` без змін. Незакомічені CSS-зміни власника (75 файлів) теж зелені.
- Виконано після 0.30.0: 007 progression styling, rating-tier badge, test-only policy, коментарі, readiness API,
  diagnostics naming, ViewportProjector/camera, struct script, реліз 0.30.1, 016 converter, 018 CSS, 019 dead code.

## P1 — завершення архітектури

1. **FightPhysicsOrchestrator змішує production frame і DEV diagnostics.**
   `src/game/application/fishing/fight_physics_orchestrator.js` — 4 669 рядків, 82 методи. `#buildDebugSnapshot`
   (1 225 рядків) щокадру бою в production будує новий об'єкт приблизно з 675 полів, плюс
   `pipelineFrame.toDebugData()`. Production-рендер і HUD читають близько 20 полів цього snapshot через
   `tensionMeter.getDiagnostics()` (`fishing_render_frame_builder.js`: `fightDebug.lineRemainingMeters`,
   `forces`, `reelSlip`, `rodMaxLoadKg`…), `TackleStressSystem.setDiagnostics` теж його отримує.
   Крок: окремий production read model бою (поля, які потрібні рендеру/HUD, один об'єкт, що перевикористовується),
   DEV snapshot будується лише коли DEV overlay його запитує (провайдер компонує Development Bootstrap).
   Далі — розділ orchestrator за вже названими стадіями pipeline. Докази: game-cycle digest, allocation sites,
   call counts, HUD parity.
2. **GameApplication — use-case логіка в bootstrap.** `src/bootstrap/production/game_application.js`: 933 рядки,
   ~59 приватних полів: state machine, update/draw, закидання, прикормка й кораблик, wet feeder, panning,
   оновлення інвентаря, preload assets; напряму імпортує `FISH_DB`, `GameClock`, `ConfigProvider`.
   Bootstrap має лише компонувати. Крок: `GameSession` і малі координатори в `game/application` з портами
   (clock, assets, warnings), bootstrap лише з'єднує.
3. **DEV-механізми в production-графі.** Production startup завжди створює `FixedCatchFishFactory`, хоча Fixed Catch
   вимкнений; gameplay читає `devFlags` (`infiniteResources` ×4, `infiniteCasting` ×3, `noEquipmentLoss` ×2);
   `GameDebugFacade`/debug events живуть у production. Рішення власника D4 зберегло API прапорців. Варіант:
   production компонує неактивну реалізацію прапорців і не створює Fixed Catch; DEV компонує справжні.

## P2 — контракти й конфіг

4. **Конфіг створюється в споживачах.** `new FightPhysicsConfigAdapter(config)` як fallback у 6 класах
   application (`bite_system`, `catch_resolution_service`, `fight_service`, `fight_session_factory`,
   `fight_physics_orchestrator`, `inventory_runtime_config_provider`) — кілька екземплярів одного адаптера.
   `ITEM_PROGRESSION_CONFIG` імпортується статично в `inventory_item_snapshot_mapper.js` і
   `legacy_item_state_migration.js`: оминає runtime config і DEV overrides. Компонувати один раз і інжектувати.
5. **Правило для прихованої композиції.** ~13 параметрів `= new X()` в inventory application і ~30 domain-калькуляторів,
   створених полями orchestrator. Записати правило в DEVELOPMENT_RULES (stateless domain-калькулятори може створювати
   власник; конфігуровані, stateful і host-залежності — лише ін'єкція) і прибрати defaults там, де production
   завжди передає залежність.
6. **Platform singletons і шум у консолі.** `ChumControls` пише `console.log("--- DEBUG 1…")` на кожен клік;
   `LocalStorageCache` — статичний клас із прямими `console.*` і `printStorageUsage` на старті; `GameLoop` тримає
   статичний активний цикл; `InventoryInstanceIdFactory` — статичний лічильник. Зробити екземпляри, логер ін'єктувати.
7. **Кешування модулів після релізу.** Версію має лише entry (`?v=`) і 22 stylesheet; 462 production-модулі —
   без версії. На GitHub Pages (кеш ~10 хв) гравець може отримати суміш версій. Варіанти: каталог на версію при
   деплої, import map з версіями, service worker.
8. **Розмиті контракти.** У production 504 виклики `?.(` і 246 перевірок `typeof … === "function"`. Після явної
   композиції обов'язкові залежності можна викликати прямо (DependencyContractValidator уже перевіряє при
   композиції). Посилювати помодульно, починаючи не з гарячого циклу.

## P3 — тести, engine, документація

9. **Тестова композиція.** `game-cycle-check.js` (2 102 рядки) має власний список `GAMEPLAY_FILES` і композицію —
   ризик розійтися з bootstrap; 16 checks через `bindConstructorDefaults`; VM-loader; Node попереджає
   `MODULE_TYPELESS_PACKAGE_JSON`. Збирати тестові графи з production composition-модулів.
10. **Engine.** 19 приватних копій `clamp` у domain/application/presentation, хоча є `RenderMath.clamp`.
    Спільна `engine/math` функція — лише з перевіркою NaN/порядку меж кожної копії.
11. **Legacy-сейви.** Міграції старих сейвів (`InventoryLegacyMigration` 1 199 рядків, `LegacyItemStateMigration`,
    `LegacyInventorySaveSource`) живі для реальних гравців demo. Потрібна політика виведення (рішення власника).
12. **Документація й особисті утиліти.** `docs/simplified_fight_physics_model.md` посилається на `src/core/…`,
    `src/systems/…`; `utils/create-version-copy.js` має жорсткий шлях `D:\dev\cyber fishing\versions`.

## Рекомендований порядок

1 → 3 → 4 → 2 → 6 → 7, далі 5, 8, 9–12. Кожен крок — окрема spec, без зміни геймплею, сейвів і таймінгу;
доказ — checks, guard, незмінний game-cycle digest, browser smoke; для 1 і 2 — ще hot-loop allocations і call counts.
Рішення власника: 3 (перегляд D4), 7 (спосіб деплою), 11 (політика сейвів).

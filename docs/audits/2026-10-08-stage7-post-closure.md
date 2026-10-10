# Аудит після закриття Stage 7

Дата: 2026-10-08. Перевірений commit: `d065f0cf707507032aae69d5d44a07bbf3c007cb`.
Реліз: **0.30.1**. На початку аудиту робоче дерево було чистим.
Цей аудит змінює лише документацію; runtime, CSS, конфігурація й тести не редагувалися.

## Висновок

Classic → native ESM рефакторинг успішно завершений. Stage 7 закритий тегом `stage7-closed`
на релізі 0.29.0; подальший cleanup прийнятий у 0.30.1. Повторно відкривати Stage 7 через
перелічені нижче залишки немає підстав. Водночас завершення міграції не означає відсутність
усіх зайвих полів або ідеальну структуру стилів.

Не знайдено активного classic/ESM compatibility transport, недосяжних source-файлів або
невикористаних ESM import bindings. Знайдено конкретні залишки на рівні полів, локальних
змінних, DEV fallback та тестових припущень. Вони потребують окремого невеликого cleanup.

## Що перевірено

- Усі 572 `src/**/*.js`: AST imports, exports, literal dynamic imports, union досяжності від обох entries.
- Import bindings і приватні поля: scope/AST аналіз та ручна перевірка місць оголошення/запису.
- Публічні методи без статичних звернень: пошук також у `utils/**/*.js` та HTML, з відсівом test-only APIs.
- Реальні споживачі класів з `Bridge`, старих saves, browser lifecycle handles та VM test loader.
- Обидва HTML, stylesheets, DOM class/custom-property writers і checks, що читають CSS за фіксованими шляхами.
- Full, Quick, Architecture, окремий SHA256 stdout game-cycle та browser smoke обох native pages.

Результат є статичним аудитом плюс перевіреними сценаріями. Він не доводить покриття кожного
можливого DOM-стану, override, зовнішнього console-виклику або поведінки невідомого плагіна.

## Приймальні результати цього аудиту

| Перевірка | Результат |
| --- | --- |
| `npm run check` | 38/38 |
| `npm run check:quick` | 13/13 |
| `npm run check:architecture` | 2/2 |
| Syntax | 628 JS-файлів, 0 помилок |
| Architecture guard | 19 негативних fixtures, 0 порушень |
| Production graph | 463 модулі / 654 imports |
| DEV graph | 569 модулів / 839 imports |
| Union двох runtime graphs | усі 572 source-модулі |
| Недосяжні source-модулі | 0 |
| Невикористані ESM import bindings | 0 |
| CSS vocabulary check | 180 class names згадані в JS/HTML |
| Browser: `index.html`, `dev.html` | запуск, інвентар, reload; DEV Tools відкривається |
| Browser console | 0 errors / 0 warnings на обох сторінках, також після reload |

Game-cycle stdout: **11 907 bytes**, SHA256:
`7b9baea38feaa4b550e20bc2d22d5eed7875a8c7fb6f3fdf9e176ddf573ed5b6`.
Він збігається з baseline закриття Stage 7 та 0.30.1. Поточні save-round-trip checks підтвердили
byte-identical upgrades schema 2/3; актуальні storage key/schema збережені.

Browser smoke виконав Codex у вбудованому браузері на окремому localhost port 4187. Інвентар
обох сторінок показав 20 предметних карток; у DEV відкрилися runtime overrides, config validation
та діагностика підмотування. Це UI smoke, а не нова інструментована перевірка повного fight/save
cycle чи внутрішніх лічильників loops. Тимчасові вкладки й сервер закриті.

У Node-прогоні `config-runtime` є один `MODULE_TYPELESS_PACKAGE_JSON` warning: test tooling
без явної package module boundary завантажує ESM. Checks проходять; у браузері warning немає.
Не додавати сліпо `type: module` у root package: `utils` використовує CommonJS. Це окрема
дрібна задача про явні межі Node test runtime.

## Compatibility retirement і потрібні адаптери

У tracked tree немає `architecture/`, `utils/build/`, `backend/` або `src/debug/`.
Обидва HTML мають по одному module script. Немає bridge/activation/cumulative-runtime scripts,
старих runtime wrapper paths або production imports у DEV. Історія збережена в Git tags.

**Залишити:**

- `InventoryGameplayBridge`: чинний application адаптер між inventory read models/gameplay commands
  і споживачами гри; створюється в `InventoryCompositionRoot`.
- `InventoryEventBridge`: чинні subscriptions і передача events через injected target adapter.
- `OverlayInteractionBridge` та `OverlayMetricInfoBridge`: interaction/metric-info lifecycle у DEV.
- `LegacyInventorySaveSource`, `InventoryLegacyMigration`, `LegacyItemStateMigration` та відповідні
  ID/equipment migration policies: підтримка реальних старих saves, а не міст між classic та ESM.
- `NativeEsmTestLoader` і `SourceRuntime`: чинний ізольований VM test harness. Його explicit publication
  у test context не є browser/global compatibility transport.

Публікація `window.game`, cleanup/watchdog handles потрібна чинному browser lifecycle/DEV
контракту. `CYBER_FISHING_CONFIG_RUNTIME` і `CYBER_FISHING_PROJECT_VERSION` не мають читачів
у source runtime, але явно перевіряються тестами й можуть використовуватися з console.
Це кандидати для окремого рішення про зовнішній diagnostics API, не доказ мертвого transport.

## A. Підтверджені залишки полів — P2

У 17 модулях знайдено **24 приватні поля без читачів**: два лише оголошені з initializer,
ще 22 тільки записуються. Private fields не читаються через reflection або рядкові property keys.
Номери рядків нижче відповідають перевіреному commit.

| Модуль | Поля без читачів | Рядки оголошень |
| --- | --- | --- |
| `src/bootstrap/production/game_application.js` | `#map` | 16 |
| `src/game/application/chum/chum_controller.js` | `#rng`, `#getViewportSize`, `#panViewport` | 13, 14, 15 |
| `src/game/application/fishing/cast_service.js` | `#config` | 5 |
| `src/game/application/fishing/fishing_controller.js` | `#debugEvents` | 7 |
| `src/game/application/fishing/fishing_force_service.js` | `#config`, `#upDirection`, `#forces` | 2, 3, 4 |
| `src/game/application/inventory/inventory_command_service.js` | `#now` | 31 |
| `src/game/application/inventory/inventory_facade.js` | `#migrationWarnings` | 6 |
| `src/game/application/inventory/inventory_gameplay_bridge.js` | `#lastResult` | 12 |
| `src/game/application/inventory/inventory_refill_target_writer.js` | `#repository` | 4 |
| `src/game/domain/fish/fish.js` | `#level` | 5 |
| `src/game/domain/fishing/stamina_system.js` | `#lastStaminaBalanceFrame` | 7 |
| `src/game/domain/fishing/tackle_stress_system.js` | `#currentColor`, `#currentStatusLabel`, `#currentStatusColor` | 20, 21, 22 |
| `src/game/domain/tackle/reel.js` | `#holdConfig` | 6 |
| `src/game/domain/tackle/rod.js` | `#compensation`, `#variant` | 4, 5 |
| `src/game/presentation/inventory/inventory_item_tree_view_factory.js` | `#assemblyReader` | 4 |
| `src/game/presentation/inventory/inventory_ui.js` | `#lastViewModel` | 29 |
| `src/platform/browser/input/input_controller.js` | `#anchorX` | 47 |

Практичний ефект: зайві retained references, дві непотрібні allocation в `FishingForceService`,
невикористаний frozen warnings array в `InventoryFacade`, а також visual-state calculations
у `TackleStressSystem.#updateVisualStates` без споживача результату.

Видаляти поле і запис можна після перевірки RHS: getter, conversion, allocation або calculation
може мати окремий побічний ефект. Наприклад, `Fish.#level` не є підставою прибирати зовнішній
fish level/save field. Аргументи constructors і публічні APIs не змінювати автоматично.

## B. Локальні залишки і fallback — P2

- `DevTools.#populatePanel` (`src/dev/tools/dev_tools.js:148`): `legacyOverlayModules` бере дані
  з того самого `settingsStore`, що й основний шлях. `OverlaySettingsStore.getSnapshot()` завжди
  повертає новий object; звичайний шлях викликає його тричі, fallback не додає іншого джерела.
  Достатньо одного snapshot без цього compatibility-shaped фрагмента.
- `StaminaDebugModule.render:11`: локальний `config` не використовується, але двічі викликає
  `configSource()` у звичайному шляху.
- `FightRodControlSection:10` та `FightPhysicsOverlayModule:13`: два невикористані `sectionOptions`
  objects залишилися після explicit composition.
- `FightService:142–145`: `floatEntity`, `bounds`, `input`, `net` у destructuring не читаються;
  `fishData` читається й має залишитися.
- `InventoryItemHydrator:18`: `categoryId` у `Object.entries` не використовується; це дрібний
  локальний cleanup із перевіркою enumeration order.

Два `_authoredStats` у `InventoryItemHydrator` і `InventoryItemViewFactory` навмисно виключають
`gameplayStats` із rest object. **Це не мертвий код:** їх видалення поверне authored stats у view.

## C. Кандидати, які не можна видаляти лише за результатом grep

### Публічні методи

14 методів не мають інших статичних згадок у JS/HTML source або tests:

- `RenderAllocationDiagnostics.disable`;
- `DebugFormatters.hookPower`;
- `FishStateForcePreviewSection.resolveActualDirection`;
- `OverlayValueFormatter.kgPerKg`, `kgPerKgMps`;
- `AssetManifest.toProviderManifest`;
- `DependencyContractValidator.requireProperties`;
- `Vector2.sub`;
- `CompositeRenderer.getComponentCount`, `getComponentIdAt`;
- `RenderMath.pointInRect`;
- `EquipmentService.getPrimaryHook`, `getActiveBaits`, `consumeReel`.

Це shortlist для consumer/API review. Особливо `RenderAllocationDiagnostics.disable` може бути
навмисним manual DEV control. Окремо знайдені APIs, що читаються лише tests (наприклад
`GameCompositionRoot.getRuntimeConfig`, render-pipeline introspection); вони не позначені dead
автоматично. Видалення публічного API має відповідати owner rule у `DEVELOPMENT_RULES.md`.

### Буффи і bite fallback

- `BuffManager` видалений, але `FightService:163` завжди передає `buffs: null`; значення ще
  проходить через `FishingForceService`, `FightPhysicsOrchestrator`, `FishForceSystem` до
  `PlayerForceSystem:122`, де застосовується `getTotalMultiplier` або множник 1. У перевіреному
  source/tests немає provider ненульових buffs. Це залишок непідключеної можливості: окремо
  вирішити retirement параметра/гілки, довести незмінність формули для чинних inputs.
- `WaterEntity.startBite:627` має fallback на `runtimeConfig.float.biteSequence`. Єдиний source
  caller — `WaitingState:165`, який передає sequence риби. Для removal треба довести всі paths
  `BiteSystem`/Fixed Catch/DEV і прямі API consumers; у цьому аудиті fallback не видалявся.

## D. Залишки classic припущень у tests — P3

`inventory-ui-check.js:390` приймає як named ESM export, так і `globalThis.Class = Class`.
Для повністю native source другий варіант застарів; ESM assertion можна посилити без видалення
check. Коментарі про activations/cumulative runtime також залишилися в `game-cycle-check`,
`platform-runtime-check`, `consumable-event-identity-check`, `inventory-transaction-check` та
`inventory-equipment-check`. Вони вводять в оману, але не створюють runtime dependency.

`game-cycle-check.domainClass` ще пробує `eval(name)` перед native module export lookup,
а platform check дублює context/import-module namespace fallback. Це test-harness cleanup;
VM realm/module identity і regression scenarios мають зберегтися.

## E. Стилі: реальний залишок структури

| Файл | Рядків | Bytes | Class names | Особливості |
| --- | ---: | ---: | ---: | --- |
| `style.css` | 225 | 3 765 | 19 | 30 rules; 4 `!important`; DEV Tools + game shell + version badge |
| `inventory.css` | 1 881 | 39 843 | 161 | 25 custom-property definitions; 3 keyframes; 4 media queries; 1 container query |

DEV selectors `.devtools-*`, `.switch`, `.slider` лежать у production styles і завантажуються
`index.html`. Це прогалина ownership CSS, яку JS architecture guard не аналізує.
Inventory stylesheet змішує modal layout, header, filters, cards, slots, resource meters,
attachments, long press, assembly editor, saved loadouts, tooltips та responsive overrides.

CSS vocabulary check доводить згадку class names у code, але не доводить, що selector у цілому
матчиться в реальному DOM, не перекритий каскадом і потрібний у кожному стані. У перевірених
файлах не знайдено повторів повного selector header в однаковому at-rule context; це також
не є доказом відсутності дубльованих declarations або семантично мертвих rules.

Окрема задача: [018 — Presentation CSS restructure](https://github.com/sanyaswb/CyberFishing/blob/specs-archive-001-019/specs/018-presentation-css-restructure/spec.md).

## Рекомендований порядок після аудиту

1. Невеликий cleanup підтверджених приватних полів/локальних значень і дубльованого snapshot;
   перевірка side effects, focused checks, Full/Quick/Architecture та незмінний game-cycle.
2. Окремий перегляд public/test-only APIs, buffs і bite fallback; збереження live checks і save migration.
3. CSS restructure за spec 018 з browser baseline/computed-style parity; жодного redesign у цьому переході.

Код у пунктах 1–3 не реалізований цим аудитом. P0/P1 runtime blocker у перевіреному обсязі
не виявлено. Деталі актуальних шарів і прийнятого cleanup: [architecture](../architecture.md),
[cleanup closure](../refactoring_remaining.md).

## Follow-up closure

Початковий аудит вище збережений як snapshot до реалізації. За наступним дорученням
власника виконано [019 cleanup](https://github.com/sanyaswb/CyberFishing/blob/specs-archive-001-019/specs/019-post-closure-dead-code/results.md)
(commit `67da207`) і [018 CSS restructure](https://github.com/sanyaswb/CyberFishing/blob/specs-archive-001-019/specs/018-presentation-css-restructure/results.md).
Consumer review, збережені contracts, removals, differential/browser evidence і network
tradeoff записані у results. Stage 7 не відкривався повторно; версію 0.30.1 не змінено.

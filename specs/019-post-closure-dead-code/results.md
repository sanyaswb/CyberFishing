# Результат 019

Виконано 2026-10-08 на базі `d065f0c` (v0.30.1). Авторизація: доручення власника
самостійно виконати follow-up задачі аудиту. Версію та release tag не змінено.

## Consumer review і рішення

- Прибрано всі 24 приватні поля з таблиці аудиту та записи в них. RHS переглянуто:
  constructor references, локальні results/frames, null та невикористані objects.
  `Fish.#level` був лише приватною копією; level fish data, physics level coefficients,
  DEV synchronization і persisted level залишилися. `updateRuntimeStats` читає вагу і physics;
  єдиний caller передає numeric level із fish profile. Constructor signature збережено.
- Прибрано невикористані calculations `TackleStressSystem.#updateVisualStates` та його
  `ratioGradientColor`: результат ніхто не читав. Presentation tension styling має своїх
  споживачів і не змінювався. Stress/failure calculations та diagnostics залишилися.
- Прибрано два `sectionOptions`, невикористаний stamina config read, зайвий destructuring
  FightService; hydrator використовує `Object.values` у тому самому enumeration order.
  `_authoredStats` збережено: він виключає authored values із rest object.
- DevTools бере один snapshot із того самого `OverlaySettingsStore`, замість трьох.
  Додаткового legacy source не існувало; відсутній store як і раніше не створює section.
- Прибрано 12 методів без callsites, computed-name uses або contract consumers:
  `resolveActualDirection`, `kgPerKg`, `kgPerKgMps`, `toProviderManifest`,
  `requireProperties`, `Vector2.sub`, `CompositeRenderer.getComponentCount/getComponentIdAt`,
  `RenderMath.pointInRect`, `EquipmentService.getPrimaryHook/getActiveBaits/consumeReel`.
  Classes та їхні live methods збережено.
- **Збережено** `RenderAllocationDiagnostics.disable` як парну ручну DEV-команду.
  **Збережено** `DebugFormatters.hookPower`: hook-domain check явно закріплює delegation
  до Domain policy через source assertion. Перша focused перевірка виявила цей consumer;
  метод відновлено, assertion не послаблено. Test-only API contracts також залишилися.
- Прибрано шлях `buffs` через п'ять classes: єдине gameplay composition завжди подавало
  `null`, provider/ненульових consumers немає після retirement BuffManager.
  Чинний множник дорівнював 1. Fish debuffs, GodMode та Fixed Catch не змінювалися.
- `startBite` копіює явну fish sequence без fallback на відсутній `CONFIG.float.biteSequence`.
  Єдиний caller — WaitingState; природна риба отримує passive/active sequence,
  Fixed Catch замінює її лише за наявності sequence. Карась має лише passive,
  окунь — обидві. Unsupported lure regression залишилася в gameplay checks.
- Native test lookup більше не пробує `eval`/classic provider; inventory export assertion
  посилено до named ESM. Namespace identities/VM realm та всі scenarios збережено.
  Застарілі коментарі про activations/cumulative transport виправлено.

Live inventory/event/overlay bridges, save migrations, configuration globals для diagnostics,
NativeEsmTestLoader і SourceRuntime збережено. Жодного unreachable source file не було.

## Приймання

- Full **38/38**, Quick **13/13**, Architecture **2/2**; guard **19 negative fixtures**.
- Graph не змінився: **572** source modules; production **463 / 654 imports**, DEV **569 / 839**.
- Differential baseline/current: **4 837** однакових serialized records — 2 400 player force
  frames, 1 200 tension frames із diagnostics, fish runtime updates, 30 bite starts
  (5 tackle types × pulling on/off × 3 GodMode sequence modes).
- Game-cycle: **11 907 bytes**, SHA256
  `7b9baea38feaa4b550e20bc2d22d5eed7875a8c7fb6f3fdf9e176ddf573ed5b6`.
- Чинні save round-trip/migration checks пройшли; schema/key/serialization не змінювалися.
- Browser smoke виконав Codex у Chromium Codex In-app Browser, окремий localhost:4188:
  index/dev world, inventory/equip/unequip, DEV panel/debug controls, reload обох сторінок;
  **0 errors / 0 warnings**. Один native entrypoint на сторінку.
- Production base: GodMode і Fixed Catch **false**, як вирішив власник.

Локальний differential script, початковий checkout, stdout/logs і browser screenshots збережено
в `.git/codex-followup-018/`. Node warning `MODULE_TYPELESS_PACKAGE_JSON` у config-runtime
існував до змін; browser warnings відсутні. Root package type не змінювався.

Наступний незалежний checkpoint: [018 — CSS](../018-presentation-css-restructure/spec.md).

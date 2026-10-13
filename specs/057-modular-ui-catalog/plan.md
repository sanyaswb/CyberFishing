# Implementation Plan: Модульні UI-компоненти та їхній каталог

**Branch**: `develop` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Окрема специфікація 057. Власник дозволив у цій ітерації лише підготовку spec і plan; наведені нижче runtime-файли та етапи є майбутніми змінами.

## Summary

Створити ізольовану DEV-сторінку `ui-catalog.html`, що складає приклади з реальних production-renderers, BEM-блоків і інжектованих кольорових resolvers. Виділяти спільні компоненти поступово, починаючи з кнопки закриття, ресурсних шкал і перемикачів. Внутрішнє оформлення має одного власника, зовнішня геометрія залишається у споживача.

Окремий browser-адаптер задає логічну DOM-поверхню шириною щонайменше 320px і масштаб нижче неї. Він забезпечує узгоджені drag/scroll/tooltip/portal координати, не змінюючи Canvas гри, input світу або формат збережень. Спочатку перевірити адаптер у каталозі, потім підключати його до production UI малими кроками з регресійними перевірками.

## Technical Context

**Language/Version**: Поточний native JavaScript ESM-клієнт, HTML, CSS і SVG; Node.js/npm для наявних перевірок. Новий runtime-framework або Sass build не потрібні.

**Primary Dependencies**: Наявні `InventoryDomFactory`, production UI renderers, `DegradationColorResolver`, `HudStyleResolver`, `HudBarRenderer` та спільні стилі. Конкретні джерела й споживачі наведені в [research.md](research.md).

**Storage**: Відсутнє у каталозі. Демонстраційний стан у пам’яті; доступ до live saves, ігрових команд, care-сервісів та реального clock заборонений.

**Testing**: Focused component/catalog/scale contracts, `utils/css-usage-check.js`, `utils/architecture-check.js`, Architecture + Quick + Full, незмінний game-cycle/save baseline. Візуальне приймання виконує власник.

**Target Platform**: Поточні браузерні DOM/Canvas адаптери; логічна ширина 320px, фізичні перевірки 240, 280, 319, 320, 740px і ширші. Список підтримуваних браузерів не розширюється цим планом.

**Project Type**: Локальний browser-game з окремими production, DEV і house entrypoints; додається ізольований DEV entrypoint каталогу.

**Performance Goals**: Без нового ігрового frame loop; оновлення прикладів тільки при зміні control/state/розміру. Вузли, зображення, callbacks та resolved styles повторно використовуються; resize-вимірювання коалесуються, dispose очищає слухачів і scheduling.

**Constraints**: Один модульний script на сторінку; native CSS composition без injected style blocks; production не залежить від DEV; no DOM globals у domain/application/engine; незмінні gameplay, save format, timer semantics і state ownership; без browser automation, commit/push у поточній ітерації.

**Scale/Scope**: Усі UI-сімейства FR-002, інвентаризовані перед реалізацією; один representative example на кожен компонент і кожен застосовний стан. Не створювати новий редактор коду/тем або універсальну schema-driven UI-систему.

## Constitution Check

| Gate | До дослідження | Після проєктування |
| --- | --- | --- |
| SRP і необхідність абстракцій | PASS: виділяються реальні повторювані компоненти | PASS: renderer, fixtures, preview controller, scale adapter мають окремі обов’язки |
| Напрям залежностей | PASS: каталог у DEV, UI у presentation, браузерні механізми у platform | PASS: concrete collaborators складає bootstrap; production не імпортує каталог |
| Engine незалежний від гри/браузера | PASS | PASS: engine не змінюється; перенесення UI в engine не потрібне |
| Авторитетний стан | PASS: поточний UI читає production read models | PASS: isolated fixtures не є другим власником ігрового стану |
| Збереження поведінки | PASS: немає gameplay-задач | PASS: виділення шаблонів зберігає callbacks/ARIA/classes; scale=1 — поточна геометрія |
| Докази й guards | PASS: джерела/споживачі перевірені | PASS: нова сторінка додається до перевірок, а не виключається з них |
| Межа цієї ітерації | PASS: owner обрав документацію | PASS: каталог, адаптер масштабу й component extraction зараз не реалізуються |

## Project Structure

### Documentation (this feature)

```text
DESIGN_RULES.md
AGENTS.md
specs/057-modular-ui-catalog/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/ui-components.md
```

`tasks.md` створюється окремим етапом після прийняття плану; у цій ітерації він не потрібний.

### Source Code (repository root; proposed, not created)

```text
ui-catalog.html
src/entrypoints/dev/ui_catalog.entry.js
src/bootstrap/development/ui_catalog_bootstrap.js
src/dev/ui_catalog/
├── ui_catalog_page.js
├── ui_catalog_examples.js
├── ui_catalog_fixture_models.js
└── ui_catalog_preview_controller.js
src/dev/styles/ui-catalog.css
src/game/presentation/ui/
├── ui_close_button_renderer.js
└── ui_auto_switch_renderer.js
src/platform/browser/dom/ui_surface_adapter.js
src/game/presentation/styles/modal-controls.css       # existing shared close appearance
src/game/presentation/styles/inventory/resource-meters.css
src/game/presentation/styles/tokens.css
utils/ui-catalog-check.js
utils/ui-surface-check.js
```

**Structure Decision**: UI-спільні шаблони розміщуються у presentation. Каталог і контрольні дані — DEV; будь-які factory/strategy з host/config залежностями створює development bootstrap. Scale adapter — platform із вузьким інжектованим контрактом. Уже спільний `InventoryResourceMeterRenderer` повторно використовується без перейменування або нового wrapper лише заради каталогу. Стилі не переносяться масово: зберігати їхніх наявних власників і native порядок завантаження.

## Implementation sequence for the next iteration

1. **Інвентаризація й контракт.** Побудувати coverage-таблицю всіх FR-002 компонентів/станів, реальних source/style owners та споживачів. Додати missing family до плану до написання runtime-коду. Перевірити форму callback/lifecycle кожного renderer; не створювати fixtures із вигаданими gameplay-контрактами.
2. **Спільні примітиви.** Виділити close і auto-switch markup за доказом повторного використання; споживачі додають свої layout BEM-mix. Для toolbar відокремити нинішні `position: fixed`, `bottom/right` від appearance, зберігши screen-specific класи й поведінку. Ресурсні meter і Canvas bar renderers уже існують — не копіювати їх. Спільну help/focus логіку виділяти лише для реальних повторних споживачів.
3. **Сторінка й гарантії.** Підключити один DEV entry, production CSS у визначеному порядку й catalog-only CSS для зовнішньої сітки прикладів. Розширити явні списки native pages у architecture/style checks, додати negative fixtures для production → catalog, другого script і catalog CSS у production. Якщо каталог має потрапляти до Pages-релізу як DEV-інструмент, додати його до committed-module packaging та release check; не публікувати в цій ітерації.
4. **Реальні приклади.** Реєструвати renderers із ізольованими models і callbacks. Показувати default/hover/focus/disabled/on/off/empty/selected/error, шкали й крайні значення. Catalog styles не перевизначають внутрішні кольори/параметри production-компонентів; джерело компонента вказане біля прикладу.
5. **Масштаб і координати.** Реалізувати adapter за [контрактом](contracts/ui-components.md#ui-surface). Перевірити 320 → 280 → 240 → 320 у каталозі, portals, drag/scroll, safe-area й коротку висоту. Автоматичне UI hit-testing належить browser DOM; ручні розрахунки drag/scroll переводять фізичні дельти в логічні одиниці. Canvas лишається у фізичному viewport.
6. **Підключення production UI.** Під’єднувати поверхню/portal root до реальних модалів, HUD DOM і affected drag/tooltip consumers по одному. Не обгортати `body` transform і не змінювати game input. Зберігати чинні save boundaries; persisted drag coordinates перевірити на фактичний формат до адаптації.
7. **Регресія й приймання.** Focused checks + Architecture + Quick + Full, незмінні save/game-cycle outputs. Owner перевіряє візуал на 240/280/319/320px і desktop, square/portrait/wide assets, повторні відкриття, keyboard, drag, scroll та підказки. Після цього виконати дозволений у тій ітерації commit/publish workflow.

## Validation and risks

- Найвищий ризик — змішування фізичних `clientX/clientY` і логічних CSS/scroll координат. `DraggableButton`, `HorizontalScrollController`, `InventoryTooltipPresenter`, DEV overlay drag мають окремі regression scenarios.
- Для responsive viewport previews browser media queries описують сторінку, а не маленьку demo-card. Композиції каталогу повинні отримувати справжню контрольну ширину через container queries або isolated preview surface з явним layout mode. Якщо production-компонент досі залежить від viewport query, на першому кроці перевіряти його реальним viewport і позначати це; не заявляти, що зменшена картка демонструє його мобільний стан.
- Default Canvas config та DOM degradation scale вже мають різні семантичні owners. Каталог показує їх без третьої палітри; зміна кольорової політики HUD є окремою owner-зміною.
- Неочікувані ресурси/таймери від full InventoryUI/House bootstrap не підключати: використовувати renderer або read-only composition з ізольованими ports. Наявні game saves не відкривати навіть для "зручних" прикладів.
- Перелік source файлів є запланованою структурою; актуальні consumer contracts повторно перевіряються перед реалізацією, оскільки попередні UI-ітерації поки не закомічені.

## Complexity Tracking

Винятків із constitution немає. Окремий scale adapter потрібний для реальної межі систем координат, а окрема DEV-сторінка — для ізоляції ігрового стану. Нові глобали, compatibility bridges, залежність engine від DOM, Sass build і універсальний компонентний runtime не потрібні.

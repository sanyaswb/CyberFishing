# ТЗ 018: реструктуризація Presentation CSS

Дата: 2026-10-08. Статус: **задача підготовлена; реалізація не розпочата**.
Тип: структурна зміна зі збереженням вигляду та поведінки.
Baseline: `d065f0c`, реліз 0.30.1. Stage 7 залишається закритим; це окреме покращення Presentation.

## Проблема і бажаний результат

Розробник має знаходити правила певного UI-компонента в одному зрозумілому модулі стилів.
Production має завантажувати тільки потрібні йому стилі; DEV додає власні стилі окремо.
Розподіл повинен спиратися на реальних DOM writers і cascade dependencies, а не на кількість
рядків або довільну кількість файлів. Вигляд усіх чинних UI-станів має залишитися незмінним.

Зараз є два external stylesheets, які в однаковому порядку читають обидві сторінки:

| Baseline-файл | Рядків / bytes | Відповідальності |
| --- | --- | --- |
| `src/game/presentation/styles/style.css` | 225 / 3 765 | game shell, scouting fade, victory stacking, version badge, DEV Tools |
| `src/game/presentation/styles/inventory.css` | 1 881 / 39 843 | весь inventory UI, animations, responsive/reduced-motion rules |

Контрольні SHA256 authored bytes:

- `style.css`: `f8adc21a02a34fb0d3b23093b111defc1d4e1fdd69f2477533cf261a66672526`.
- `inventory.css`: `7a38c76ba8a07b0bcd662e15706ebefb84ee5c9ccedee97848096f882f2c0a23`.

Inventory має 161 class name, 25 CSS custom-property definitions, 3 keyframes, media queries
на 1180/820/520 px та `prefers-reduced-motion`; також named container query
`inventory-assembly-workspace (max-width: 520px)`. У `style.css` 19 class names і 4 `!important`.
Ці факти — inventory baseline, а не вимога зберігати довільну кількість правил назавжди.

## Межі роботи

У цьому переході:

- розділити authored CSS за UI ownership;
- винести DEV Tools styles із production stylesheet у `src/dev/styles/`;
- визначити явний порядок завантаження native CSS на обох HTML-сторінках;
- адаптувати чинні CSS checks до нових шляхів без послаблення assertions;
- прибрати старі monolith paths після cutover усіх споживачів;
- описати структуру, власників та правила додавання нових стилів.

Поза цим переходом:

- redesign, зміна кольорів/розмірів/шрифтів/поведінки анімацій або responsive UX;
- перейменування DOM classes, state modifiers, custom properties, container/keyframe names;
- зміни gameplay, config ownership, save format, подій або physics timing;
- Canvas renderer decomposition;
- впровадження CSS framework, preprocessors, bundler або UI component framework;
- масове перенесення inline styles і DEV overlay style installer із JS;
- довільне видалення CSS через відсутність selector у одному screenshot.

Подальше винесення статичного inline styling потребує окремого scope. Динамічні geometry,
resource percentages, rarity colors і long-press progress залишаються даними відповідних
renderers/adapters; CSS читає їх через чинні custom-property contracts.

## Ownership і рекомендована структура

Production styles залишаються в Presentation. DEV styles належать DEV. Domain/Application
не знають CSS або DOM selector names; HTML є місцем композиції stylesheet dependencies.

```text
src/game/presentation/styles/
  game-shell.css
  version-badge.css
  inventory/
    theme.css
    modal.css
    header.css
    shared-controls.css
    loadout.css
    slots.css
    item-cards.css
    resource-meters.css
    attachments.css
    assembly-editor.css
    item-parameters.css
    list-and-filters.css
    tooltips.css
    responsive.css

src/dev/styles/
  dev-tools.css
```

Це вихідна карта відповідальностей, а не обов'язковий file-count KPI. До перенесення
уточнити її за повним selector → DOM writer → cascade consumers inventory. Наприклад,
attachments можна залишити поруч із cards, якщо audit підтвердить єдиного власника;
окремий shared component виправданий лише реальними споживачами. Не дробити stylesheet
на файли для кожного modifier або declaration і не створювати catch-all `utils.css`.

| Власник | Поточні families / джерела | Основні DOM writers |
| --- | --- | --- |
| Game shell | `body`, `canvas`, victory/scouting states | HTML, platform engine interface/input; presentation outcome state |
| Version badge | `.game-version-badge` | `GameVersionBadge`, HTML badge node |
| DEV Tools | `.devtools-*`, `.switch`, `.slider` | `DevToolsUI`; лише `dev.html` |
| Inventory theme | `:root` і custom properties на `.inventory-modal` | існуючий CSS scope; DOM dynamic writers |
| Modal/layout | `.inventory-modal*`, `.inventory-main*`, спільні panel surfaces, backpack button | `InventoryUi` |
| Header | load, active tackle, auto settings, close control | `InventoryHeaderRenderer` |
| Shared controls | disabled controls, warning, scroll treatments, toggle/long-press states | відповідні renderer/control consumers |
| Loadout | `.inventory-loadout-*`, `.inventory-saved-loadout-preview*` | `InventoryLoadoutPanelRenderer`, `InventorySavedLoadoutPreviewRenderer` |
| Slots | `.inventory-field*`, `.inventory-slot*`, compatible/highlight/locked states | `InventoryLoadoutPanelRenderer`, `InventoryAssemblyEditorRenderer` |
| Cards | `.inventory-item-card*`, rating-tier badge, rarity states | `InventoryItemCardRenderer`, rarity/condition adapters |
| Resource meters | `.inventory-resource-meter*`, fill/icon/track, variants | `InventoryResourceMeterRenderer` |
| Attachments | `.inventory-attachments*`, `.inventory-attachment-badge*` | `InventoryAttachmentBadgeRenderer` |
| Assembly editor | `.inventory-assembly-editor*`, named workspace container | `InventoryAssemblyEditorRenderer` |
| Parameters | parameter sections/rows/bars/segments, bait effectiveness, container override | `InventoryItemParametersRenderer` |
| List/filter UI | categories, subfilters, sort, grid, selection/compatibility marks | `InventoryGridRenderer` |
| Tooltips | `.inv-tooltip*`, `.inventory-tooltip*`, balance tooltip states | `InventoryTooltipPresenter` |
| Responsive policy | чинні viewport media overrides і reduced motion | policy всього inventory; або colocated owner rules після доказу cascade parity |

Згруповані selectors, що стосуються кількох компонентів (наприклад спільні surfaces,
disabled buttons і scrollbars), мають одного shared owner. Не копіювати той самий rule
в кожен компонент. Scope/theme variables зберігати на нинішніх `:root`/modal nodes:
tooltip може знаходитися поза modal і залежати від root inheritance.

## Завантаження і cascade contract

**FR-001.** Native CSS працює без build step. Переважний варіант — ordered `<link rel="stylesheet">`
у HTML: однакові production modules у `index.html`/`dev.html`, DEV styles тільки в `dev.html`.
Порядок визначається залежностями й каскадом, а не alphabetical folder traversal.
JS module entries залишаються по одному на сторінку.

**FR-002.** Якщо реалізація обирає CSS composition entry з `@import`, потрібне окремо записане
обґрунтування та browser network/load measurement відносно baseline. Заборонені вкладені
import chains, cycles, повторне завантаження тих самих rules і приховані build requirements.
Чинні `style.css`/`inventory.css` не залишати як compatibility wrappers без живого контракту.

**FR-003.** Переносити declarations із незмінними values, selector specificity, state modifiers,
pseudo-elements/classes, важливістю, at-rule contexts і порядком declarations усередині rule.
Відносний порядок усіх потенційно конфліктних правил має зберігатися. Перед grouping
non-contiguous sections довести, що новий порядок не змінює cascade winners.

**FR-004.** Перенести всі три keyframes рівно один раз до відповідного component/shared owner.
Animation names, durations, timing functions, fill mode, reduced-motion overrides зберегти.
Named container і query повинні працювати з тим самим DOM ancestor.

**FR-005.** Існуючі `!important` не прибирати механічно. Нові `!important`, глобальні resets,
`@layer` priority changes або ширші selectors потребують окремого доказу еквівалентності;
цей перехід не є redesign cascade model.

**FR-006.** Зберегти custom-property contracts: name, scope, fallback та JS writers. Theme defaults
не дублюють mutable gameplay/config state. Не переносити visual constants у Domain.

**FR-007.** Зберегти loading/cache policy для нових paths і deployment через статичний сервер.
Визначити, як version/cache query застосовується до кожного нового stylesheet; перевірити reload
після path cutover. Не збільшувати JS scheduling, DOM queries або style writes у hot loops.

## Адаптація checks

Шість чинних checks мають literal references до старих stylesheet paths:

1. `utils/css-usage-check.js`;
2. `utils/inventory-ui-check.js`;
3. `utils/item-rarity-check.js`;
4. `utils/item-condition-check.js`;
5. `utils/item-progression-check.js`;
6. `utils/degradation-color-check.js`.

**FR-008.** Після cutover ці checks читають реальну композицію stylesheets обох HTML-сторінок
із project-local paths і зберігають свої assertions. Можна використати один невеликий shared
test reader, оскільки щонайменше шість споживачів потребують ті самі дані. Reader не змінює source
і не стає production manifest/compatibility transport.

**FR-009.** CSS usage check охоплює всі підключені CSS modules, DEV styles і retained injected
style blocks у погодженому scope; не обмежується двома старими filenames. Перевірити unresolved
links/imports, дублікати завантажень і відсутність DEV stylesheet у production. Зберегти unknown-class
negative fixture та підтримку dynamic prefixes. Згадка class name не видається за доказ CSS reachability.

**FR-010.** Відсутність rule у переліку чи screenshot не дозволяє видаляти assertions або CSS.
Cleanup потрібен лише за окремим доказом DOM/state consumers та cascade effects, із записаною причиною.

## Візуальне приймання

Порівняння before/after проводиться в одному browser engine, на тому самому наборі items,
станах, viewport, zoom, DPR і clock/animation sampling. Game Canvas/time не повинні створювати
випадковий шум у CSS screenshot diff: фіксувати UI region/момент і вказувати masks явно.

Обов'язкова матриця:

- `index.html` і `dev.html`: game shell/version badge, inventory closed/open, reload;
- viewport widths: **1280, 1181/1180/1179, 821/820/819, 521/520/519, 390 px**;
- named workspace container: ширина **521/520/519 px**, незалежно від viewport;
- mouse hover, keyboard focus-visible, selected/compatible/disabled/highlighted/locked states;
- loadout, saved loadout preview, assembly editor, open filters/sort menus, warning and scrolling;
- cards із/без metadata, ordinary/unique rarity, glow/pulse, condition, line resource meter,
  attachment badges, incomplete state та long-press indicator;
- tooltip поза modal з inheritance, balance parameter positive/negative/neutral states;
- reduced motion увімкнений/вимкнений; звичайний animation trace з однаковим моментом sampling;
- DEV Tools open/closed, switch/inputs/scrollbar; overlay та їх drag/scale після нового CSS load.

**SC-001.** Before/after computed styles і bounding boxes для представницьких елементів
та `::before`/`::after` збігаються. Будь-яку різницю пояснити; не приймати її як випадковий redesign.

**SC-002.** Screenshot differences у UI regions відсутні при однаковому rendering environment;
допустимі лише явно зафіксовані noise masks. Число CSS files або зменшення рядків не є доказом parity.

**SC-003.** Focused CSS/inventory/rarity/condition/progression/degradation checks, Architecture,
Quick і Full проходять із незмінним змістом. Baseline зараз 2/13/38; нові необхідні scenarios
можуть збільшити кількість перевірок, але видалення live checks не входить у цю задачу.

**SC-004.** Game-cycle stdout залишається
`7b9baea38feaa4b550e20bc2d22d5eed7875a8c7fb6f3fdf9e176ddf573ed5b6`;
save schema/key/bytes, public gameplay APIs та кадровий lifecycle незмінні.

**SC-005.** Browser load/reload обох native pages: 0 CSS/module 404, 0 console errors/new warnings,
UI інтеракції працюють; cold/warm stylesheet request count, transferred bytes і load completion
порівняні з baseline, будь-яке помітне погіршення досліджене до приймання.

**SC-006.** У production CSS dependency graph немає DEV styles; кожен retained stylesheet
має явних consumers і зрозумілого власника. Старі paths і порожні wrappers видалені після cutover.
Документація, shared CSS test reader і project structure відображають фінальну композицію.

## Definition of done

Завдання завершене після виконання [tasks.md](tasks.md), visual/cascade parity, checks і записаного
приймання на одному stable source snapshot. Окремий commit/release decision фіксується за чинним
процесом проєкту. Підготовка цього ТЗ не означає, що CSS уже реструктуризовано.

Пов'язаний аудит: [Stage 7 post-closure audit](../../docs/audits/2026-10-08-stage7-post-closure.md).

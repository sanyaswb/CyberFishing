# Spec 177 — Гіперпосилання з модулів Overlay у параметри DevTools з розкриттям і підсвічуванням

Статус: 2026-11-13 — реалізовано `TK-296` (`v0.50.107`), `TK-296.1` (`v0.50.108`) та `TK-296.2` (`v0.50.110`), спільну інфраструктуру гіперпосилань, оновлений стиль заголовків/посилань і перше застосування в модулі «ПОГОДА Й ХВИЛІ» перевірено автоматичними тестами; чекає візуальної перевірки власника в браузері.
Правила: AGENTS.md, DEVELOPMENT_RULES.md (одна відповідальність, композиція, DEV не в production), DESIGN_RULES.md, docs/styles.md, utils/UTILS_RULES.md.

## 1. Запит власника (2026-11-13)

«чудово тепер тільки для цього модуля але заклади логіку і для майбутніх, потрібно в overlay текст зробити як посилання (гіппер) при натисканні відкривається devtools розкривається параметр який відповідає за параметр який натиснуто і підсвічується зеленим».

## 2. Поточний стан (`v0.50.106`)

- Оверлей-модулі (`src/dev/overlay/modules/*`) виводять текст через `OverlayHtmlBuilder.plainRow(...)` / `metricRow(...)`; `metricRow` лише показує локальний тултип формули, але не відкриває відповідне налаштування у DevTools.
- `DevToolsUI` (`src/dev/tools/dev_tools_ui.js`) уже позначає рядки та секції атрибутом `data-devtools-path` через `#assignDevToolsPath(element, path)`, а `DevToolsDependencyFeedback` (`src/dev/services/dev_tools_dependency_feedback.js`) уміє розгортати згорнуті предківські секції `.devtools__section-content`, прокручувати до рядка й тимчасово підсвічувати рядок-блокувальник червоним (`.devtools__row--blocked-prerequisite`).
- Деякі елементи керування у `WeatherDevSection` (`сила дощу, %`, `сила грози, %`, `сила туману, %`, `напрям вітру`, `⚡ Удар блискавки зараз`) ще не мали `path` для адресації.

## 3. Рішення та модель

### D1. Позначення гіперпосилань в Overlay (спільне для всіх модулів)
1. `OverlayHtmlBuilder.devLink(label, devtoolsPath, { extraClass } = {})` та проксі `OverlayModule.devLink(...)`:
   - Генерує `<button type="button" class="debug-overlay__dev-link" data-overlay-control="devtools-link" data-overlay-activate="release" data-devtools-path="...">...</button>`.
   - `OverlayHtmlBuilder.plainRow(label, value, options = {})` також приймає `options.devtoolsPath` (обгортає екрановану назву рядка у `devLink`) та `options.labelHtml` (дозволяє вкласти кілька посилань в одному рядку, наприклад діапазон значень `штиль ×… … вітер ×…`).
2. Активація на відпусканні (`data-overlay-activate="release"`):
   - Не запускає перехід при початку скролу пальцем або при спробі перетягнути вікно (`OverlayWindowDragController.#isInteractiveTarget` уже ігнорує `button` та `[data-overlay-control]`).
   - Підтримує клавіатурну активацію (`Enter`/`Space`) і не перемикає батьківський `<summary>` (працює `preventDefault()` + `stopPropagation()`).
3. Візуальний стиль (`.debug-overlay__dev-link`, `.debug-overlay__heading`, `.debug-overlay__title` у `overlay-content.css` і `overlay.css`, оновлено у `TK-296.1`):
   - Скинута кнопка без рамки й фону в спокої, успадкований шрифт, без підкреслень і пунктирних ліній (`text-decoration: none`), колір `--ui-info`; при hover (лише `.ui-surface--desktop-hover`) / active / `:focus-visible` — заокруглена плашка `--ui-control-hover-background` і колір `--ui-text`.
   - Розділювач `.debug-overlay__divider` без `dashed`; заголовки оверлею (`.debug-overlay__heading`, `.debug-overlay__title`, підзаголовки й `<summary>`-групи) без нижнього підкреслення, із фоном і заокругленими краями (`--ui-radius-panel` / `--ui-radius-control`).

### D2. Маршрутизація події (`OverlayInteractionBridge` -> композиція -> `DevTools`)
- `OverlayInteractionBridge` приймає опцію `onRevealDevToolsParameter = null`.
- У `#handlePointerUp` та `#handleClick` для `data-overlay-control="devtools-link"` викликає `this.#onRevealDevToolsParameter?.(control.getAttribute("data-devtools-path"))` (існуючі `data-overlay-activate="release"` дії з `actions[controlType]` зберігаються без змін).
- `createDebugOverlayRuntime` (`debug_overlay_bootstrap.js`) приймає опційний `revealDevToolsParameter = null` і передає його у міст; `development_game_startup.js` зв'язує `(path) => devTools?.revealParameter?.(path)`.

### D3. Відкриття, розкриття та зелене підсвічування у `DevTools`
1. `DevToolsUI` веде індекс підключених рядків і секцій за `data-devtools-path` (`#pathRows`, `#pathSections`), очищає його у `clearValueBindings()` та `releaseValueBindings()`.
2. `DevTools.revealParameter(path)`:
   - Відкриває панель (`this.open()`), якщо вона закрита.
   - Делегує `this.#ui.revealPath(path)`.
3. `DevToolsUI.revealPath(path)`:
   - Обирає цільовий елемент (перевага спеціалізованим секціям над загальним деревом `CONFIG`, щоб `CONFIG.canvas.water.*` розкривався у `🖼️ СЦЕНА WebGL → water`, поруч із `🌧 ПОГОДА`). Якщо точного рядка немає, шукає секцію або найдовший префікс шляху.
   - Проходить по всіх батьківських `.devtools__section-content` та розкриває кожну згорнуту секцію кліком по її заголовку (зберігаючи стан розкриття у `dev_tools_sections_state`). Якщо ціль сама є `.devtools__section`, розкриває її теж.
   - Передає цільовий елемент у `DevToolsDependencyFeedback.showRevealed(elements)` (із легким фолбеком у `DevToolsUI`, якщо `dependencyFeedback` відсутній або не має методу): знімає попереднє зелене підсвічування, додає `.devtools__row--revealed`, прокручує рядок у видиму область (`scrollIntoView({ block: "center" })`) і знімає підсвічування за таймером (`durationMs`, а також при закритті панелі, перебудові чи новому переході).
4. CSS (`.devtools__row--revealed` у `dev-tools.css`):
   - `outline: 2px solid var(--ui-success); outline-offset: -2px; border-radius: var(--ui-radius-control); background: rgba(var(--ui-success-rgb), 0.14);`.

### D4. Посилання у модулі «ПОГОДА Й ХВИЛІ» (`WeatherOverlayModule`)
- `WeatherDevSection` додає `path` до елементів керування (`WEATHER.controls.rainStrength`, `stormStrength`, `fogStrength`, `windDirection`, `strike`).
- `WeatherOverlayModule` робить клікабельними посиланнями:
  - `Опади` → `WEATHER.controls.storm` (у грозу) / `WEATHER.controls.rain`
  - `Гроза 0…1` → `WEATHER.controls.stormStrength`
  - `Дощ 0…1` → `WEATHER.controls.rainStrength`
  - `Туман 0…1` → `WEATHER.controls.fogStrength`
  - `Вітер` та `Сила вітру 0…1` → `WEATHER.controls.windDirection`
  - `Ніч 0…1` → `CONFIG.spawns.timePhases.night.startHour`
  - `Хвилі` (коли вимкнено) → `CONFIG.canvas.water.waves`
  - `Амплітуда хвиль` та `База (з арту)` → `CONFIG.canvas.water.amplitude`
  - `Довжина хвиль` та `База (з арту)` → `CONFIG.canvas.water.wavelength`
  - `Швидкість хвиль` та `База швидкості` → `CONFIG.canvas.water.speed`
  - `Загальний множник` (у трьох групах хвиль) → `CONFIG.canvas.water.seaState.enabled` (а під час плавного переходу також посилання на `CONFIG.canvas.water.seaState.smoothingSec` або на `enabled`/`smoothingSec`)
  - Підпункти множників:
    - `Вітер: висота` → активний режим (`calmAmplitude` / `windAmplitude`), плюс окремі гіперпосилання на `штиль ×…` (`CONFIG.canvas.water.seaState.normal.calmAmplitude`) і `вітер ×…` (`CONFIG.canvas.water.seaState.normal.windAmplitude`)
    - `Ніч: затихання` → `CONFIG.canvas.water.seaState.normal.nightAmplitude`
    - `Гроза: штормовий підйом` → `CONFIG.canvas.water.seaState.storm.amplitude`
    - `Гроза: розтяг хвилі` → `CONFIG.canvas.water.seaState.storm.wavelength`
    - `Вітер: прискорення` → `CONFIG.canvas.water.seaState.normal.windSpeed`
    - `Гроза: штормове прискорення` → `CONFIG.canvas.water.seaState.storm.speed`
  - `Блискавок` → `WEATHER.controls.strike`

## 4. Перевірки
- Автоматичні:
  - Розширення `weather-check.js` (наявність `data-overlay-control="devtools-link"` та коректних `data-devtools-path` у `WeatherOverlayModule`, перевірка кліку через `OverlayInteractionBridge` з кількома вікнами й всередині `<summary>` без згортання).
  - Розширення `devtools-controls-check.js` / `overlay-balance-windows-check.js`: `DevTools.revealParameter(path)` / `DevToolsUI.revealPath(path)` відкриває закриту панель, розгортає вкладені згорнуті секції, обирає спеціалізовану секцію сцени перед загальним `CONFIG`, підсвічує рядок класом `.devtools__row--revealed` і знімає підсвічування по таймеру або при закритті панелі.
  - `css-usage`, `config-runtime`, повний `node utils/run-checks.js`.
- Перевірка власника в браузері (візуально агентом не перевірялося).

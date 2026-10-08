# План: Presentation CSS restructure

Статус: виконано. Канонічні вимоги: [spec.md](spec.md); фактичне приймання:
[results.md](results.md), фінальні owners/order: [ownership.md](ownership.md).

## 1. Зафіксувати візуальний і каскадний baseline

Перевірити актуальний commit/робоче дерево. Перерахувати stylesheet links і CSS rules,
at-rule nesting, selectors, declaration order, variables, keyframes та DOM writers.
Доповнити baseline метриками inline/injected styling; розділити static appearance і dynamic data writes.

Побудувати source rule → owner file mapping і список cascade conflicts перед grouping
non-contiguous blocks. Окремо врахувати спільні scrollbar/disabled/surface rules,
tooltip inheritance, named container і reduced-motion rules. Зберегти baseline screenshots,
computed-style/geometry samples та cold/warm loading measurements для матриці у spec.

Результат: перевірена ownership map, рекомендований dependency/load order і відтворювані
визначені UI-сценарії. Візуальний baseline не підміняється game-cycle check.

## 2. Винести DEV styling

Виділити `.devtools-*`, `.switch`, `.slider` у `src/dev/styles/dev-tools.css`.
Підключити тільки `dev.html`, зберегти panel geometry, animation, switch/inputs/scrollbars.
Game shell та badge залишаються production assets. Перевірити, що class/selector families
не використовуються production UI; не змінювати DEV overlay installer у цьому checkpoint.

Приймання: game/DEV browser samples, CSS usage/architecture, відсутність DEV CSS request у production.

## 3. Розділити inventory CSS

Перенести правила за погодженою ownership map, зі збереженням declarations і cascade winners.
Почати з cohesive blocks; shared rules мають одного власника. Не створювати duplicated selector
groups у різних компонентах. Динамічні class/custom-property contracts і JS writers не змінюються.

Використати explicit ordered HTML links як початковий варіант композиції. Якщо обрано інший
варіант, записати reason, dependency graph і load measurements. За кожним checkpoint перевірити
CSS rule inventory та представницькі computed styles; за фінальним — повну visual matrix.

## 4. Перевести CSS checks на реальну композицію

Спільний test reader виводить список stylesheets із `index.html`/`dev.html`, резолвить query-free
project-local paths, перевіряє existence/load order/duplicate loads. Це маленький read-only helper
для наявних шести checks, без runtime manifest або нової системи build.

Перенести старі literal filenames у цей reader, зберегти meaning кожної assertion. Додати
негативні fixtures для missing stylesheet, duplicate load, невідомого class і DEV stylesheet
у production. Усі retained styles охоплені checks; injected style scope записаний явно.

## 5. Cutover, cleanup і приймання

Видалити monoliths/wrappers лише після переходу всіх HTML/test consumers. Перевірити `rg`
на старі paths, CSS dependencies, випадковий DEV load, недосяжні files, залишкові inline duplication.
Оновити docs/architecture і Git-tracked project structure за фінальними paths.

Focused checks → Architecture → Quick → Full → game-cycle SHA256 → browser/visual matrix
→ network/reload measurements. Зафіксувати фактичні результати, source snapshot, browser/viewport,
будь-які masks і залишені out-of-scope improvements. Після приймання окремий factual commit;
release/push за чинною авторизацією, без повторного відкриття Stage 7.

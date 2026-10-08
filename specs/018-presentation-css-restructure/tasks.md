# Задача 018: Presentation CSS restructure

**Статус: виконано.** Результат: [results.md](results.md); owners/order: [ownership.md](ownership.md).
Вимоги: [spec.md](spec.md). Порядок: [plan.md](plan.md).

## A. Аудит і baseline

- [x] A1 Перевірити фактичні два stylesheet paths, метрики, HTML links, CSS test consumers,
  media/keyframes/container queries та наявність DEV rules у production stylesheet.
- [x] A2 Перед реалізацією перевірити новий HEAD/status і актуальність baseline hashes.
- [x] A3 Зафіксувати повну selector/declaration/context → DOM writer → target owner карту.
- [x] A4 Зафіксувати shared rules, conflicts/order constraints, variables/inheritance і animation owners.
- [x] A5 Зняти screenshots, computed styles/geometry/pseudo-elements і cold/warm network baseline
  для однакових data/state/viewport/environment сценаріїв.

## B. Production/DEV ownership

- [x] B1 Винести DEV Tools CSS у `src/dev/styles/`; лише `dev.html` його підключає.
- [x] B2 Розділити game shell і version badge за фактичними responsibility boundaries.
- [x] B3 Перевірити DEV panel/toggle/focus/scroll, production shell і stacking/fade states.

## C. Inventory component styles

- [x] C1 За погодженою картою розділити theme, modal/header, loadout, slots, cards, resource meters,
  attachments, assembly, parameters, list/filter/sort і tooltip styling.
- [x] C2 Зберегти declarations, specificity, conflict order, pseudo-elements і custom-property contracts.
- [x] C3 Перенести всі keyframes, viewport/reduced-motion rules і named container/query без дублювання.
- [x] C4 Визначити explicit native CSS load order обох сторінок і cache/version policy всіх нових paths.
- [x] C5 Перевірити representative visual/cascade parity після кожного cohesive checkpoint.

## D. Checks і cutover

- [x] D1 Один невеликий read-only test reader для actual HTML CSS composition і шести чинних consumers.
- [x] D2 Перевести css-usage/inventory-ui/rarity/condition/progression/degradation checks на нову композицію.
- [x] D3 Зберегти assertions і negative fixtures; перевірити missing/duplicate links і DEV CSS у production.
- [x] D4 Видалити старі monolith files/wrappers після переходу всіх consumers; `rg` і reachability proof.
- [x] D5 Оновити architecture docs та tracked project structure.

## E. Приймання

- [x] E1 Повна visual matrix spec: обидві сторінки, breakpoint/container boundaries, focus/state/pseudo,
  rarity/resources/attachments, tooltip outside modal, animations і reduced motion, DEV tools/overlay.
- [x] E2 Before/after computed styles/bounding boxes і screenshots із явно записаними noise masks.
- [x] E3 Focused checks + Architecture + Quick + Full; live checks не видаляються/не послаблюються.
- [x] E4 Незмінний game-cycle stdout SHA256, save schema/key/bytes і кадровий lifecycle.
- [x] E5 Browser cold/warm load/reload: no asset 404/errors/new warnings; network metrics порівняні.
- [x] E6 Зафіксувати evidence на одному stable snapshot, final owners/paths і out-of-scope залишки.
- [x] E7 Factual commit та погоджений release checkpoint після приймання; Stage 7 не відкривається повторно.

Примітки приймання: reduced-motion rule bodies перевірені forced fixture queries;
local HTTP cache має no-store, тому network evidence — first navigation/reload, без заяви про warm HTTP cache.
Overlay drag fixture використовує окремий position key та hold 1ms; production timing незмінний.
E7: factual commit/push без нового release/tag; package version залишається 0.30.1.

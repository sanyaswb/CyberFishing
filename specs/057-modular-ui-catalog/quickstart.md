# Validation guide: UI-каталог

Каталог та спільний UI surface adapter реалізовані. Відкрити після `npm run dev`: [UI catalog](http://127.0.0.1:4173/ui-catalog.html). 4173 — default port; `--port`/`PORT` можуть його змінити. Каталог використовує реальні production renderers і memory fixtures без live saves/game/care clock.

У `dev.html` відкрити ⚙️ DevTools → **Каталог UI 🧩**. Каталог відкривається поверх зупиненої
гри; **← До DevTools** закриває його й відновлює ту саму сесію та фокус контролу відкриття.
House/каталог мають один active embedded frame; previews каталогу не отримують live House data.

## Preparation

Прочитати [DESIGN_RULES](../../DESIGN_RULES.md), [spec](spec.md), [plan](plan.md), [contracts](contracts/ui-components.md). Перевірити source consumers та coverage FR-002 до extraction. Використати підтримувані Node.js/npm і залежності репозиторію; новий frontend build не потрібний.

## Automated checks after implementation

```powershell
node utils/checks/ui/ui-catalog-check.js
node utils/checks/ui/ui-components-check.js
node utils/checks/ui/ui-surface-check.js
node utils/checks/inventory/keepnet-check.js
node utils/checks/ui/inventory-ui-check.js
node utils/checks/items/degradation-color-check.js
npm run check:architecture
npm run check:quick
npm run check
```

## Automated evidence — 2026-10-14

| Check | Result |
| --- | --- |
| Focused UI components, catalog, surface, Inventory, Keepnet, House, feed picker | PASS |
| `npm run check:architecture` | 4/4 PASS |
| `npm run check:quick` | 25/25 PASS |
| `npm run check` | 51/51 PASS |
| CSS usage | 32 native linked stylesheets, BEM/version/ownership/reachability/pointer policy; 18 negative fixtures rejected |
| Architecture | Production→DEV forbidden; module/layer/host/cycle rules; 22 negative fixtures rejected |
| Game cycle | Existing tracked baseline passed; no rebaseline |
| Inventory save round trip / fresh inventory | PASS; schema2/3 upgrade bytes remain identical and fresh current-format bytes match existing fixture |
| Pages packaging | v0.35.0 committed HEAD: 770 files / 669 modules; House/catalog closure and room assets PASS; packaged console smoke clear |
| DevTools catalog navigation | Injected menu action, one embedded House/catalog frame, trusted return, same-session resume, focus restoration and disposal PASS |
| `git diff --check` | PASS |

Focused surface checks cover 240/280/319/320/740/1280px, scale1/0.875/0.75 and restoration, physical/logical pointer/rect/delta conversion, safe-area, zero/hidden measurements, portal/scroll footprint, drag save string schema, depth input, outcome visibility and disposal. Catalog controls offer 240/280/319/320/640/740/960/1280px; the widest option allows desktop hover when the actual available preview width exceeds1024px and the device policy permits it. Actual HouseView/feed picker fixtures cover stock/reading changes with retained nodes/images, focus, Escape, quantity consumption and repeated mount/dispose. Production gameplay/domain/application/config and baseline files are unchanged.

Browser/visual smoke was **not performed**: the owner instruction in [spec.md](spec.md#assumptions) says “автоматична перевірка браузером у цьому чаті не дозволена”. Automated DOM/geometry checks do not establish visual clipping, device touch feel or final aesthetic acceptance. T028 remains unchecked for owner acceptance.

Owner follow-up on2026-10-14: mobile region overlap and resize work are tracked in tasks T030–T036 and the [corrective audit](../../docs/audits/2026-10-14-inventory-resize.md). The orchestration now coalesces viewport resize before an ordinary update; this supersedes the initial iteration's note that Application files were untouched. Gameplay formulas and save boundaries remain unchanged.

Touch-interaction follow-up: hover and decorative press states use the single surface policy from
[DESIGN_RULES.md](../../DESIGN_RULES.md#10-states-accessibility-and-motion). Focused checks cover
1024/1025px, portrait, coarse input, touch laptops with fine pointers, capability changes, hint
dismissal and listener disposal. Hover is available only on a wide landscape desktop without touch;
UI/catalog roots suppress browser tap highlighting. Keyboard focus and selected states remain.

## Owner visual acceptance after implementation

Запустити `npm run dev`, відкрити `http://127.0.0.1:4173/ui-catalog.html`. Не виконувати автоматичну browser-перевірку всупереч вказівці власника.

1. Знайти кожне FR-002 сімейство, source, default і застосовні стани; не додавати вигадані production states.
2. Перевірити keyboard/focus/Escape/help, switch A/count, close cross, placeholders/selected assets, disabled/error.
3. Перевірити meter 0/1/34/67/100, remaining color parity, occupancy inversion і HUD tension parity.
4. Змінити shared token та порівняти close у каталозі, інвентарі й садку; зовнішні позиції визначають containers.
5. Змінити реальну preview width/viewport: 740/320/319/280/240px. На mobile inventory чотири колонки, keepnet дві; нижче 320 немає нового wrap/order, scale 0.875/0.75.
6. Перевірити square/portrait/wide assets: rod 9:16; keepnet visual мінімум квадрат і росте для portrait, іконка не обрізана.
7. На 280/240px перевірити click/drag, horizontal scroll, tooltips/portals/fixed, safe-area і low-height vertical scroll; повернутись до 320, повторити open/close/dispose.
8. Порівняти saves до/після каталогу: без змін. Real gameplay timers/stock/progress не запускаються previews.
9. Перевірити відсутність hover/фону натискання на mobile, планшеті, portrait і сенсорному ноутбуці з мишею; desktop landscape понад1024px без touch зберігає hover. Перевірити1024/1025px, поворот екрана, закриття відкритої hover-підказки та видимий keyboard focus.

Реалізація каталогу та наступні UI/House зміни включені у v0.35.0 за запитом власника на commit/push від 2026-10-14. Committed HEAD release check перевіряє пакування джерел; console-only smoke перевіряє запуск index/DEV/House/catalog. Публікація GitHub Pages і особисте візуальне приймання мають окремий статус.

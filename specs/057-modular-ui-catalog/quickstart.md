# Validation guide: UI-каталог

Каталог і scale adapter **ще не реалізовані**. Guide визначає приймання наступної ітерації; наведена URL зараз не є готовою сторінкою.

## Preparation

Прочитати [DESIGN_RULES](../../DESIGN_RULES.md), [spec](spec.md), [plan](plan.md), [contracts](contracts/ui-components.md). Перевірити source consumers та coverage FR-002 до extraction. Використати підтримувані Node.js/npm і залежності репозиторію; новий frontend build не потрібний.

## Automated checks after implementation

```powershell
node utils/ui-catalog-check.js
node utils/ui-surface-check.js
node utils/keepnet-check.js
node utils/inventory-ui-check.js
node utils/degradation-color-check.js
npm run check:architecture
npm run check:quick
npm run check
```

Перші два checks додаються під час реалізації, а не удавано запускаються зараз. Очікується coverage component/state registry, real renderer/style/resolver identities, zero save/game-command access, disposal та scale/coordinate contracts. Наявні baseline/save checks проходять без зміни очікуваних даних.

## Owner visual acceptance after implementation

Запустити `npm run dev`, відкрити `http://localhost:4173/ui-catalog.html`. 4173 — default DEV port; врахувати його перевизначення. Не виконувати автоматичну browser-перевірку всупереч вказівці власника.

1. Знайти кожне FR-002 сімейство, source, default і застосовні стани; не додавати вигадані production states.
2. Перевірити keyboard/focus/Escape/help, switch A/count, close cross, placeholders/selected assets, disabled/error.
3. Перевірити meter 0/1/34/67/100, remaining color parity, occupancy inversion і HUD tension parity.
4. Змінити shared token та порівняти close у каталозі, інвентарі й садку; зовнішні позиції визначають containers.
5. Змінити реальну preview width/viewport: 740/320/319/280/240px. На mobile inventory чотири колонки, keepnet дві; нижче 320 немає нового wrap/order, scale 0.875/0.75.
6. Перевірити square/portrait/wide assets: rod 9:16; keepnet visual мінімум квадрат і росте для portrait, іконка не обрізана.
7. На 280/240px перевірити click/drag, horizontal scroll, tooltips/portals/fixed, safe-area і low-height vertical scroll; повернутись до 320, повторити open/close/dispose.
8. Порівняти saves до/після каталогу: без змін. Real gameplay timers/stock/progress не запускаються previews.

Commit/publishing виконується лише після дозволу власника в наступній ітерації. Поточний check committed Pages packaging не доводить наявність майбутнього каталогу в релізі.

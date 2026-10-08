# Результат 018

Виконано 2026-10-08 на базі `d065f0c` (0.30.1), після cleanup checkpoint `67da207`.
Авторизація — доручення власника самостійно виконати follow-up задачі. Package version,
release tag, gameplay/config/save APIs та module entries не змінено.

## Реалізація

- Два monolith stylesheets замінено 15 production modules та одним DEV module.
  Найбільший файл — `list-and-filters.css`, 5 280 bytes замість 39 843-byte inventory monolith.
- DEV rules більше не завантажуються production. Обидві HTML pages явно композують
  однаковий production prefix; DEV stylesheet завантажується після нього.
- 250 CSS blocks зберегли точний authored text і початковий порядок усередині owner.
  Повна карта, source hashes і DOM writers — [rule-map.json](rule-map.json),
  cascade/load contract — [ownership.md](ownership.md).
- Шість CSS checks переведені на actual HTML composition. Assertions збережено;
  usage guard охоплює 16 linked stylesheets, два retained injected blocks і 249
  class-selector occurrences. Unknown class та п'ять invalid-link fixtures відхиляються.
- Старі `style.css`/`inventory.css` видалені після переходу consumers. Порожній
  `devtools-styles` placeholder та його єдиний creator видалені. Існуючі meaningful
  inline styles/overlay installer залишилися; нових runtime mechanisms немає.

## Visual/browser evidence

Перевіряв Codex у **Codex In-app Browser (Chromium)** через `computer-use`/CUA,
localhost port 4188. Це не окремий ручний Chrome smoke користувача.
Baseline authored CSS і native pages збережені до cleanup; current CSS — фінальна композиція.

39 unique deterministic fixture scenarios мають 0 differences: widths 1280,
1181/1180/1179, 821/820/819, 521/520/519, 390; independently constrained named container
521/520/519 at viewport 1280; default/empty/loadout/saved/assembly/tooltip, shell closed,
victory hold/release, scroll, DEV panel, reduced-motion branches. Fixtures використовують
captured native DOM і реальні production renderers/DOM adapters з однаковими DTO.
Перевірені rarity/glow, metadata-free cards, condition/resource/line meter, attachment placements,
long press, open filters/sort, selected/compatible/locked/disabled/highlight/warning states,
tooltip outside modal, positive/negative/neutral details та one/two/three parameter sections.

Кожен sample порівнює 128 explicitly requested authored/contract computed properties,
normal/`::before`/`::after`, bounding boxes, scroll dimensions і CSSOM rule multiset.
У DEV sample scope — 64 visible DEV nodes; приховані секції не видаються за перевірені
computed samples. First-pass CSS property enumeration виявила обмеження browser reader
і була доповнена explicit-property pass для всієї матриці.

Окремі keyboard-focus input/card та mouse-hover card comparisons — 0 differences.
Реальні `OverlayDomAdapter`, `OverlayScaleControls`, `OverlayWindowDragController`
у browser fixture після native pointer drag перемістилися з (10,805) до (110,705),
після `+` отримали scale 1.1, before/after styles/geometry збіглися. Fixture має власний
disposable position key та hold 1ms для стабільного native drag; production hold timing
не змінено. Test-only pointer trace виключено зі scope цього comparison.

Сім screenshot pairs (assembly desktop/mobile/reduced, default desktop, saved mobile,
tooltip desktop, DEV desktop) перевірені Sharp: **0 different pixels, masks: none**.
Game Canvas не є частиною цих deterministic UI fixtures. Анімації sampled у 500ms.
Reduced-motion rule bodies перевірено forced media-query fixture copies; OS-level
preference не перемикалася. Незмінність production media text підтверджена rule hashes.

Actual native `index.html`/`dev.html` після cutover/reload: world/version badge,
inventory open/close, по 20 cards після reload; DEV panel open/close, visible switch,
input focus і live overlay interval 150→151→150 працюють. Production має 15 CSS links,
DEV — 16; порожніх style nodes немає. CSS assets завантажилися; console errors/warnings:
**0/0** на native pages та network fixture.

Локальні raw JSON/screenshots/test fixtures — `.git/codex-followup-018/` і
`utils/tmp/css018/` (не shipped source). Screenshot результату native production:
`browser-production-final.png`; DEV — `browser-dev-final.png` у evidence directory.

## Завантаження: виміряний компроміс

Browser Resource Timing, native page у 1280×720 iframe, перший navigation/reload.
Local server віддає `Cache-Control: no-store`; reload прогріває процес/filesystem,
**не є warm HTTP cache**. Це вісім локальних samples, не remote performance benchmark.

| Page / snapshot | CSS requests | Body bytes | Transfer bytes | CSS completion, first/reload ms |
| --- | --- | --- | --- | --- |
| Production baseline | 2 | 43 608 | 44 208 | 19.5 / 19.0 |
| Production current | 15 | 41 669 | 46 169 | 35.5 / 28.3 |
| DEV baseline | 2 | 43 608 | 44 208 | 18.5 / 18.5 |
| DEV current | 16 | 44 596 | 49 396 | 29.0 / 29.9 |

Request/header overhead зріс через explicit component links; CSS completion у цих samples
пізніший на 9–16ms. Production body bytes зменшилися завдяки DEV isolation; DEV body
трохи більший через owner comments/spacing. Немає import waterfall, duplicate loads або
нового JS scheduling. Цей tradeoff зафіксовано: задача покращує ownership, а не обіцяє
network speedup. Вплив на remote cold load не виміряний; build/bundle system не вводилася.

## Regression acceptance

Focused CSS/inventory/rarity/condition/progression/degradation checks, Architecture **2/2**,
Quick **13/13**, Full **38/38**. Guards/assertions не послаблено; 19 architecture negative fixtures.
Source graph: 572 modules; production 463 / 654 imports, DEV 569 / 839 — без змін.

Game-cycle stdout: 11 907 bytes, SHA256
`7b9baea38feaa4b550e20bc2d22d5eed7875a8c7fb6f3fdf9e176ddf573ed5b6`.
Schema 2/3 byte-identical upgrade/round trips, current schema 4 та key
`fishing_game_player_inventory_v2` збережено. Native bootstrap/loop/dispose checks проходять.
Pre-existing Node `MODULE_TYPELESS_PACKAGE_JSON` warning у config-runtime лишається;
browser warnings відсутні. Root package module mode не змінювався через CJS utilities.

## Closure

018 і 019 завершені. Classic-to-ESM migration/Stage 7 залишаються закритими.
Live inventory/event/overlay bridges є поточними contracts, а не classic transport;
save migrations і manual/test diagnostics retained за consumer review 019.
Static inline appearance та Canvas decomposition — можливі окремі improvements, не
залишені обов'язкові кроки цієї міграції. Factual commits/push без нового release/tag.

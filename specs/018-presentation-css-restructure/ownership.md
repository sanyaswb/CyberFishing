# CSS ownership і порядок композиції

Реалізовано 2026-10-08. Канонічна карта кожного початкового rule, його рядка, SHA256,
фінального файлу та фактичних DOM writers: [rule-map.json](rule-map.json).
Усі 250 top-level blocks перенесені без зміни authored text, включно з declarations,
selectors, pseudo-elements, nested queries та keyframes. Це evidence переходу, а не
заборона майбутніх погоджених змін вигляду.

## Файли та load order

HTML є composition root CSS. `index.html` завантажує перші 15 файлів цієї таблиці;
`dev.html` — ті самі 15 у тому самому порядку, потім DEV stylesheet. Немає `@import`,
runtime manifest, barrel/wrapper CSS або build step. Кожен link має `?v=0.30.1`;
під час наступного release query усіх links оновлюється разом із package version.

| Порядок | Файл у `src/game/presentation/styles/` | Відповідальність |
| --- | --- | --- |
| 1 | `game-shell.css` | body/canvas, victory stacking, scouting fade |
| 2 | `version-badge.css` | version badge |
| 3 | `inventory/modal.css` | theme scope, backpack/modal lifecycle, layout, shared panel surfaces |
| 4 | `inventory/header.css` | equipment summary, auto settings, close control |
| 5 | `inventory/shared-controls.css` | warning, disabled actions, shared scrollbars |
| 6 | `inventory/loadout.css` | equipped/saved loadout, save action |
| 7 | `inventory/slots.css` | fields, empty/locked/highlighted sockets, compatible pulse |
| 8 | `inventory/item-cards.css` | cards, metadata, rarity pulse, long-press feedback |
| 9 | `inventory/resource-meters.css` | resource track/fill/icon variants |
| 10 | `inventory/attachments.css` | attached item badge placement |
| 11 | `inventory/assembly-editor.css` | assembly workspace, named container, actions |
| 12 | `inventory/item-parameters.css` | sections, bars, segments, bait effectiveness, container query |
| 13 | `inventory/list-and-filters.css` | categories/subfilters/sort, selection, grid |
| 14 | `inventory/tooltips.css` | tooltips outside modal, balance details, tooltip rarity pulse |
| 15 | `inventory/responsive.css` | viewport breakpoints and reduced-motion overrides |
| DEV 16 | `src/dev/styles/dev-tools.css` | DEV panel, editor inputs, switches, scrollbars |

Theme не має окремого файлу: його root/modal declarations відповідають життєвому циклу
modal та займають малий cohesive block. Реальні shared consumers виправдовують окремий
`shared-controls.css`; їхні rules не скопійовані в кожен компонент.

## Cascade та contracts

- Усередині кожного owner збережено початковий відносний порядок правил. Non-contiguous
  loadout/cards/tooltips/shared sections згруповано після consumer review. Same-target
  modifier rules залишаються після base rules; порядок declarations незмінний.
- Modal panel-surface defaults завантажуються до loadout/assembly/list component overrides.
  Shared disabled actions не змінюють base geometry; їхня specificity вища за base button.
  Shared scrollbar rules мають того самого одного owner; component rules їх не перевизначають.
- Slots/card/resource/attachment families відповідають різним DOM nodes. Card metadata,
  long-press та rarity modifiers зберігають specificity/order у card owner. Named container
  оголошено в assembly owner до query у parameters owner.
- Viewport overrides на 1180/820/520 px та reduced motion завантажуються останніми серед
  production modules. Same-specificity overrides і їхній порядок залишаються такими, як
  у початковому inventory tail. DEV selectors не є production families.
- Root scrollbar variables залишаються на `:root`, modal theme — на `.inventory-modal`.
  Tooltip поза modal зберігає свої defaults/fallbacks та root scrollbar inheritance.
  Rarity/condition/resource/long-press custom properties і їхні JS writers не змінені.
- Три keyframes мають по одному owner: compatible pulse — slots, card rarity pulse — cards,
  tooltip rarity pulse — tooltips. Чотири game-shell `!important` збережено; нових немає.
- Cascade перевірено CSSOM inventory, 128 explicitly requested computed properties для
  normal/`::before`/`::after`, geometry/scroll samples і pixel comparisons; деталі та межі
  evidence — у [results.md](results.md).

## Правила подальших змін

Нові component rules додаються до відповідного owner; спільний rule має одного власника
з реальними consumers. Новий stylesheet потребує явного HTML link у правильному порядку,
актуального version query і перевірки обох native pages. Domain/Application не знають
CSS classes і не імпортують visual data.

`utils/testing/styles/page_stylesheet_reader.js` — read-only test reader реальних HTML links.
Він перевіряє local paths, existence, duplicates незалежно від query, owner boundaries,
однаковий production prefix у DEV, cache versions, відсутність `@import` і unlinked CSS.
Шість чинних CSS checks користуються цією композицією. CSS usage також читає два retained
static injected blocks: `OverlayStyleInstaller` і browser `EngineInterface`.

Inline styles/dynamic visual writes та overlay installer залишилися у чинному scope.
Порожній `devtools-styles` node видалено: він не мав rules або інших consumers.
Масове перенесення static inline appearance і Canvas decomposition потребують окремих задач.

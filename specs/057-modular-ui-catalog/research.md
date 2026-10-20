# Research: Модульний UI-каталог

**Date**: 2026-10-13. Дослідження виконано за локальним кодом без браузера; опис включає поточні незакомічені правки UI. Невирішених architecture-critical питань для плану немає; runtime extraction звіряється з актуальними consumers перед реалізацією.

## 1. Розміщення й джерело оформлення

**Decision**: Окрема DEV-сторінка з production-компонентами. Спільні UI renderers/styles у presentation, browser adapters у platform, composition у bootstrap; engine не змінюється.

**Rationale**: [DEVELOPMENT_RULES](../../DEVELOPMENT_RULES.md), [constitution](../../.specify/memory/constitution.md) та [docs/styles](../../docs/styles.md) уже задають ці межі. Загальність UI не дає права перенести CyberFishing DOM/state в engine. Чинні BEM-mix відокремлюють appearance від placement.

**Alternatives considered**: Каталог усередині `dev.html` має менше page-registration змін, але запускає гру. Static mockup дублює styles/markup. Framework/Storybook або schema-driven runtime додали б новий build і шар без поточної потреби.

## 2. Перевірені owners і споживачі

| Сімейство | Поточне джерело | Споживачі / висновок |
| --- | --- | --- |
| Close | `styles/modal-controls.css`, `ui-modal-close` | `InventoryHeaderRenderer`, `KeepnetUI`; CSS уже спільний, markup можна виділити без зміни ARIA/callback |
| Toolbar | `styles/hud/toolbar.css` | inventory, keepnet, platform GameControls/ChumControls; `fixed/bottom/right` треба відокремити від appearance |
| Auto switch | `inventory/inventory_header_renderer.js`, `styles/inventory/header.css` | bait/chum; checkbox `role="switch"`, кругла A, кількість/asset |
| DOM resource meter | `inventory/inventory_resource_meter_renderer.js`, `styles/inventory/resource-meters.css` | картки, parameters, keepnet; shared create/updateReading pattern |
| Degradation colors | `styles/degradation_color_resolver.js`, `visual/degradation_color_config.js` | resolver інжектується `GameCompositionRoot.#composeStyleResolvers`; occupancy задає `remainingPercent` |
| Canvas bars | `hud/hud_bar_renderer.js`, `hud/fight_status_bars_renderer.js`, `styles/hud_style_resolver.js`, `styles/three_band_gradient_color.js` | HUD; runtime `config.ui.hudStyles`, реальні gradients/statuses |
| Help | `keepnet/keepnet_ui.js`, `styles/keepnet.css` | локальні open/dismiss/Escape/focus contracts; extraction за реальним повторним використанням |
| Item/slot cards | `inventory/inventory_item_card_renderer.js`, `inventory/inventory_loadout_panel_renderer.js` | attachments/resource/condition/rarity/progression/tooltip/long-press; collaborators складає bootstrap |
| Keepnet cards | `keepnet/keepnet_card_renderer.js` | grouped/individual cards, fallback, countdown identity, actions |
| House/aquarium | `house/house_view.js`, `house/aquarium_fish_view.js` | view/control fixtures без persistence/care services |
| Shared tokens | `styles/tokens.css`, `styles/inventory/theme.css` | DOM values не є власником gameplay/config |

Шляхи presentation відносні до `src/game/presentation/`. Повний інвентар кожної родини є першим implementation-кроком; не створювати registry автоматичним скануванням CSS-класів.

## 3. Палітри шкал

**Decision**: Resource/condition/occupancy використовують `DegradationColorResolver`; occupancy safety — вільний залишок. Canvas tension preview використовує `HudStyleResolver` і `threeBandGradientColor`.

**Rationale**: Degradation config має stops 0/1/34/67/100, від critical-red до safe-green зі зростанням залишку. Tension має чинний blue/yellow/orange/red gradient. Каталог не додає третю схему й не приховано перекольоровує гру.

**Alternatives considered**: Кольори в CSS preview або копія stops у fixture створюють нового власника. Масова заміна HUD кольорів виходить за межу component extraction.

## 4. Native CSS і Sass-приклади

**Decision**: Зберегти native CSS, semantic custom properties і BEM-mix. Owner mixins визначають reuse/Grid/узгоджені breakpoints, а не вимогу встановити compiler.

**Rationale**: `docs/styles.md` записує CSS як authoritative source без SCSS build. Guard перевіряє linked assets, BEM, focus/font і static style injection.

**Alternatives considered**: Sass потребує окремого рішення й одного reproducible pipeline. Редаговані SCSS та generated CSS одночасно створюють двох власників.

## 5. Масштаб нижче 320px

**Decision**: Virtual DOM UI surface: `logicalWidth=max(320,physicalWidth)`, `scale=min(1,physicalWidth/320)`, `logicalHeight=physicalHeight/scale`. Єдиний origin, portal root та conversion; спочатку каталог, потім production consumers.

**Rationale**: `src/platform/browser/runtime/canvas_metrics_provider.js` задає фактичні viewport/canvas dimensions; `src/platform/browser/input/input_controller.js` читає фізичні `clientX/clientY`. Scale на `body` змішує координати й змінює containing block fixed controls.

Перевірені affected consumers:

- `src/platform/browser/dom/draggable_button.js`: rect/pointer проти CSS left/top/edge cache.
- `src/platform/browser/dom/horizontal_scroll_controller.js`: physical pointer delta проти logical `scrollLeft`.
- `src/game/presentation/inventory/inventory_tooltip_presenter.js`: body portal, physical anchor rect і layout tooltip size.
- `src/dev/overlay/dom/overlay_window_drag_controller.js`: overlay pointer/layout coordinates.
- `src/platform/browser/ui/depth_selector.js`: ratio через один rect і `clientY`; не застосовувати inverse scale двічі.

**Alternatives considered**: Окреме зменшення tokens не гарантує загальний scale. Неадаптований transform root робить UI видимим, але може лишити drag/portal/input неправильними. Зміна world/Canvas projection не належить DOM дизайну.

## 6. Контрольна ширина прикладів

**Decision**: Container-aware composition або isolated preview surface з явним layout mode. Компонент із viewport queries на етапі міграції перевіряти справжнім viewport і позначати це обмеження.

**Rationale**: Звуження demo-card не активує browser media queries. Напис "320px" без mobile layout був би неправдивим доказом адаптації.

**Alternatives considered**: Iframe дає власний viewport, але ускладнює lifecycle, focus, styles і scale. Використати лише коли реальний компонент інакше неможливо чесно оглянути, а не для кожного елемента.

## 7. Guards і побічні ефекти

**Decision**: Зареєструвати нову DEV page у guards, посилити negative fixtures. Fixtures memory-only; production reachability/whitelists не послаблювати.

**Rationale**: `utils/checks/architecture/architecture-check.js` має явні entry/page maps; `utils/testing/styles/page_stylesheet_reader.js` дозволяє три pages й DEV CSS лише для `dev.html`. `utils/build-pages-release.js` пакує явний перелік pages. Нову сторінку додати до контрактів без bypass.

**Alternatives considered**: Пропуск guard, inline module/CSS або full game bootstrap порушують межі й ізоляцію.

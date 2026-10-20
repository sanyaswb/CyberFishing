# Tasks: Модульні UI-компоненти та каталог патернів

**Input**: [spec.md](spec.md), [plan.md](plan.md), [contracts](contracts/ui-components.md), [DESIGN_RULES.md](../../DESIGN_RULES.md).

**Owner revision, 2026-10-13**: реалізацію каталогу й виправлення дизайну дозволено поточним запитом. Паралельні роботи мають окремих власників файлів. Історичні завершені specs не переписуються; gameplay, save bytes і таймери зберігаються.

## Phase 1: Audit and ownership

- [X] T001 Перевірити фактичних споживачів компонентів і CSS за `DESIGN_RULES.md`, `docs/styles.md`, `specs/055-live-bait-aquarium/tasks.md`, `specs/056-inventory-icon-design/spec.md`; записати поточні власники й невідповідності в `specs/057-modular-ui-catalog/coverage.md`.
- [X] T002 Визначити межі каталог DEV → production renderers, shared presentation components, browser surface; зберегти Canvas/world input поза масштабуванням у `src/bootstrap/production/game_composition_root.js`.

## Phase 2: Shared production components (US2)

- [X] T003 [US2] Виділити спільну кнопку в `src/game/presentation/ui/ui_close_button_renderer.js`; переєднати Inventory/Keepnet/House, зберегти callbacks, ARIA й очищення bindings.
- [X] T004 [US2] Виділити авторежим у `src/game/presentation/ui/ui_auto_switch_renderer.js` і `src/game/presentation/styles/auto-switch.css`; зберегти зелену/приглушену A, stock, зображення, checkbox/switch та контрольний варіант без stock/artwork.
- [X] T005 [US2] Відокремити розміщення toolbar від базового appearance в `src/game/presentation/styles/hud/toolbar.css`; додати застосовні focus/active/disabled стани й semantic tokens у `styles/tokens.css`.
- [X] T006 [US2] Усунути дублювання дій/close, tag/order selectors та `!important` у `src/game/presentation/styles/house.css`, `house/house_view.js`, `fisherman-house.html`; використати shared component properties.
- [X] T007 [US2] Виправити class-based styling, keyboard names/focus/reduced motion і вузьку панель у `src/dev/tools/dev_tools_ui.js`, `src/dev/styles/dev-tools.css`, `overlay.css`; прибрати глобальний transform усіх натиснутих кнопок у `styles/game-shell.css`.
- [X] T008 [US2] Замінити order-dependent parameter selectors явними BEM modifiers у `inventory/inventory_item_parameters_renderer.js`, `styles/inventory/item-parameters.css`, зі збереженням геометрії.

## Phase 3: Catalog and isolation (US1)

- [X] T009 [P] [US1] Додати `ui-catalog.html`, `src/entrypoints/dev/ui_catalog.entry.js`, `src/bootstrap/development/ui_catalog_bootstrap.js`; один module script, незмінний production CSS prefix та catalog-only layout.
- [X] T010 [P] [US1] Реєструвати explicit families/states/source metadata у `src/dev/ui_catalog/ui_catalog_definitions.js`; no CSS scanning, palette copies або universal runtime.
- [X] T011 [US1] Показати справжні close/switch/resource/Inventory/Keepnet renderers із memory fixtures у `src/dev/ui_catalog/`; збереження й ігрові команди недоступні.
- [X] T012 [US1] Перевикористати production house markup та `HouseView`, `AquariumFeedPicker`, `AquariumFishView` у `src/dev/ui_catalog/ui_catalog_house_example.js`; one-shot frame scheduler без care/game clock.
- [X] T013 [US1] Показати production DOM DepthSelector та Canvas `FightStatusBarsRenderer` у `src/dev/ui_catalog/ui_catalog_hud_example.js`; зберегти реальну кольорову логіку.
- [X] T014 [US1] Перевірити re-mount, callbacks, numeric node/image identity, focus/scroll й dispose через `utils/checks/ui/ui-catalog-check.js`, `utils/checks/ui/ui-components-check.js`.

## Phase 4: Meter semantics (US3)

- [X] T015 [US3] Замінити власну feed-gradient палітру House на injected `InventoryResourceMeterRenderer` + runtime `DegradationColorResolver` у `house/house_view.js`, `src/bootstrap/production/house_startup.js`.
- [X] T016 [US3] Нормалізувати лише graphical/ARIA fill 0..100 у `inventory/inventory_resource_meter_renderer.js`; accessible text лишає вихідне reading. Перевірити negative/over/missing values та п'ять кольорових меж у `utils/checks/ui/ui-components-check.js`, `utils/checks/ui/ui-catalog-check.js`.
- [X] T017 [US3] Зберегти occupancy count+hook reservation незалежно від фільтра й напрям safety як remaining free capacity у `keepnet/keepnet_ui.js`; перевірити `utils/checks/inventory/keepnet-check.js`.

## Phase 5: Logical surface and composition (US4)

- [X] T018 [P] [US4] Реалізувати `src/platform/browser/dom/ui_surface_adapter.js`, `styles/ui-surface.css`: physical/logical metrics, `logicalWidth=max(320,physicalWidth)`, `scale=min(1,physicalWidth/320)`, `logicalHeight=physicalHeight/scale`, safe-area, portals, zero measurement, flow footprint, resize coalescing/dispose.
- [X] T019 [US4] Переєднати DOM HUD, Inventory, Keepnet, House, DEV через bootstrap й narrow ports; масштаб не змінює Canvas/world input. Зберегти outcome stacking та DEV доступ у `styles/game-shell.css`.
- [X] T020 [US4] Перевести drag/scroll/tooltip/overlay deltas у logical units через інжектований port у `draggable_button.js`, `horizontal_scroll_controller.js`, `inventory_tooltip_presenter.js`, `overlay_window_drag_controller.js`; не змінювати save schema.
- [X] T021 [US4] Перевести responsive layout на named surface container queries та logical dimensions у `styles/inventory/*.css`, `styles/keepnet.css`, `styles/house.css`, HUD/DEV styles; великі композиції Grid, internal groups Flex.
- [X] T022 [US4] Закріпити чотири equal inventory item columns і дві keepnet columns, rod 9:16 та intrinsic portrait keepnet growth у production styles; нижче320 layout320 масштабується один раз.
- [X] T023 [US4] Усунути native top-layer quantity dialog scale escape; зберегти modal focus/Enter/Escape/restore у `house/aquarium_feed_picker.js`.
- [X] T024 [US4] Перевірити widths240/280/319/320/740/1280, pointer/rect/delta, safe-area, zero/restore, scrolling, drag string save boundary і disposal у `utils/checks/ui/ui-surface-check.js`.

## Phase 6: Guards and evidence

- [X] T025 Зареєструвати сторінку в `utils/checks/architecture/architecture-check.js`, `utils/testing/styles/page_stylesheet_reader.js`, `utils/checks/architecture/css-usage-check.js`; додати negative production→catalog, second-script та catalog-CSS-in-production fixtures без guard bypass.
- [X] T026 Додати packaging каталогу в `utils/build-pages-release.js` й focused working-tree closure evidence до `utils/checks/tooling/pages-release-check.js`; публікація/commit/push поза запитом.
- [X] T027 Виконати focused checks, Architecture + Quick + Full; звірити незмінний game-cycle та inventory-save output. Записати результати в `specs/057-modular-ui-catalog/quickstart.md`.
- [ ] T028 Візуальне приймання власником на 240/280/319/320px і desktop: proportions, long/error/empty states, keyboard, transformed hit areas, drag, touch scrolling, help/portal boundaries, repeated mount/close. У цьому чаті browser automation не дозволено `spec.md`; пункт не позначається виконаним автоматично.
- [X] T029 [US2] Виправити виявлені під час інтеграційного аудиту stale available/active/restoring класи вичерпаних зарядів у `src/platform/browser/ui/hold_charges.js`; перевірити переходи та незмінну ідентичність DOM-вузлів через `utils/checks/ui/ui-components-check.js`.

## Dependencies and parallel work

T001–T002 перед реалізацією; T003–T008 shared contracts перед остаточною інтеграцією прикладів. Каталог (T009–T014), platform surface (T018–T020,T024) й House design (T006,T015,T023) виконуються паралельно за окремими file owners. Guards/evidence T025–T028 після інтеграції. Pending gameplay/release work у spec055 не закривається дизайнерськими змінами.

## Phase 7: Mobile overlap and resize correction (owner report, 2026-10-14)

- [X] T030 Відтворити невідповідний sizing contract мобільної екіпіровки та підтвердити окремих DOM-власників equipment/items у `utils/checks/ui/inventory-ui-check.js`; записати причину в `docs/audits/2026-10-14-inventory-resize.md`.
- [X] T031 Виправити mobile intrinsic Grid rows, percentage heights і shrink у `styles/inventory/modal.css`, `loadout.css`, `list-and-filters.css`; зберегти4 mobile columns, rod9:16 та окрему прокрутку предметів.
- [X] T032 Виміряти duplicate resize work детермінованими лічильниками в `utils/checks/ui/ui-surface-check.js`, `utils/checks/platform/platform-runtime-check.js`, `utils/testing/runtime/game_application_test_composition.js`: усі regression assertions провалилися до виправлення.
- [X] T033 Зберігати один pending viewport resize в `game/application/session/game_application.js`, застосувати останній розмір перед наступним world/input update; `CanvasMetricsProvider` не перевстановлює незмінні bitmap dimensions.
- [X] T034 Прибрати unchanged CSS writes/content observation у fixed `UiSurfaceAdapter`; flow preview зберігає observation/scroll footprint. Перевірити burst coalescing, resize feedback settlement і lifecycle у `utils/checks/ui/ui-surface-check.js`.
- [X] T035 Виконати Architecture + Quick + Full та незмінні game-cycle/save checks після виправлення; Architecture4/4, Quick21/21, Full47/47 passed; результати в `docs/audits/2026-10-14-inventory-resize.md`.
- [ ] T036 Owner acceptance: відкритий інвентар на240/280/319/320/740px, populated/empty/locked slots, long names, repeated resize, focus і вертикальна/горизонтальна прокрутка. Browser profiling FPS/frame time та візуальні rectangles тут не виконувалися.

## Phase 8: Performance rules and touch interactions (owner request, 2026-10-14)

- [X] T037 Доповнити `DESIGN_RULES.md`, `DEVELOPMENT_RULES.md`, `docs/styles.md`: bounded resize/render work, unchanged writes, observer settlement, lifecycle, mobile region ownership та єдина політика hover.
- [X] T038 Дозволяти hover лише для UI/viewport понад1024px, landscape, fine/hover pointer без coarse/touch; cached capability queries належать `UiSurfaceAdapter`, використовуються CSS, Inventory hints і DEV hover help. При зміні режиму прибрати відкриту hover-підказку; зберегти keyboard focus/selected states.
- [X] T039 Обмежити всі CSS hover/decorative active через `ui-surface--desktop-hover`; прибрати browser tap highlight на UI та catalog roots, включно з link-like controls.
- [X] T040 Додати CSS guard із18 negative fixtures та regression checks для1024/1025px, portrait/touch/hybrid, capability bursts, hint dismissal, keyboard help і disposal; unchanged visible/hidden surface measurements не записують CSS/classes.
- [X] T041 Виконати фінальні Architecture + Quick + Full; Architecture4/4, Quick21/21, Full47/47 PASS після всіх runtime/CSS/guard змін, результати в `quickstart.md` і corrective audit.
- [ ] T042 Owner visual acceptance: mobile/tablet/portrait/touch laptop, link tap background, hover transition після resize/rotation та keyboard focus. Browser automation тут не виконується за чинним owner contract.

## Phase 9: Catalog access from DevTools (owner request, 2026-10-14)

- [X] T043 Додати пункт «Каталог UI 🧩» через injected callback у `dev_tools.js` і development bootstrap; перевикористати готовий каталог та один `EmbeddedPageOverlay` для House/UI без другого game loop.
- [X] T044 Додати «До DevTools»: same-origin embedded return зберігає ту саму DEV-сесію, standalone link веде на `dev.html`; close відновлює focus, dispose очищає handlers/frames і не запускає знищену гру.
- [X] T045 Перевірити menu callback, bootstrap destination, isolated House/catalog ready callbacks, trusted return/stale source, repeated open/close, focus та disposal у наявних checks; не створювати копій каталогу/службових журналів.
- [X] T046 Architecture4/4, Quick22/22, Full48/48 PASS; `clean:artifacts` не знайшов зайвих службових записів, `git diff --check` PASS; чинний quickstart оновлено.
- [ ] T047 Owner visual acceptance: DevTools → Каталог UI → До DevTools на desktop/mobile, focus і незмінність поточної сесії. Browser automation у цьому чаті не виконується.

## Release closure — v0.35.0 (2026-10-14)

- [X] T048 Зафіксувати виконані T001–T027, T029–T035, T037–T041 і T043–T046; оновити version/changelog та короткий опис результату. Підсумкова перевірка: Architecture 4/4, Quick 25/25, Full 51/51; незмінний game-cycle baseline; консоль index/DEV/House/catalog без помилок.
- Особисті T028/T036/T042/T047 залишаються окремими owner acceptance; автоматична перевірка не підміняє їхній результат.

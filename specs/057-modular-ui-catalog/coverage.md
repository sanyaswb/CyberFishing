# UI pattern coverage and design audit

Аудит 2026-10-13 використовує фактичні production sources. Завершені specs055/056 описують попередній стан; мобільні колонки й стилі зараз визначає `DESIGN_RULES.md`. Каталог використовує ті самі компоненти, не окремі макети.

| FR-002 family | Production source / appearance owner | Catalog example and states |
| --- | --- | --- |
| Buttons, icons, switches | `ui/ui_close_button_renderer.js`, `ui/ui_auto_switch_renderer.js`; `modal-controls.css`, `auto-switch.css`; production inventory SVG | Controls: normal/on/off/disabled/empty/long, native hover/focus/active |
| Meters, indicators | `inventory/inventory_resource_meter_renderer.js`; runtime `DegradationColorResolver`; `resource-meters.css` | Meters: resource/condition/occupancy,0/1/34/67/100,invalid/over/zero |
| Fields, filters, sorting | `inventory/inventory_grid_renderer.js`, `keepnet/keepnet_ui.js`, `house/aquarium_feed_picker.js`; component styles | Inventory/Keepnet/House: checkbox/select/range/input, filters/order/quantity |
| Slots, cards | `inventory/inventory_loadout_panel_renderer.js`, `inventory_item_card_renderer.js`, `keepnet/keepnet_card_renderer.js` | Inventory: empty/selected/locked/missing/long; Keepnet: groups/details |
| Windows, tabs, action groups | `InventoryUI`, `KeepnetUI`, `HouseView`, assembly/loadout renderers | Real dialogs, house panels/dock, assembly actions, close/Escape/focus |
| Tooltips, messages, confirmations | `InventoryTooltipPresenter`, inventory warnings, Keepnet help/release, feed quantity modal | Hover/help/error state, confirmed/cancelled release, quantity action |
| HUD controls | `DepthSelector`, `FightStatusBarsRenderer`, `HudBarRenderer`, `HudStyleResolver` | Depth pointer/keyboard/wheel; Canvas normal/active/boundary/hidden |
| Inventory composition | production InventoryUI + isolated fixture facade | Four equal mobile columns, rod9:16, source-owned slots/actions |
| Keepnet composition | production KeepnetUI + isolated port | Two mobile columns, occupancy with reservation, square/portrait/wide illustrations |
| House/aquarium composition | fetched production `fisherman-house.html`, actual House/Aquarium views | owned/unowned/empty/renovating/error/long, feed remaining reading, controlled frame |

## Corrected mismatches

| Verified mismatch | Correction owner |
| --- | --- |
| Copied close/switch markup and missing shared disposal | Shared renderers injected through bootstrap; host BEM mixes retain placement |
| Fixed screen anchoring inside base toolbar button | Position/bottom/layer reside in screen slot modifiers |
| House button copies/tag selectors/`!important` | Shared actions/close/switch, semantic custom properties, explicit BEM elements |
| House feed uses its own gradient regardless of exhaustion | Shared resource meter reads injected runtime degradation colors |
| Unbounded graphical meter and ARIA numeric values | Shared renderer clamps fill0..100 and retains reading in accessible text |
| Major modal/mobile regions built as successive Flex columns | Production Grid composition; Flex remains inside controls/cards |
| Inventory column count inferred through fixed-size auto-fill at mobile | Explicit `repeat(4,minmax(0,1fr))`; keepnet `repeat(2,minmax(0,1fr))` |
| Parameter styling depends on child order | Explicit single/centered BEM state set by renderer |
| Desktop viewport media query ignores catalog's narrow surface | Named `ui-surface` container queries and logical width/height values |
| Below320 individual geometry follows physical viewport | One logical320 surface scale, portal and physical/logical conversion port |
| Global active button transform overrides component geometry | Interaction states belong to component owners |
| DEV switch invisible keyboard focus / missing name / panel350px exceeds baseline | Semantic name, explicit focus styles, logical-width panel and reduced-motion |
| Native top-layer quantity dialog escapes transformed root | Contained modal with cached controls, focus/Escape/restore, background isolation |
| Depleted Hold charges retain previous available/active appearance | Reset cached circle class from authoritative reading; unchanged charge/state ownership |
| Repeated House mount leaves generated controls/meters and handlers | Dispose removes generated close/switch/meter/rows; FeedPicker restores original list and bindings |

## Task review scope

`specs/055-live-bait-aquarium/tasks.md` still has four unchecked legacy tasks: T039 (owner browser smoke), T040 (release/play acceptance), T048 (second room), T052 (committed release/browser evidence). These are not proof of current design failure and remain open. Completed tasks and `specs/056-inventory-icon-design/spec.md` are historical. Current corrective implementation/evidence is tracked in `tasks.md` here.

Browser visual acceptance is pending: no browser was opened under the current owner contract. Automated geometry/lifecycle checks cannot prove visual clipping or touch feel.

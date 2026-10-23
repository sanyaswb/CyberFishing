// The catalog's tabs (spec 140): short names in page order; each definition names its group. A group with several
// cards shows them one at a time through a second tab level.
export const UI_CATALOG_GROUPS = Object.freeze([
  Object.freeze({ id: "buttons", name: "Кнопки" }),
  Object.freeze({ id: "meters", name: "Шкали" }),
  Object.freeze({ id: "inventory", name: "Інвентар" }),
  Object.freeze({ id: "hud", name: "HUD" }),
  Object.freeze({ id: "house", name: "Будинок" }),
]);

// Every window starts at this surface size in physical pixels (spec 140 Revision 2).
export const UI_CATALOG_FRAME_SIZE = Object.freeze({ width: 320, height: 640 });

const INVENTORY_STATES = [["normal", "Заповнений"], ["empty", "Порожній"], ["locked", "Заблоковані слоти"], ["assembly", "Збірка та дії"], ["error", "Помилка дії"]];
const INVENTORY_READING = { min: 0, max: 100, unit: "%", label: "Залишок ресурсу картки, %" };
const INVENTORY_CONTRACT = "InventoryUI отримує ізольований getViewModel/dispatch port і production renderers. Числове оновлення викликає updateDynamicProgression без перебудови карток.";
const INVENTORY_SOURCES = ["src/game/presentation/inventory/inventory_ui.js", "src/game/presentation/inventory/inventory_item_card_renderer.js", "src/game/presentation/inventory/inventory_loadout_panel_renderer.js", "src/game/presentation/inventory/inventory_section_tabs_renderer.js", "src/game/presentation/inventory/inventory_grid_renderer.js", "src/game/presentation/inventory/inventory_assembly_editor_renderer.js", "src/game/presentation/inventory/inventory_rod_removal_renderer.js", "src/game/presentation/inventory/inventory_saved_loadout_preview_renderer.js", "src/game/presentation/inventory/inventory_tooltip_presenter.js", "src/game/presentation/inventory/inventory_load_renderer.js", "src/game/presentation/inventory/inventory_load_meter_config.js"];
const INVENTORY_STYLES = ["src/game/presentation/styles/inventory/modal.css", "src/game/presentation/styles/inventory/loadout.css", "src/game/presentation/styles/inventory/section-tabs.css", "src/game/presentation/styles/inventory/slots.css", "src/game/presentation/styles/inventory/item-cards.css", "src/game/presentation/styles/inventory/list-and-filters.css", "src/game/presentation/styles/inventory/assembly-editor.css", "src/game/presentation/styles/inventory/tooltips.css", "src/game/presentation/styles/inventory/header.css", "src/game/presentation/styles/inventory/resource-meters.css"];

// One block of the whole production inventory, shown through a crop window (spec 140 R2-D3).
function inventoryBlock(id, name, focus, description) {
  return { id, name, group: "inventory", example: "inventory", focus, families: ["inventory"], description,
    contract: INVENTORY_CONTRACT, states: INVENTORY_STATES, reading: INVENTORY_READING, sources: INVENTORY_SOURCES,
    styles: INVENTORY_STYLES };
}

// This inventory is explicit: each entry names the production renderer and its style owner. example names the
// factory when it differs from the id; focus is the block a crop window shows; a reading runs min..max in two steps.
export const UI_CATALOG_DEFINITIONS = Object.freeze([
  {
    id: "controls", name: "Закриття та A", group: "buttons",
    families: ["buttons", "icons", "switches"],
    description: "Спільна кнопка закриття та перемикач A. Hover, active і focus-visible перевіряються вказівником та клавіатурою. Вимкнений контроль не виконує дію.",
    contract: "create({label,onClose,disabled,className}); create/update({checked,disabled,stock,items,placeholderUrl}). className задає тільки розміщення.",
    states: [["normal", "Звичайний"], ["enabled", "Увімкнений"], ["disabled", "Заблокований"], ["empty", "Порожній запас"]],
    sources: ["src/game/presentation/ui/ui_close_button_renderer.js", "src/game/presentation/ui/ui_auto_switch_renderer.js"],
    styles: ["src/game/presentation/styles/modal-controls.css", "src/game/presentation/styles/auto-switch.css"],
  },
  {
    id: "inventory-selector", name: "Радіальний вибір", group: "buttons",
    families: ["buttons", "icons", "inventory"],
    description: "Одна кнопка й три округлені сектори. На ПК — наведення та клік; на телефоні — утримання, рух і відпускання. Клавіатура: Enter/Space, Tab, Escape. Classic повертає чинні кнопки.",
    contract: "Production InventorySelectorRenderer/Controller та чинні InventoryUI/KeepnetSectionView; каталог змінює лише ізольовані параметри прикладу.",
    states: [["normal", "Закрито"], ["open", "Відкрито"], ["equipment", "Екіпіровка: виділено"], ["classic", "Classic"]],
    sources: ["src/game/presentation/inventory/inventory_selector_renderer.js", "src/game/presentation/inventory/inventory_selector_geometry.js", "src/platform/browser/dom/inventory_selector_controller.js"],
    styles: ["src/game/presentation/styles/inventory/inventory-selector.css", "src/game/presentation/styles/hud/toolbar.css"],
  },
  {
    id: "meters", name: "Ресурс · стан · зайнятість", group: "meters",
    families: ["meters", "indicators"],
    description: "Залишок ресурсу та стан зменшуються. Зайнятість зростає, але її колір читає вільну місткість. Один runtime resolver для всіх трьох.",
    contract: "InventoryResourceMeterRenderer.create/updateReading({id,percent,remainingPercent,label}, {variant:'summary'}). Колір: DegradationColorResolver + runtime degradationColors.",
    states: [["normal", "Звичайний"], ["zero", "Нульова місткість"], ["missing", "Відсутнє значення"]],
    reading: { min: 0, max: 100, unit: "%", label: "Залишок ресурсу / стану, %" },
    sources: ["src/game/presentation/inventory/inventory_resource_meter_renderer.js", "src/game/presentation/styles/degradation_color_resolver.js", "src/game/presentation/visual/degradation_color_config.js"],
    styles: ["src/game/presentation/styles/inventory/resource-meters.css"],
  },
  {
    id: "inventory", name: "Весь", group: "inventory",
    families: ["slots", "cards", "filters", "sorting", "action-groups", "tooltips", "inventory"],
    description: "Справжній InventoryUI з даними тільки в пам’яті: екіпірування, рюкзак, садок, предмети, фільтри й заголовок.",
    contract: INVENTORY_CONTRACT, states: INVENTORY_STATES, reading: INVENTORY_READING, sources: INVENTORY_SOURCES, styles: INVENTORY_STYLES,
  },
  inventoryBlock("inventory-left", "Ліва панель", ".inventory-main__sidebar", "Екіпірування або рюкзак разом із вкладками розділів."),
  inventoryBlock("inventory-tabs", "Вкладки", ".inventory-section-tabs__list", "Рядок вкладок розділів інвентаря."),
  inventoryBlock("inventory-filters", "Фільтри", ".inventory-list-panel__controls", "Категорії, фільтри й сортування предметів."),
  inventoryBlock("inventory-list", "Список", ".inventory-list-panel__items", "Сторінки карток предметів."),
  inventoryBlock("inventory-header", "Заголовок", ".inventory-header", "Заголовок інвентаря з наживкою, прикормкою та закриттям."),
  {
    id: "keepnet", name: "Садок", group: "inventory", example: "inventory", section: "keepnet",
    families: ["dialogs", "fields", "messages", "confirmations", "keepnet"],
    description: "Розділ садка всередині справжнього інвентаря (spec 067): параметри ліворуч, риба праворуч, групування, фільтри, підтвердження відпускання.",
    contract: "KeepnetSectionView + KeepnetViewModel + KeepnetCardRenderer, приєднані до InventoryUI через attachKeepnetSection. Дані лише демонстраційні.",
    states: [["normal", "Групи риб"], ["empty", "Порожній"], ["reserved", "Місце на гачку"], ["over", "Переповнений"], ["error", "Помилка"]],
    reading: { min: 0, max: 600, unit: "с", label: "Демонстраційний час живця, с" },
    sources: ["src/game/presentation/keepnet/keepnet_section_view.js", "src/game/presentation/keepnet/keepnet_view_model.js", "src/game/presentation/keepnet/keepnet_card_renderer.js"],
    styles: ["src/game/presentation/styles/keepnet.css"],
  },
  {
    id: "hud", name: "HUD", group: "hud",
    families: ["hud", "canvas"],
    description: "Справжні HUD-контроли: глибина, заряди, час, прикормка та продовження; Canvas читає чинні descriptors HUD.",
    contract: "DepthSelector.show/updateMax/setIcon/open/close; FightStatusBarsRenderer.render з production HudBarRenderer і HudStyleResolver. Canvas перерисовується подією, без нового frame loop.",
    states: [["normal", "Звичайний / день"], ["open", "Глибина відкрита"], ["active", "Активне керування"], ["aiming", "Прицілювання"], ["night", "Ніч"]],
    reading: { min: 0, max: 100, unit: "%", label: "Натяг / контроль, %" },
    sources: ["src/platform/browser/ui/depth_selector.js", "src/platform/browser/ui/hold_charges.js", "src/platform/browser/ui/time_display.js", "src/platform/browser/ui/chum_controls.js", "src/platform/browser/ui/game_controls.js", "src/game/presentation/hud/fight_status_bars_renderer.js", "src/game/presentation/hud/hud_bar_renderer.js", "src/game/presentation/styles/hud_style_resolver.js", "src/game/presentation/styles/three_band_gradient_color.js"],
    styles: ["src/game/presentation/styles/hud/depth-selector.css", "src/game/presentation/styles/hud/hold-charges.css", "src/game/presentation/styles/hud/time-display.css", "src/game/presentation/styles/hud/chum-control.css", "src/game/presentation/styles/hud/game-controls.css"],
  },
  {
    id: "house", name: "Будинок і акваріум", group: "house",
    families: ["tabs", "house", "aquarium"],
    description: "Production HTML і HouseView: мініатюри, відкритий розділ, справжній AquariumFeedPicker.",
    contract: "Розмітка береться з модуля екрана будинку (house_screen_markup.js) без production-композиції. Підставляються read models, renderer ports та контрольований scheduler. Жодного care timer, clock чи storage.",
    states: [["normal", "Акваріум із рибою"], ["section-open", "Меню: відкритий розділ"], ["empty", "Порожній"], ["renovating", "Ремонт"], ["night", "Ніч"]],
    reading: { min: 0, max: 100, unit: "%", label: "Залишок корму, %" },
    sources: ["src/game/presentation/house/house_screen_markup.js", "src/game/presentation/house/house_view.js", "src/game/presentation/house/aquarium_feed_picker.js", "src/game/presentation/house/aquarium_fish_view.js", "src/game/domain/live_bait/aquarium_care_calculator.js", "src/game/presentation/ui/ui_sheet_handle_renderer.js", "src/platform/browser/dom/sheet_dismiss_controller.js", "src/platform/browser/dom/sheet_height_controller.js", "src/platform/browser/dom/horizontal_scroll_controller.js"],
    styles: ["src/game/presentation/styles/house.css", "src/game/presentation/styles/modal-controls.css"],
  },
]);

export const UI_CATALOG_LABELS = Object.freeze({
  pageTitle: "Каталог UI CyberFishing",
  stateLabel: "Стан",
  resizeWidth: "Ширина прикладу",
  resizeHeight: "Висота прикладу",
  resizeBoth: "Розмір прикладу",
  houseReturn: "Повернення працює лише в контрольному прикладі.",
  houseFullscreen: "Контрольна дія повного екрана.",
  hudFullscreen: "Повний екран: контрольний callback, сторінка лишається в каталозі.",
  hudNet: "Контрольна дія підсаки.",
  hudContinue: "Контрольна дія продовження.",
  hudChum: "Контрольна дія прикормки.",
});

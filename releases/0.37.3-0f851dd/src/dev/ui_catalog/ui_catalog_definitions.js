// This inventory is explicit: each entry names the production renderer and its style owner.
export const UI_CATALOG_DEFINITIONS = Object.freeze([
  {
    id: "controls", name: "Кнопки, іконки та автоматичний режим",
    families: ["buttons", "icons", "switches"], height: 220,
    description: "Спільна кнопка закриття та перемикач A. Hover, active і focus-visible перевіряються вказівником та клавіатурою. Вимкнений контроль не виконує дію.",
    contract: "create({label,onClose,disabled,className}); create/update({checked,disabled,stock,items,placeholderUrl}). className задає тільки розміщення.",
    states: [["normal", "Звичайний"], ["enabled", "Увімкнений"], ["disabled", "Заблокований"], ["empty", "Порожній запас"], ["long", "Довга назва"]],
    sources: ["src/game/presentation/ui/ui_close_button_renderer.js", "src/game/presentation/ui/ui_auto_switch_renderer.js"],
    styles: ["src/game/presentation/styles/modal-controls.css", "src/game/presentation/styles/auto-switch.css"],
  },
  {
    id: "meters", name: "Ресурс, стан і зайнятість",
    families: ["meters", "indicators"], height: 360,
    description: "Залишок ресурсу та стан зменшуються. Зайнятість зростає, але її колір читає вільну місткість. Для 0, 1, 34, 67 і 100% використовується один runtime resolver.",
    contract: "InventoryResourceMeterRenderer.create/updateReading({id,percent,remainingPercent,label}, {variant:'summary'}). Колір: DegradationColorResolver + runtime degradationColors.",
    states: [["normal", "Звичайний"], ["zero", "Нульова місткість"], ["over", "Понад місткість"], ["missing", "Відсутнє значення"]],
    reading: { min: -10, max: 110, value: 67, label: "Залишок ресурсу / стану, %" },
    sources: ["src/game/presentation/inventory/inventory_resource_meter_renderer.js", "src/game/presentation/styles/degradation_color_resolver.js", "src/game/presentation/visual/degradation_color_config.js"],
    styles: ["src/game/presentation/styles/inventory/resource-meters.css"],
  },
  {
    id: "inventory", name: "Інвентар: слоти, картки, фільтри та групи дій",
    families: ["slots", "cards", "filters", "sorting", "action-groups", "tooltips", "inventory"], height: 680,
    description: "Справжній InventoryUI з даними тільки в пам’яті. Сіра секція екіпірування масштабується від ширини контейнера (spec 067): вудка зі станом, колонка залежних слотів, чотири нижні комірки та вкладки-іконки (поки лише візуальний стан). Чотири колонки предметів на мобільній поверхні. Оберіть картку, розкрийте сортування, натисніть заблокований слот або огляньте підказку.",
    contract: "InventoryUI отримує ізольований getViewModel/dispatch port і production renderers. Числове оновлення викликає updateDynamicProgression без перебудови карток.",
    states: [["normal", "Заповнений"], ["consumables", "Світчери: три наживки"], ["same-consumables", "Світчери: однакові наживки"], ["selected-consumables", "Світчери: вибір наживки, 1 кг"], ["full-consumables", "Світчери: три наживки і дві прикормки"], ["norod", "Без вудки"], ["empty", "Порожній"], ["locked", "Заблоковані слоти"], ["assembly", "Збірка та дії"], ["removal", "Зняття вудилища"], ["save", "Назва збірки"], ["saved", "Перегляд збірки"], ["long", "Довга назва"], ["missing", "Відсутній asset"], ["error", "Помилка дії"]],
    reading: { min: 0, max: 100, value: 67, label: "Залишок ресурсу картки, %" },
    sources: ["src/game/presentation/inventory/inventory_ui.js", "src/game/presentation/inventory/inventory_item_card_renderer.js", "src/game/presentation/inventory/inventory_loadout_panel_renderer.js", "src/game/presentation/inventory/inventory_section_tabs_renderer.js", "src/game/presentation/inventory/inventory_grid_renderer.js", "src/game/presentation/inventory/inventory_assembly_editor_renderer.js", "src/game/presentation/inventory/inventory_rod_removal_renderer.js", "src/game/presentation/inventory/inventory_saved_loadout_preview_renderer.js", "src/game/presentation/inventory/inventory_tooltip_presenter.js", "src/game/presentation/inventory/inventory_load_renderer.js", "src/game/presentation/inventory/inventory_load_meter_config.js"],
    styles: ["src/game/presentation/styles/inventory/modal.css", "src/game/presentation/styles/inventory/loadout.css", "src/game/presentation/styles/inventory/section-tabs.css", "src/game/presentation/styles/inventory/slots.css", "src/game/presentation/styles/inventory/item-cards.css", "src/game/presentation/styles/inventory/list-and-filters.css", "src/game/presentation/styles/inventory/assembly-editor.css", "src/game/presentation/styles/inventory/tooltips.css", "src/game/presentation/styles/inventory/header.css", "src/game/presentation/styles/inventory/resource-meters.css"],
  },
  {
    id: "keepnet", name: "Садок: розділ інвентаря, поля, підказка та підтвердження",
    families: ["dialogs", "fields", "messages", "confirmations", "keepnet"], height: 680,
    description: "Справжній KeepnetSectionView (розділ інвентаря, spec 067): параметри ліворуч, дві мобільні колонки риби праворуч, групування, фільтри, ? та Escape, підтвердження відпускання. Резерв живця на гачку враховується незалежно від фільтра.",
    contract: "KeepnetSectionView + KeepnetViewModel + KeepnetCardRenderer. getView та всі callbacks працюють лише з демонстраційними даними. Оновлення часу зберігає зображення та scroll.",
    states: [["normal", "Групи риб"], ["empty", "Порожній"], ["reserved", "Місце на гачку"], ["zero", "Нульова місткість"], ["over", "Переповнений"], ["error", "Помилка"], ["missing", "Відсутній asset"], ["portrait", "Портретна ілюстрація"], ["wide", "Широка ілюстрація"], ["square", "Квадратна ілюстрація"]],
    reading: { min: 0, max: 600, value: 180, label: "Демонстраційний час живця, с" },
    sources: ["src/game/presentation/keepnet/keepnet_section_view.js", "src/game/presentation/keepnet/keepnet_view_model.js", "src/game/presentation/keepnet/keepnet_card_renderer.js"],
    styles: ["src/game/presentation/styles/keepnet.css"],
  },
  {
    id: "house", name: "Будинок та акваріум: панелі та завантаження корму",
    families: ["tabs", "house", "aquarium"], height: 680,
    description: "Production HTML і HouseView: мініатюри, усі назви після свайпу вгору та відкритий розділ. Список прикормки використовує справжній AquariumFeedPicker: вибір одного рядка й окреме завантаження. Риба малюється лише при зміні прикладу.",
    contract: "Розмітка береться з модуля екрана будинку (house_screen_markup.js) без production-композиції. Підставляються read models, renderer ports та контрольований scheduler. Жодного care timer, clock чи storage.",
    states: [["normal", "Акваріум із рибою"], ["feed-ready", "Прикормка: доступне дозавантаження"], ["menu-collapsed", "Меню: мініатюри"], ["menu-expanded", "Меню: усі назви"], ["section-open", "Меню: відкритий розділ"], ["empty", "Порожній"], ["full", "Місткість 100%"], ["no-feed", "Автогодівниця: немає запасу"], ["unaffordable", "Прокачка: недостатньо коштів"], ["unowned", "Не встановлено"], ["renovating", "Ремонт"], ["error", "Помилка"], ["long", "Довгі назви"], ["evening", "Вечір"], ["night", "Ніч"]],
    reading: { min: 0, max: 100, value: 67, label: "Залишок корму, %" },
    sources: ["src/game/presentation/house/house_screen_markup.js", "src/game/presentation/house/house_view.js", "src/game/presentation/house/aquarium_feed_picker.js", "src/game/presentation/house/aquarium_fish_view.js", "src/game/domain/live_bait/aquarium_care_calculator.js", "src/game/presentation/ui/ui_sheet_handle_renderer.js", "src/platform/browser/dom/sheet_dismiss_controller.js", "src/platform/browser/dom/sheet_height_controller.js", "src/platform/browser/dom/horizontal_scroll_controller.js"],
    styles: ["src/game/presentation/styles/house.css", "src/game/presentation/styles/modal-controls.css"],
  },
  {
    id: "hud", name: "HUD: глибина, заряди, час, прикормка та Canvas-шкали",
    families: ["hud", "canvas"], height: 700,
    description: "Справжні HUD-контроли: клавіші, wheel і pointer drag глибини; заряди, час, прикормка, підсака та продовження. Canvas читає чинні descriptors HUD та трикольоровий gradient натягу. Світових координат гри в прикладі немає.",
    contract: "DepthSelector.show/updateMax/setIcon/open/close; FightStatusBarsRenderer.render з production HudBarRenderer і HudStyleResolver. Canvas перерисовується подією, без нового frame loop.",
    states: [["normal", "Звичайний / день"], ["time-speed", "DEV час: ×1.5..×5"], ["open", "Глибина відкрита"], ["active", "Активне керування"], ["boundary", "Граничний натяг"], ["disabled", "Прикормка недоступна"], ["empty", "Прикормка закінчилась"], ["aiming", "Прицілювання"], ["moving", "Кораблик у русі"], ["boat", "Кораблик готовий"], ["charges-empty", "Заряди вичерпано"], ["dawn", "Світанок"], ["evening", "Вечір"], ["night", "Ніч"], ["hidden", "HUD прихований"]],
    reading: { min: 0, max: 100, value: 67, label: "Натяг / контроль, %" },
    sources: ["src/platform/browser/ui/depth_selector.js", "src/platform/browser/ui/hold_charges.js", "src/platform/browser/ui/time_display.js", "src/platform/browser/ui/chum_controls.js", "src/platform/browser/ui/game_controls.js", "src/game/presentation/hud/fight_status_bars_renderer.js", "src/game/presentation/hud/hud_bar_renderer.js", "src/game/presentation/styles/hud_style_resolver.js", "src/game/presentation/styles/three_band_gradient_color.js"],
    styles: ["src/game/presentation/styles/hud/depth-selector.css", "src/game/presentation/styles/hud/hold-charges.css", "src/game/presentation/styles/hud/time-display.css", "src/game/presentation/styles/hud/chum-control.css", "src/game/presentation/styles/hud/game-controls.css"],
  },
]);

export const UI_CATALOG_WIDTHS = Object.freeze([240, 280, 319, 320, 520, 521, 600, 640, 740, 820, 821, 960, 1280]);

export const UI_CATALOG_LABELS = Object.freeze({
  pageTitle: "Каталог UI CyberFishing",
  houseReturn: "Повернення працює лише в контрольному прикладі.",
  houseFullscreen: "Контрольна дія повного екрана.",
  hudFullscreen: "Повний екран: контрольний callback, сторінка лишається в каталозі.",
  hudNet: "Контрольна дія підсаки.",
  hudContinue: "Контрольна дія продовження.",
  hudChum: "Контрольна дія прикормки.",
});

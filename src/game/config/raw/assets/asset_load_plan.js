// The asset load plan (spec 157 R15, TK-177; owner edits it): three layers, each with groups by priority (1 first).
// Entries: { id } one registry asset, { tag } every asset with that folder tag, { source } a named source of the game's
// state (see bootstrap/production/asset_load_sources.js), { module } a feature's code (bootstrap/production/
// game_feature_modules.js, spec 157 R12). An asset belongs to the first group that names it; registry
// assets that no group names land in the implicit last group "unassigned" of layer-three and load there.
// - layer-one: the first frame; the game is ready only when it has loaded (start "composition"). Its groups share one
//   priority: a later priority waits for the earlier one and is one more request wave of the start (spec 160).
// - layer-two: the full game cycle, right after the first frame (start "ready").
// - layer-three: lazy: true, the owner's order (spec 159): low copies of backgrounds, items, then Spine, the Fisherman's
//   Room and the rest; then the full files in the same order. Audio is on demand (load: false): its players load it when the radio starts or a
//   sound plays. A group with locked: true holds what game
//   progress has not opened (room levels above the opened one, TK-216): it stays out until it opens, or until the player
//   asks for it. An asset named by another group too (the House tag) still waits for that.
// - features: the code of features not needed for the first frame, warmed up after it one group at a time (start
//   "ready"); the player's first use asks for a feature at once.
// - readyOn: "low": the low-quality copies load first. In layer-one the group counts as loaded with them and the full
//   files follow right after the first frame; in later layers the full files follow at once (spec 157 R17, spec 159).
// Today's plan repeats the loads before stage D (spec 157 R4, R5, R6, R11): nothing is added to the start.
export const ASSET_LOAD_PLAN = {
  layers: [
    {
      id: "layer-one", label: "Перший кадр", start: "composition",
      groups: [
        { id: "location", label: "Фон поточної фази й карта глибин", priority: 1, readyOn: "low",
          assets: [{ source: "location.background.current" }, { source: "location.depthMap" }] },
        { id: "scene", label: "Поплавок у сцені", priority: 1, assets: [{ tag: "floats-scene" }] },
        { id: "rod-start", label: "Статична вудка (до приходу Spine)", priority: 1, assets: [{ tag: "rods-scene" }] },
        { id: "slot-icons", label: "Заглушки клітинок інвентаря", priority: 1, assets: [{ source: "inventory.slotIcons" }] },
      ],
    },
    {
      id: "layer-two", label: "Повний ігровий цикл", start: "ready",
      groups: [
        { id: "location-phases", label: "Інші фази фону", priority: 1, readyOn: "low", assets: [{ source: "location.background.others" }] },
        { id: "depth-icons", label: "Іконки вибору глибини", priority: 1, readyOn: "low", assets: [{ source: "hud.depthIcons" }] },
        { id: "selector", label: "Арт селектора інвентаря", priority: 1, readyOn: "low",
          assets: [{ id: "ui.inventory-sections" }, { id: "items.briefcases.briefcase--1--close" }, { id: "items.keepnet.keepnet--0" }] },
        { id: "keepnet-stages", label: "Стадії садка", priority: 1, readyOn: "low", assets: [{ tag: "keepnet" }] },
      ],
    },
    {
      id: "features", label: "Функції поза стартом (код)", start: "ready",
      groups: [
        { id: "feature-pixi", label: "Pixi (сцена WebGL)", priority: 1, assets: [{ module: "pixi" }] },
        { id: "feature-radio", label: "Радіо", priority: 2, assets: [{ module: "radio" }] },
      ],
    },
    {
      id: "layer-three", label: "Вміст, який відкривають пізніше", start: "after:layer-two", lazy: true,
      groups: [
        { id: "feature-boat", label: "Кораблик", priority: 1, assets: [{ module: "boat" }] },
        { id: "feature-item-editor", label: "Редактор предметів", priority: 2, assets: [{ module: "item-editor" }] },
        { id: "feature-victory", label: "Екран перемоги", priority: 3, assets: [{ module: "victory" }] },
        { id: "lazy-backgrounds", label: "Фони інших локацій", priority: 4, assets: [{ source: "location.elsewhere" }] },
        { id: "lazy-items", label: "Предмети інвентаря", priority: 5,
          assets: [{ tag: "baits" }, { tag: "batteries" }, { tag: "briefcases" }, { tag: "floats" }, { tag: "nets" },
            { id: "items.boats.boat-lvl--3_bait" }, { id: "items.boats.boat-lvl--3_no-bait" }, { id: "items.radio.radio-receiver" },
            { id: "items.rods.bamboo-rod-ecip-v1" }, { id: "items.aquarium-feed-simple" }, { id: "items.aquarium-feed-good" },
            { id: "items.aquarium-feed-premium" }] },
        { id: "lazy-spine", label: "Анімації Spine", priority: 6, assets: [{ tag: "animations" }] },
        { id: "lazy-room", label: "Кімната рибалки", priority: 7, assets: [{ tag: "house" }] },
        { id: "lazy-rest", label: "Решта зображень", priority: 8,
          assets: [{ tag: "fish-display" }, { tag: "lobby" }, { tag: "inventory" }, { tag: "loader" }, { id: "ui.status-icons" }] },
        { id: "audio", label: "Аудіо (під час запуску радіо)", priority: 9, load: false, assets: [{ tag: "audio" }] },
        { id: "locked", label: "Закрите прогресом (на вимогу)", priority: 10, locked: true, assets: [{ source: "progress.locked" }] },
      ],
    },
  ],
};

// The asset load plan (spec 157 R15, TK-177; owner edits it): three layers, each with groups by priority (1 first).
// Entries: { id } one registry asset, { tag } every asset with that folder tag, { source } a named source of the game's
// state (see bootstrap/production/asset_load_sources.js), { module } a feature's code (bootstrap/production/
// game_feature_modules.js, spec 157 R12). An asset belongs to the first group that names it; registry
// assets that no group names land in the implicit last group "unassigned" of layer-three and load there.
// - layer-one: the first frame; the game is ready only when it has loaded (start "composition").
// - layer-two: the full game cycle, right after the first frame (start "ready").
// - layer-three: content opened later. load: false groups load only when the game asks for them (on demand).
// - features: the code of features not needed for the first frame, warmed up after it one group at a time (start
//   "ready"); the player's first use asks for a feature at once.
// - readyOn: "low": the group counts as loaded with the low-quality copies of its images; the full files replace them
//   right after the first frame (spec 157 R17, owner: on for the current background phase).
// Today's plan repeats the loads before stage D (spec 157 R4, R5, R6, R11): nothing is added to the start.
export const ASSET_LOAD_PLAN = {
  layers: [
    {
      id: "layer-one", label: "Перший кадр", start: "composition",
      groups: [
        { id: "location", label: "Фон поточної фази й карта глибин", priority: 1, readyOn: "low",
          assets: [{ source: "location.background.current" }, { source: "location.depthMap" }] },
        { id: "scene", label: "Поплавок у сцені", priority: 2, assets: [{ tag: "floats-scene" }] },
        { id: "rod-start", label: "Статична вудка (до приходу Spine)", priority: 2, assets: [{ tag: "rods-scene" }] },
        { id: "slot-icons", label: "Заглушки клітинок інвентаря", priority: 2, assets: [{ source: "inventory.slotIcons" }] },
      ],
    },
    {
      id: "layer-two", label: "Повний ігровий цикл", start: "ready",
      groups: [
        { id: "location-phases", label: "Інші фази фону", priority: 1, assets: [{ source: "location.background.others" }] },
        { id: "depth-icons", label: "Іконки вибору глибини", priority: 1, assets: [{ source: "hud.depthIcons" }] },
        { id: "selector", label: "Арт селектора інвентаря", priority: 1,
          assets: [{ id: "ui.inventory-sections" }, { id: "items.briefcases.briefcase--1--close" }, { id: "items.keepnet.keepnet--0" }] },
        { id: "keepnet-stages", label: "Стадії садка", priority: 1, assets: [{ tag: "keepnet" }] },
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
      id: "layer-three", label: "Вміст, який відкривають пізніше", start: "after:layer-two",
      groups: [
        { id: "on-demand", label: "На вимогу (не вантажиться у фоні)", priority: 1, load: false,
          assets: [{ tag: "audio" }, { tag: "animations" }, { tag: "fish-display" },
            { tag: "house" }, { tag: "lobby" }, { tag: "inventory" }, { tag: "loader" }, { id: "ui.status-icons" },
            { tag: "baits" }, { tag: "batteries" }, { tag: "boats" }, { tag: "briefcases" }, { tag: "floats" }, { tag: "nets" },
            { tag: "radio" }, { tag: "rods" }, { id: "items.aquarium-feed-simple" }, { id: "items.aquarium-feed-good" },
            { id: "items.aquarium-feed-premium" }] },
      ],
    },
  ],
};

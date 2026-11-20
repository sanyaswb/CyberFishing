// Spec 181 D1: the player's buffs and debuffs (CONFIG.statusEffects), edited live in DevTools. modifiers are the shares of
// a system's effect that STAY (1 — unchanged, 0 — none); a system reads only its own keys. durationSec 0 — a status
// without a timer that lasts while its source holds it (an item in its slot, the location's radiation). badge — a round
// icon under the radio in the HUD (spec 181 D3); icon — its drawing (presentation/hud/status_icons.js).
export const STATUS_EFFECTS = {
  // Горілка (spec 179 Q8, етап L — TK-374): кожна пляшка — ще одна стопка (до 5); час і протверезіння
  // сходинками — за рівнем (TK-378, levelSec: 1 пляшка 1 хв … 5 пляшок 10 хв). Під радіацією — захист від ефектів викиду 30 / 45 / 60 % за 1 / 2 / 3+ пляшки
  // (Q25); без радіації — сп'яніння (CONFIG.canvas.intoxication).
  vodka: {
    kind: "buff",
    icon: "vodka",
    badge: true,
    durationSec: 600,
    stacking: "add",
    maxStacks: 5,
    // TK-378 (власник): час за рівнем 1…5 — пляшка ставить рівень на один вище від поточного і його час: 1 пляшка — 1 хв,
    // 2 — 3 хв, 3 — 5, 4 — 7, 5 — 10 хв. Протверезіння сходинками: рівень N тримається, поки лишилось більше за час
    // рівня N−1 (5 пляшок: 10→7 хв — 5, 7→5 — 4, 5→3 — 3, 3→1 — 2, остання хвилина — 1). durationSec — для таймера
    // без цього списку.
    levelSec: [60, 180, 300, 420, 600],
    timeBase: "real",
    modifiers: {
      emission: {
        vignette: [0.7, 0.55, 0.4], // частка затемнення, що лишається: 1, 2, 3+ пляшки
        blur: [0.7, 0.55, 0.4], // частка розмиття (px), що лишається: 1, 2, 3+ пляшки
        blurRate: 1, // частка частоти пульсів розмиття (1 — ритм викиду той самий)
      },
    },
  },
  // Радіація (spec 181 D4, Q2): дебаф без таймера, поки радіація локації > 0; модифікаторів немає — ефекти задає викид.
  radiation: {
    kind: "debuff",
    icon: "radiation",
    badge: true,
    durationSec: 0,
    stacking: "renew",
    maxStacks: 1,
    timeBase: "real",
    modifiers: {},
  },
  // Протигаз у слоті (spec 181 Q3: без значка — його видно в слоті): ефектів викиду немає; закид дозволяє сам слот.
  gasMask: {
    kind: "buff",
    icon: "gas-mask",
    badge: false,
    durationSec: 0,
    stacking: "renew",
    maxStacks: 1,
    timeBase: "real",
    modifiers: {
      emission: {
        vignette: 0,
        blur: 0,
        blurRate: 1,
      },
      // Spec 179 етап K (TK-373): шипіння радіації на екрані в протигазі приглушене (частка, що лишається).
      radiation: {
        grain: 0.3,
      },
    },
  },
};

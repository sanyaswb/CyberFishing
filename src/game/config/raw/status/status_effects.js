// Spec 181 D1: the player's buffs and debuffs (CONFIG.statusEffects), edited live in DevTools. modifiers are the shares of
// a system's effect that STAY (1 — unchanged, 0 — none); a system reads only its own keys. durationSec 0 — a status
// without a timer that lasts while its source holds it (an item in its slot, the location's radiation). badge — a round
// icon under the radio in the HUD (spec 181 D3); icon — its drawing (presentation/hud/status_icons.js).
export const STATUS_EFFECTS = {
  // Горілка (spec 179 Q8): ефекти викиду на екрані слабші; повторна пляшка оновлює час, не складається.
  vodka: {
    kind: "buff",
    icon: "vodka",
    badge: true,
    durationSec: 600,
    stacking: "renew",
    maxStacks: 1,
    timeBase: "real",
    modifiers: {
      emission: {
        vignette: 0.5, // частка затемнення, що лишається
        blur: 0.5, // частка розмиття (px), що лишається
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

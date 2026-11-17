// Spec 181 D3: the player-facing names of the statuses (the HUD badge's accessible name) and the countdown's text.
export const STATUS_LABELS = Object.freeze({
  names: Object.freeze({
    vodka: "Горілка",
    gasMask: "Протигаз",
    radiation: "Радіація",
  }),
  // Q6: a tap shows the time left as m:ss.
  countdown(seconds) {
    const total = Math.max(0, Math.ceil(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    return `${minutes}:${String(total % 60).padStart(2, "0")}`;
  },
  badge(name, kind) {
    return kind === "debuff" ? `${name} (дебаф)` : name;
  },
});

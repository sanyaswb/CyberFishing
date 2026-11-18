// Player-facing HUD labels, injected into the browser HUD widgets by composition.
export const HUD_LABELS = Object.freeze({
  timePhase: "Двічі натисніть для зміни пори доби: день, вечір, ніч.",
  timeAcceleration: (multiplier, enabled) =>
    enabled
      ? `Ігровий час · ×${multiplier}. Натисніть для наступної швидкості; після ×5 повернення до ×1.`
      : "Ігровий час",
  depthValue: (meters) => `${meters} м`,
  depthToggle: "Глибина поплавка",
  depthTrack: "Вибір глибини",
  castLimit: (meters) => `${meters} м`,
  holdActive: "УТРИМАННЯ",
  fullscreen: "На весь екран",
  house: "Будинок", // spec 179 D12
  landingNet: "Підсака",
  chumAction: "Прикормка",
  chumActionCount: (count) => `Прикормка · ${count} порцій`,
  // Spec 184 D4 (TK-376): the HUD drink button.
  drinkAction: (name, count) => `Випити: ${name} · ${count} шт`,
  chumBoatAction: "Кораблик для прикормки",
  continueAfterOutcome: "ПРОДОВЖИТИ",
});

// Player-facing HUD labels, injected into the browser HUD widgets by composition.
export const HUD_LABELS = Object.freeze({
  depthValue: (meters) => `${meters} м`,
  depthToggle: "Глибина поплавка",
  depthTrack: "Вибір глибини",
  castLimit: (meters) => `закид до ${meters} м`,
  holdActive: "УТРИМАННЯ",
  fullscreen: "На весь екран",
  landingNet: "Підсака",
  chumAction: "Прикормка",
  chumActionCount: (count) => `Прикормка · ${count} порцій`,
  chumBoatAction: "Кораблик для прикормки",
  continueAfterOutcome: "ПРОДОВЖИТИ",
});

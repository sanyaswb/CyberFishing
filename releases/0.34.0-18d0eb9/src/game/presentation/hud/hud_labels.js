// Player-facing HUD labels, injected into the browser HUD widgets by composition.
export const HUD_LABELS = Object.freeze({
  depthValue: (meters) => `${meters} м`,
  depthToggle: "Глибина поплавка",
  depthTrack: "Вибір глибини",
  castLimit: (meters) => `закид до ${meters} м`,
  holdActive: "УТРИМАННЯ",
  continueAfterOutcome: "ПРОДОВЖИТИ",
});

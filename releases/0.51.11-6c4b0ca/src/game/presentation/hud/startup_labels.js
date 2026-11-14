// Player-facing text of the startup screen (spec 157 D5, R3).
export const STARTUP_LABELS = Object.freeze({
  bytes: (loaded, total) => `${loaded} / ${total} МБ`,
  failed: "Не вдалося завантажити гру. Перевірте з'єднання.",
  retry: "Спробувати ще",
});

// Player-facing item progression labels, injected into the item progression DOM adapter by composition.
export const ITEM_PROGRESSION_LABELS = Object.freeze({
  title: "Прогресія предмета",
  ratingTier: "Клас рейтингу",
  ratingTierOf: (current, maximum) => `Клас рейтингу ${current} з ${maximum}`,
  lineRemaining: "Залишок ліски",
  used: "Використано",
  primaryParameter: "Основний параметр",
  groupRange: "Діапазон групи",
  rating: "Рейтинг",
  ratingPercent: (percent) => `Рейтинг ${percent}%`,
  capacity: "Ємність",
  capacityPercent: (percent) => `Ємність ${percent}%`,
  quality: "Якість",
  qualityOf: (value, maximum) => `Якість ${value} з ${maximum}`,
});

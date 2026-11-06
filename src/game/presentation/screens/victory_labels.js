// Victory window texts (spec 161). Plates carry icons, not words; these are the visible values and accessible names.
const kg = (value, digits) => `${Number(value).toFixed(digits)} kg`;

export const VICTORY_LABELS = Object.freeze({
  dialog: "Риба спіймана",
  title: "Caught",
  claim: "Claim",
  release: "Release",
  showFish: "Показати рибу на весь екран",
  closeFish: "Повернутися до панелі",
  level: (level) => `Рівень ${level}`,
  weight: (value) => kg(value, 3),
  weightName: (value) => `Вага: ${kg(value, 3)}`,
  scaleValue: (value) => Number(value).toFixed(2),
  scale: ({ minKg, maxKg, weightKg, trophyKg }) => `Вага ${kg(weightKg, 3)} у межах ${kg(minKg, 2)} – ${kg(maxKg, 2)}` +
    (trophyKg === null ? "" : `; трофей від ${kg(trophyKg, 2)}`),
  trophy: (isTrophy) => isTrophy ? "Трофей" : "Не трофей",
  anomaly: (hasAnomaly, anomaly) => hasAnomaly ? `Аномалія: ${anomaly}` : "Без аномалії",
  rarity: (rarity) => rarity.isResolved === false || !(rarity.maxHalfSteps > 0) ? "Рідкість невідома"
    : `Рідкість ${rarity.halfSteps}/${rarity.maxHalfSteps}`,
});

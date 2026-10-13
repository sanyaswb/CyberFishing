const formatNumber = (value) => String(Math.round(value * 1000) / 1000).replace(".", ",");

export const KEEPNET_LABELS = Object.freeze({
  open: "Відкрити садок", title: "Садок", close: "Закрити садок",
  help: "Як користуватися садком",
  capacity: "Місткість садка", back: "← Усі види",
  note: "У садку немає прикормки. Живці мають власний відлік життя. Натисніть на вид, щоб оглянути кожну рибу.",
  status: "Прикормка доступна лише в акваріумі",
  kindLabel: "Тип риби", speciesLabel: "Вид риби", allSpecies: "Усі види",
  kinds: [["all", "Уся риба"], ["catch", "Забраний улов"], ["live_bait", "Живці"]],
  empty: "За цими фільтрами риби немає.", unknownRarity: "Рідкість: не збережена",
  catch: "Забраний улов", protected: "Живець · під захистом",
  convert: "На живця", select: "Вибрати живця", deselect: "Скасувати вибір",
  transfer: "В акваріум", release: "Відпустити", confirmRelease: "Так, відпустити", cancel: "Залишити",
  done: "Зміни збережено.", moved: "Рибу перенесено в акваріум.",
  fallback: "Акваріум заповнений. Живця залишено в садку з власним таймером.",
  count: (count, capacity, live, reserved) => `${count} / ${capacity} риб · ${live} живців${reserved ? ` · ${reserved} місце на гачку` : ""}`,
  occupancy: (count, capacity) => `${count} / ${capacity}`,
  groupCount: (count) => `Кількість: ${count}`,
  details: (name, count) => `${name} · ${count} шт.`,
  weight: (kg) => `${formatNumber(kg * 1000)} г`,
  totalWeight: (kg) => `Разом: ${formatNumber(kg * 1000)} г`,
  level: (level) => `Рівень: ${level}`,
  rarity: (value) => typeof value === "string" ? `Рідкість: ${value}` :
    `Рідкість: ${formatNumber(value.halfSteps / value.unitsPerStar)} / ${formatNumber(value.maxHalfSteps / value.unitsPerStar)} ★ (${value.halfSteps}/${value.maxHalfSteps})`,
  lifetime: (ms) => {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `Живець · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  },
  error: (reason) => ({
    keepnet_full: "Садок заповнений: звільніть місце для повернення живця.",
    aquarium_full: "Акваріум заповнений.", aquarium_required: "Спочатку встановіть акваріум у будинку.",
    bait_unavailable: "Цей живець уже недоступний.", not_found: "Цієї риби вже немає в садку.",
    bait_ineligible: "Ця риба не підходить для живця.", hook_busy: "Спочатку поверніть живця з гачка.",
    stale_revision: "Дані змінилися на іншій сторінці. Повторіть дію.",
  })[reason] || `Не вдалося зберегти зміни: ${reason}`,
});

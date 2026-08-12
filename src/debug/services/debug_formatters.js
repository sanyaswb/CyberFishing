class DebugFormatters {
  static number(value, digits = 3) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : "n/a";
  }

  static ms(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "n/a";
    return `${n.toFixed(0)} ms`;
  }

  static equipmentPower(item) {
    if (!item) return 0;
    const stats = item.effectiveStats || item;
    const maxLoad = Number(stats.maxLoadKg);
    const durability = Number(stats.durability ?? 100);
    const lossPerPercent = Number(
      stats.durabilityMaxLoadLossPerPercent ?? 0.001,
    );
    if (!Number.isFinite(maxLoad) || maxLoad <= 0) return 0;
    return (
      maxLoad *
      Math.max(0.1, 1 - Math.max(0, 100 - durability) * lossPerPercent)
    );
  }

  static hookPower(hook) {
    if (!hook) return 0;
    const stats = hook.effectiveStats || hook;
    const equipmentPowerLevel = Number(stats.equipmentPowerLevel) || 0;
    const weight = Number(stats.weight) || 0;
    const equipmentPower = equipmentPowerLevel * weight * 0.01;
    return equipmentPower + new HookQualityModifier().getPowerBonus(
      stats.quality,
    );
  }
}

window.DebugFormatters = DebugFormatters;

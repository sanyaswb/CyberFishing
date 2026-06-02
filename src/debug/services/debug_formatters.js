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
    const maxLoad = Number(item.maxLoadKg);
    const durability = Number(item.durability ?? 100);
    const lossPerPercent = Number(
      item.durabilityMaxLoadLossPerPercent ?? 0.001,
    );
    if (!Number.isFinite(maxLoad) || maxLoad <= 0) return 0;
    return (
      maxLoad *
      Math.max(0.1, 1 - Math.max(0, 100 - durability) * lossPerPercent)
    );
  }

  static hookPower(hook) {
    if (!hook) return 0;
    const level = Number(hook.level) || 0;
    const weight = Number(hook.weight) || 0;
    const quality = Number(hook.quality) || 0;
    return (level * weight + quality) * 0.01;
  }
}

window.DebugFormatters = DebugFormatters;

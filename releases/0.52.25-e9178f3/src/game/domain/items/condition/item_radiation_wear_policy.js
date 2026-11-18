// Spec 179 D10 (TK-370): how much condition an item loses to radiation. exposure — the share of one average full
// emission the item went through (1 = a whole one); roll 0…1 — the item's own roll for the current emission. The loss
// (condition percent points) = the range of its quality at roll × exposure × (1 − its radiation immunity) × wearScale;
// the range is linear between rangeAtQuality1 and rangeAtQuality10 (owner: quality 10 — 20–40 %, quality 1 — 80–100 %).
// settings: CONFIG.emission.wear (read on every call: DevTools edits apply).
export class ItemRadiationWearPolicy {
  range(quality, settings) {
    const share = (Math.max(1, Math.min(10, Number(quality) || 1)) - 1) / 9;
    const low = settings.rangeAtQuality1, high = settings.rangeAtQuality10;
    return [low[0] + (high[0] - low[0]) * share, low[1] + (high[1] - low[1]) * share];
  }

  loss({ quality, immunity = 0, roll, exposure }, settings) {
    if (!(exposure > 0)) return 0;
    const [min, max] = this.range(quality, settings);
    const kept = 1 - Math.max(0, Math.min(1, Number(immunity) || 0));
    return (min + (max - min) * Math.max(0, Math.min(1, roll))) * exposure * kept * Math.max(0, settings.wearScale);
  }
}

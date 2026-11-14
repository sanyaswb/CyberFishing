// «ITEM PROGRESSION» (spec 174 C2, moved out of the service module into «Бази»): each item's progression rating,
// its source values and, for composite strategies, the breakdown.
export class ItemProgressionModule {
  #provider;

  // provider: ItemProgressionDebugSnapshotProvider (getSnapshots()).
  constructor({ provider }) {
    this.#provider = provider;
  }

  mount(host, context) {
    this.#renderItemProgression(host, context);
  }

  #renderItemProgression(parent, { ui, createSection }) {
    const snapshots = this.#provider.getSnapshots();
    if (snapshots.length === 0) return;
    const root = createSection("ITEM PROGRESSION", parent, ["ITEM_PROGRESSION"], { icon: "chart" });
    for (const snapshot of snapshots) {
      const item = createSection(snapshot.itemId, root, ["ITEM_PROGRESSION", snapshot.itemId]);
      ui.createInfoRow("Group", snapshot.group, item);
      ui.createInfoRow("Strategy", snapshot.strategy, item);
      ui.createInfoRow("Raw metric", String(snapshot.rawMetric), item);
      ui.createInfoRow("Baseline min/max", snapshot.baseline, item);
      ui.createInfoRow("Normalized rating", String(snapshot.normalizedRating), item);
      ui.createInfoRow("Rating percent", `${snapshot.ratingPercent}%`, item);
      ui.createInfoRow("Rating tier", snapshot.ratingTier, item);
      ui.createInfoRow("Quality", snapshot.quality, item);
      if (snapshot.capacity !== "N/A") {
        ui.createInfoRow("Capacity", snapshot.capacity, item);
        ui.createInfoRow("Capacity source", snapshot.capacitySource, item);
      }
      ui.createInfoRow("Out-of-range", snapshot.outOfRange, item);
      ui.createInfoRow("Config source", snapshot.configSource, item);
      if (snapshot.breakdown.length > 0) {
        const breakdown = createSection("Composite breakdown", item, ["ITEM_PROGRESSION", snapshot.itemId, "breakdown"]);
        for (const component of snapshot.breakdown) {
          ui.createInfoRow(component.label || component.id,
            `${ItemProgressionModule.#percent(component.percent)}% × ${component.weight}`, breakdown);
        }
      }
    }
  }

  static #percent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "N/A";
    return number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }
}

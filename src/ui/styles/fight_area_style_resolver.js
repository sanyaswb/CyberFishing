class FightAreaStyleResolver {
  #configProvider;
  #cache = null;

  constructor({ configProvider }) {
    if (typeof configProvider !== "function") {
      throw new TypeError("FightAreaStyleResolver requires configProvider");
    }
    this.#configProvider = configProvider;
  }

  resolve() {
    if (this.#cache) return this.#cache;
    const config = this.#configProvider() || {};
    this.#cache = Object.freeze({
      catchFill: config.color || "rgba(0, 150, 255, 0.3)",
      catchStroke: config.strokeColor || "rgba(0, 200, 255, 0.8)",
      lastDashFill:
        config.lastDashFillColor || "rgba(170, 80, 255, 0.12)",
      lastDashStroke:
        config.lastDashStrokeColor || "rgba(190, 90, 255, 0.9)",
      lastDashDash: Object.freeze(
        Array.isArray(config.lastDashDash)
          ? config.lastDashDash.slice()
          : [9, 7],
      ),
      netFill: "rgba(0, 255, 128, 0.05)",
      netStroke: "rgba(0, 255, 128, 0.5)",
      sectorFill: "rgba(175, 0, 35, 0.28)",
      sectorClampedFill: "rgba(210, 35, 25, 0.32)",
      sectorStroke: "rgba(255, 70, 70, 0.98)",
      sectorClampedStroke: "rgba(255, 145, 35, 1)",
      sectorAxis: "rgba(255, 255, 255, 0.7)",
      lineRadiusStroke: "rgba(255, 230, 0, 0.98)",
    });
    return this.#cache;
  }

  invalidate() {
    this.#cache = null;
  }
}

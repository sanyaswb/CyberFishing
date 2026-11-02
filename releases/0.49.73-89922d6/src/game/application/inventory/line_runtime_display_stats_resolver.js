import { RuntimeDisplayStatWriter } from "./runtime_display_stat_writer.js";

export class LineRuntimeDisplayStatsResolver {
  #statWriter;

  constructor({ statWriter = new RuntimeDisplayStatWriter() } = {}) {
    this.#statWriter = statWriter;
  }

  apply(item) {
    if (item?.itemType === "fishing_line") {
      this.#writeIfDefined(item, "lengthMeters", "meters");
      this.#writeIfDefined(item, "diameterMm");
      this.#writeIfDefined(item, "maxLoadKg");
      return;
    }

    if (item?.itemType === "leader_line") {
      this.#writeIfDefined(item, "diameterMm");
      this.#writeIfDefined(item, "maxLoadKg");
    }
  }

  #writeIfDefined(item, key, format = "coefficient") {
    const value = item?.effectiveStats?.[key];
    if (value === undefined || value === null) return;
    this.#statWriter.write(item, key, value, { format });
  }
}

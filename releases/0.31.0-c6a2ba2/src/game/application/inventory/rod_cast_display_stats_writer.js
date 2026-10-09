// Writes the equipped rod's cast-distance display stats (minimum line, cast power, line length, maximum cast
// distance, scale) and its maxDistance into the equipped read model. Labels are injected by composition.
export class RodCastDisplayStatsWriter {
  #castDistanceCalculator;
  #linePolicy;
  #labels;

  constructor({ castDistanceCalculator, linePolicy, labels }) {
    this.#castDistanceCalculator = castDistanceCalculator;
    this.#linePolicy = linePolicy;
    this.#labels = labels;
  }

  writeEquipped(equipment) {
    if (!equipment?.rod) return;
    this.#writeCastDistanceStats(equipment.rod, equipment);
  }

  #writeCastDistanceStats(rodItem, equipment) {
    const labels = this.#labels;
    const meter = labels.meterUnit;
    const previewPower = this.#castDistanceCalculator.getBuildCastPowerCoefficient(equipment);
    const info = this.#castDistanceCalculator.describe(equipment, previewPower);
    const requiredLine = this.#linePolicy.getMinimumLineLengthMeters(rodItem);
    this.#writeRuntimeDisplayStat(
      rodItem,
      labels.minimumLine,
      `${this.#formatMeters(requiredLine)}${meter}`,
    );
    this.#writeRuntimeDisplayStat(
      rodItem,
      labels.castPower,
      this.#formatCoefficient(previewPower),
    );

    if (!equipment?.line) {
      delete rodItem.maxDistance;
      this.#writeRuntimeDisplayStat(rodItem, labels.line, labels.lineNotEquipped);
      this.#deleteRuntimeDisplayStat(rodItem, labels.lineLength);
      this.#deleteRuntimeDisplayStat(rodItem, labels.obsoleteCastPower);
      this.#deleteRuntimeDisplayStat(rodItem, labels.obsoleteCastLength);
      this.#deleteRuntimeDisplayStat(rodItem, labels.maxCastDistance);
      this.#writeRuntimeDisplayStat(
        rodItem,
        labels.scale,
        `${info.pixelsPerMeter}px = 1${meter}`,
      );
      return;
    }

    const lineMeters = this.#formatMeters(info.lineLengthMeters);
    const castMeters = this.#formatMeters(info.effectiveDistanceMeters);
    const castPx = Math.round(info.effectiveDistancePx);
    rodItem.maxDistance = Math.round(info.maxDistancePx);
    this.#writeRuntimeDisplayStat(rodItem, labels.lineLength, `${lineMeters}${meter}`);
    this.#deleteRuntimeDisplayStat(rodItem, labels.obsoleteCastPower);
    this.#deleteRuntimeDisplayStat(rodItem, labels.obsoleteCastLength);
    this.#writeRuntimeDisplayStat(
      rodItem,
      labels.maxCastDistance,
      `${castMeters}${meter} (${castPx}px)`,
    );
    this.#writeRuntimeDisplayStat(
      rodItem,
      labels.scale,
      `${info.pixelsPerMeter}px = 1${meter}`,
    );
    this.#deleteRuntimeDisplayStat(rodItem, labels.line);
  }

  #writeRuntimeDisplayStat(item, label, value) {
    if (!item) return;
    if (!item.displayStats) item.displayStats = {};
    item.displayStats[label] = value;
    delete item[label];
  }

  #deleteRuntimeDisplayStat(item, label) {
    if (!item) return;
    if (item.displayStats) delete item.displayStats[label];
    delete item[label];
  }

  #formatMeters(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }

  #formatCoefficient(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  }
}

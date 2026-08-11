class DegradationColorConfigValidator {
  #errors = [];

  validate(config) {
    this.#errors = [];
    const minimum = Number(config?.range?.minimum);
    const maximum = Number(config?.range?.maximum);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
      this.#error(
        "DEGRADATION_COLOR_CONFIG.range",
        "expected finite minimum below maximum",
      );
      return this.#errors.slice();
    }
    const stops = config?.colorStops;
    if (!Array.isArray(stops) || stops.length < 2) {
      this.#error(
        "DEGRADATION_COLOR_CONFIG.colorStops",
        "expected at least two color stops",
      );
      return this.#errors.slice();
    }
    const ids = new Set();
    let previousPosition = -Infinity;
    stops.forEach((stop, index) => {
      const path = `DEGRADATION_COLOR_CONFIG.colorStops[${index}]`;
      const position = Number(stop?.position);
      if (!String(stop?.id || "").trim() || ids.has(stop.id)) {
        this.#error(`${path}.id`, "expected unique non-empty id");
      } else {
        ids.add(stop.id);
      }
      if (
        !Number.isFinite(position) ||
        position < minimum ||
        position > maximum ||
        position <= previousPosition
      ) {
        this.#error(
          `${path}.position`,
          "expected strictly increasing position inside the configured range",
        );
      }
      previousPosition = position;
      if (!this.#isRgbColor(stop?.color)) {
        this.#error(`${path}.color`, "expected RGB channels in [0, 255]");
      }
    });
    if (Number(stops[0]?.position) !== minimum) {
      this.#error(
        "DEGRADATION_COLOR_CONFIG.colorStops[0].position",
        "first stop must match range minimum",
      );
    }
    if (Number(stops[stops.length - 1]?.position) !== maximum) {
      this.#error(
        `DEGRADATION_COLOR_CONFIG.colorStops[${stops.length - 1}].position`,
        "last stop must match range maximum",
      );
    }
    const progress = config?.interactionProgress;
    if (!this.#isRgbColor(progress?.neutralColor)) {
      this.#error(
        "DEGRADATION_COLOR_CONFIG.interactionProgress.neutralColor",
        "expected RGB channels in [0, 255]",
      );
    }
    for (const key of ["fillAlpha", "glowAlpha"]) {
      const value = Number(progress?.[key]);
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        this.#error(
          `DEGRADATION_COLOR_CONFIG.interactionProgress.${key}`,
          "expected a finite alpha in [0, 1]",
        );
      }
    }
    return this.#errors.slice();
  }

  assertValid(config) {
    const issues = this.validate(config);
    if (issues.length === 0) return true;
    const details = issues
      .map((issue) => `- ${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid degradation color configuration:\n${details}`);
  }

  #error(path, message) {
    this.#errors.push(Object.freeze({ path, message }));
  }

  #isRgbColor(value) {
    return (
      Array.isArray(value) &&
      value.length === 3 &&
      value.every(
        (channel) =>
          Number.isInteger(channel) && channel >= 0 && channel <= 255,
      )
    );
  }
}

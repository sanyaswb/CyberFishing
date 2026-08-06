class DegradationColorResolver {
  #configProvider;

  constructor({ configProvider } = {}) {
    if (typeof configProvider !== "function") {
      throw new TypeError("DegradationColorResolver requires configProvider");
    }
    this.#configProvider = configProvider;
  }

  resolvePercent(value) {
    const config = this.#configProvider() || {};
    const minimum = Number(config.range?.minimum);
    const maximum = Number(config.range?.maximum);
    const stops = Array.isArray(config.colorStops) ? config.colorStops : [];
    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum >= maximum ||
      stops.length < 2
    ) {
      return this.#unavailable("degradation_color_config_invalid");
    }
    const rawValue = Number(value);
    if (!Number.isFinite(rawValue)) {
      return this.#unavailable("degradation_value_missing");
    }
    const percent = Math.max(minimum, Math.min(maximum, rawValue));
    const color = this.#resolveColor(percent, stops);
    return Object.freeze({
      available: true,
      reason: null,
      rawValue,
      percent,
      normalized: (percent - minimum) / (maximum - minimum),
      position: percent,
      color: Object.freeze(color),
      cssColor: `rgb(${color.join(", ")})`,
      outOfRange:
        rawValue < minimum ? "below" : rawValue > maximum ? "above" : null,
    });
  }

  #resolveColor(value, stops) {
    if (value <= Number(stops[0].position)) return stops[0].color.slice(0, 3);
    for (let index = 1; index < stops.length; index += 1) {
      const current = stops[index];
      if (value > Number(current.position)) continue;
      const previous = stops[index - 1];
      const span = Number(current.position) - Number(previous.position);
      const ratio = span > 0
        ? (value - Number(previous.position)) / span
        : 0;
      return previous.color.slice(0, 3).map((channel, channelIndex) =>
        Math.round(
          Number(channel) +
            (Number(current.color[channelIndex]) - Number(channel)) * ratio,
        ),
      );
    }
    return stops[stops.length - 1].color.slice(0, 3);
  }

  #unavailable(reason) {
    return Object.freeze({
      available: false,
      reason,
      rawValue: null,
      percent: null,
      normalized: null,
      position: null,
      color: null,
      cssColor: "",
      outOfRange: null,
    });
  }
}

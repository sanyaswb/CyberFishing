import { RuntimeDisplayStatFormatter } from "./runtime_display_stat_formatter.js";

export class RuntimeDisplayStatWriter {
  #formatter;

  constructor({ formatter = new RuntimeDisplayStatFormatter() } = {}) {
    this.#formatter = formatter;
  }

  write(item, key, value, { format = "coefficient" } = {}) {
    if (!item?.displayStats || value === undefined || value === null) return;
    const stat = this.#parseDescriptor(key, item.displayStatsSchema?.[key]);
    item.displayStats[stat.label] = this.#joinSuffix(
      this.#format(value, format),
      stat.suffix,
    );
  }

  #format(value, format) {
    if (format === "meters") return this.#formatter.formatMeters(value);
    return this.#formatter.formatCoefficient(value);
  }

  #parseDescriptor(key, descriptor) {
    if (descriptor && typeof descriptor === "object") {
      return {
        label: descriptor.label || key,
        suffix: descriptor.suffix || "",
      };
    }

    const text = String(descriptor || key);
    const separatorIndex = text.indexOf(":");
    if (separatorIndex < 0) {
      return { label: text.trim() || key, suffix: "" };
    }

    return {
      label: text.slice(0, separatorIndex).trim() || key,
      suffix: text.slice(separatorIndex + 1).trim(),
    };
  }

  #joinSuffix(value, suffix) {
    const normalized = String(suffix || "").trim();
    if (!normalized) return value;
    const glue = normalized.startsWith("%") ? "" : " ";
    return `${value}${glue}${normalized}`;
  }
}

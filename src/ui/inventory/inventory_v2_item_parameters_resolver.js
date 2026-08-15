const INVENTORY_V2_RARITY_NAMES = Object.freeze({
  common: "Звичайний",
  uncommon: "Незвичайний",
  rare: "Рідкісний",
  epic: "Епічний",
  legendary: "Ультра",
  unique: "Легенда",
});

class InventoryV2ItemParametersResolver {
  #resourceMeterResolver;
  #progressionDomAdapter;
  #parameterConfig;
  #parameterAliases;

  constructor({
    resourceMeterResolver = null,
    progressionDomAdapter = null,
    parameterConfig = null,
    parameterAliases = null,
  } = {}) {
    this.#resourceMeterResolver =
      resourceMeterResolver || new globalThis.InventoryV2ResourceMeterResolver();
    this.#progressionDomAdapter = progressionDomAdapter;
    this.#parameterConfig =
      parameterConfig || globalThis.INVENTORY_V2_ITEM_PARAMETER_CONFIG || {};
    this.#parameterAliases =
      parameterAliases || globalThis.INVENTORY_V2_ITEM_PARAMETER_ALIASES || {};
  }

  resolve(item) {
    if (!item || typeof item !== "object") return Object.freeze([]);
    const parameters = [];
    const renderedIds = new Set();
    const visual = this.#progressionDomAdapter?.resolveVisual?.(item.progression);

    const ratingTier = this.#resolveRatingTier(item);
    if (ratingTier) {
      this.#append(
        parameters,
        renderedIds,
        "ratingTier",
        "text",
        ratingTier,
      );
    }

    if (item.rarity) {
      const rarityId = item.rarity.id || item.rarityProfile?.id;
      const rarityName =
        INVENTORY_V2_RARITY_NAMES[rarityId] || rarityId || "Звичайний";
      const color =
        item.rarityVisual?.cssColor || item.rarityColor || item.rarity.color;
      this.#append(parameters, renderedIds, "rarity", "text", rarityName, {
        color,
      });
    }

    if (item.progression?.quality?.available) {
      const quality = item.progression.quality;
      const filledSections = Number(quality.filledSections) || 0;
      const totalSections = Number(quality.totalSections) || 10;
      const color =
        visual?.quality?.cssColor ||
        item.rarityVisual?.cssColor ||
        item.rarityColor ||
        item.rarity?.color;
      this.#append(
        parameters,
        renderedIds,
        "quality",
        "segments",
        `${quality.value ?? filledSections}/${quality.maximum ?? totalSections}`,
        { filledSections, totalSections, color },
      );
    }

    const rating = item.progression?.rating;
    if (rating?.available && Number.isFinite(Number(rating.percent))) {
      this.#append(
        parameters,
        renderedIds,
        "rating",
        "bar",
        `${Math.round(Number(rating.percent))}%`,
        {
          label: rating.metricLabel,
          percent: rating.percent,
          color: visual?.rating?.cssColor,
        },
      );
    }

    const condition = item.condition;
    if (condition?.available && Number.isFinite(Number(condition.percent))) {
      this.#append(
        parameters,
        renderedIds,
        "condition",
        "bar",
        `${Math.round(Number(condition.percent))}%`,
        {
          percent: condition.percent,
          color: condition.visual?.cssColor || condition.color,
        },
      );
    }

    const freshness = item.freshness;
    if (freshness?.available && Number.isFinite(Number(freshness.percent))) {
      this.#append(
        parameters,
        renderedIds,
        "freshness",
        "bar",
        `${Math.round(Number(freshness.percent))}%`,
        { percent: freshness.percent },
      );
    }

    const resource = this.#resourceMeterResolver.resolve(item);
    if (resource) {
      this.#append(
        parameters,
        renderedIds,
        `resource:${resource.id}`,
        "resource",
        resource.value,
        { label: resource.title, resource },
      );
    }

    const schemaIds = this.#resolveDisplaySchemaIds(item.displayStatsSchema);
    for (const [label, value] of Object.entries(item.displayStats || {})) {
      if (!this.#isDisplayValue(value)) continue;
      const sourceId = schemaIds.get(this.#labelKey(label));
      const parameterId = this.#resolveDisplayParameterId(label, sourceId);
      if (renderedIds.has(parameterId)) continue;
      this.#append(
        parameters,
        renderedIds,
        parameterId,
        "text",
        String(value).trim(),
        { label: String(label).trim() },
      );
    }

    return Object.freeze(parameters);
  }

  #append(parameters, renderedIds, id, kind, value, extras = {}) {
    if (renderedIds.has(id)) return;
    const definition = this.#parameterConfig[id] || {};
    parameters.push(Object.freeze({
      id,
      kind,
      label: extras.label || definition.label || id,
      value,
      description: definition.description || "",
      percent: this.#finiteOrUndefined(extras.percent),
      filledSections: this.#finiteOrUndefined(extras.filledSections),
      totalSections: this.#finiteOrUndefined(extras.totalSections),
      color: extras.color,
      resource: extras.resource || null,
    }));
    renderedIds.add(id);
  }

  #resolveDisplaySchemaIds(schema) {
    const ids = new Map();
    for (const [sourceId, descriptor] of Object.entries(schema || {})) {
      const label = this.#schemaLabel(sourceId, descriptor);
      ids.set(this.#labelKey(label), `stat:${sourceId}`);
    }
    return ids;
  }

  #schemaLabel(sourceId, descriptor) {
    if (descriptor && typeof descriptor === "object") {
      return descriptor.label || sourceId;
    }
    const text = String(descriptor || "");
    if (!text.includes(":")) return sourceId;
    return text.slice(0, text.indexOf(":")) || sourceId;
  }

  #resolveDisplayParameterId(label, schemaId) {
    if (schemaId) {
      return this.#parameterConfig[schemaId]?.aliasOf || schemaId;
    }
    const key = this.#labelKey(label);
    const alias = this.#parameterAliases[key];
    if (alias) return alias;
    const slug = key
      .normalize("NFKD")
      .replace(/[^a-zа-яіїєґ0-9]+/giu, "-")
      .replace(/^-+|-+$/g, "");
    return `stat:${slug || "parameter"}`;
  }

  #resolveRatingTier(item) {
    const ratingTier = item.progression?.ratingTier;
    if (!ratingTier?.available) return "";
    const current = Number(
      ratingTier?.current ??
        ratingTier?.value,
    );
    if (!Number.isFinite(current)) return "";
    const maximum = Number(ratingTier?.maximum);
    const value = Math.max(0, Math.floor(current));
    return Number.isFinite(maximum) && maximum > 0
      ? `${value} / ${Math.floor(maximum)}`
      : String(value);
  }

  #isDisplayValue(value) {
    return (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      typeof value !== "object" &&
      typeof value !== "function"
    );
  }

  #finiteOrUndefined(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  #labelKey(label) {
    return String(label || "").trim().toLocaleLowerCase("uk-UA");
  }
}

globalThis.INVENTORY_V2_RARITY_NAMES = INVENTORY_V2_RARITY_NAMES;
globalThis.InventoryV2ItemParametersResolver =
  InventoryV2ItemParametersResolver;

class InventoryV2BalanceParameterResolver {
  #config;
  #castDistanceCalculator;
  #retrieveSpeedCalculator;
  #reelConfig;
  #physicsConfig;
  #debugConfig;
  #rarityVisualResolver;

  constructor({
    config = null,
    castDistanceCalculator = null,
    retrieveSpeedCalculator = null,
    reelConfig = null,
    physicsConfig = null,
    debugConfig = null,
    rarityVisualResolver = null,
  } = {}) {
    this.#config =
      config || globalThis.INVENTORY_V2_BALANCE_TOOLTIP_CONFIG || {};
    this.#physicsConfig = physicsConfig || globalThis.CONFIG?.physics || {};
    this.#castDistanceCalculator =
      castDistanceCalculator || this.#createCastDistanceCalculator();
    this.#retrieveSpeedCalculator =
      retrieveSpeedCalculator || this.#createRetrieveSpeedCalculator();
    this.#reelConfig =
      reelConfig || this.#physicsConfig?.tackle?.reel || {};
    this.#debugConfig =
      debugConfig || globalThis.CONFIG?.debug?.inventory || {};
    if (
      rarityVisualResolver &&
      typeof rarityVisualResolver.resolve !== "function"
    ) {
      throw new TypeError(
        "InventoryV2BalanceParameterResolver rarityVisualResolver must implement resolve",
      );
    }
    this.#rarityVisualResolver = rarityVisualResolver;
  }

  resolve(item, context = {}) {
    if (!item || typeof item !== "object") return Object.freeze([]);
    const baselines = this.#resolveProgressionBaselines(item);
    const progressionRows = this.#progressionRows(item);
    const contextualRows = this.#baitEffectivenessRows(item);
    const effectiveStatRows = this.#effectiveStatRows(item, baselines);
    const derivedRows = this.#derivedRows(item, context);
    const sections = this.#composeSections({
      item,
      progressionRows,
      contextualRows,
      effectiveStatRows,
      derivedRows,
    });
    return Object.freeze(sections);
  }

  #composeSections({
    item,
    progressionRows,
    contextualRows,
    effectiveStatRows,
    derivedRows,
  }) {
    const gameplayRows = [...progressionRows, ...effectiveStatRows, ...derivedRows];
    const byId = new Map(gameplayRows.map((row) => [row.id, row]));
    const consumed = new Set();
    const take = (...ids) => ids
      .map((id) => byId.get(id))
      .filter((row) => {
        if (!row || consumed.has(row.id)) return false;
        consumed.add(row.id);
        return true;
      });

    const primary = take(
      "rating-tier",
      "rarity",
      "stat:maxLoadKg",
      "quality",
      "condition",
    );
    const sections = [
      this.#section("primary", "Основні параметри", primary),
    ];

    if (this.#isRod(item)) {
      sections.push(this.#section(
        "casting",
        "Закидання",
        take("stat:castPowerCoefficient", "cast-distance"),
      ));
    }
    if (this.#isReel(item)) {
      sections.push(this.#section(
        "retrieve",
        "Підмотка",
        take(
          "stat:retrieveSpeedMetersPerSec",
          "stat:bearingCount",
          "effective-retrieve-speed",
          "retrieve-duration",
        ),
      ));
    }

    sections.push(this.#section(
      "bait-effectiveness",
      "Ефективність за видом риби",
      contextualRows,
    ));

    sections.push(this.#section(
      "additional",
      "Інші параметри",
      gameplayRows.filter((row) => !consumed.has(row.id)),
    ));
    if (this.#debugConfig.showEffectiveStats === true) {
      sections.push(this.#section(
        "effective-stats",
        "EffectiveItemStats · DEBUG",
        effectiveStatRows,
        { showTechnicalPaths: true },
      ));
    }
    return sections.filter((section) => section.rows.length > 0);
  }

  #progressionRows(item) {
    const rows = [];
    const rarity = this.#rarityName(item);
    if (rarity) {
      rows.push(this.#row({
        id: "rarity",
        label: "Рідкість",
        technicalPath: "rarity",
        actualText: rarity,
      }));
    }

    const ratingTierDescriptor = item.progression?.ratingTier;
    const ratingTier = Number(
      ratingTierDescriptor?.current ??
        ratingTierDescriptor?.value,
    );
    if (ratingTierDescriptor?.available && Number.isFinite(ratingTier)) {
      rows.push(this.#row({
        id: "rating-tier",
        label: "Клас рейтингу",
        technicalPath: "progression.ratingTier",
        actual: ratingTier,
        baseline: 1,
        precision: 0,
        direction: "higher_is_better",
      }));
    }

    const quality = item.progression?.quality;
    const qualityValue = Number(quality?.value);
    if (quality?.available && Number.isFinite(qualityValue)) {
      const minimum = Number.isFinite(Number(quality?.minimum))
        ? Number(quality.minimum)
        : 1;
      const maximum = Number.isFinite(Number(quality?.maximum))
        ? Number(quality.maximum)
        : 10;
      rows.push(this.#row({
        id: "quality",
        label: "Якість",
        technicalPath: "progression.quality",
        actual: qualityValue,
        baseline: minimum,
        actualText: `${this.#formatNumber(qualityValue, 0)}/${this.#formatNumber(maximum, 0)}`,
        baselineText: `${this.#formatNumber(minimum, 0)}/${this.#formatNumber(maximum, 0)}`,
        precision: 0,
        direction: "higher_is_better",
      }));
    }

    const condition = Number(item.condition?.percent);
    if (item.condition?.available && Number.isFinite(condition)) {
      rows.push(this.#row({
        id: "condition",
        label: "Поточний стан",
        technicalPath: "condition.percent",
        actual: condition,
        baseline: 100,
        unit: "%",
        precision: 0,
        direction: "higher_is_better",
      }));
    }

    const freshness = Number(item.freshness?.percent);
    if (item.freshness?.available && Number.isFinite(freshness)) {
      rows.push(this.#row({
        id: "freshness",
        label: "Свіжість",
        technicalPath: "freshness.percent",
        actual: freshness,
        baseline: 100,
        unit: "%",
        precision: 0,
        direction: "higher_is_better",
      }));
    }

    const rating = item.progression?.rating;
    if (
      rating?.available === true &&
      Number.isFinite(Number(rating.rawValue))
    ) {
      const ratingMinimum = Number(rating.minimum);
      rows.push(this.#row({
        id: "rating",
        label: rating.metricLabel || "Рейтинг категорії",
        technicalPath: `progression.rating.${rating.metricId || "value"}`,
        actual: Number(rating.rawValue),
        baseline: Number.isFinite(ratingMinimum) ? ratingMinimum : null,
        unit: rating.metricSuffix || "",
        direction: "higher_is_better",
        impacts: Number.isFinite(Number(rating.percent))
          ? [this.#impact(
              "Позиція в балансному діапазоні",
              `${this.#formatNumber(rating.percent, 2)}%`,
              "neutral",
            )]
          : [],
      }));
    }
    return rows;
  }

  #baitEffectivenessRows(item) {
    const descriptor = item.baitEffectiveness;
    if (!descriptor?.available || !Array.isArray(descriptor.entries)) {
      return [];
    }
    return descriptor.entries.map((entry) => {
      const multiplier = Number(entry.multiplier);
      const relative = Number(entry.relativeEffectiveness);
      const impacts = [];
      if (entry.discovered && Number.isFinite(relative)) {
        impacts.push(this.#impact(
          "Відносно найкращої наживки для цього виду",
          `${this.#formatNumber(relative * 100, 0)}%`,
          "neutral",
        ));
      }
      if (
        entry.discovered &&
        Number.isFinite(Number(entry.freshnessMultiplier)) &&
        Number(entry.freshnessMultiplier) !== 1
      ) {
        impacts.push(this.#impact(
          "Модифікатор свіжості",
          `×${this.#formatNumber(entry.freshnessMultiplier, 2)}`,
          "negative",
        ));
      }
      return this.#row({
        id: `bait-effectiveness:${entry.fishId}`,
        label: entry.fishName || entry.fishId,
        technicalPath:
          `fish.${entry.fishId}.baitMultipliers.${descriptor.baitId}`,
        actualText: this.#effectivenessText(entry),
        baselineText:
          entry.discovered && Number.isFinite(Number(entry.effectiveMultiplier ?? multiplier))
            ? `×${this.#formatNumber(entry.effectiveMultiplier ?? multiplier, 2)}`
            : "—",
        baselineLabel: "множник клювання",
        impacts,
      });
    });
  }

  #effectivenessText(entry) {
    if (!entry?.discovered) return "Невідомо";
    if (!entry.compatible) return "Не підходить";
    const maximum = Math.max(1, Math.floor(Number(entry.maximumStars) || 5));
    const filled = Math.max(
      0,
      Math.min(maximum, Math.floor(Number(entry.stars) || 0)),
    );
    return `${"★".repeat(filled)}${"☆".repeat(maximum - filled)}`;
  }

  #effectiveStatRows(item, baselines) {
    const values = [];
    this.#flattenEffectiveStats(item.effectiveStats || {}, "", values);
    return values
      .filter(([path]) => path !== "quality")
      .map(([path, actual]) => {
        const definition = this.#definition(item, path);
        const progressionBaseline = baselines.get(path);
        const configuredBaseline = Number(definition.baseline);
        const baseline = progressionBaseline?.minimum ??
          (Number.isFinite(configuredBaseline) ? configuredBaseline : null);
        return this.#row({
          id: `stat:${path}`,
          label: definition.label,
          technicalPath: `effectiveStats.${path}`,
          actual,
          baseline,
          unit: definition.unit,
          precision: definition.precision,
          direction:
            progressionBaseline?.direction ||
            definition.direction ||
            "neutral",
          baselineLabel: progressionBaseline
            ? "мінімум балансу"
            : definition.baselineLabel || "базове значення",
        });
      });
  }

  #derivedRows(item, context) {
    return [
      ...this.#resolveReelDerivedRows(item),
      ...this.#resolveRodDerivedRows(item, context),
    ];
  }

  #resolveReelDerivedRows(item) {
    if (!this.#isReel(item) || !this.#retrieveSpeedCalculator?.calculate) {
      return [];
    }
    const stats = item.effectiveStats || {};
    const baseSpeed = Number(stats.retrieveSpeedMetersPerSec);
    const bearingCount = Number(stats.bearingCount) || 0;
    const bearingBonus = Number(
      this.#reelConfig?.bearingRetrieveSpeedBonusMetersPerSec,
    );
    if (!Number.isFinite(baseSpeed) || !Number.isFinite(bearingBonus)) {
      return [];
    }
    const effectiveSpeed = Number(this.#retrieveSpeedCalculator.calculate({
      baseSpeedMetersPerSec: baseSpeed,
      bearingCount,
      bearingBonusMetersPerSec: bearingBonus,
    }));
    if (!Number.isFinite(effectiveSpeed)) return [];

    const distanceMeters = Math.max(
      0,
      Number(stats.lineCapacityMeters) ||
        Number(this.#config.retrieveTimeReferenceMeters) ||
        10,
    );
    const rows = [this.#row({
      id: "effective-retrieve-speed",
      label: "Фактична швидкість підмотки",
      technicalPath: "derived.effectiveRetrieveSpeedMetersPerSec",
      actual: effectiveSpeed,
      baseline: baseSpeed,
      unit: "м/с",
      direction: "higher_is_better",
      baselineLabel: "без підшипників",
      impacts: bearingCount > 0
        ? [this.#impact(
            `Підшипники ×${this.#formatNumber(bearingCount, 0)}`,
            this.#signed(effectiveSpeed - baseSpeed, "м/с"),
            this.#tone(effectiveSpeed - baseSpeed, "higher_is_better"),
          )]
        : [],
    })];

    if (distanceMeters > 0 && baseSpeed > 0 && effectiveSpeed > 0) {
      const baseDuration = distanceMeters / baseSpeed;
      const effectiveDuration = distanceMeters / effectiveSpeed;
      const durationDelta = effectiveDuration - baseDuration;
      rows.push(this.#row({
        id: "retrieve-duration",
        label: `Час змотування ${this.#formatNumber(distanceMeters, 2)} м`,
        technicalPath: "derived.retrieveDurationSeconds",
        actual: effectiveDuration,
        baseline: baseDuration,
        unit: "с",
        direction: "lower_is_better",
        baselineLabel: "без підшипників",
        impacts: bearingCount > 0
          ? [this.#impact(
              `Вплив ${this.#formatNumber(bearingCount, 0)} підшипників`,
              this.#signed(durationDelta, "с"),
              this.#tone(durationDelta, "lower_is_better"),
            )]
          : [],
      }));
    }
    return rows;
  }

  #resolveRodDerivedRows(item, context) {
    if (!this.#isRod(item) || !this.#castDistanceCalculator?.describe) {
      return [];
    }
    const equipment = context?.equipment || {};
    const isActiveRod = Boolean(
      item.instanceId && equipment.rod?.instanceId === item.instanceId,
    );
    const activeLine = isActiveRod ? equipment.line : null;
    const activeLineMeters = Number(
      activeLine?.effectiveStats?.lengthMeters,
    );
    const referenceMeters = activeLineMeters > 0
      ? activeLineMeters
      : Math.max(0, Number(this.#config.referenceCastDistanceMeters) || 12);
    const line = activeLineMeters > 0
      ? activeLine
      : {
          itemType: "fishing_line",
          effectiveStats: Object.freeze({ lengthMeters: referenceMeters }),
        };
    const previewEquipment = {
      ...equipment,
      rod: item,
      reel: isActiveRod ? equipment.reel || null : null,
      line,
    };
    const castPowerCoefficient =
      this.#castDistanceCalculator.getBuildCastPowerCoefficient?.(
        previewEquipment,
      );
    const actual = this.#castDistanceCalculator.describe(
      previewEquipment,
      Number.isFinite(Number(castPowerCoefficient))
        ? Number(castPowerCoefficient)
        : null,
    );
    const baseline = this.#castDistanceCalculator.describe(
      previewEquipment,
      1,
    );
    if (
      !Number.isFinite(Number(actual?.effectiveDistanceMeters)) ||
      !Number.isFinite(Number(baseline?.effectiveDistanceMeters))
    ) {
      return [];
    }

    const deltaMeters =
      Number(actual.effectiveDistanceMeters) -
      Number(baseline.effectiveDistanceMeters);
    const deltaPx =
      Number(actual.effectiveDistancePx) -
      Number(baseline.effectiveDistancePx);
    const impacts = [this.#impact(
      "Сила закидання",
      this.#formatNumber(actual.castPowerCoefficient, 2),
      this.#tone(
        Number(actual.castPowerCoefficient) - 1,
        "higher_is_better",
      ),
    )];
    if (!activeLineMeters) {
      impacts.push(this.#impact(
        "База попереднього розрахунку",
        `${this.#formatNumber(referenceMeters, 2)} м`,
        "neutral",
      ));
    }

    return [this.#row({
      id: "cast-distance",
      label: "Дальність закиду",
      technicalPath: "derived.castDistance",
      actual: Number(actual.effectiveDistanceMeters),
      baseline: Number(baseline.effectiveDistanceMeters),
      actualText:
        `${this.#formatNumber(actual.effectiveDistanceMeters, 2)} м ` +
        `(${Math.round(Number(actual.effectiveDistancePx))} px)`,
      baselineText:
        `${this.#formatNumber(baseline.effectiveDistanceMeters, 2)} м ` +
        `(${Math.round(Number(baseline.effectiveDistancePx))} px)`,
      deltaText:
        `${this.#signed(deltaMeters, "м")} ` +
        `(${this.#signed(Math.round(deltaPx), "px", 0)})`,
      direction: "higher_is_better",
      impacts,
    })];
  }

  #resolveProgressionBaselines(item) {
    const baselines = new Map();
    const rating = item.progression?.rating;
    for (const component of rating?.breakdown || []) {
      const minimum = Number(component.minimum);
      if (!component.id || !Number.isFinite(minimum)) continue;
      baselines.set(component.id, {
        minimum,
        direction: this.#config.stats?.[component.id]?.direction,
      });
    }
    if (
      rating?.metricId &&
      Number.isFinite(Number(rating.minimum)) &&
      !baselines.has(rating.metricId)
    ) {
      baselines.set(rating.metricId, {
        minimum: Number(rating.minimum),
        direction: this.#config.stats?.[rating.metricId]?.direction,
      });
    }
    return baselines;
  }

  #flattenEffectiveStats(value, path, output) {
    if (this.#isIgnored(path)) return;
    if (Array.isArray(value)) {
      if (value.every((entry) => this.#isScalar(entry))) {
        output.push([path, value.join(", ")]);
      }
      return;
    }
    if (!value || typeof value !== "object") {
      if (path && this.#isScalar(value)) output.push([path, value]);
      return;
    }
    for (const key of Object.keys(value).sort((left, right) =>
      left.localeCompare(right, "en"),
    )) {
      const childPath = path ? `${path}.${key}` : key;
      this.#flattenEffectiveStats(value[key], childPath, output);
    }
  }

  #definition(item, path) {
    const key = path.split(".").pop();
    const configured = this.#config.stats?.[path] ||
      this.#config.stats?.[key] ||
      {};
    const schema = this.#schemaDescriptor(item.displayStatsSchema?.[key], key);
    return {
      ...configured,
      label: schema.label || configured.label || this.#humanize(key),
      unit: schema.unit || configured.unit || "",
    };
  }

  #schemaDescriptor(descriptor, fallbackLabel) {
    if (descriptor && typeof descriptor === "object") {
      return {
        label: String(descriptor.label || fallbackLabel || "").trim(),
        unit: String(descriptor.suffix || "").trim(),
      };
    }
    const text = String(descriptor || "").trim();
    if (!text) return { label: "", unit: "" };
    const separator = text.indexOf(":");
    return separator >= 0
      ? {
          label: text.slice(0, separator).trim() || fallbackLabel,
          unit: text.slice(separator + 1).trim(),
        }
      : { label: fallbackLabel, unit: "" };
  }

  #row({
    id,
    label,
    technicalPath,
    actual = null,
    baseline = null,
    actualText = null,
    baselineText = null,
    deltaText = null,
    baselineLabel = "мінімум",
    unit = "",
    precision = 2,
    direction = "neutral",
    impacts = [],
  }) {
    const numericActual =
      actual === null || actual === undefined || actual === ""
        ? NaN
        : Number(actual);
    const numericBaseline =
      baseline === null || baseline === undefined || baseline === ""
        ? NaN
        : Number(baseline);
    const hasNumericComparison =
      Number.isFinite(numericActual) && Number.isFinite(numericBaseline);
    const delta = hasNumericComparison
      ? numericActual - numericBaseline
      : null;
    return Object.freeze({
      id,
      label: String(label || id),
      technicalPath: String(technicalPath || id),
      actual: actualText || this.#formatValue(actual, unit, precision),
      baseline: baselineText ||
        (Number.isFinite(numericBaseline)
          ? this.#formatValue(numericBaseline, unit, precision)
          : "—"),
      baselineLabel,
      delta: deltaText ||
        (delta === null ? "" : this.#signed(delta, unit, precision)),
      tone: delta === null ? "neutral" : this.#tone(delta, direction),
      impacts: Object.freeze([...(impacts || [])]),
    });
  }

  #impact(label, value, tone = "neutral") {
    return Object.freeze({ label, value, tone });
  }

  #section(id, title, rows, { showTechnicalPaths = false } = {}) {
    return Object.freeze({
      id,
      title,
      showTechnicalPaths,
      rows: Object.freeze([...(rows || [])]),
    });
  }

  #formatValue(value, unit, precision = 2) {
    if (typeof value === "boolean") return value ? "Так" : "Ні";
    const numeric = Number(value);
    const formatted = Number.isFinite(numeric)
      ? this.#formatNumber(numeric, precision)
      : String(value ?? "—");
    const normalizedUnit = String(unit || "").trim();
    if (!normalizedUnit) return formatted;
    return normalizedUnit.startsWith("%")
      ? `${formatted}${normalizedUnit}`
      : `${formatted} ${normalizedUnit}`;
  }

  #signed(value, unit = "", precision = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "";
    const threshold = Math.pow(10, -Math.max(0, Number(precision) || 0)) / 2;
    const normalized = Math.abs(numeric) < threshold ? 0 : numeric;
    const prefix = normalized > 0 ? "+" : "";
    return `${prefix}${this.#formatValue(normalized, unit, precision)}`;
  }

  #formatNumber(value, precision = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "0";
    const decimals = Number.isInteger(precision) ? precision : 2;
    if (decimals === 0) return String(Math.round(numeric));
    return numeric
      .toFixed(decimals)
      .replace(/0+$/, "")
      .replace(/\.$/, "");
  }

  #tone(delta, direction) {
    const numeric = Number(delta);
    if (!Number.isFinite(numeric) || Math.abs(numeric) < 0.0000001) {
      return "neutral";
    }
    if (direction === "lower_is_better") {
      return numeric < 0 ? "positive" : "negative";
    }
    if (direction === "higher_is_better") {
      return numeric > 0 ? "positive" : "negative";
    }
    return "neutral";
  }

  #rarityName(item) {
    const rarity = item.rarity;
    if (typeof rarity === "string") return rarity;
    if (!rarity) return "";
    const rarityId = this.#rarityVisualResolver?.resolve(rarity)?.id ||
      rarity.id ||
      "";
    return globalThis.INVENTORY_V2_RARITY_NAMES?.[rarityId] || rarityId;
  }

  #humanize(value) {
    const text = String(value || "Параметр")
      .replace(/([a-zа-яіїєґ])([A-ZА-ЯІЇЄҐ])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .trim();
    return text ? text.charAt(0).toLocaleUpperCase("uk-UA") + text.slice(1) : "Параметр";
  }

  #isIgnored(path) {
    if (!path) return false;
    return (this.#config.ignoredEffectiveStatsPaths || []).some(
      (ignored) => path === ignored || path.startsWith(`${ignored}.`),
    );
  }

  #isScalar(value) {
    return ["string", "number", "boolean"].includes(typeof value) &&
      value !== "" &&
      (typeof value !== "number" || Number.isFinite(value));
  }

  #isReel(item) {
    return item?.itemType === "reel";
  }

  #isRod(item) {
    return item?.itemType === "rod";
  }

  #createCastDistanceCalculator() {
    return typeof globalThis.CastDistanceCalculator === "function"
      ? new globalThis.CastDistanceCalculator(globalThis.CONFIG || {})
      : null;
  }

  #createRetrieveSpeedCalculator() {
    return typeof globalThis.ReelRetrieveSpeedCalculator === "function"
      ? new globalThis.ReelRetrieveSpeedCalculator()
      : null;
  }
}

globalThis.InventoryV2BalanceParameterResolver =
  InventoryV2BalanceParameterResolver;

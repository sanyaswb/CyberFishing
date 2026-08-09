const INVENTORY_V2_STAT_DESCRIPTIONS = Object.freeze({
  "рівень": "Рівень предмета. Більш високий рівень відкриває доступ до кращих характеристик.",
  "якість": "Рідкість предмета. Впливає на базові показники та кількість можливих покращень.",
  "сила": "Поточна потужність або ефективність предмета відносно його максимального потенціалу.",
  "стан": "Технічний стан предмета. Якщо стан падає до нуля, предмет може зламатися або втратити ефективність.",
  "підшипники": "Кількість підшипників. Забезпечують плавнішу роботу котушки та додають бонус до швидкості підмотки.",
  "місткість шпулі": "Максимальна довжина ліски, яку може вмістити котушка.",
  "тест": "Рекомендована вага приманок або оснасток для цього вудилища.",
  "макс. навантаження": "Максимальна вага, яку витримує снасть перед обривом або поломкою.",
  "товщина": "Діаметр ліски. Товща ліска міцніша, але може відлякувати обережну рибу.",
  "довжина": "Фізична довжина вудилища. Впливає на дальність закидання.",
  "вага": "Маса предмета. Впливає на швидкість втоми рибака.",
  "передавальне число": "Співвідношення оборотів шпулі до одного обороту ручки котушки. Впливає на швидкість і тягу.",
  "швидкість підмотки": "Швидкість, з якою котушка намотує ліску (метрів за секунду)."
});

const INVENTORY_V2_RARITY_NAMES = Object.freeze({
  "common": "Звичайний",
  "uncommon": "Незвичайний",
  "rare": "Рідкісний",
  "epic": "Епічний",
  "legendary": "Ультра",
  "unique": "Легенда"
});

class InventoryV2ItemParametersResolver {
  #resourceMeterResolver;
  #progressionDomAdapter;

  constructor({ resourceMeterResolver = null, progressionDomAdapter = null } = {}) {
    this.#resourceMeterResolver =
      resourceMeterResolver || new globalThis.InventoryV2ResourceMeterResolver();
    this.#progressionDomAdapter = progressionDomAdapter;
  }

  resolve(item) {
    if (!item || typeof item !== "object") return Object.freeze([]);
    const parameters = [];
    const renderedLabels = new Set();
    const visual = this.#progressionDomAdapter?.resolveVisual?.(item.progression);

    // 1. Level
    const level = this.#resolveLevel(item);
    if (level) {
      parameters.push(this.#createStat("level", "text", "Рівень", level));
      renderedLabels.add("рівень");
    }

    // 2. Rarity
    if (item.rarity) {
      const rarityId = item.rarity.id || item.rarityProfile?.id;
      const rarityName = INVENTORY_V2_RARITY_NAMES[rarityId] || rarityId || "Звичайний";
      const color = item.rarityVisual?.cssColor || item.rarityColor || item.rarity.color;
      parameters.push(this.#createStat("rarity", "text", "Рідкість", rarityName, { color }));
      renderedLabels.add("рідкість");
    }

    // 2.5 Quality Segments
    if (item.progression?.quality?.available) {
      const q = item.progression.quality;
      const filled = q.filledSections || 0;
      const total = q.totalSections || 10;
      const color = visual?.quality?.cssColor || item.rarityVisual?.cssColor || item.rarityColor || item.rarity?.color;
      parameters.push(this.#createStat("quality", "segments", "Якість", `${q.value || filled}/${q.maximum || total}`, { 
        filledSections: filled, 
        totalSections: total,
        color: color
      }));
      renderedLabels.add("якість");
    }

    // 3. Power (bar)
    const power = item.progression?.power;
    if (power?.available && power.percent !== undefined) {
      const label = power.metricLabel || "Сила";
      parameters.push(this.#createStat("power", "bar", label, `${Math.round(power.percent)}%`, { 
        percent: power.percent,
        color: visual?.power?.cssColor 
      }));
      renderedLabels.add(this.#labelKey(label));
    }

    // 4. Condition (bar)
    const condition = item.condition;
    if (condition && condition.percent !== undefined) {
      const color = condition.visual?.cssColor || condition.color;
      parameters.push(this.#createStat("condition", "bar", "Стан", `${Math.round(condition.percent)}%`, { 
        percent: condition.percent, 
        color 
      }));
      renderedLabels.add("стан");
    }

    // 5. Existing Resource Meters (e.g. Energy / Charge)
    const resource = this.#resourceMeterResolver.resolve(item);
    if (resource) {
      parameters.push(this.#createStat(`resource:${resource.id}`, "bar", resource.title, resource.value, { percent: resource.percent }));
      renderedLabels.add(this.#labelKey(resource.title));
    }

    // 6. Display Stats
    for (const [label, value] of Object.entries(item.displayStats || {})) {
      if (!this.#isDisplayValue(value)) continue;
      const labelKey = this.#labelKey(label);
      if (!labelKey || renderedLabels.has(labelKey)) continue;
      
      parameters.push(this.#createStat(`stat:${labelKey}`, "text", String(label).trim(), String(value).trim()));
      renderedLabels.add(labelKey);
    }
    
    return Object.freeze(parameters);
  }

  #createStat(id, kind, label, value, extras = {}) {
    const labelKey = this.#labelKey(label);
    const description = INVENTORY_V2_STAT_DESCRIPTIONS[labelKey] || "";
    
    return Object.freeze({
      id,
      kind,
      label,
      value,
      description,
      percent: extras.percent,
      filledSections: extras.filledSections,
      totalSections: extras.totalSections,
      color: extras.color
    });
  }

  #resolveLevel(item) {
    const progressionLevel = item.progression?.level;
    const current = Number(
      progressionLevel?.current ?? progressionLevel?.value ?? item.level ?? item.engineStats?.level,
    );
    if (!Number.isFinite(current)) return "";
    const maximum = Number(progressionLevel?.maximum);
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

  #labelKey(label) {
    return String(label || "").trim().toLocaleLowerCase("uk-UA");
  }
}

globalThis.INVENTORY_V2_STAT_DESCRIPTIONS = INVENTORY_V2_STAT_DESCRIPTIONS;
globalThis.INVENTORY_V2_RARITY_NAMES = INVENTORY_V2_RARITY_NAMES;
globalThis.InventoryV2ItemParametersResolver = InventoryV2ItemParametersResolver;

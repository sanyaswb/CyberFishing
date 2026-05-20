class DevTools {
  #config;
  #ui;
  #isOpen = false;
  #liveData = null;
  #activeFishKey = "";

  #excludeKeys = [
    "id",
    "name",
    "icon", // ДОДАНО: ігноруємо емодзі, щоб не створювати для них зайвих полів
    "bgUrls",
    "depthUrl",
    "endpoint",
    "backgroundColor",
    "colorGradient",
    "statuses",
  ];

  constructor(config) {
    this.#config = config;
    this.#ui = new DevToolsUI(() => this.toggle(), this.#config);
    document.addEventListener("debug-live-update", (event) => {
      this.#liveData = event.detail || null;
      const nextFishKey = this.#getActiveFishKey();
      if (this.#isOpen && nextFishKey !== this.#activeFishKey) {
        this.#populatePanel();
      }
    });
  }

  toggle() {
    this.#isOpen = !this.#isOpen;
    this.#ui.togglePanel(this.#isOpen);

    if (this.#isOpen) {
      this.#populatePanel();
    }
  }

  #populatePanel() {
    const body = this.#ui.body;
    body.innerHTML = "";
    this.#activeFishKey = this.#getActiveFishKey();

    // 1. OVERLAY MODULES
    if (typeof OVERLAY_MODULES !== "undefined") {
      const content = this.#createSectionWithCache(
        "OVERLAY MODULES (На Екрані)",
        body,
      );
      for (const k in OVERLAY_MODULES) {
        this.#ui.createSwitcherRow(
          k,
          OVERLAY_MODULES[k],
          content,
          (v) => (OVERLAY_MODULES[k] = v),
        );
      }
    }

    // 2. CONSOLE MODULES
    if (typeof window !== "undefined" && window.DEBUG_MODULES) {
      const content = this.#createSectionWithCache(
        "CONSOLE MODULES (Логи F12)",
        body,
      );
      for (const k in window.DEBUG_MODULES) {
        this.#ui.createSwitcherRow(
          k,
          window.DEBUG_MODULES[k],
          content,
          (v) => {
            window.DEBUG_MODULES[k] = v;
            document.dispatchEvent(
              new CustomEvent("debug-module-toggled", {
                detail: { module: k, enabled: v },
              }),
            );
          },
        );
      }
    }

    // 3. ITEM_DB (БАЗА ПРЕДМЕТІВ)
    if (typeof ITEM_DB !== "undefined") {
      const dbContent = this.#createSectionWithCache(
        "📦 БАЗА ПРЕДМЕТІВ (ITEM_DB)",
        body,
      );
      for (const key of Object.keys(ITEM_DB)) {
        if (this.#excludeKeys.includes(key)) continue;
        const sectionContent = this.#createSectionWithCache(key, dbContent);
        // Шлях тепер починається з "ITEM_DB"
        this.#buildTree(ITEM_DB[key], sectionContent, ["ITEM_DB", key]);
      }
    }

    // 4. FISH_DB (БАЗА РИБИ)
    if (typeof FISH_DB !== "undefined") {
      const fishDbContent = this.#createSectionWithCache(
        "🐟 БАЗА РИБИ (FISH_DB)",
        body,
      );
      FISH_DB.forEach((fish, index) => {
        const fishLabel = fish?.id || fish?.name || `Fish [${index}]`;
        const sectionContent = this.#createSectionWithCache(
          fishLabel,
          fishDbContent,
        );
        this.#buildTree(fish, sectionContent, ["FISH_DB", index]);
      });
    }

    // 5. MAP_DB (БАЗА ЛОКАЦІЙ)
    if (typeof MAP_DB !== "undefined") {
      const mapDbContent = this.#createSectionWithCache(
        "🗺️ БАЗА ЛОКАЦІЙ (MAP_DB)",
        body,
      );
      for (const key of Object.keys(MAP_DB)) {
        const location = MAP_DB[key];
        const locationLabel = location?.id || location?.name || key;
        const sectionContent = this.#createSectionWithCache(
          locationLabel,
          mapDbContent,
        );
        this.#buildTree(location, sectionContent, ["MAP_DB", key]);
      }
    }

    // 6. CONFIG (НАЛАШТУВАННЯ ГРИ)
    if (typeof CONFIG !== "undefined") {
      const configContent = this.#createSectionWithCache(
        "⚙️ НАЛАШТУВАННЯ (CONFIG)",
        body,
      );
      for (const key of Object.keys(CONFIG)) {
        if (this.#excludeKeys.includes(key)) continue;
        const sectionContent = this.#createSectionWithCache(key, configContent);
        // Шлях тепер починається з "CONFIG"
        this.#buildTree(CONFIG[key], sectionContent, ["CONFIG", key]);
      }
    }

    this.#renderActiveFishSection(body);
  }

  #renderActiveFishSection(body) {
    const hookedFish = this.#liveData?.hookedFish;
    if (!hookedFish) return;

    const fishLabel = hookedFish.id || hookedFish.name || "hookedFish";
    const activeFishContent = this.#createSectionWithCache(
      `ACTIVE FISH (${fishLabel})`,
      body,
    );
    this.#renderActiveFishRuntimeControls(hookedFish, activeFishContent);
    this.#buildTree(hookedFish, activeFishContent, ["HOOKED_FISH"]);
  }

  #renderActiveFishRuntimeControls(hookedFish, parentElement) {
    this.#ensureActiveFishRuntimePhysics(hookedFish);

    const levelContent = this.#createSectionWithCache(
      "level runtime",
      parentElement,
    );
    this.#ui.createInputRow(
      "weight",
      Number(hookedFish.weight) || 0,
      levelContent,
      "number",
      (newValue) =>
        this.#updateConfigValue(["HOOKED_FISH", "weight"], newValue),
    );
    this.#ui.createInputRow(
      "level",
      Number(hookedFish.level) || 0,
      levelContent,
      "number",
      (newValue) => this.#updateConfigValue(["HOOKED_FISH", "level"], newValue),
    );

    hookedFish.physics = hookedFish.physics || {};
    this.#ui.createInputRow(
      "levelBasePower",
      Number(hookedFish.physics.levelBasePower) || 0,
      levelContent,
      "number",
      (newValue) =>
        this.#updateConfigValue(
          ["HOOKED_FISH", "physics", "levelBasePower"],
          newValue,
        ),
    );
    this.#ui.createInputRow(
      "levelBaseSpeedMetersPerSec",
      Number(hookedFish.physics.baseSpeedMetersPerSec) || 0,
      levelContent,
      "number",
      (newValue) =>
        this.#updateConfigValue(
          ["HOOKED_FISH", "physics", "baseSpeedMetersPerSec"],
          newValue,
        ),
    );

    this.#renderActiveFishRetrieveControls(hookedFish, parentElement);
    this.#renderActiveFishForceControls(hookedFish, parentElement);
  }

  #renderActiveFishRetrieveControls(hookedFish, parentElement) {
    const fishRetrieve = hookedFish.physics?.fishRetrieve;
    if (!fishRetrieve) return;

    const content = this.#createSectionWithCache(
      "fishRetrieve runtime",
      parentElement,
    );
    const fields = [
      "maxPullSpeedMetersPerSecond",
      "staticBodyResistanceKgPerKg",
      "waterDragKgPerKgPerMps2",
      "pullAccelerationMetersPerSecond2",
      "accelerationResistanceKgPerKgPerMps2",
    ];

    for (const field of fields) {
      this.#ui.createInputRow(
        field,
        Number(fishRetrieve[field]) || 0,
        content,
        "number",
        (newValue) =>
          this.#updateConfigValue(
            ["HOOKED_FISH", "physics", "fishRetrieve", field],
            newValue,
          ),
      );
    }
  }

  #renderActiveFishForceControls(hookedFish, parentElement) {
    const physics = hookedFish.physics;
    if (!physics) return;

    const content = this.#createSectionWithCache(
      "fish force runtime",
      parentElement,
    );
    const fields = [
      "basePower",
      "baseSpeedMetersPerSec",
      "speedForceMultiplier",
      "waterResistanceMultiplier",
      "waterResistanceKgPerKgPerMps",
      "minPowerRatio",
      "minStaminaActivityMultiplier",
      "exhaustedSpeedRatio",
      "agility",
    ];

    for (const field of fields) {
      this.#ui.createInputRow(
        field,
        Number(physics[field]) || 0,
        content,
        "number",
        (newValue) =>
          this.#updateConfigValue(["HOOKED_FISH", "physics", field], newValue),
      );
    }

    const directionForce = physics.directionForce;
    if (!directionForce) return;

    const directionContent = this.#createSectionWithCache(
      "directionForce runtime",
      content,
    );
    for (const field of [
      "sameDirectionMultiplier",
      "sideDirectionMultiplier",
      "oppositeDirectionMultiplier",
    ]) {
      this.#ui.createInputRow(
        field,
        Number(directionForce[field]) || 0,
        directionContent,
        "number",
        (newValue) =>
          this.#updateConfigValue(
            ["HOOKED_FISH", "physics", "directionForce", field],
            newValue,
          ),
      );
    }
  }

  #ensureActiveFishRuntimePhysics(hookedFish) {
    hookedFish.physics = hookedFish.physics || {};
    const physics = hookedFish.physics;
    const globalPhysics = this.#config?.physics || {};

    physics.fishRetrieve = this.#withDefaultNumbers(
      physics.fishRetrieve,
      globalPhysics.fishRetrieve,
      [
        "maxPullSpeedMetersPerSecond",
        "staticBodyResistanceKgPerKg",
        "waterDragKgPerKgPerMps2",
        "pullAccelerationMetersPerSecond2",
        "accelerationResistanceKgPerKgPerMps2",
      ],
    );
    physics.directionForce = this.#withDefaultNumbers(
      physics.directionForce,
      globalPhysics.directionForce,
      [
        "sameDirectionMultiplier",
        "sideDirectionMultiplier",
        "oppositeDirectionMultiplier",
      ],
    );
    this.#applyDefaultNumber(
      physics,
      "waterResistanceKgPerKgPerMps",
      globalPhysics.waterResistanceKgPerKgPerMps,
    );
    this.#applyDefaultNumber(physics, "minStaminaActivityMultiplier", 0.75);
    this.#applyDefaultNumber(physics, "exhaustedSpeedRatio", 0.25);
  }

  #getActiveFishKey() {
    const fish = this.#liveData?.hookedFish;
    if (!fish) return "";
    return `${fish.id || fish.name || "hookedFish"}:${fish.level ?? ""}:${fish.weight ?? ""}`;
  }

  #shouldSkipKey(path, key) {
    if (this.#excludeKeys.includes(key)) return true;
    if (
      path[0] === "HOOKED_FISH" &&
      (key === "weight" ||
        key === "level" ||
        key === "maxLevel" ||
        key === "resistance" ||
        key === "biteSequence")
    ) {
      return true;
    }
    if (
      path[0] === "HOOKED_FISH" &&
      path[1] === "physics" &&
      (key === "fishRetrieve" || key === "directionForce")
    ) {
      return true;
    }

    const isConfigLocationsMap =
      path[0] === "CONFIG" && path[1] === "locations" && key === "map";
    const isConfigSpawnsFishes =
      path[0] === "CONFIG" && path[1] === "spawns" && key === "fishes";

    return isConfigLocationsMap || isConfigSpawnsFishes;
  }

  #createSectionWithCache(labelStr, parentElement) {
    let savedStates =
      typeof CacheManager !== "undefined"
        ? CacheManager.get("dev_tools_sections_state", {})
        : {};
    let isExpanded = savedStates[labelStr] || false;

    return this.#ui.createSection(
      labelStr,
      parentElement,
      isExpanded,
      (isNowExpanded) => {
        if (typeof CacheManager !== "undefined") {
          savedStates = CacheManager.get("dev_tools_sections_state", {});
          savedStates[labelStr] = isNowExpanded;
          CacheManager.set("dev_tools_sections_state", savedStates);
        }
      },
    );
  }

  #buildTree(obj, parentElement, path) {
    for (const key in obj) {
      if (this.#shouldSkipKey(path, key)) continue;

      const val = obj[key];
      const currentPath = [...path, key];

      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === "number") {
          this.#ui.createInputRow(
            key,
            val.join(", "),
            parentElement,
            "array",
            (newVal) => this.#updateConfigValue(currentPath, newVal),
          );
        } else if (val.length > 0 && typeof val[0] === "object") {
          const content = this.#createSectionWithCache(key, parentElement);
          val.forEach((item, index) => {
            const itemLabel = item.id || item.type || `Item [${index}]`;
            const itemContent = this.#createSectionWithCache(
              itemLabel,
              content,
            );
            this.#buildTree(item, itemContent, [...currentPath, index]);
          });
        }
      } else if (val !== null && typeof val === "object") {
        const content = this.#createSectionWithCache(key, parentElement);
        this.#buildTree(val, content, currentPath);
      } else if (
        typeof val === "number" ||
        typeof val === "boolean" ||
        typeof val === "string"
      ) {
        if (typeof val === "boolean") {
          this.#ui.createSwitcherRow(key, val, parentElement, (newVal) =>
            this.#updateConfigValue(currentPath, newVal),
          );
        } else if (typeof val === "string") {
          if (key === "currentMethod") {
            this.#ui.createEnumToggleRow(
              key,
              ["hand", "boat"],
              val,
              parentElement,
              (newVal) => this.#updateConfigValue(currentPath, newVal),
            );
          } else {
            this.#ui.createInputRow(
              key,
              val,
              parentElement,
              "string",
              (newVal) => this.#updateConfigValue(currentPath, newVal),
            );
          }
        } else {
          this.#ui.createInputRow(key, val, parentElement, "number", (newVal) =>
            this.#updateConfigValue(currentPath, newVal),
          );
        }
      }
    }
  }

  #updateConfigValue(path, newValue) {
    const root = this.#resolveEditableRoot(path[0]);
    if (!root) return;

    let target = root;

    // Проходимо по всьому шляху, пропускаючи нульовий індекс (назва кореня)
    for (let i = 1; i < path.length - 1; i++) {
      target = target[path[i]];
    }

    target[path[path.length - 1]] = newValue;
    this.#syncHookedFishLevelBalance(path);
    if (path[0] === "HOOKED_FISH") {
      this.#emitHookedFishUpdated(path, newValue, root);
      return;
    }
    this.#syncItemDbStatAliases(path, newValue);
    console.log(`[DevTools] Оновлено ${path.join(".")} =`, newValue);

    // Відправляємо подію з повним шляхом (наприклад: ["ITEM_DB", "rods", "rod_test_spin", "engineStats", "basePower"])
    document.dispatchEvent(
      new CustomEvent("config-updated", {
        detail: { path: path, value: newValue },
      }),
    );
  }

  #resolveEditableRoot(rootName) {
    if (rootName === "ITEM_DB" && typeof ITEM_DB !== "undefined") return ITEM_DB;
    if (rootName === "FISH_DB" && typeof FISH_DB !== "undefined") return FISH_DB;
    if (rootName === "HOOKED_FISH") return this.#liveData?.hookedFish || null;
    if (rootName === "MAP_DB" && typeof MAP_DB !== "undefined") return MAP_DB;
    if (rootName === "CONFIG" && typeof CONFIG !== "undefined") return CONFIG;
    return null;
  }

  #emitHookedFishUpdated(path, value, fish) {
    console.log(`[DevTools] Оновлено ${path.join(".")} =`, value);
    document.dispatchEvent(
      new CustomEvent("debug-hooked-fish-updated", {
        detail: { path, value, fish },
      }),
    );
  }

  #syncHookedFishLevelBalance(path) {
    if (path[0] !== "HOOKED_FISH") return;

    const changedKey = path[path.length - 1];
    if (changedKey !== "weight" && changedKey !== "level") return;

    const fish = this.#liveData?.hookedFish;
    if (!fish) return;

    const template = this.#findFishTemplate(fish);
    const ranges = template?.weightConfig?.levelWeightRanges;
    if (!Array.isArray(ranges) || ranges.length === 0) return;

    const range = changedKey === "weight"
      ? this.#findLevelRangeByWeight(ranges, fish.weight)
      : this.#findLevelRangeByLevel(ranges, fish.level);
    if (!range) return;

    fish.level = Math.max(1, Math.round(Number(range.level) || fish.level || 1));
    fish.physics = fish.physics || {};
    this.#applyFiniteNumber(fish.physics, "levelBasePower", range.basePower);
    this.#applyFiniteNumber(
      fish.physics,
      "baseSpeedMetersPerSec",
      this.#firstFiniteNumber(
        range.baseSpeedMetersPerSec,
        range.speedMetersPerSec,
        range.speed,
      ),
    );
  }

  #findFishTemplate(fish) {
    if (typeof FISH_DB === "undefined" || !Array.isArray(FISH_DB)) return null;
    return FISH_DB.find((candidate) => candidate?.id === fish?.id) || null;
  }

  #findLevelRangeByLevel(ranges, level) {
    const targetLevel = Math.round(Number(level) || 1);
    return ranges.find((range) => Math.round(Number(range?.level) || 0) === targetLevel) || null;
  }

  #findLevelRangeByWeight(ranges, weight) {
    const value = Number(weight);
    if (!Number.isFinite(value)) return null;

    let firstRange = null;
    let lastRange = null;
    for (const range of ranges) {
      const min = Number(range?.min);
      const max = Number(range?.max);
      if (!Number.isFinite(min) || !Number.isFinite(max)) continue;

      const normalized = {
        range,
        min: Math.min(min, max),
        max: Math.max(min, max),
      };
      if (!firstRange) firstRange = normalized;
      lastRange = normalized;
      if (value >= normalized.min && value <= normalized.max) return range;
    }

    if (!firstRange) return null;
    return value < firstRange.min ? firstRange.range : lastRange.range;
  }

  #applyFiniteNumber(target, key, value) {
    if (!Number.isFinite(Number(value))) return;
    target[key] = Math.max(0, Number(value));
  }

  #withDefaultNumbers(target, defaults, keys) {
    const result = target && typeof target === "object" ? target : {};
    for (const key of keys) {
      this.#applyDefaultNumber(result, key, defaults?.[key]);
    }
    return result;
  }

  #applyDefaultNumber(target, key, value) {
    if (Number.isFinite(Number(target?.[key]))) return;
    if (!Number.isFinite(Number(value))) return;
    target[key] = Math.max(0, Number(value));
  }

  #firstFiniteNumber(...values) {
    for (const value of values) {
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return NaN;
  }

  #syncItemDbStatAliases(path, newValue) {
    if (path[0] !== "ITEM_DB" || path.length < 5) return;

    const category = path[1];
    const itemId = path[2];
    const group = path[3];
    const field = path[4];
    const item = ITEM_DB?.[category]?.[itemId];
    if (!item || typeof item !== "object") return;

    if (group === "displayStats") {
      const engineKey = this.#resolveDisplayStatEngineKey(
        item,
        category,
        field,
        newValue,
      );
      if (!engineKey) return;
      item.engineStats = item.engineStats || {};
      item.engineStats[engineKey] = newValue;
      return;
    }

    if (group === "engineStats") {
      const displayKey = this.#resolveEngineStatDisplayKey(item, field);
      if (!displayKey) return;
      item.displayStats[displayKey] = newValue;
    }
  }

  #resolveDisplayStatEngineKey(item, category, field, value) {
    const key = String(field).toLowerCase();
    if (key === "level") return "level";
    if (key === "power" || key === "basepower" || key === "strength") {
      return "basePower";
    }
    if (key === "maxdistance" || key === "distance") return "maxDistance";

    if (category !== "rods") return null;
    const keys = Object.keys(item.displayStats || {});
    const index = keys.indexOf(field);
    if (index === 0 && Number.isFinite(Number(value))) return "level";
    if (index === 1 && Number.isFinite(Number(value))) return "basePower";
    return null;
  }

  #resolveEngineStatDisplayKey(item, field) {
    const displayStats = item.displayStats;
    if (!displayStats || typeof displayStats !== "object") return null;

    for (const key of Object.keys(displayStats)) {
      const engineKey = this.#resolveDisplayStatEngineKey(
        item,
        "rods",
        key,
        displayStats[key],
      );
      if (engineKey === field) return key;
    }

    if (
      field === "level" &&
      Object.prototype.hasOwnProperty.call(displayStats, "level")
    ) {
      return "level";
    }
    if (
      field === "basePower" &&
      Object.prototype.hasOwnProperty.call(displayStats, "power")
    ) {
      return "power";
    }
    if (
      field === "maxDistance" &&
      Object.prototype.hasOwnProperty.call(displayStats, "distance")
    ) {
      return "distance";
    }
    return null;
  }
}

class DevToolsUI {
  #panel;
  #body;
  #btn;
  #onToggleCallback;

  constructor(onToggleCallback, config) {
    this.#onToggleCallback = onToggleCallback;
    this.#initStyles();
    this.#initBtn(config);
    this.#initPanel();
  }

  get body() {
    return this.#body;
  }

  togglePanel(isOpen) {
    if (isOpen) {
      this.#panel.classList.add("open");
    } else {
      this.#panel.classList.remove("open");
    }
  }

  createSection(labelStr, parentElement, isExpanded, onToggle) {
    const section = document.createElement("div");
    section.className = "devtools-section";

    const title = document.createElement("div");
    title.className = "devtools-section-title";
    title.innerHTML = `<span>${isExpanded ? "▼" : "▶"}</span> ${labelStr}`;

    const content = document.createElement("div");
    content.className = "devtools-section-content";
    content.style.display = isExpanded ? "block" : "none";

    title.addEventListener("click", () => {
      const isHidden = content.style.display === "none";
      content.style.display = isHidden ? "block" : "none";
      title.innerHTML = `<span>${isHidden ? "▼" : "▶"}</span> ${labelStr}`;
      if (onToggle) onToggle(isHidden);
    });

    section.appendChild(title);
    section.appendChild(content);
    parentElement.appendChild(section);

    return content;
  }

  createSwitcherRow(labelStr, initialValue, parentElement, onChangeCallback) {
    const row = document.createElement("div");
    row.className = "devtools-row";

    const label = document.createElement("div");
    label.className = "devtools-label";
    label.innerText = labelStr;
    row.appendChild(label);

    const inputElement = document.createElement("label");
    inputElement.className = "switch";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = initialValue;

    const slider = document.createElement("span");
    slider.className = "slider";

    inputElement.appendChild(cb);
    inputElement.appendChild(slider);
    row.appendChild(inputElement);

    cb.addEventListener("change", (e) => onChangeCallback(e.target.checked));
    parentElement.appendChild(row);
  }

  createInputRow(key, val, parentElement, type, onChangeCallback) {
    const row = document.createElement("div");
    row.className = "devtools-row";

    const label = document.createElement("div");
    label.className = "devtools-label";
    label.innerText = key;
    row.appendChild(label);

    let inputElement;

    if (type === "number") {
      inputElement = document.createElement("input");
      inputElement.type = "number";
      inputElement.step = "any";
      inputElement.className = "devtools-input-num";
      inputElement.value = val;
      inputElement.addEventListener("change", (e) =>
        onChangeCallback(parseFloat(e.target.value) || 0),
      );
    } else {
      inputElement = document.createElement("input");
      inputElement.type = "text";
      inputElement.className = "devtools-input-text";
      inputElement.value = val;
      inputElement.addEventListener("change", (e) => {
        let newVal = e.target.value;
        if (type === "array") {
          newVal = newVal.split(",").map((n) => parseFloat(n.trim()) || 0);
        }
        onChangeCallback(newVal);
      });
    }

    row.appendChild(inputElement);
    parentElement.appendChild(row);
  }

  createEnumToggleRow(
    key,
    optionsArray,
    currentValue,
    parentElement,
    onChangeCallback,
  ) {
    const row = document.createElement("div");
    row.className = "devtools-row";

    const label = document.createElement("div");
    label.className = "devtools-label";
    label.innerText = key;
    row.appendChild(label);

    const btn = document.createElement("button");
    btn.className = "devtools-btn-enum";
    btn.innerText = currentValue;
    Object.assign(btn.style, {
      background: "#3a3a50",
      color: "#00ccff",
      border: "1px solid #5a5a70",
      borderRadius: "4px",
      padding: "2px 8px",
      cursor: "pointer",
      fontWeight: "bold",
      width: "80px",
    });

    btn.addEventListener("click", () => {
      let currentIndex = optionsArray.indexOf(btn.innerText);
      let nextIndex = (currentIndex + 1) % optionsArray.length;
      let newVal = optionsArray[nextIndex];
      btn.innerText = newVal;
      onChangeCallback(newVal);
    });

    row.appendChild(btn);
    parentElement.appendChild(row);
  }

  #initStyles() {
    if (document.getElementById("devtools-styles")) return;

    const style = document.createElement("style");
    style.id = "devtools-styles";
    document.head.appendChild(style);
  }

  #initBtn(config) {
    this.#btn = document.createElement("button");
    this.#btn.innerHTML = "⚙️";

    Object.assign(this.#btn.style, {
      position: "absolute",
      top: "15px",
      left: "160px",
      fontSize: "32px",
      background: "transparent",
      border: "none",
      padding: "0",
      cursor: "pointer",
      zIndex: "9998",
      filter: "drop-shadow(0px 2px 5px rgba(0,0,0,0.8))",
      transition: "transform 0.1s ease",
    });

    this.#btn.addEventListener(
      "mouseenter",
      () => (this.#btn.style.transform = "scale(1.1)"),
    );
    this.#btn.addEventListener(
      "mouseleave",
      () => (this.#btn.style.transform = "scale(1)"),
    );

    UIUtils.makeSolid(this.#btn);

    if (typeof UIDraggableButton !== "undefined") {
      new UIDraggableButton(this.#btn, this.#onToggleCallback, config, {
        id: "devtools_btn",
        noTransform: true,
      });
    } else {
      this.#btn.addEventListener("click", this.#onToggleCallback);
    }

    document.body.appendChild(this.#btn);
  }

  #initPanel() {
    this.#panel = document.createElement("div");
    this.#panel.className = "devtools-panel";

    this.#panel.innerHTML = `
            <div class="devtools-header">
                <h2>⚙️ DEV TOOLS</h2>
                <button class="devtools-close">×</button>
            </div>
            <div class="devtools-body"></div>
        `;

    document.body.appendChild(this.#panel);
    this.#body = this.#panel.querySelector(".devtools-body");

    UIUtils.makeSolid(this.#panel);

    this.#panel
      .querySelector(".devtools-close")
      .addEventListener("click", this.#onToggleCallback);
  }
}

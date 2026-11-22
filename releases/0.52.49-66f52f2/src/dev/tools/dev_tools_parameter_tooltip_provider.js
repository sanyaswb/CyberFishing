export class DevToolsParameterTooltipProvider {
  #descriptionsByKey = {};
  #readyPromise;
  #abortController = typeof AbortController === "function" ? new AbortController() : null;
  #disposed = false;

  constructor({
    urls = [
      "src/dev/metadata/dev_tool_parameter_descriptions.json",
      "src/dev/metadata/parameter_labels.json",
    ],
  } = {}) {
    this.#readyPromise = this.#load(urls);
  }

  get ready() {
    return this.#readyPromise;
  }

  dispose() {
    this.#disposed = true;
    this.#abortController?.abort();
    this.#descriptionsByKey = {};
  }

  // Spec 174 C3: a parameter's Ukrainian name and description for its row. path: the dotted path ("CONFIG.ui.boat.x"
  // or "ui.boat.x"); key: the label shown. parameter_labels.json is matched by the whole path only (its leaf names repeat
  // across groups); the key list (dev_tool_parameter_descriptions.json) by key. null when nothing describes it.
  // TK-318: database rows share one description per field: FISH_DB.<index>. → fish., a behaviour state → behaviors.*.,
  // a location (MAP_DB.<id>. or CONFIG.locations.map.<id>.) → MAP_DB. — the paths parameter_labels.json and the config
  // validator use.
  describe(path, key) {
    const normalized = String(path || "").replace(/^CONFIG\./u, "")
      .replace(/^FISH_DB\.[^.]+\./u, "fish.")
      .replace(/^(?:MAP_DB|locations\.map)\.[^.]+\./u, "MAP_DB.")
      .replace(/\.behaviors\.[^.*]+\./u, ".behaviors.*.")
      // TK-336: an item of a list of records shares one description per field (fog.hours.0.fromHour → fog.hours.*.fromHour).
      .replace(/\.\d+(?=\.)/gu, ".*");
    const byPath = normalized ? this.#descriptionsByKey[normalized] : null;
    if (byPath?.path === normalized) return { name: byPath.label, description: byPath.description };
    const byKey = this.#descriptionsByKey[String(key)];
    if (byKey?.key) return { name: String(byKey.ua || "").replace(/_/gu, " "), description: byKey.description || "" };
    return null;
  }

  async #load(urls) {
    if (typeof fetch !== "function") return;

    const targetUrls = Array.isArray(urls) ? urls : [urls];
    const responses = await Promise.allSettled(
      targetUrls.map((url) => this.#loadOne(url)),
    );

    for (const response of responses) {
      if (!this.#disposed && response.status === "fulfilled") {
        this.#ingestDescriptions(response.value);
      }
    }
  }

  async #loadOne(url) {
    try {
      const response = await fetch(url, { cache: "no-cache", signal: this.#abortController?.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (this.#disposed) return null;
      console.warn(
        "[DevTools] Tooltip descriptions failed to load:",
        url,
        error,
      );
      return null;
    }
  }

  #ingestDescriptions(descriptions) {
    if (!descriptions) return;

    if (Array.isArray(descriptions)) {
      for (const item of descriptions) {
        if (!item?.key) continue;
        this.#descriptionsByKey[item.key] = item;
      }
      return;
    }

    for (const [path, item] of Object.entries(descriptions)) {
      if (!item?.label) continue;

      const normalized = {
        path,
        label: item.label,
        description: item.description || "",
      };
      this.#descriptionsByKey[path] = normalized;
    }
  }
}

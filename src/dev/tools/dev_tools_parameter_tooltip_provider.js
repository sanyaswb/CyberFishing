export class DevToolsParameterTooltipProvider {
  #descriptionsByKey = {};
  #readyPromise;
  #abortController = typeof AbortController === "function" ? new AbortController() : null;
  #disposed = false;

  constructor({
    urls = [
      "src/config/metadata/dev_tool_parameter_descriptions.json",
      "src/config/metadata/parameter_labels.json",
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

  getTooltip(labelText) {
    const description = this.#descriptionsByKey[String(labelText)];
    if (!description) return "";

    if (description.path) {
      return `${description.path} = ${description.label}:\n${description.description}`;
    }

    return `${description.key} = ${description.ua}:\n${description.description}`;
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

      const leafKey = path.split(".").pop();
      if (leafKey && !this.#descriptionsByKey[leafKey]) {
        this.#descriptionsByKey[leafKey] = normalized;
      }
    }
  }
}

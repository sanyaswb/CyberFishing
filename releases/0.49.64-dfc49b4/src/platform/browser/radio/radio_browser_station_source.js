// Spec 142: Radio Browser over fetch. The mirrors are tried in order; a mirror that fails or does not answer within
// requestTimeoutMs gives way to the next one. Returns the raw JSON lists (stations of a country, countries); filtering
// is the caller's (RadioStationFilter). The response text never becomes markup.
export class RadioBrowserStationSource {
  #fetch;
  #config;
  #createAbortController;
  #setTimeout;
  #clearTimeout;

  // fetchRef: window.fetch; config: () => CONFIG.radio; scheduler: { setTimeout, clearTimeout }.
  constructor({ fetchRef, config, createAbortController = () => new AbortController(), scheduler }) {
    if (typeof fetchRef !== "function") throw new TypeError("RadioBrowserStationSource requires fetch");
    this.#fetch = fetchRef;
    this.#config = config;
    this.#createAbortController = createAbortController;
    this.#setTimeout = (callback, ms) => scheduler.setTimeout(callback, ms);
    this.#clearTimeout = (id) => scheduler.clearTimeout(id);
  }

  listStations(countryCode) {
    const code = encodeURIComponent(String(countryCode || "").toUpperCase());
    const limit = Math.max(1, Number(this.#config()?.stationLimit) || 60);
    return this.#get(`/json/stations/bycountrycodeexact/${code}?hidebroken=true&order=votes&reverse=true&limit=${limit}`);
  }

  listCountries() {
    return this.#get("/json/countries?order=name&hidebroken=true");
  }

  async #get(path) {
    const servers = this.#config()?.apiServers || [];
    let lastError = new Error("No Radio Browser server configured");
    for (const server of servers) {
      const abort = this.#createAbortController();
      const timer = this.#setTimeout(() => abort.abort(), Math.max(1, Number(this.#config()?.requestTimeoutMs) || 8000));
      try {
        const response = await this.#fetch(`${String(server).replace(/\/+$/u, "")}${path}`, {
          signal: abort.signal, headers: { Accept: "application/json" },
        });
        if (!response?.ok) throw new Error(`Radio Browser ${server} answered ${response?.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error(`Radio Browser ${server} returned no list`);
        return data;
      } catch (error) {
        lastError = error;
      } finally {
        this.#clearTimeout(timer);
      }
    }
    throw lastError;
  }
}

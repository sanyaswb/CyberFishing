// Spec 142 D1: the first radio country without any GeoIP service: the region of the browser's languages (uk-UA -> UA),
// then the time zone through the configured table, then the configured default.
export class BrowserRegionResolver {
  #navigator;
  #timeZone;
  #config;

  // navigatorRef: window.navigator; timeZone: () => the IANA zone; config: () => CONFIG.radio.
  constructor({ navigatorRef, timeZone, config }) {
    this.#navigator = navigatorRef;
    this.#timeZone = timeZone;
    this.#config = config;
  }

  resolve() {
    const languages = [...(this.#navigator?.languages || []), this.#navigator?.language].filter(Boolean);
    for (const language of languages) {
      const region = String(language).split(/[-_]/u)[1];
      if (/^[A-Za-z]{2}$/u.test(region || "")) return region.toUpperCase();
    }
    const zone = String(this.#timeZone?.() || "");
    const byZone = this.#config()?.timeZoneCountries?.[zone];
    if (byZone) return String(byZone).toUpperCase();
    return String(this.#config()?.defaultCountry || "UA").toUpperCase();
  }
}

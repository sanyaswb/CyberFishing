// Reads the page's own timing entries for the startup report (spec 157 R9): startup marks, paints, the navigation
// entry and every resource entry, copied into plain objects, plus the device facts a phone report needs. The resource
// count is read first so the overlay rebuilds its report only when something new arrived.
export class BrowserStartupTimingReader {
  #performance;
  #windowTarget;

  constructor({ windowTarget }) {
    if (typeof windowTarget?.performance?.getEntriesByType !== "function") {
      throw new TypeError("BrowserStartupTimingReader requires windowTarget.performance");
    }
    this.#windowTarget = windowTarget;
    this.#performance = windowTarget.performance;
  }

  // Changes whenever a resource, mark or paint entry is added.
  revision() {
    const entries = this.#performance;
    return `${entries.getEntriesByType("resource").length}/${entries.getEntriesByType("mark").length}/${
      entries.getEntriesByType("paint").length}`;
  }

  read() {
    const copy = ({ name, initiatorType, startTime, responseEnd, transferSize, encodedBodySize, decodedBodySize }) =>
      ({ name, initiatorType, startTime, responseEnd, transferSize, encodedBodySize, decodedBodySize });
    const navigation = this.#performance.getEntriesByType("navigation")[0];
    return {
      marks: this.#performance.getEntriesByType("mark").map(({ name, startTime }) => ({ name, startTime })),
      paints: this.#performance.getEntriesByType("paint").map(({ name, startTime }) => ({ name, startTime })),
      navigation: navigation ? copy(navigation) : null,
      resources: this.#performance.getEntriesByType("resource").map(copy),
    };
  }

  environment() {
    const target = this.#windowTarget;
    const connection = target.navigator?.connection;
    return {
      url: String(target.location?.href ?? ""),
      userAgent: String(target.navigator?.userAgent ?? ""),
      viewport: `${target.innerWidth}x${target.innerHeight}`,
      devicePixelRatio: Number(target.devicePixelRatio) || 1,
      connection: connection ? { effectiveType: connection.effectiveType ?? null, downlinkMbps: connection.downlink ?? null,
        rttMs: connection.rtt ?? null, saveData: connection.saveData === true } : null,
    };
  }
}

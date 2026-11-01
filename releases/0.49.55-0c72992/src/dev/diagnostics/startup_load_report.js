import { STARTUP_MARK_PREFIX, STARTUP_STAGE_ORDER, STARTUP_STAGES } from "../../engine/diagnostics/startup_stages.js";

// Startup report (spec 157 R9) from the browser's timing entries, shared by the DEV overlay "ЗАВАНТАЖЕННЯ" and
// `npm run measure:startup` so both count the same way. Input is plain data (marks, paints, the navigation entry and
// resource entries); nothing here reads the browser.
// - T-paint: first contentful paint (first paint when the browser reports no contentful one); T-play: the "ready" mark.
// - Bytes are transferred (compressed, with headers) as the browser reports transferSize; a resource with transferSize
//   0 and a body is a cache hit; encoded/decoded sizes are the compressed and uncompressed bodies.
// - Network steps: the longest chain of requests where each one started only after the previous one had finished
//   (each module is discovered after its importer arrived), counted from the page's HTML; spec 157 Waterfall metric.
export const STARTUP_RESOURCE_KINDS = Object.freeze(["modules", "styles", "images", "audio", "vendor", "data", "other"]);

const EXTENSION_KINDS = Object.freeze({
  js: "modules", mjs: "modules", css: "styles",
  webp: "images", png: "images", jpg: "images", jpeg: "images", svg: "images", gif: "images", avif: "images",
  mp3: "audio", m4a: "audio", ogg: "audio", wav: "audio",
  json: "data", atlas: "data", skel: "data",
});
const TOP_COUNT = 10;

export class StartupLoadReport {
  // timings: { marks: [{ name, startTime }], paints: [{ name, startTime }], navigation: entry | null,
  //   resources: [{ name, initiatorType, startTime, responseEnd, transferSize, encodedBodySize, decodedBodySize }] }
  static build({ marks = [], paints = [], navigation = null, resources = [] } = {}) {
    const stages = StartupLoadReport.#stages(marks);
    const readyStage = stages.find((stage) => stage.stage === STARTUP_STAGES.ready);
    const playMs = readyStage ? readyStage.atMs : null;
    const paint = paints.find((entry) => entry.name === "first-contentful-paint")
      ?? paints.find((entry) => entry.name === "first-paint");
    const requests = resources.map((entry) => StartupLoadReport.#request(entry));
    if (navigation) requests.unshift({ ...StartupLoadReport.#request(navigation), kind: "document" });
    const beforePlay = playMs === null ? requests : requests.filter((request) => request.endMs <= playMs);
    const chain = StartupLoadReport.#deepestChain(beforePlay);
    return Object.freeze({
      paintMs: paint ? paint.startTime : null,
      playMs,
      stages,
      beforePlay: StartupLoadReport.#totals(beforePlay),
      all: StartupLoadReport.#totals(requests),
      networkSteps: chain.length,
      moduleSteps: StartupLoadReport.#deepestChain(beforePlay.filter((request) =>
        request.kind === "document" || request.kind === "modules")).length,
      // The requests of the deepest chain, first to last: what to cut to shorten the waterfall.
      deepestChain: Object.freeze(chain.map((request) => request.url)),
      largest: [...beforePlay].sort((a, b) => b.encoded - a.encoded || b.decoded - a.decoded).slice(0, TOP_COUNT),
      longest: [...beforePlay].sort((a, b) => b.durationMs - a.durationMs).slice(0, TOP_COUNT),
    });
  }

  static kindOf(url) {
    const path = String(url).split(/[?#]/u)[0];
    if (/\/vendor\//u.test(path)) return "vendor";
    const extension = path.match(/\.([a-z0-9]+)$/iu)?.[1]?.toLowerCase();
    return EXTENSION_KINDS[extension] ?? "other";
  }

  static #stages(marks) {
    const times = new Map();
    for (const mark of marks) {
      if (!String(mark.name).startsWith(STARTUP_MARK_PREFIX)) continue;
      const stage = mark.name.slice(STARTUP_MARK_PREFIX.length);
      if (!times.has(stage)) times.set(stage, mark.startTime);
    }
    const stages = [];
    let previous = 0;
    for (const stage of STARTUP_STAGE_ORDER) {
      if (!times.has(stage)) continue;
      const atMs = times.get(stage);
      stages.push(Object.freeze({ stage, atMs, sinceMs: atMs - previous }));
      previous = atMs;
    }
    return Object.freeze(stages);
  }

  static #request(entry) {
    const transferred = Math.max(0, Number(entry.transferSize) || 0);
    const encoded = Math.max(0, Number(entry.encodedBodySize) || 0);
    const decoded = Math.max(0, Number(entry.decodedBodySize) || 0);
    const startMs = Math.max(0, Number(entry.startTime) || 0);
    const endMs = Math.max(startMs, Number(entry.responseEnd) || startMs);
    return Object.freeze({ url: String(entry.name), kind: StartupLoadReport.kindOf(entry.name), startMs, endMs,
      durationMs: endMs - startMs, transferred, encoded, decoded, cached: transferred === 0 && decoded > 0 });
  }

  static #totals(requests) {
    const empty = () => ({ count: 0, cached: 0, transferred: 0, encoded: 0, decoded: 0 });
    const total = empty();
    const byKind = Object.fromEntries(["document", ...STARTUP_RESOURCE_KINDS].map((kind) => [kind, empty()]));
    for (const request of requests) {
      for (const bucket of [total, byKind[request.kind]]) {
        bucket.count += 1;
        if (request.cached) bucket.cached += 1;
        bucket.transferred += request.transferred;
        bucket.encoded += request.encoded;
        bucket.decoded += request.decoded;
      }
    }
    return Object.freeze({ ...total, byKind: Object.freeze(byKind) });
  }

  // Requests in start order; a request continues the deepest chain among those that had finished when it started.
  // The finished ones are taken in end order with a running maximum, so the work is O(n log n) for ~900 requests.
  static #deepestChain(requests) {
    const byStart = [...requests].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
    const byEnd = [...byStart].sort((a, b) => a.endMs - b.endMs);
    const depth = new Map();
    const previous = new Map();
    let finished = 0;
    let deepestFinished = null;
    let deepest = null;
    for (const request of byStart) {
      while (finished < byEnd.length && byEnd[finished].endMs <= request.startMs) {
        const candidate = byEnd[finished];
        // Ties go to the request that finished last: the likeliest one to have revealed the next request.
        if (depth.has(candidate) && (deepestFinished === null || depth.get(candidate) >= depth.get(deepestFinished))) {
          deepestFinished = candidate;
        }
        finished += 1;
      }
      depth.set(request, deepestFinished === null ? 1 : depth.get(deepestFinished) + 1);
      previous.set(request, deepestFinished);
      if (deepest === null || depth.get(request) > depth.get(deepest)) deepest = request;
    }
    const chain = [];
    for (let request = deepest; request; request = previous.get(request)) chain.unshift(request);
    return chain;
  }
}

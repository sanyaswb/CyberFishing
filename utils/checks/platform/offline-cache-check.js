"use strict";

// Offline cache (spec 171 stage 4, owner Q2 2026-11-09): the release's service worker and the page that registers it.
// The fakes keep the Cache API contract the worker relies on: entries keyed by the request URL (a Request or a string),
// match() finds a stored URL, put() stores a response, keys()/delete() list and drop whole caches.
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT_DIR = path.resolve(__dirname, "../../..");
const importSource = (file) => import(pathToFileURL(path.join(ROOT_DIR, file)).href);
const ORIGIN = "https://example.test";
const BASE = `${ORIGIN}/CyberFishing/`;

function fakeCaches() {
  const stores = new Map();
  const keyOf = (request) => (typeof request === "string" ? request : request.url);
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      match: async (request) => store.get(keyOf(request)) ?? undefined,
      put: async (request, response) => { store.set(keyOf(request), response); },
      urls: () => [...store.keys()].sort(),
    };
  };
  return { stores, open, keys: async () => [...stores.keys()], delete: async (name) => stores.delete(name) };
}

function response(url, { status = 200, type = "basic", body = url } = {}) {
  return { url, ok: status >= 200 && status < 300, status, type, body, clone() { return response(url, { status, type, body }); } };
}

function fakeNetwork(available = () => true) {
  const requests = [];
  const fetch = async (request) => {
    const url = typeof request === "string" ? request : request.url;
    requests.push({ url, cache: request.cache ?? null });
    if (!available(url)) throw new TypeError("Failed to fetch");
    return response(url, { status: url.includes("missing") ? 404 : 200 });
  };
  return { fetch, requests };
}

function request(url, { mode = "cors", method = "GET", range = false } = {}) {
  return { url, mode, method, headers: { has: (name) => range && name === "range" } };
}

function fakeScope() {
  const listeners = new Map();
  let claims = 0;
  return {
    location: { href: `${BASE}sw.js` },
    clients: { claim: async () => { claims += 1; } },
    addEventListener: (type, listener) => listeners.set(type, listener),
    listeners,
    claims: () => claims,
  };
}

async function checkWorker() {
  const { OfflineCacheWorker } = await importSource("src/platform/browser/offline/offline_cache_worker.js");
  const release = { id: "0.50.50-abc1234", pages: ["index.html"],
    shell: ["releases/0.50.50-abc1234/index.html", "releases/0.50.50-abc1234/build/index.boot-AAAA.js"] };
  const caches = fakeCaches();
  let online = true;
  const network = fakeNetwork(() => online);
  const scope = fakeScope();
  for (const [name, options, pattern] of [
    ["scope", { scope: {} }, /requires its scope/u],
    ["caches", { caches: {} }, /requires caches/u],
    ["fetch", { fetch: null }, /requires fetch/u],
    ["release id", { release: { id: "" } }, /requires a release id/u],
  ]) {
    assert.throws(() => new OfflineCacheWorker({ scope, caches, fetch: network.fetch, release, ...options }), pattern,
      `the worker validates ${name}`);
  }
  // An older release's cache, and a cache of another site part that is not ours.
  await caches.open("cyber-fishing-offline-0.50.49-old0000");
  await caches.open("other-cache");
  const worker = new OfflineCacheWorker({ scope, caches, fetch: network.fetch, release });
  assert.equal(worker.cacheName, "cyber-fishing-offline-0.50.50-abc1234", "one cache per release");
  worker.listen();
  assert.deepEqual([...scope.listeners.keys()].sort(), ["activate", "fetch", "install", "message"]);

  // install: the page and the start's files, through the HTTP cache.
  await worker.precache();
  const cache = await caches.open(worker.cacheName);
  assert.deepEqual(cache.urls(), [`${BASE}index.html`, `${BASE}releases/0.50.50-abc1234/build/index.boot-AAAA.js`,
    `${BASE}releases/0.50.50-abc1234/index.html`]);
  assert(network.requests.every((entry) => entry.cache === "force-cache"), "precache reads the HTTP cache first");
  const broken = new OfflineCacheWorker({ scope: fakeScope(), caches: fakeCaches(), fetch: network.fetch,
    release: { ...release, shell: ["build/missing.js"] } });
  await assert.rejects(broken.precache(), /missing\.js answered 404/u, "a start file that cannot be fetched fails the install");

  // activate: other releases' caches go, ours and foreign ones stay; open pages are claimed.
  await worker.activate();
  assert.deepEqual((await caches.keys()).sort(), ["cyber-fishing-offline-0.50.50-abc1234", "other-cache"]);
  assert.equal(scope.claims(), 1, "the first visit's page is controlled at once");

  // fetch: what the worker leaves to the network.
  for (const [name, item] of [
    ["POST", request(`${BASE}releases/x/build/a.js`, { method: "POST" })],
    ["a range request (media)", request(`${BASE}assets/audio/radio/vinyl/vinyl-5.m4a`, { range: true })],
    ["another origin", request("https://radio.example/stream")],
    ["outside the worker's folder", request(`${ORIGIN}/other/app.js`)],
    ["a source module (?esm=1)", request(`${BASE}releases/x/src/game/a.js`)],
    ["a source map", request(`${BASE}releases/x/build/a.js.map`)],
    ["another page (dev.html)", request(`${BASE}dev.html`, { mode: "navigate" })],
  ]) assert.equal(worker.respond(item), null, `${name} goes to the network untouched`);

  // Cache first for the release's files: the network once, then the cache, also offline.
  const asset = `${BASE}releases/0.50.50-abc1234/assets/items/floats/float-day.webp`;
  network.requests.length = 0;
  assert.equal((await worker.respond(request(asset))).url, asset);
  assert.equal((await worker.respond(request(asset))).url, asset);
  assert.equal(network.requests.length, 1, "the second request comes from the cache");
  online = false;
  assert.equal((await worker.respond(request(asset))).url, asset, "offline: from the cache");
  await assert.rejects(worker.respond(request(`${BASE}releases/0.50.50-abc1234/assets/never-loaded.webp`)),
    /Failed to fetch/u, "offline, a file the game never loaded fails as the network would");
  online = true;
  const notFound = `${BASE}releases/0.50.50-abc1234/assets/missing.webp`;
  assert.equal((await worker.respond(request(notFound))).status, 404);
  assert.equal(await cache.match(notFound), undefined, "an error response is not stored");

  // The game page: instant from the cache, refreshed in the background; "./" and "index.html" are one page.
  network.requests.length = 0;
  online = false;
  const page = await worker.respond(request(`${BASE}?utm=1`, { mode: "navigate" }));
  assert.equal(page.url, `${BASE}index.html`, "offline: the cached page for the folder address");
  online = true;
  const fresh = await worker.respond(request(`${BASE}index.html`, { mode: "navigate" }));
  assert.equal(fresh.url, `${BASE}index.html`, "online: still the cached page at once");
  assert.deepEqual(network.requests.map((entry) => entry.url), [`${BASE}?utm=1`, `${BASE}index.html`],
    "each navigation revalidates the page for the next launch");

  // message: the first visit's files, from the HTTP cache, ours only.
  const before = network.requests.length;
  const chunk = `${BASE}releases/0.50.50-abc1234/build/chunks/radio-BBBB.js`;
  await worker.store([chunk, `${BASE}`, "https://cdn.example/x.js", `${BASE}releases/x/src/a.js`, "not a url::", asset]);
  assert(await cache.match(chunk), "a file loaded before the worker controlled the page is stored");
  assert.deepEqual(network.requests.slice(before).map((entry) => [entry.url, entry.cache]), [[chunk, "force-cache"]],
    "only the missing same-origin file is fetched, from the HTTP cache; the page and stored files are not refetched");
  online = false;
  await worker.store([`${BASE}releases/0.50.50-abc1234/assets/late.webp`]);
  online = true;
}

async function checkPage() {
  const { BrowserOfflineCache } = await importSource("src/platform/browser/offline/browser_offline_cache.js");
  const logger = { warnings: [], warn(...args) { this.warnings.push(args); } };
  const page = ({ attribute = "sw.js", serviceWorker = true, register } = {}) => {
    const registrations = [];
    const posted = [];
    let bufferSize = null;
    const active = { postMessage: (message) => posted.push(message) };
    const windowTarget = {
      location: { href: `${BASE}index.html#top`, origin: ORIGIN },
      navigator: serviceWorker ? { serviceWorker: {
        register: register ?? (async (url, options) => { registrations.push([url, options]); return {}; }),
        ready: Promise.resolve({ active }),
      } } : {},
      performance: {
        setResourceTimingBufferSize: (size) => { bufferSize = size; },
        getEntriesByType: (type) => (type === "resource" ? [
          { name: `${BASE}releases/r/build/index.boot-AAAA.js` }, { name: "https://cdn.example/font.woff2" },
          { name: `${BASE}releases/r/assets/a.webp` }] : []),
      },
    };
    const documentTarget = { documentElement: { getAttribute: (name) => (name === "data-offline-worker" ? attribute : null) } };
    return { windowTarget, documentTarget, registrations, posted, bufferSize: () => bufferSize };
  };
  const plain = page({ attribute: null });
  assert.equal(BrowserOfflineCache.fromPage({ ...plain, logger }), null, "a page without a declared worker (npm run dev) has none");
  const noSupport = page({ serviceWorker: false });
  assert.equal(BrowserOfflineCache.fromPage({ ...noSupport, logger }), null, "a browser without service workers has none");

  const release = page();
  const offline = BrowserOfflineCache.fromPage({ ...release, logger });
  assert.equal(release.bufferSize(), 2000, "the page keeps enough resource timings for the first visit's list");
  assert.deepEqual(release.registrations, [], "nothing registers before the full load");
  await offline.enable();
  await offline.enable();
  assert.deepEqual(release.registrations, [[`${BASE}sw.js`, { updateViaCache: "none" }]],
    "once, beside the page (not under its <base>), always checking for a new worker");
  assert.deepEqual(release.posted, [{ type: "cache-urls", urls: [`${BASE}index.html`,
    `${BASE}releases/r/build/index.boot-AAAA.js`, `${BASE}releases/r/assets/a.webp`] }],
    "the worker gets the page and its same-origin files");

  const failing = page({ register: async () => { throw new Error("blocked"); } });
  await BrowserOfflineCache.fromPage({ ...failing, logger }).enable();
  assert.equal(logger.warnings.length, 1, "a refused registration is reported once and the game goes on");
}

async function checkComposition() {
  const fs = require("node:fs");
  const startup = fs.readFileSync(path.join(ROOT_DIR, "src/bootstrap/production/game_startup.js"), "utf8");
  const development = fs.readFileSync(path.join(ROOT_DIR, "src/bootstrap/development/development_game_startup.js"), "utf8");
  assert.match(startup, /offlineCache: BrowserOfflineCache\.fromPage\(/u, "the production page composes its offline cache");
  assert.doesNotMatch(development, /BrowserOfflineCache|offlineCache/u, "dev.html never registers a worker");
}

(async () => {
  await checkWorker();
  await checkPage();
  await checkComposition();
  console.log("Offline cache passed: worker (one cache per release, install from the HTTP cache, a failing start file "
    + "fails the install, old caches dropped, pages claimed, cache first offline, errors not stored, the page instant and "
    + "revalidated, first-visit files stored without refetching, network left alone for POST/range/other origins/sources/"
    + "maps/other pages) and page (declared worker only, after the full load, once, beside the page, same-origin list, "
    + "refusal reported).");
})().catch((error) => { console.error(error); process.exitCode = 1; });

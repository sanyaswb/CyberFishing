// The release's service worker (spec 171 stage 4, owner Q2 2026-11-09): an instant repeat start and play without the
// network after the first visit. utils/build-release.js bundles this class into <page folder>/sw.js with the release's
// id, its URL prefix and the start's files; only a built release registers it (BrowserOfflineCache), never npm run dev.
// - One cache per release ("cyber-fishing-offline-<id>"); activation deletes the caches of other releases.
// - install: the game page and the start's files (the startup manifest), from the HTTP cache where it has them. A new
//   release's worker installs in the background and takes over on the next launch (no skipWaiting), so one session
//   never mixes two releases.
// - The game page's navigation is answered from the cache (instant start, offline); the page then revalidates in the
//   background for the next launch of the same release.
// - Every other same-origin GET inside the worker's folder: cache first, then the network, stored on success. What the
//   game never loads (audio until it plays, content progress has not opened) is never cached. Range requests (media),
//   source modules (?esm=1) and source maps go to the network untouched.
// - message { type: "cache-urls", urls }: the page's files loaded before this worker controlled it (the first visit),
//   stored from the HTTP cache, so nothing is downloaded twice.
const CACHE_PREFIX = "cyber-fishing-offline-";
const SKIPPED_PATH = /(?:^|\/)src\/|\.map$/u;

export class OfflineCacheWorker {
  #scope;
  #caches;
  #fetch;
  #release;
  #cacheName;
  #base;

  // scope: the worker's global ({ addEventListener, location, clients, registration }); caches and fetch: its
  // CacheStorage and fetch; release: { id, shell: [URLs relative to the worker], pages: [the game page's URLs] }.
  constructor({ scope, caches, fetch, release }) {
    if (typeof scope?.addEventListener !== "function") throw new TypeError("OfflineCacheWorker requires its scope");
    if (typeof caches?.open !== "function") throw new TypeError("OfflineCacheWorker requires caches");
    if (typeof fetch !== "function") throw new TypeError("OfflineCacheWorker requires fetch");
    if (typeof release?.id !== "string" || release.id === "") throw new TypeError("OfflineCacheWorker requires a release id");
    this.#scope = scope;
    this.#caches = caches;
    this.#fetch = fetch;
    this.#base = new URL("./", scope.location.href);
    this.#release = Object.freeze({
      id: release.id,
      shell: Object.freeze((release.shell ?? []).map((url) => this.#absolute(url))),
      pages: Object.freeze(new Set((release.pages ?? []).map((url) => this.#absolute(url)))),
    });
    this.#cacheName = `${CACHE_PREFIX}${release.id}`;
  }

  get cacheName() {
    return this.#cacheName;
  }

  listen() {
    this.#scope.addEventListener("install", (event) => event.waitUntil(this.precache()));
    this.#scope.addEventListener("activate", (event) => event.waitUntil(this.activate()));
    this.#scope.addEventListener("fetch", (event) => {
      const response = this.respond(event.request);
      if (response) event.respondWith(response);
    });
    this.#scope.addEventListener("message", (event) => {
      if (event.data?.type === "cache-urls" && Array.isArray(event.data.urls)) event.waitUntil(this.store(event.data.urls));
    });
  }

  // The page and the start's files. A file that cannot be fetched fails the install: a release without its start
  // offline would answer the page from a cache that cannot run it.
  async precache() {
    const cache = await this.#caches.open(this.#cacheName);
    await Promise.all([...this.#release.pages, ...this.#release.shell].map(async (url) => {
      const response = await this.#fetch(new Request(url, { cache: "force-cache" }));
      if (!response.ok) throw new Error(`${url} answered ${response.status}`);
      await cache.put(url, response);
    }));
  }

  // Other releases' caches go; the worker controls open pages at once (the first visit's page included).
  async activate() {
    const names = await this.#caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== this.#cacheName)
      .map((name) => this.#caches.delete(name)));
    await this.#scope.clients?.claim?.();
  }

  // A Promise of the response for a request this worker answers, or null for the network's default handling.
  respond(request) {
    if (request.method !== "GET" || request.headers?.has?.("range")) return null;
    const url = new URL(request.url);
    if (url.origin !== this.#base.origin || !url.href.startsWith(this.#base.href)) return null;
    if (request.mode === "navigate") {
      const page = this.#pageKey(url);
      return page ? this.#pageResponse(request, page) : null;
    }
    if (SKIPPED_PATH.test(url.pathname)) return null;
    return this.#cacheFirst(request);
  }

  // URLs the page loaded before this worker controlled it: stored from the HTTP cache, skipped when unsuitable.
  async store(urls) {
    const cache = await this.#caches.open(this.#cacheName);
    await Promise.all(urls.map(async (value) => {
      let url;
      // The page sends absolute URLs (resource timing); anything else is not one of its files.
      try { url = new URL(value); } catch { return; }
      if (url.origin !== this.#base.origin || !url.href.startsWith(this.#base.href) || SKIPPED_PATH.test(url.pathname)) return;
      const key = this.#pageKey(url) ?? url.href;
      if (await cache.match(key)) return;
      try {
        const response = await this.#fetch(new Request(key, { cache: "force-cache" }));
        if (response.ok && response.type !== "opaque") await cache.put(key, response);
      } catch {
        // Offline or gone: the next online launch stores it on its way through the worker.
      }
    }));
  }

  async #cacheFirst(request) {
    const cache = await this.#caches.open(this.#cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await this.#fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  }

  // The cached page at once (instant start, offline); a fresh copy for the next launch of this release meanwhile.
  async #pageResponse(request, page) {
    const cache = await this.#caches.open(this.#cacheName);
    const cached = await cache.match(page);
    const fresh = this.#fetch(request).then(async (response) => {
      if (response.ok && response.type === "basic") await cache.put(page, response.clone());
      return response;
    });
    if (cached) {
      fresh.catch(() => {});
      return cached;
    }
    return fresh;
  }

  // The page's cache key for a navigation URL ("./" and "./index.html" are one page), or null for other pages.
  #pageKey(url) {
    const bare = new URL(url.href);
    bare.search = "";
    bare.hash = "";
    if (this.#release.pages.has(bare.href)) return bare.href;
    if (bare.href.endsWith("/") && this.#release.pages.has(`${bare.href}index.html`)) return `${bare.href}index.html`;
    return null;
  }

  #absolute(url) {
    return new URL(url, this.#base).href;
  }
}

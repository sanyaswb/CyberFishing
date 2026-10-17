import { SpineAtlasTextReader } from "./spine_atlas_text_reader.js";

// Loads one Spine bundle through AssetLoadQueue (spec 099): the atlas text first, then each atlas page and the
// skeleton JSON as their own jobs. Spine's AssetManager is never used, so every request obeys the queue caps.
// `pages` settles as soon as the atlas and its pages are decoded (enough for the static picture); `result` settles
// with the whole bundle. Both resolve, never reject: { status: "ready", ... } or { status: "failed", reason, error }.
export class SpineBundleLoader {
  #queue;
  #transport;

  constructor({ queue, transport }) {
    if (typeof queue?.request !== "function") throw new TypeError("SpineBundleLoader requires an AssetLoadQueue");
    if (typeof transport?.loadText !== "function" || typeof transport.loadJson !== "function" ||
      typeof transport.loadImage !== "function") {
      throw new TypeError("SpineBundleLoader requires a transport with loadText, loadJson and loadImage");
    }
    this.#queue = queue;
    this.#transport = transport;
  }

  // descriptor: { skeleton, atlas, skin, linePoint } with project-relative URLs.
  load(descriptor, { priority = "interactive" } = {}) {
    const interests = [];
    let released = false;
    const request = (key, load) => {
      const interest = this.#queue.request({ key, priority, load });
      interests.push(interest);
      if (released) interest.release();
      return interest.result;
    };
    const pages = request(`text:${descriptor.atlas}`, (token) => this.#transport.loadText(descriptor.atlas, token))
      .then((outcome) => this.#loadPages(descriptor, outcome, request));
    const skeleton = request(`json:${descriptor.skeleton}`, (token) => this.#transport.loadJson(descriptor.skeleton, token));
    const result = Promise.all([pages, skeleton]).then(([pagesOutcome, skeletonOutcome]) => {
      if (pagesOutcome.status !== "ready") return pagesOutcome;
      if (skeletonOutcome.status !== "ready") {
        return SpineBundleLoader.#failure(skeletonOutcome.status === "cancelled" ? "cancelled" : "skeleton-failed",
          skeletonOutcome.error);
      }
      const json = skeletonOutcome.payload;
      return {
        status: "ready",
        bundle: Object.freeze({
          skeleton: json,
          version: String(json?.skeleton?.spine ?? ""),
          atlasText: pagesOutcome.atlasText,
          atlas: pagesOutcome.atlas,
          pages: pagesOutcome.pages,
          skin: descriptor.skin ?? null,
          linePoint: descriptor.linePoint ?? null,
        }),
      };
    });
    return {
      pages,
      result,
      release: () => {
        released = true;
        for (const interest of interests) interest.release();
      },
    };
  }

  async #loadPages(descriptor, outcome, request) {
    if (outcome.status !== "ready") {
      return SpineBundleLoader.#failure(outcome.status === "cancelled" ? "cancelled" : "atlas-failed", outcome.error);
    }
    let atlas;
    try {
      atlas = SpineAtlasTextReader.read(outcome.payload);
    } catch (error) {
      return SpineBundleLoader.#failure("atlas-invalid", error);
    }
    const directory = descriptor.atlas.slice(0, descriptor.atlas.lastIndexOf("/") + 1);
    const loads = atlas.pages.map((page) => {
      const url = `${directory}${page.name}`;
      return request(`image:${url}`, (token) => this.#transport.loadImage(url, token));
    });
    const settled = await Promise.all(loads);
    const pages = new Map();
    for (let index = 0; index < settled.length; index += 1) {
      const page = settled[index];
      if (page.status !== "ready") {
        return SpineBundleLoader.#failure(page.status === "cancelled" ? "cancelled" : "page-failed", page.error);
      }
      pages.set(atlas.pages[index].name, page.payload);
    }
    return { status: "ready", atlasText: outcome.payload, atlas, pages };
  }

  static #failure(reason, error = null) {
    return { status: "failed", reason, error };
  }
}

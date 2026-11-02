import { SpineAtlasTextReader } from "./spine_atlas_text_reader.js";
import { SpineSetupPoseReader } from "./spine_setup_pose_reader.js";

// Loads one Spine bundle through AssetLoadQueue (spec 099): the atlas text first, then each atlas page and the
// skeleton JSON as their own jobs. Spine's AssetManager is never used, so every request obeys the queue caps.
// `pages` settles as soon as the atlas and its pages are decoded (enough for the static picture); `result` settles
// with the whole bundle. Both resolve, never reject: { status: "ready", ... } or { status: "failed", reason, error }.
export class SpineBundleLoader {
  #queue;
  #transport;
  #assets;

  // assets: the AssetRegistry; a bundle is requested by the export's asset id (spec 157 R16).
  constructor({ queue, transport, assets }) {
    if (typeof queue?.request !== "function") throw new TypeError("SpineBundleLoader requires an AssetLoadQueue");
    if (typeof assets?.spineOf !== "function") throw new TypeError("SpineBundleLoader requires assets");
    this.#assets = assets;
    if (typeof transport?.loadText !== "function" || typeof transport.loadJson !== "function" ||
      typeof transport.loadImage !== "function") {
      throw new TypeError("SpineBundleLoader requires a transport with loadText, loadJson and loadImage");
    }
    this.#queue = queue;
    this.#transport = transport;
  }

  // descriptor: { asset, skin, linePoint }; the registry gives the skeleton JSON and the atlas.
  load(descriptor, { priority = "interactive" } = {}) {
    const files = this.#assets.spineOf(descriptor.asset);
    const interests = [];
    let released = false;
    const request = (key, load) => {
      const interest = this.#queue.request({ key, priority, load });
      interests.push(interest);
      if (released) interest.release();
      return interest.result;
    };
    const pages = request(`text:${files.atlas}`, (token) => this.#transport.loadText(files.atlas, token))
      .then((outcome) => this.#loadPages(files.atlas, outcome, request));
    const skeleton = request(`json:${files.skeleton}`, (token) => this.#transport.loadJson(files.skeleton, token));
    const result = Promise.all([pages, skeleton]).then(([pagesOutcome, skeletonOutcome]) => {
      if (pagesOutcome.status !== "ready") return pagesOutcome;
      if (skeletonOutcome.status !== "ready") {
        return SpineBundleLoader.#failure(skeletonOutcome.status === "cancelled" ? "cancelled" : "skeleton-failed",
          skeletonOutcome.error);
      }
      const json = skeletonOutcome.payload;
      let staticPose = null;
      try {
        staticPose = SpineSetupPoseReader.read(json, pagesOutcome.atlas, descriptor);
      } catch {
        staticPose = null;
      }
      return {
        status: "ready",
        bundle: Object.freeze({
          skeleton: json,
          // The skeleton file's name, for the DEV export of an edited skeleton.
          skeletonFile: files.skeleton.slice(files.skeleton.lastIndexOf("/") + 1),
          version: String(json?.skeleton?.spine ?? ""),
          atlasText: pagesOutcome.atlasText,
          atlas: pagesOutcome.atlas,
          pages: pagesOutcome.pages,
          skin: descriptor.skin ?? null,
          linePoint: descriptor.linePoint ?? null,
          // The setup-pose picture for the static fallback: { bounds, linePoint, region } (skeleton units, y up).
          staticPose,
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

  async #loadPages(atlasFile, outcome, request) {
    if (outcome.status !== "ready") {
      return SpineBundleLoader.#failure(outcome.status === "cancelled" ? "cancelled" : "atlas-failed", outcome.error);
    }
    let atlas;
    try {
      atlas = SpineAtlasTextReader.read(outcome.payload);
    } catch (error) {
      return SpineBundleLoader.#failure("atlas-invalid", error);
    }
    const directory = atlasFile.slice(0, atlasFile.lastIndexOf("/") + 1);
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

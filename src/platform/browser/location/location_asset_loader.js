import { DepthMapReader } from "./depth_map_reader.js";

export class LocationAssetLoader {
  #imageAssets;
  #canvasFactory;
  #assets;

  // assets: the AssetRegistry; a location names its backgrounds and depth map by asset id (spec 157 R16).
  constructor({ imageAssets, canvasFactory, assets }) {
    if (!imageAssets || typeof imageAssets.preload !== "function") {
      throw new TypeError("LocationAssetLoader requires imageAssets");
    }
    if (!assets || typeof assets.pathOf !== "function") throw new TypeError("LocationAssetLoader requires assets");
    this.#assets = assets;
    if (!canvasFactory || typeof canvasFactory.createSurface !== "function") {
      throw new TypeError("LocationAssetLoader requires canvasFactory");
    }
    this.#imageAssets = imageAssets;
    this.#canvasFactory = canvasFactory;
  }

  // phases (spec 157 R4, spec 083 decision 3): the time-of-day phases startup waits for, the current one first
  // (base, and its overlay at dusk or dawn); null loads all. The other phases load through the asset load plan after the
  // game is ready (layer-two). Images are keyed by their asset id (spec 157 D1), the key the plan's loads use too;
  // background.assetIds always names every phase.
  async load(locationId, locationConfig, locationsConfig, { phases = null } = {}) {
    const background = this.#buildBackgroundManifest(locationConfig);
    const depth = this.#buildDepthRecord(locationConfig);
    const manifest = {};
    for (const [phase, assetId] of Object.entries(background.assetIds)) {
      if (!background.dynamic || phases === null || phases.includes(phase)) manifest[assetId] = background.manifest[assetId];
    }
    if (depth.assetId) manifest[depth.assetId] = depth.src;

    if (Object.keys(manifest).length > 0) {
      await this.#imageAssets.preload(manifest);
    }

    return { background, depthReader: this.#createDepthReader(depth.assetId, locationsConfig) };
  }

  #buildBackgroundManifest(locationConfig) {
    const manifest = {};
    const assetIds = {};
    let dynamic = false;
    if (locationConfig.backgroundAssets) {
      dynamic = true;
      for (const key of ["day", "evening", "night"]) {
        const assetId = locationConfig.backgroundAssets[key];
        assetIds[key] = assetId;
        manifest[assetId] = this.#assets.pathOf(assetId);
      }
    } else if (locationConfig.backgroundAsset) {
      assetIds.default = locationConfig.backgroundAsset;
      manifest[locationConfig.backgroundAsset] = this.#assets.pathOf(locationConfig.backgroundAsset);
    }
    return { dynamic, assetIds, manifest };
  }

  #buildDepthRecord(locationConfig) {
    if (!locationConfig.depthAsset) return { assetId: "", src: "" };
    return { assetId: locationConfig.depthAsset, src: this.#assets.pathOf(locationConfig.depthAsset) };
  }

  #createDepthReader(assetId, locationsConfig) {
    if (!assetId) return null;
    const image = this.#imageAssets.tryGet(assetId);
    if (!image) return null;
    const width = locationsConfig.baseResolution.width;
    const height = locationsConfig.baseResolution.height;
    const surface = this.#canvasFactory.createSurface(width, height, {
      willReadFrequently: true,
    });
    surface.drawImage(image, 0, 0, width, height);
    return new DepthMapReader({
      width,
      height,
      pixels: surface.getImageData(0, 0, width, height).data,
    });
  }
}

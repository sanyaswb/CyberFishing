import { DepthMapReader } from "./depth_map_reader.js";
import { ImageAssetProvider } from "../assets/image_asset_provider.js";

export class LocationAssetLoader {
  #imageAssets;
  #canvasFactory;

  constructor({ imageAssets, canvasFactory }) {
    if (!imageAssets || typeof imageAssets.preload !== "function") {
      throw new TypeError("LocationAssetLoader requires imageAssets");
    }
    if (!canvasFactory || typeof canvasFactory.createSurface !== "function") {
      throw new TypeError("LocationAssetLoader requires canvasFactory");
    }
    this.#imageAssets = imageAssets;
    this.#canvasFactory = canvasFactory;
  }

  // phases (spec 157 R4, spec 083 decision 3): the time-of-day phases startup waits for, the current one first
  // (base, and its overlay at dusk or dawn); null loads all. The other phases come back as loadDeferredBackground(),
  // which the composition starts after the game is ready; background.assetIds always names every phase.
  async load(locationId, locationConfig, locationsConfig, { phases = null } = {}) {
    const background = this.#buildBackgroundManifest(locationId, locationConfig);
    const depth = this.#buildDepthRecord(locationId, locationConfig);
    const manifest = {};
    const deferred = {};
    for (const [phase, assetId] of Object.entries(background.assetIds)) {
      const target = !background.dynamic || phases === null || phases.includes(phase) ? manifest : deferred;
      target[assetId] = background.manifest[assetId];
    }
    if (depth.assetId) manifest[depth.assetId] = depth.src;

    if (Object.keys(manifest).length > 0) {
      await this.#imageAssets.preload(manifest);
    }

    return {
      background,
      depthReader: this.#createDepthReader(depth.assetId, locationsConfig),
      loadDeferredBackground: () => (Object.keys(deferred).length > 0
        ? this.#imageAssets.preload(deferred) : Promise.resolve()),
    };
  }

  #buildBackgroundManifest(locationId, locationConfig) {
    const manifest = {};
    const assetIds = {};
    let dynamic = false;
    if (locationConfig.bgUrls) {
      dynamic = true;
      for (const key of ["day", "evening", "night"]) {
        const src = locationConfig.bgUrls[key];
        const assetId = ImageAssetProvider.assetIdForSource(
          src,
          `location:${locationId}:${key}`,
        );
        assetIds[key] = assetId;
        manifest[assetId] = src;
      }
    } else if (locationConfig.bgUrl) {
      const assetId = ImageAssetProvider.assetIdForSource(
        locationConfig.bgUrl,
        `location:${locationId}:default`,
      );
      assetIds.default = assetId;
      manifest[assetId] = locationConfig.bgUrl;
    }
    return { dynamic, assetIds, manifest };
  }

  #buildDepthRecord(locationId, locationConfig) {
    if (!locationConfig.depthUrl) return { assetId: "", src: "" };
    return {
      assetId: ImageAssetProvider.assetIdForSource(
        locationConfig.depthUrl,
        `location:${locationId}:depth`,
      ),
      src: locationConfig.depthUrl,
    };
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

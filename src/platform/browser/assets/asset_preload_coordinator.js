import { AssetLoadResult } from "../../../engine/assets/asset_load_result.js";
import { AssetManifest } from "../../../engine/assets/asset_manifest.js";
import { ImageAssetProvider } from "./image_asset_provider.js";

export class AssetPreloadCoordinator {
  #imageAssets;
  #locationsConfig;
  #diagnostics;
  #resolveFishImage;
  #assets;
  #requests = new Map();

  // resolveFishImage(fish): the one victory image source (spec 100 D4), shared with the outcome frame builder.
  // assets: the AssetRegistry (a location names its backgrounds and depth map by asset id, spec 157 R16).
  constructor({ imageAssets, locationsConfig, resolveFishImage, assets, diagnostics = null }) {
    if (!imageAssets || typeof imageAssets.preload !== "function") {
      throw new TypeError("AssetPreloadCoordinator requires imageAssets");
    }
    if (typeof resolveFishImage !== "function") {
      throw new TypeError("AssetPreloadCoordinator requires resolveFishImage");
    }
    if (!assets || typeof assets.pathOf !== "function") throw new TypeError("AssetPreloadCoordinator requires assets");
    this.#assets = assets;
    this.#resolveFishImage = resolveFishImage;
    this.#imageAssets = imageAssets;
    this.#locationsConfig = locationsConfig || {};
    this.#diagnostics = diagnostics;
  }

  preloadApplicationAssets() {
    return this.preloadManifest(new AssetManifest(), "application");
  }

  // phases (spec 157 R4): the time-of-day phases startup needs; null takes all three.
  preloadLocation(locationId, { phases = null } = {}) {
    const locationConfig = this.#locationsConfig.map?.[locationId] || {};
    const manifest = new AssetManifest();
    if (locationConfig.backgroundAssets) {
      for (const key of ["day", "evening", "night"]) {
        if (phases !== null && !phases.includes(key)) continue;
        const src = this.#assets.pathOf(locationConfig.backgroundAssets[key]);
        manifest.add(
          ImageAssetProvider.assetIdForSource(src, `location:${locationId}:${key}`),
          src,
          { critical: true },
        );
      }
    } else if (locationConfig.backgroundAsset) {
      const src = this.#assets.pathOf(locationConfig.backgroundAsset);
      manifest.add(ImageAssetProvider.assetIdForSource(src, `location:${locationId}:default`), src, { critical: true });
    }
    if (locationConfig.depthAsset) {
      const src = this.#assets.pathOf(locationConfig.depthAsset);
      manifest.add(ImageAssetProvider.assetIdForSource(src, `location:${locationId}:depth`), src, { critical: true });
    }
    return this.preloadManifest(manifest, `location:${locationId}`);
  }

  preloadFishingAssets(equipment, fish) {
    const manifest = new AssetManifest();
    this.#addFishSprite(manifest, fish, false);
    return this.preloadManifest(manifest, "fishing");
  }

  preloadVictoryAssets(fish) {
    const manifest = new AssetManifest();
    this.#addFishSprite(manifest, fish, true);
    return this.preloadManifest(manifest, "victory")
      .then((result) => result.assertCriticalReady("victory"));
  }

  preloadManifest(manifest, scope = "assets") {
    if (!manifest || typeof manifest.count !== "number") {
      throw new TypeError("AssetPreloadCoordinator requires AssetManifest");
    }
    if (manifest.count === 0) {
      return Promise.resolve(new AssetLoadResult());
    }
    const records = [];
    const promises = [];
    for (let index = 0; index < manifest.count; index += 1) {
      const record = manifest.getAt(index);
      records.push({
        id: record.id,
        src: record.src,
        critical: record.critical,
        loaded: false,
        fallbackUsed: false,
        error: null,
      });
      promises.push(
        this.#preloadRecord(record)
          .then(() => {
            records[index].loaded = true;
          })
          .catch((error) => {
            records[index].error = error;
            records[index].fallbackUsed = !record.critical;
            if (record.critical) throw error;
          }),
      );
    }
    return Promise.all(promises)
      .then(() => new AssetLoadResult(records))
      .catch((error) => {
        const result = new AssetLoadResult(records);
        if (!result.ok) {
          const loadError = new Error(
            `${scope} critical assets failed: ${error.message}`,
          );
          loadError.scope = scope;
          loadError.critical = true;
          loadError.result = result;
          throw loadError;
        }
        return result;
      });
  }

  #preloadRecord(record) {
    if (this.#imageAssets.isReady?.(record.id)) return Promise.resolve();
    const existing = this.#requests.get(record.id);
    if (existing) return existing;
    this.#diagnostics?.recordAssetRequestCreated();
    const request = this.#imageAssets
      .preload({ [record.id]: record.src })
      .finally(() => {
        this.#requests.delete(record.id);
      });
    this.#requests.set(record.id, request);
    return request;
  }

  #addFishSprite(manifest, fish, critical) {
    const source = this.#resolveFishImage(fish);
    manifest.add(ImageAssetProvider.assetIdForSource(source, "fish"), source, {
      critical,
    });
  }
}

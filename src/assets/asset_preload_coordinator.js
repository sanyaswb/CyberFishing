class AssetPreloadCoordinator {
  #imageAssets;
  #locationsConfig;
  #requests = new Map();

  constructor({ imageAssets, locationsConfig }) {
    if (!imageAssets || typeof imageAssets.preload !== "function") {
      throw new TypeError("AssetPreloadCoordinator requires imageAssets");
    }
    this.#imageAssets = imageAssets;
    this.#locationsConfig = locationsConfig || {};
  }

  preloadApplicationAssets() {
    return this.preloadManifest(new AssetManifest(), "application");
  }

  preloadLocation(locationId) {
    const locationConfig = this.#locationsConfig.map?.[locationId] || {};
    const manifest = new AssetManifest();
    if (locationConfig.bgUrls) {
      for (const key of ["day", "evening", "night"]) {
        const src = locationConfig.bgUrls[key];
        manifest.add(
          ImageAssetProvider.assetIdForSource(src, `location:${locationId}:${key}`),
          src,
          { critical: true },
        );
      }
    } else if (locationConfig.bgUrl) {
      manifest.add(
        ImageAssetProvider.assetIdForSource(locationConfig.bgUrl, `location:${locationId}:default`),
        locationConfig.bgUrl,
        { critical: true },
      );
    }
    if (locationConfig.depthUrl) {
      manifest.add(
        ImageAssetProvider.assetIdForSource(locationConfig.depthUrl, `location:${locationId}:depth`),
        locationConfig.depthUrl,
        { critical: true },
      );
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
    if (typeof RenderAllocationDiagnostics !== "undefined") {
      RenderAllocationDiagnostics.recordAssetRequestCreated();
    }
    const request = this.#imageAssets
      .preload({ [record.id]: record.src })
      .finally(() => {
        this.#requests.delete(record.id);
      });
    this.#requests.set(record.id, request);
    return request;
  }

  #addFishSprite(manifest, fish, critical) {
    const id = String(fish?.id || "unknown");
    const level = Number(fish?.level) || 1;
    const source = fish?.imagePath || `assets/fish/${id}/${id}--${level}.webp`;
    manifest.add(ImageAssetProvider.assetIdForSource(source, "fish"), source, {
      critical,
    });
  }
}

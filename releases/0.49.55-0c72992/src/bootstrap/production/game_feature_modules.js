// Features loaded after the first frame (spec 157 R12): the asset load plan names them ({ module }) and loads them
// through its queue, the player's first use asks for them at once. Each import() is a lazy chunk of the release: it is
// not in utils/build-release.js START_IMPORTS, so the page does not preload it.
export const GAME_FEATURE_MODULES = Object.freeze({
  radio: () => import("./radio_feature_composition.js"),
});

// Methods every skeletal scene adapter provides (spec 099 "Scene port"); composition checks them with requireMethods.
// Placement and points are in surface pixels with y down; local bounds are in skeleton units with y up.
export const SKELETAL_SCENE_METHODS = Object.freeze([
  "setPlacement",
  "setLoop",
  "setSampled",
  "clearTrack",
  "setTrackTimeScale",
  "update",
  "render",
  "getPoint",
  "getLocalBounds",
  "hasClip",
  "clipDuration",
  "getMissingClips",
  "getClips",
  "getBones",
  "setBoneSetup",
  "restoreContext",
  "dispose",
]);

// The colour of each zone category (spec 129 D1): the editor outlines, the location debug map fills and the
// DevTools swatches read this one table. The key order is the categories' order everywhere in the editor.
export const ZONE_CATEGORY_COLORS = Object.freeze({
  castable: "#00ff80",
  collisions: "#ff4444",
  snags: "#ffcc00",
  dynamic: "#ff66ff",
  // Spec 172 D4 (TK-273): where it rains; drops fall only inside these zones.
  rain: "#4da6ff",
});

// The gameplay switch of each category (Revision 2): the editor lists, draws and drags a category only while it is on.
export const ZONE_PHYSICS_KEYS = Object.freeze({
  castable: "enableCastable",
  collisions: "enableCollisions",
  snags: "enableSnags",
  dynamic: "enableDynamicZones",
  rain: "enableRainZones",
});

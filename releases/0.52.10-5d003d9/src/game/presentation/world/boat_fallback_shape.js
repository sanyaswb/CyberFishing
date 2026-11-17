// The bait boat seen from above while it has no Spine view (TK-197). A canvas cannot draw a symbol of the SVG sprite, so
// the shape is polygons: flat [x, y, ...] in shares of the boat's size around its centre, the bow towards +x (angle 0).
// Both renderers read it from the frame model, because the platform scene does not import game modules.
export const BOAT_FALLBACK_SHAPE = Object.freeze({
  parts: Object.freeze([
    Object.freeze({ color: "#e8edf0", points: Object.freeze([0.5, 0, 0.2, 0.2, -0.45, 0.2, -0.45, -0.2, 0.2, -0.2]) }),
    Object.freeze({ color: "#2f6f8f", points: Object.freeze([0.14, 0.12, -0.2, 0.12, -0.2, -0.12, 0.14, -0.12]) }),
  ]),
});

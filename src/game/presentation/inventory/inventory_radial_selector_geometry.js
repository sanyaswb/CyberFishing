/**
 * Single source of truth for the radial inventory selector geometry and hit-testing (TK-008.2, TK-008.4).
 * Pure mathematical model: computes SVG paths, sector angles, icon positions and exact hit-tests.
 */

export const RADIAL_SELECTOR_DEFAULTS = Object.freeze({
  baseSize: 48,
  buttonRadiusRatio: 1.0,      // D (48px)
  innerRadiusRatio: 1.15,      // 1.15D (55.2px)
  outerRadiusRatio: 2.1,       // 2.1D (100.8px)
  gapRatio: 0.1,               // 0.1D (4.8px)
  cornerRadiusRatio: 0.06,     // 0.06D (2.88px)
  sectorCount: 3,
  totalAngleRad: Math.PI / 2,  // 90 degrees
});

export const RADIAL_SECTOR_IDS = Object.freeze([
  "equipment", // 0: left (horizontal)
  "backpack",  // 1: middle (diagonal 45 deg)
  "keepnet",   // 2: top (vertical)
]);

/**
 * Computes exact geometry parameters for the radial selector.
 * @param {number} baseSize Logical size in pixels (default 48)
 * @returns {object} Geometry model
 */
export function calculateRadialSelectorGeometry(baseSize = RADIAL_SELECTOR_DEFAULTS.baseSize) {
  const D = Math.max(1, Number(baseSize) || RADIAL_SELECTOR_DEFAULTS.baseSize);
  const r0 = D * RADIAL_SELECTOR_DEFAULTS.buttonRadiusRatio;
  const rIn = D * RADIAL_SELECTOR_DEFAULTS.innerRadiusRatio;
  const rOut = D * RADIAL_SELECTOR_DEFAULTS.outerRadiusRatio;
  const gapLinear = D * RADIAL_SELECTOR_DEFAULTS.gapRatio;
  const cornerRadius = D * RADIAL_SELECTOR_DEFAULTS.cornerRadiusRatio;

  const rMid = (rIn + rOut) / 2;
  // Angular gap based on linear gap distance at mean radius
  const gapAngleRad = gapLinear / rMid;
  const totalAngleRad = RADIAL_SELECTOR_DEFAULTS.totalAngleRad;
  const sectorCount = RADIAL_SELECTOR_DEFAULTS.sectorCount;

  // Available angle for all sectors after subtracting gaps
  const availableAngleRad = totalAngleRad - (sectorCount - 1) * gapAngleRad;
  const sectorAngleRad = availableAngleRad / sectorCount;

  // SVG viewport dimensions: origin (cx, cy) is at bottom-right corner of the fan area
  const padding = 8;
  const viewportSize = Math.ceil(rOut + padding);
  const cx = viewportSize;
  const cy = viewportSize;

  const sectors = [];
  let currentStart = 0;

  for (let i = 0; i < sectorCount; i += 1) {
    const id = RADIAL_SECTOR_IDS[i];
    const startAngle = currentStart;
    const endAngle = currentStart + sectorAngleRad;
    const midAngle = (startAngle + endAngle) / 2;

    // Center coordinates for artwork placement
    const iconX = cx - rMid * Math.cos(midAngle);
    const iconY = cy - rMid * Math.sin(midAngle);
    // Relative rotation: angle offset relative to 45 deg diagonal
    const iconRotationDeg = (midAngle - Math.PI / 4) * (180 / Math.PI);

    // SVG path coordinates (X decreases to left, Y decreases to top from cx, cy)
    const p1 = { x: cx - rIn * Math.cos(startAngle), y: cy - rIn * Math.sin(startAngle) };
    const p2 = { x: cx - rOut * Math.cos(startAngle), y: cy - rOut * Math.sin(startAngle) };
    const p3 = { x: cx - rOut * Math.cos(endAngle), y: cy - rOut * Math.sin(endAngle) };
    const p4 = { x: cx - rIn * Math.cos(endAngle), y: cy - rIn * Math.sin(endAngle) };

    const pathData = [
      `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
      `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
      `A ${rOut.toFixed(2)} ${rOut.toFixed(2)} 0 0 1 ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
      `L ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
      `A ${rIn.toFixed(2)} ${rIn.toFixed(2)} 0 0 0 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
      "Z",
    ].join(" ");

    sectors.push(Object.freeze({
      index: i,
      id,
      startAngle,
      endAngle,
      midAngle,
      center: Object.freeze({ x: iconX, y: iconY }),
      iconRotationDeg,
      pathData,
      width: rOut - rIn,
    }));

    currentStart = endAngle + gapAngleRad;
  }

  // Central trigger button SVG path (quarter circle at bottom-right)
  const triggerPath = [
    `M ${cx.toFixed(2)} ${cy.toFixed(2)}`,
    `L ${(cx - r0).toFixed(2)} ${cy.toFixed(2)}`,
    `A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 0 1 ${cx.toFixed(2)} ${(cy - r0).toFixed(2)}`,
    "Z",
  ].join(" ");

  // Keep-open transparent area (quarter disk of radius rOut)
  const keepOpenPath = [
    `M ${cx.toFixed(2)} ${cy.toFixed(2)}`,
    `L ${(cx - rOut).toFixed(2)} ${cy.toFixed(2)}`,
    `A ${rOut.toFixed(2)} ${rOut.toFixed(2)} 0 0 1 ${cx.toFixed(2)} ${(cy - rOut).toFixed(2)}`,
    "Z",
  ].join(" ");

  // Trigger icon placement
  const triggerIconCenter = Object.freeze({
    x: cx - r0 * 0.45,
    y: cy - r0 * 0.45,
  });

  return Object.freeze({
    baseSize: D,
    r0,
    rIn,
    rOut,
    gapLinear,
    cornerRadius,
    viewportSize,
    center: Object.freeze({ x: cx, y: cy }),
    triggerPath,
    triggerIconCenter,
    keepOpenPath,
    sectors: Object.freeze(sectors),

    /**
     * Exact hit-test function for touch hold/release and desktop hover.
     * @param {number} x X coordinate relative to the component
     * @param {number} y Y coordinate relative to the component
     * @param {object} options Options including isReady and custom center
     * @returns {object|null} Hit result
     */
    hitTest(x, y, { isReady = true, customCenter = null } = {}) {
      const originX = customCenter ? customCenter.x : cx;
      const originY = customCenter ? customCenter.y : cy;

      const dx = originX - x;
      const dy = originY - y;

      // Must be within the top-left quadrant of (originX, originY)
      if (dx < 0 || dy < 0) {
        return null;
      }

      const dist = Math.hypot(dx, dy);

      // Hit central trigger button
      if (dist <= r0) {
        return Object.freeze({ type: "trigger" });
      }

      // Hit inner gap
      if (dist < rIn) {
        return Object.freeze({ type: "inner-gap" });
      }

      // Beyond outer radius
      if (dist > rOut) {
        return null;
      }

      // Angle measured from horizontal left (0) to vertical top (PI/2)
      const phi = Math.atan2(dy, dx);

      if (!isReady) {
        return Object.freeze({ type: "not-ready" });
      }

      for (const sector of sectors) {
        if (phi >= sector.startAngle && phi <= sector.endAngle) {
          return Object.freeze({
            type: "sector",
            id: sector.id,
            index: sector.index,
          });
        }
      }

      // In angular gap between sectors
      return Object.freeze({ type: "gap" });
    },

    /**
     * Determines whether coordinates lie within the transparent keep-open area.
     * @param {number} x X coordinate
     * @param {number} y Y coordinate
     * @param {object} options
     * @returns {boolean}
     */
    isInsideKeepOpenArea(x, y, { customCenter = null } = {}) {
      const originX = customCenter ? customCenter.x : cx;
      const originY = customCenter ? customCenter.y : cy;

      const dx = originX - x;
      const dy = originY - y;

      if (dx < 0 || dy < 0) return false;
      return dx * dx + dy * dy <= rOut * rOut;
    },
  });
}

export class InventoryRadialSelectorGeometry {
  static calculate(baseSize) {
    return calculateRadialSelectorGeometry(baseSize);
  }
}

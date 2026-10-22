// Crossing sine waves on a plane (spec 106 D2, spec 128): one set per displacement axis. Each wave: wavelength
// multiple, direction (radians from the horizontal), share of the amplitude (a set's shares add up to 1) and phase.
const wave = (multiple, angle, share, phase) =>
  Object.freeze({ multiple, dirX: Math.cos(angle), dirY: Math.sin(angle), share, phase });

// The sum of a set at a point is in -1..1. k is 2π / wavelength; travel is k × speed × time (how far the crests have
// moved); positions and the wavelength share one unit. The water's displacement map writes whole rows (addRow);
// a single point (sampleAt) gives the same sum for that place, e.g. the water under the float.
export class CrossingWavePattern {
  static WAVES_X = Object.freeze([wave(1, 0.17, 0.5, 0), wave(0.58, -0.44, 0.3, 1.7), wave(0.34, 1.05, 0.2, 4.1)]);
  static WAVES_Y = Object.freeze([wave(0.8, 0.52, 0.6, 0.9), wave(0.45, -0.87, 0.4, 2.6)]);

  // Adds each wave's sine at target.length points of a row: x0, x0 + dx, ... at height y. Its phase grows by the
  // same step per point, so rotating (sin, cos) by that step replaces a sine per point: two sines per wave and row.
  static addRow(waves, target, k, x0, dx, y, travel) {
    for (let index = 0; index < waves.length; index += 1) {
      const current = waves[index];
      const step = (k * current.dirX * dx) / current.multiple;
      const phase = (k * (x0 * current.dirX + y * current.dirY) - travel) / current.multiple + current.phase;
      const stepSin = Math.sin(step);
      const stepCos = Math.cos(step);
      let sin = Math.sin(phase);
      let cos = Math.cos(phase);
      for (let column = 0; column < target.length; column += 1) {
        target[column] += current.share * sin;
        const next = sin * stepCos + cos * stepSin;
        cos = cos * stepCos - sin * stepSin;
        sin = next;
      }
    }
  }

  static sampleAt(waves, k, x, y, travel) {
    let sum = 0;
    for (let index = 0; index < waves.length; index += 1) {
      const current = waves[index];
      sum += current.share * Math.sin((k * (x * current.dirX + y * current.dirY) - travel) / current.multiple + current.phase);
    }
    return sum;
  }
}

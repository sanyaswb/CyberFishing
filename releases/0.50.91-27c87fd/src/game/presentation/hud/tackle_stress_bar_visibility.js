// When the second fight bar (tackle STRESS, under the tension bar) shows: any accumulated tackle stress, or tension at
// the break threshold. The HUD and the Spine rod's critical clips (spec 099) read the same rule, so they switch together.
export class TackleStressBarVisibility {
  static isVisible({ stressRatio, tension, breakThreshold }) {
    return Number(stressRatio) > 0 || Number(tension) >= (Number(breakThreshold) || 100) - 0.1;
  }
}

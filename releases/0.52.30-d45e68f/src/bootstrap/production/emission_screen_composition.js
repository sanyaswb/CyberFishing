// Spec 179 stages E, J, L: what the screen shows of the emission and of the vodka, once per frame (GameApplication's
// update, also in the house's world ticks). The «Радіація» status first (the intoxication reads it); then the emission's
// veil (darkening, blur; spec 181 D2: the full intensity weakened at the output by the statuses' shares); then the view's
// motion — the emission's shake (TK-372; the gas mask does not stop it) plus the vodka's sway without radiation (TK-374;
// its blur reaches the scene through getSceneBlurPx) — as one CSS move of the scene (SceneLayer.setViewMotion).
// effect: EmissionScreenEffect; veil: EmissionVeilDomRenderer or null (no UI surface); cameraShake: EmissionCameraShake;
// intoxication: IntoxicationEffect; statuses: PlayerStatusEffects; getViewWidth: () => the logical screen's width;
// getConfig: () => CONFIG. Returns { update(dtMs) }.
export function composeEmissionScreen({ effect, veil, cameraShake, intoxication, sceneLayer, emissionExposure,
  radiationStatus, statuses, getViewWidth, getConfig }) {
  return Object.freeze({
    update(dtMs) {
      const config = getConfig();
      radiationStatus.update();
      const intensity = emissionExposure.intensity();
      const record = effect.update(dtMs, intensity, config.emission?.screen, emissionExposure.modifier("vignette"),
        emissionExposure.modifier("blur"), emissionExposure.modifier("blurRate"));
      veil?.apply(record, !(record.includeHud === false && sceneLayer.isActive()));
      const shake = cameraShake.update(dtMs, intensity, emissionExposure.atPeak(), config.emission?.screen?.shake);
      const drunk = intoxication.update(dtMs, statuses.stacks("vodka"), statuses.definition("vodka")?.maxStacks,
        statuses.has("radiation"), getViewWidth(), config.canvas?.intoxication);
      sceneLayer.setViewMotion(shake.x + drunk.x, shake.y + drunk.y, shake.marginPx + drunk.marginX,
        shake.marginPx + drunk.marginY);
    },
  });
}

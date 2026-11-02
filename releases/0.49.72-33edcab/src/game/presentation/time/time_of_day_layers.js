// One background composition for every time-of-day scene (location Canvas, House DOM):
// an opaque base phase and at most one translucent phase above it.
export function timeOfDayLayers(eveningOpacity, nightOpacity, output) {
  if (nightOpacity === 1) {
    output.base = "night"; output.overlay = null; output.overlayOpacity = 0;
  } else if (nightOpacity > 0) {
    output.base = "evening"; output.overlay = "night"; output.overlayOpacity = nightOpacity;
  } else if (eveningOpacity === 1) {
    output.base = "evening"; output.overlay = null; output.overlayOpacity = 0;
  } else if (eveningOpacity > 0) {
    output.base = "day"; output.overlay = "evening"; output.overlayOpacity = eveningOpacity;
  } else {
    output.base = "day"; output.overlay = null; output.overlayOpacity = 0;
  }
  return output;
}

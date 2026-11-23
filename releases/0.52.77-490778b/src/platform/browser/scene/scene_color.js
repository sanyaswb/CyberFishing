// TK-358: the colours of the scene's weather particles — a "#rrggbb" config value parsed once per change (SceneColor)
// and the mix of two colours by a share (the rain's and the ash's tint toward the emission's).
const parseHex = (text) => (/^#[0-9a-f]{6}$/iu.test(text) ? Number.parseInt(text.slice(1), 16) : 0xffffff);

export class SceneColor {
  #text = "";
  #value = 0xffffff;

  // The 0xrrggbb value of a "#rrggbb" config text (white for anything else), parsed only when the text changes.
  read(text) {
    const next = typeof text === "string" ? text : "#ffffff";
    if (next !== this.#text) {
      this.#text = next;
      this.#value = parseHex(next);
    }
    return this.#value;
  }
}

export function mixColor(a, b, share) {
  if (share <= 0) return a;
  if (share >= 1) return b;
  const channel = (shift) => Math.round(((a >> shift) & 255) + ((((b >> shift) & 255) - ((a >> shift) & 255)) * share));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

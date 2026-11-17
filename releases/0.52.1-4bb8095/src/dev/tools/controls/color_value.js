// TK-320: a colour written as text in the config ("#rgb", "#rrggbb", "#rrggbbaa", "rgb(r, g, b)", "rgba(r, g, b, a)"),
// read into { r, g, b, a, format } and written back in the same format, so editing a colour never changes how it is
// stored. null for anything else (a named colour, a gradient), which stays a plain text field.
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const RGB = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/iu;

const channel = (value) => Math.max(0, Math.min(255, Math.round(Number(value))));
const alphaOf = (value) => Math.max(0, Math.min(1, Number(value)));
const hex2 = (value) => channel(value).toString(16).padStart(2, "0");

export class ColorValue {
  static parse(text) {
    const source = String(text ?? "").trim();
    const hex = HEX.exec(source);
    if (hex) {
      const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
      const value = (start) => parseInt(digits.slice(start, start + 2), 16);
      return { r: value(0), g: value(2), b: value(4), a: digits.length === 8 ? value(6) / 255 : 1,
        format: digits.length === 8 ? "hex8" : "hex" };
    }
    const rgb = RGB.exec(source);
    if (!rgb) return null;
    const hasAlpha = /^rgba/iu.test(source) || rgb[4] !== undefined;
    return { r: channel(rgb[1]), g: channel(rgb[2]), b: channel(rgb[3]), a: rgb[4] === undefined ? 1 : alphaOf(rgb[4]),
      format: hasAlpha ? "rgba" : "rgb" };
  }

  // Whether the format carries an opacity the picker can change.
  static hasAlpha(color) {
    return color?.format === "rgba" || color?.format === "hex8";
  }

  // "#rrggbb" for <input type="color">.
  static toHex6(color) {
    return `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`;
  }

  static format(color) {
    const a = Math.round(alphaOf(color.a) * 100) / 100;
    if (color.format === "rgba") return `rgba(${channel(color.r)}, ${channel(color.g)}, ${channel(color.b)}, ${a})`;
    if (color.format === "rgb") return `rgb(${channel(color.r)}, ${channel(color.g)}, ${channel(color.b)})`;
    if (color.format === "hex8") return `${ColorValue.toHex6(color)}${hex2(alphaOf(color.a) * 255)}`;
    return ColorValue.toHex6(color);
  }
}

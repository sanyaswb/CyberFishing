// DevTools' own icons (spec 174 C1): outline icons on a 20 × 20 grid, drawn with the text colour (stroke: currentColor
// in dev-tools.css), so they look the same on every platform and follow the panel's states. They are built from these
// path lists as inline SVG: no file to load, nothing in the asset registry, DEV only.
const SVG_NS = "http://www.w3.org/2000/svg";

export const DEV_ICONS = Object.freeze({
  gear: ["M10 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6z",
    "M10 2v2.2M10 15.8V18M2 10h2.2M15.8 10H18M4.3 4.3l1.6 1.6M14.1 14.1l1.6 1.6M4.3 15.7l1.6-1.6M14.1 5.9l1.6-1.6"],
  close: ["M5 5l10 10", "M15 5L5 15"],
  chevron: ["M8 5l5 5-5 5"],
  home: ["M3 9.5L10 4l7 5.5", "M5 8.5V16h10V8.5"],
  hook: ["M13 2.5v9a4.5 4.5 0 0 1-9 0V9l2.5 2.5"],
  shop: ["M4 7h12l-1 10H5z", "M7.5 7V5.5a2.5 2.5 0 0 1 5 0V7"],
  sliders: ["M4 5h9M4 10h3M11 10h5M4 15h7M15 15h1", "M13 3v4M7 8v4M11 13v4"],
  bug: ["M7 8a3 3 0 0 1 6 0v4a3 3 0 0 1-6 0z", "M10 9v6M4 10h3M13 10h3M5 6l2 1.5M15 6l-2 1.5M5 15l2-1.5M15 15l-2-1.5"],
  layers: ["M10 3l7 4-7 4-7-4z", "M3 11l7 4 7-4"],
  scene: ["M3 4h14v12H3z", "M3 13l4-4 3 3 2-2 5 5", "M13 7.5h.01"],
  map: ["M3 5l4.5-2 5 2L17 3v12l-4.5 2-5-2L3 17z", "M7.5 3v12M12.5 5v12"],
  database: ["M4 5c0-1.1 2.7-2 6-2s6 .9 6 2-2.7 2-6 2-6-.9-6-2z", "M4 5v10c0 1.1 2.7 2 6 2s6-.9 6-2V5",
    "M4 10c0 1.1 2.7 2 6 2s6-.9 6-2"],
  fish: ["M3 10c2.5-4 7.5-5 11-1l3-2v6l-3-2c-3.5 4-8.5 3-11-1z", "M7 9.5h.01"],
  box: ["M3 6.5L10 3l7 3.5v7L10 17l-7-3.5z", "M3 6.5L10 10l7-3.5M10 10v7"],
  spine: ["M4 16c2-2 1.5-5 4-7s5-1.5 8-5", "M4 16h.01M8 9h.01M16 4h.01"],
  radio: ["M3 8h14v9H3z", "M6 8l9-4", "M7 11a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z", "M11 11.5h4M11 14h4"],
  net: ["M4 4h12l-2 13H6z", "M5.3 8h9.4M5.8 12h8.4M8 4l1 13M12 4l-1 13"],
  play: ["M6 4l9 6-9 6z"],
  wrench: ["M14.5 3.5a3.5 3.5 0 0 0-4.6 4.4L3.5 14.3l2.2 2.2 6.4-6.4a3.5 3.5 0 0 0 4.4-4.6l-2 2-2-.6-.6-2z"],
  stack: ["M10 3l7 3.5-7 3.5-7-3.5z", "M3 10l7 3.5 7-3.5", "M3 13.5l7 3.5 7-3.5"],
  chart: ["M3 17h14", "M5 14l4-4 3 2 5-6"],
  warning: ["M10 3l8 14H2z", "M10 8v4M10 14.5h.01"],
  copy: ["M8 7h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z", "M4 13V5a1 1 0 0 1 1-1h7"],
  download: ["M10 3v10", "M6 9l4 4 4-4", "M4 17h12"],
  cloud: ["M6 15h8.5a3 3 0 0 0 .3-6A4.5 4.5 0 0 0 6 8a3.5 3.5 0 0 0 0 7z"],
  info: ["M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14z", "M10 9v5M10 6.5h.01"],
  reset: ["M4 10a6 6 0 1 0 1.8-4.3", "M4 3v3.5h3.5"],
  search: ["M8.5 3.5a5 5 0 1 0 0 10a5 5 0 1 0 0-10z", "M12.2 12.2L17 17"],
  changed: ["M10 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6z"],
  camera: ["M3 7h3l1.5-2h5L14 7h3v9H3z", "M10 9a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z"],
});

// An inline SVG of one icon; className: the consumer's sizing class besides the shared devtools__icon.
export function createDevIcon(documentRef, name, className = "") {
  const paths = DEV_ICONS[name];
  if (!paths) throw new RangeError(`Unknown DevTools icon: ${name}`);
  const svg = documentRef.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className ? `devtools__icon ${className}` : "devtools__icon");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of paths) {
    const path = documentRef.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}

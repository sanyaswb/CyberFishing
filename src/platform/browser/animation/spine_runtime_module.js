// The one Spine runtime entry (spec 083, contract in spec 047 "Spine Surface Contract"). This checked-in stub reports
// that no runtime is prepared, so scenes keep their static fallback. A prepared runtime (a pinned, self-hosted ESM
// build of the official spine-webgl, no CDN, no globals) replaces this file and keeps the same named export,
// returning { version, createScene(bundle, surface) }.
export function createSpineRuntime() {
  return null;
}

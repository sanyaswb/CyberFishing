"use strict";

const assert = require("node:assert/strict");

async function main() {
  const { EmbeddedPageOverlay, EMBEDDED_PAGE_RETURN_MESSAGE } = await import(
    "../src/platform/browser/ui/embedded_page_overlay.js"
  );
  const listeners = new Map();
  const frames = [];
  const windowTarget = {
    location: { origin: "https://game.example" },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
  };
  const documentRef = {
    createElement: (tag) => {
      assert.equal(tag, "iframe");
      return { contentWindow: {}, addEventListener(name, listener) { this[name] = listener; }, remove() { this.removed = true; } };
    },
    body: { appendChild: (frame) => frames.push(frame) },
  };
  let entered = 0;
  let exited = 0;
  let readyWindow = null;
  let returnedFocus = 0;
  const opener = { isConnected: true, focus: () => returnedFocus++ };
  documentRef.activeElement = opener;
  const overlay = new EmbeddedPageOverlay({ documentRef, windowTarget,
    src: "ui-catalog.html?embedded=1&page=default", title: "Default page",
    onEnter: () => entered++, onExit: () => exited++, onReady: (frameWindow) => readyWindow = frameWindow });
  overlay.open();
  overlay.open();
  assert.equal(frames.length, 1, "opening twice keeps one house page");
  assert.equal(entered, 1, "the location pauses once");
  assert.equal(frames[0].src, "ui-catalog.html?embedded=1&page=default");
  assert.equal(frames[0].className, "embedded-page-overlay");
  assert.equal(frames[0].allowFullscreen, true);
  frames[0].load();
  assert.equal(readyWindow, frames[0].contentWindow, "preview receives only the loaded frame window");
  const message = listeners.get("message");
  message({ source: {}, origin: windowTarget.location.origin,
    data: { type: EMBEDDED_PAGE_RETURN_MESSAGE } });
  message({ source: frames[0].contentWindow, origin: "https://other.example",
    data: { type: EMBEDDED_PAGE_RETURN_MESSAGE } });
  message({ source: frames[0].contentWindow, origin: windowTarget.location.origin,
    data: { type: "other-action" } });
  assert.equal(exited, 0, "untrusted messages cannot resume the location");
  message({ source: frames[0].contentWindow, origin: windowTarget.location.origin,
    data: { type: EMBEDDED_PAGE_RETURN_MESSAGE } });
  assert.equal(frames[0].removed, true);
  assert.equal(exited, 1, "only the house page can resume the location");
  assert.equal(returnedFocus, 1, "return restores the opening control's keyboard focus");
  let catalogReadyWindow = null;
  overlay.open({ src: "ui-catalog.html?embedded=1", title: "UI catalog",
    onReady: frameWindow => { catalogReadyWindow = frameWindow; } });
  overlay.open();
  assert.equal(frames.length, 2, "House and catalog share one active embedded page");
  assert.equal(frames[1].src, "ui-catalog.html?embedded=1");
  assert.equal(frames[1].title, "UI catalog");
  frames[1].load();
  assert.equal(catalogReadyWindow, frames[1].contentWindow);
  assert.equal(readyWindow, frames[0].contentWindow, "Catalog load must not update the House preview");
  message({ source: frames[0].contentWindow, origin: windowTarget.location.origin,
    data: { type: EMBEDDED_PAGE_RETURN_MESSAGE } });
  assert.equal(exited, 1, "A closed House frame cannot close the catalog");
  message({ source: frames[1].contentWindow, origin: windowTarget.location.origin,
    data: { type: EMBEDDED_PAGE_RETURN_MESSAGE } });
  assert.equal(frames[1].removed, true);
  assert.equal(exited, 2, "Returning from the catalog resumes the existing game once");
  assert.equal(returnedFocus, 2);
  overlay.open();
  assert.equal(frames[2].src, "ui-catalog.html?embedded=1&page=default", "a page opened with options does not change the default destination");
  overlay.dispose();
  overlay.open({ src: "ui-catalog.html?embedded=1" });
  assert.equal(frames.length, 3, "A disposed overlay cannot reopen a page");
  assert.equal(frames[2].removed, true);
  assert.equal(exited, 2, "page cleanup does not restart a disposed game");
  assert.equal(listeners.has("message"), false);
  console.log("Embedded House/UI catalog overlay passed: one active page, fullscreen-capable frame, trusted return, focus restoration and lifecycle cleanup.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

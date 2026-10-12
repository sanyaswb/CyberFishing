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
      return { contentWindow: {}, remove() { this.removed = true; } };
    },
    body: { appendChild: (frame) => frames.push(frame) },
  };
  let entered = 0;
  let exited = 0;
  const overlay = new EmbeddedPageOverlay({ documentRef, windowTarget,
    src: "fisherman-house.html?embedded=1", title: "House",
    onEnter: () => entered++, onExit: () => exited++ });
  overlay.open();
  overlay.open();
  assert.equal(frames.length, 1, "opening twice keeps one house page");
  assert.equal(entered, 1, "the location pauses once");
  assert.equal(frames[0].src, "fisherman-house.html?embedded=1");
  assert.equal(frames[0].className, "embedded-page-overlay");
  assert.equal(frames[0].allowFullscreen, true);
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
  overlay.open();
  overlay.dispose();
  assert.equal(frames[1].removed, true);
  assert.equal(exited, 1, "page cleanup does not restart a disposed game");
  assert.equal(listeners.has("message"), false);
  console.log("Embedded house overlay passed: one active page, fullscreen-capable frame, trusted return and lifecycle cleanup.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

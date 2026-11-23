// The DevToolsUI.redraw contract (TK-387) for DevToolsUI doubles: the old rows' bindings are released, the container is
// emptied, then draw() fills it again — in this order, as the real panel does (an open drill-in is the real panel's own
// part, checked in devtools-controls). Mix it into a double as a method: { releaseValueBindings() {}, redraw: devToolsRedraw }.
function devToolsRedraw(container, draw) {
  this.releaseValueBindings(container);
  container.replaceChildren();
  draw();
}

module.exports = { devToolsRedraw };

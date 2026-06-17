const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class CanvasContextSpy {
  constructor({ textWidth = 8 } = {}) {
    this.calls = [];
    this.textWidth = textWidth;
    this.fillStyle = "";
    this.strokeStyle = "";
    this.lineWidth = 1;
    this.font = "";
    this.textAlign = "";
    this.textBaseline = "";
    this.globalAlpha = 1;
    this.shadowColor = "";
    this.shadowBlur = 0;
    this.lineDashOffset = 0;
    this.filter = "none";
  }

  save() {
    this.#record("save");
  }

  restore() {
    this.#record("restore");
  }

  beginPath() {
    this.#record("beginPath");
  }

  closePath() {
    this.#record("closePath");
  }

  moveTo(...args) {
    this.#record("moveTo", args);
  }

  lineTo(...args) {
    this.#record("lineTo", args);
  }

  quadraticCurveTo(...args) {
    this.#record("quadraticCurveTo", args);
  }

  arc(...args) {
    this.#record("arc", args);
  }

  ellipse(...args) {
    this.#record("ellipse", args);
  }

  rect(...args) {
    this.#record("rect", args);
  }

  roundRect(...args) {
    this.#record("roundRect", args);
  }

  clip() {
    this.#record("clip");
  }

  fill() {
    this.#record("fill");
  }

  stroke() {
    this.#record("stroke");
  }

  fillRect(...args) {
    this.#record("fillRect", args);
  }

  strokeRect(...args) {
    this.#record("strokeRect", args);
  }

  drawImage(...args) {
    this.#record("drawImage", args);
  }

  fillText(...args) {
    this.#record("fillText", args);
  }

  measureText(text) {
    this.#record("measureText", [text]);
    return { width: String(text).length * this.textWidth };
  }

  translate(...args) {
    this.#record("translate", args);
  }

  rotate(...args) {
    this.#record("rotate", args);
  }

  setLineDash(...args) {
    this.#record("setLineDash", args);
  }

  callsNamed(name) {
    return this.calls.filter((call) => call.name === name);
  }

  textCall(text) {
    return this.calls.find(
      (call) => call.name === "fillText" && call.args[0] === text,
    );
  }

  reset() {
    this.calls.length = 0;
  }

  #record(name, args = []) {
    this.calls.push({
      name,
      args: Array.from(args),
      state: {
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        font: this.font,
        textAlign: this.textAlign,
        textBaseline: this.textBaseline,
        globalAlpha: this.globalAlpha,
        shadowColor: this.shadowColor,
        shadowBlur: this.shadowBlur,
        lineDashOffset: this.lineDashOffset,
        filter: this.filter,
      },
    });
  }
}

class RenderTestHarness {
  constructor(rootDirectory) {
    this.rootDirectory = rootDirectory;
  }

  createContext(globals = {}) {
    return vm.createContext({
      console,
      ...globals,
    });
  }

  load(context, files) {
    for (const file of files) {
      vm.runInContext(
        fs.readFileSync(path.join(this.rootDirectory, file), "utf8"),
        context,
        { filename: file },
      );
    }
  }

  run(context, source, filename) {
    return vm.runInContext(source, context, { filename });
  }
}

function createIdentityProjector({ scale = 1 } = {}) {
  return {
    virtualToScreen(x, y, target = {}) {
      target.x = x;
      target.y = y;
      return target;
    },
    screenToVirtual(x, y, target = {}) {
      target.x = x;
      target.y = y;
      return target;
    },
    getScale() {
      return scale;
    },
    getPerspective() {
      return { scale: 1, squashY: 1 };
    },
  };
}

module.exports = {
  CanvasContextSpy,
  RenderTestHarness,
  createIdentityProjector,
};

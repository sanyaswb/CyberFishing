export class DepthSelector {
  #pendingFrames = new Set();
  #disposed = false;
  #animationFrameHost;
  #labels;

  constructor({ labels } = {}) {
    this.#labels = labels;
    this.#animationFrameHost = document.defaultView;
    this.container = document.createElement("div");
    this.container.innerHTML = `
            <div id="ds-container" class="depth-selector">
                <div id="ds-wrapper" class="depth-selector__wrapper">
                    <div id="ds-distance-panel" class="depth-selector__distance-panel">
                        <span id="ds-distance-value" class="depth-selector__distance-value">${this.#labels.castDistance("0.0")}</span>
                        <div id="ds-distance-track" class="depth-selector__distance-track" role="progressbar" aria-label="${this.#labels.castDistanceRange}">
                            <div id="ds-distance-fill" class="depth-selector__distance-fill"></div>
                        </div>
                    </div>
                    <div id="ds-input-container" class="depth-selector__input-container">
                        <input type="text" id="ds-input" class="depth-selector__input" value="1.5">
                    </div>
                    <div id="ds-slider-container" class="depth-selector__slider-container">
                        <input type="range" id="ds-slider" class="depth-selector__slider" min="0.1" step="0.1">
                    </div>
                    <div id="ds-labels" class="depth-selector__labels">
                        <span id="ds-min" class="depth-selector__min">0.1</span>
                        <span></span>
                        <span id="ds-max" class="depth-selector__max">8.0</span>
                    </div>
                </div>
            </div>
        `;
    document.body.appendChild(this.container);

    this.mainContainer = document.getElementById("ds-container");
    this.slider = document.getElementById("ds-slider");
    this.input = document.getElementById("ds-input");
    this.maxLabel = document.getElementById("ds-max");
    this.inputContainer = document.getElementById("ds-input-container");
    this.distanceValue = document.getElementById("ds-distance-value");
    this.distancePanel = document.getElementById("ds-distance-panel");
    this.distanceTrack = document.getElementById("ds-distance-track");
    this.distanceFill = document.getElementById("ds-distance-fill");

    this.onChange = null;
    this.isActive = false;

    this.#bindEvents();
  }

  #bindEvents() {
    this.slider.addEventListener("input", (e) => {
      if (this.#disposed) return;
      const val = parseFloat(e.target.value);
      this.input.value = val.toFixed(2);
      this.#updateInputPosition();
      if (this.onChange) this.onChange(val);
    });

    this.input.addEventListener("input", (e) => {
      if (this.#disposed) return;
      let val = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
      if ((val.match(/\./g) || []).length > 1) {
        val = val.substring(0, val.lastIndexOf("."));
      }
      e.target.value = val;
    });

    this.input.addEventListener("change", (e) => {
      if (this.#disposed) return;
      let val = parseFloat(e.target.value);
      if (isNaN(val)) val = 0.1;
      val = Math.max(0.1, Math.min(parseFloat(this.slider.max), val));
      this.input.value = val.toFixed(2);
      this.slider.value = val;
      this.#updateInputPosition();
      if (this.onChange) this.onChange(val);
    });
  }

  #updateInputPosition() {
    if (this.#disposed) return;
    const min = parseFloat(this.slider.min);
    const max = parseFloat(this.slider.max);
    const val = parseFloat(this.slider.value);

    const range = max - min;
    const percent = range > 0 ? (val - min) / range : 0;
    const sliderHeight = this.slider.clientHeight;
    const offset = percent * sliderHeight;

    this.inputContainer.style.top = `calc(${offset}px - 18px)`;
  }

  show(maxDepth, currentDepth, changeCallback) {
    if (this.#disposed) return;
    this.isActive = true;
    this.onChange = changeCallback;

    this.slider.max = maxDepth;
    this.maxLabel.innerText = maxDepth.toFixed(1);

    this.slider.value = currentDepth;
    this.input.value = currentDepth.toFixed(2);

    this.mainContainer.style.display = "flex";

    this.#scheduleInputPosition();
  }

  updateMax(maxDepth) {
    if (this.#disposed) return;
    if (!this.isActive || parseFloat(this.slider.max) === maxDepth) return;

    this.slider.max = maxDepth;
    this.maxLabel.innerText = maxDepth.toFixed(1);

    // Clamp the current depth when it exceeds the new limit.
    let val = parseFloat(this.input.value);
    if (val > maxDepth) {
      val = maxDepth;
      this.input.value = val.toFixed(2);
      this.slider.value = val;
      if (this.onChange) this.onChange(val);
    }

    this.#scheduleInputPosition();
  }

  #scheduleInputPosition() {
    if (this.#disposed) return;
    const frameId = this.#animationFrameHost.requestAnimationFrame(() => {
      this.#pendingFrames.delete(frameId);
      this.#updateInputPosition();
    });
    this.#pendingFrames.add(frameId);
  }

  updateCastDistance({ availableMeters, maximumMeters, visible = true } = {}) {
    if (this.#disposed) return;
    this.distancePanel.style.display = visible ? "block" : "none";
    if (!visible) return;

    const maximum = Math.max(0, Number(maximumMeters) || 0);
    const available = Math.max(
      0,
      Math.min(maximum, Number(availableMeters) || 0),
    );
    const ratio = maximum > 0 ? available / maximum : 0;

    this.distanceValue.innerText = this.#labels.castDistance(available.toFixed(1));
    this.distanceFill.style.width = `${(ratio * 100).toFixed(1)}%`;
    this.distanceTrack.setAttribute("aria-valuemin", "0");
    this.distanceTrack.setAttribute(
      "aria-valuemax",
      maximum.toFixed(1),
    );
    this.distanceTrack.setAttribute(
      "aria-valuenow",
      available.toFixed(1),
    );
  }

  hide() {
    if (this.#disposed) return;
    this.isActive = false;
    this.mainContainer.style.display = "none";
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.isActive = false;
    for (const frameId of this.#pendingFrames) this.#animationFrameHost.cancelAnimationFrame(frameId);
    this.#pendingFrames.clear();
    this.#animationFrameHost = null;
    this.onChange = null;
    this.container?.remove();
    this.container = null;
    this.mainContainer = null;
    this.slider = null;
    this.input = null;
    this.maxLabel = null;
    this.inputContainer = null;
    this.distanceValue = null;
    this.distancePanel = null;
    this.distanceTrack = null;
    this.distanceFill = null;
  }
}

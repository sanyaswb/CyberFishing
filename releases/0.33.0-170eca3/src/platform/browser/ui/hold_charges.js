export class HoldCharges {
  #labels;

  constructor({ labels } = {}) {
    this.#labels = labels;
    this.container = document.createElement("div");
    this.container.className = "hold-charges";

    this.textLabel = document.createElement("div");
    this.textLabel.className = "hold-charges__label";

    this.container.appendChild(this.textLabel);
    document.body.appendChild(this.container);

    this.circles = [];
    this.maxCharges = 0;
  }

  update(holdState) {
    // Hide the UI when the hold is inactive or no charges remain.
    if (!holdState || !holdState.hasHold || holdState.max <= 0) {
      this.container.style.display = "none";
      return;
    }

    this.container.style.display = "flex";

    // Rebuild charge indicators when their maximum count changes.
    if (this.maxCharges !== holdState.max) {
      this.circles.forEach((c) => c.remove());
      this.circles = [];
      for (let i = 0; i < holdState.max; i++) {
        const circle = document.createElement("div");
        circle.className = "hold-charges__charge";
        this.container.appendChild(circle);
        this.circles.push(circle);
      }
      this.maxCharges = holdState.max;
    }

    let available = holdState.current;
    let active = holdState.isActive ? 1 : 0;
    let restoringCount = holdState.restoring.length;

    if (holdState.isActive) {
      this.textLabel.innerText = this.#labels.holdActive;
      this.textLabel.style.display = "block";
    } else {
      this.textLabel.style.display = "none";
    }

    for (let i = 0; i < this.maxCharges; i++) {
      const circle = this.circles[i];

      if (active > 0) {
        circle.className = "hold-charges__charge hold-charges__charge--active";
        active--;
      } else if (available > 0) {
        circle.className = "hold-charges__charge hold-charges__charge--available";
        available--;
      } else if (restoringCount > 0) {
        const timer = holdState.restoring[restoringCount - 1];
        const progress = Math.max(0, Math.min(1, 1.0 - timer / holdState.restoreMaxTime));
        circle.className = "hold-charges__charge hold-charges__charge--restoring";
        circle.style.setProperty("--hold-charge-progress", (progress * 100).toFixed(1) + "%");
        restoringCount--;
      }
    }
  }

  dispose() {
    this.circles.length = 0;
    this.container?.remove();
    this.container = null;
    this.textLabel = null;
  }
}

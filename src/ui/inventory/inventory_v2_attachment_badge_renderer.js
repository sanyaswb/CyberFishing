class InventoryV2AttachmentBadgeRenderer {
  #dom;

  constructor({ domFactory } = {}) {
    this.#dom = domFactory || new globalThis.InventoryV2DomFactory();
  }

  render(host, attachments = []) {
    if (!host) return;
    const groups = this.#groupAttachments(attachments);
    for (const [placement, entries] of groups) {
      const cluster = this.#dom.element(
        "span",
        `inventory-v2-attachments inventory-v2-attachments--${placement}`,
      );
      cluster.setAttribute("aria-hidden", "true");
      cluster.style.setProperty("--inventory-v2-badge-count", entries.length);
      entries.forEach((attachment, index) => {
        cluster.appendChild(this.#createBadge(attachment, index));
      });
      host.appendChild(cluster);
    }
  }

  #groupAttachments(attachments) {
    const groups = new Map();
    for (const attachment of Array.isArray(attachments) ? attachments : []) {
      if (!attachment) continue;
      const placement = this.#resolvePlacement(attachment);
      if (!groups.has(placement)) groups.set(placement, []);
      groups.get(placement).push(attachment);
    }
    return groups;
  }

  #resolvePlacement(attachment) {
    const explicit = String(attachment.placement || "");
    const known = ["reel-line", "hook", "bottom", "boat-cargo"];
    if (known.includes(explicit)) return explicit;

    const kind = String(attachment.kind || attachment.role || "");
    if (["line", "reelLine", "reel-line"].includes(kind)) {
      return "reel-line";
    }
    if (["hook", "feederHook", "feeder-hook"].includes(kind)) {
      return "hook";
    }
    if (["boatCargo", "boat-cargo", "cargo"].includes(kind)) {
      return "boat-cargo";
    }
    return "bottom";
  }

  #createBadge(attachment, index) {
    const badge = this.#dom.element("span", "inventory-v2-attachment-badge");
    badge.style.setProperty("--inventory-v2-badge-index", index);
    badge.title = String(attachment.name || attachment.label || "");

    const image = this.#dom.image(
      attachment.iconUrl || attachment.imageUrl,
      "",
    );
    if (image) {
      image.className = "inventory-v2-attachment-badge__image";
      badge.appendChild(image);
    } else {
      const icon = this.#dom.element(
        "span",
        "inventory-v2-attachment-badge__icon",
        attachment.icon || attachment.emoji || "•",
      );
      badge.appendChild(icon);
    }
    return badge;
  }
}

globalThis.InventoryV2AttachmentBadgeRenderer =
  InventoryV2AttachmentBadgeRenderer;

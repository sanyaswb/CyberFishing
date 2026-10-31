export class InventoryAttachmentBadgeRenderer {
  #dom;
  #rarityDomAdapter;

  constructor({ domFactory, rarityDomAdapter = null } = {}) {
    this.#dom = domFactory;
    this.#rarityDomAdapter = rarityDomAdapter;
  }

  render(host, attachments = []) {
    if (!host) return;
    const groups = this.#groupAttachments(attachments);
    for (const [placement, entries] of groups) {
      const side = ["hook", "reel-line"].includes(placement);
      host.classList.add(side
        ? "inventory-item-card__content--side-slots"
        : "inventory-item-card__content--bottom-slots");
      host.style.setProperty(side
        ? "--inventory-side-slot-count"
        : "--inventory-bottom-slot-count", entries.length);
      const cluster = this.#dom.element(
        "span",
        `inventory-attachments inventory-attachments--${placement}`,
      );
      cluster.setAttribute("aria-hidden", "true");
      cluster.style.setProperty("--inventory-badge-count", entries.length);
      entries.forEach((attachment) => {
        cluster.appendChild(this.#createBadge(attachment));
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

  #createBadge(attachment) {
    const badge = this.#dom.element("span", "inventory-attachment-badge");
    badge.title = String(attachment.name || attachment.label || "Порожній відсік");
    if (attachment.empty === true) {
      badge.classList.add("inventory-attachment-badge--empty");
      return badge;
    }
    if (attachment.rarity) this.#rarityDomAdapter?.apply?.(badge, attachment.rarity);

    const image = this.#dom.image(attachment.iconAsset, "");
    if (image) {
      image.className = "inventory-attachment-badge__image";
      badge.appendChild(image);
    } else {
      badge.appendChild(this.#dom.glyph(attachment.icon || attachment.emoji || "•", "inventory-attachment-badge__icon"));
    }
    return badge;
  }
}

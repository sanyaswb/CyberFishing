import { SceneChangeFingerprint } from "./scene_change_fingerprint.js";

const CHUM_COLOR = 0xc8ff64;
const WAYPOINT_COLOR = 0xffaa00;

// The world-entities kind on the scene (spec 107): the bait boats' chum zones (clipped to the castable water), their
// waypoints, the boats (emoji sprites with an energy bar) and their sensor rays, drawn exactly as BoatChumRenderer
// draws them on the 2D canvas. The world model is rebuilt every frame, so a fingerprint of what is drawn decides
// whether the picture changed (update() returns it) and the Graphics are rebuilt only then.
export class PixiWorldEntitiesRenderer {
  #pixi;
  #texts;
  #container;
  #zones;
  #zoneMask;
  #overlay;
  #boatLayer;
  #boatView = null;
  #boatSprites = [];
  #labelSprites = [];
  #fingerprint = new SceneChangeFingerprint();
  #visible = false;

  // stage: the scene's root container; texts: the scene's SceneTextTextures.
  constructor({ pixi, stage, texts }) {
    if (typeof pixi?.Graphics !== "function") throw new TypeError("PixiWorldEntitiesRenderer requires the Pixi namespace");
    if (typeof texts?.get !== "function") throw new TypeError("PixiWorldEntitiesRenderer requires texts");
    this.#pixi = pixi;
    this.#texts = texts;
    this.#container = new pixi.Container();
    this.#zones = new pixi.Graphics();
    this.#zoneMask = new pixi.Graphics();
    this.#overlay = new pixi.Graphics();
    this.#boatLayer = new pixi.Container();
    this.#container.addChild(this.#zones, this.#zoneMask, this.#overlay, this.#boatLayer);
    this.#container.visible = false;
    stage.addChild(this.#container);
  }

  // world: the frame's world model, or null when the kind is not on the scene; pixelRatio: the scene's backing ratio
  // (text textures are drawn at it). Returns whether the picture changed.
  update(world, pixelRatio) {
    if (!world?.visible || !this.#hasContent(world)) return this.#hide();
    if (!this.#fingerprintOf(world, pixelRatio) && this.#visible) return false;
    this.#visible = true;
    this.#container.visible = true;
    this.#drawZones(world);
    this.#overlay.clear();
    this.#drawWaypoints(world, pixelRatio);
    this.#drawBoats(world, pixelRatio);
    this.#drawSensors(world);
    return true;
  }

  #hasContent(world) {
    return world.chumZones.count + world.waypoints.count + world.boats.count + world.sensorRays.count > 0;
  }

  #hide() {
    if (!this.#visible) return false;
    this.#visible = false;
    this.#container.visible = false;
    if (this.#boatView) this.#boatView.visible = false;
    this.#fingerprint.invalidate();
    return true;
  }

  #fingerprintOf(world, pixelRatio) {
    const print = this.#fingerprint;
    print.begin();
    print.length(pixelRatio);
    for (let index = 0; index < world.clipRegions.count; index += 1) {
      const region = world.clipRegions.getAt(index);
      print.length(region.x); print.length(region.y); print.length(region.width); print.length(region.height);
    }
    for (let index = 0; index < world.chumZones.count; index += 1) {
      const zone = world.chumZones.getAt(index);
      print.length(zone.x); print.length(zone.y); print.length(zone.radiusX); print.length(zone.radiusY);
      print.alpha(zone.opacity);
    }
    for (let index = 0; index < world.waypoints.count; index += 1) {
      const waypoint = world.waypoints.getAt(index);
      print.length(waypoint.x); print.length(waypoint.y); print.length(waypoint.scale * 8);
      print.flag(waypoint.showIndex); print.length(waypoint.index);
    }
    for (let index = 0; index < world.boats.count; index += 1) {
      const boat = world.boats.getAt(index);
      print.length(boat.x); print.length(boat.y); print.length(boat.angle * 100); print.text(boat.emoji);
      print.length(boat.fontSize); print.alpha(boat.energyRatio); print.text(boat.energyColor);
      print.length(boat.barWidth); print.length(boat.barHeight); print.length(boat.barY);
      if (boat.view) {
        print.text(boat.animClip || "");
        print.length(Math.floor((boat.animTimer || 0) * 1000));
      }
    }
    for (let index = 0; index < world.sensorRays.count; index += 1) {
      const ray = world.sensorRays.getAt(index);
      print.length(ray.startX); print.length(ray.startY); print.length(ray.endX); print.length(ray.endY);
      print.flag(ray.blocked);
    }
    return print.finish();
  }

  // Chum zones fill and outline inside the castable water only (2D: primitives.beginClip(world.clipRegions)).
  #drawZones(world) {
    const zones = this.#zones;
    const mask = this.#zoneMask;
    zones.clear();
    mask.clear();
    for (let index = 0; index < world.chumZones.count; index += 1) {
      const zone = world.chumZones.getAt(index);
      zones.ellipse(zone.x, zone.y, zone.radiusX, zone.radiusY)
        .fill({ color: CHUM_COLOR, alpha: zone.opacity * 0.2 })
        .stroke({ width: 2, color: CHUM_COLOR, alpha: zone.opacity * 0.5 });
    }
    if (world.clipRegions.count > 0) {
      for (let index = 0; index < world.clipRegions.count; index += 1) {
        const region = world.clipRegions.getAt(index);
        mask.rect(region.x, region.y, region.width, region.height);
      }
      mask.fill(0xffffff);
      zones.mask = mask;
    } else {
      zones.mask = null;
    }
  }

  #drawWaypoints(world, pixelRatio) {
    const overlay = this.#overlay;
    let labels = 0;
    for (let index = 0; index < world.waypoints.count; index += 1) {
      const waypoint = world.waypoints.getAt(index);
      const scale = waypoint.scale;
      overlay.circle(waypoint.x, waypoint.y, 8 * scale)
        .stroke({ width: Math.max(1, 2 * scale), color: WAYPOINT_COLOR, alpha: 0.6 });
      overlay.circle(waypoint.x, waypoint.y, 3 * scale).fill(WAYPOINT_COLOR);
      if (!waypoint.showIndex) continue;
      // 2D: bold Arial, left-aligned at x + 10s on the alphabetic baseline at y + 4s.
      const fontPx = Math.max(6, 10 * scale);
      const text = this.#texts.get(String(waypoint.index), fontPx, pixelRatio, { family: "Arial", weight: "bold" });
      const sprite = this.#sprite(this.#labelSprites, labels);
      labels += 1;
      sprite.texture = text.texture;
      sprite.width = text.width;
      sprite.height = text.height;
      sprite.anchor.set(0.5, 0.5);
      sprite.x = waypoint.x + 10 * scale + text.width / 2 - fontPx * 0.25;
      sprite.y = waypoint.y + 4 * scale - fontPx * 0.35;
      sprite.rotation = 0;
    }
    this.#hideFrom(this.#labelSprites, labels);
  }

  #drawBoats(world, pixelRatio) {
    const overlay = this.#overlay;
    let activeView = null;
    for (let index = 0; index < world.boats.count; index += 1) {
      const boat = world.boats.getAt(index);
      const sprite = this.#sprite(this.#boatSprites, index);
      const view = boat.view ?? null;
      if (view) {
        activeView = view;
        sprite.visible = false;
        if (view.parent !== this.#boatLayer) {
          this.#boatLayer.addChild(view);
        }
        view.visible = true;
        view.x = boat.x;
        view.y = boat.y;
        view.rotation = boat.angle + Math.PI / 2;
        const scale = boat.viewScale ?? 1;
        view.scale.set(scale, scale);
      } else {
        const text = this.#texts.get(boat.emoji, boat.fontSize, pixelRatio);
        sprite.texture = text.texture;
        sprite.width = text.width;
        sprite.height = text.height;
        sprite.anchor.set(0.5, 0.5);
        sprite.x = boat.x;
        sprite.y = boat.y;
        sprite.rotation = boat.angle + Math.PI;
        sprite.visible = true;
      }
      const left = boat.x - boat.barWidth / 2;
      const top = boat.y + boat.barY;
      overlay.rect(left, top, boat.barWidth, boat.barHeight).fill({ color: 0x000000, alpha: 0.7 });
      overlay.rect(left, top, boat.barWidth * boat.energyRatio, boat.barHeight).fill(boat.energyColor);
    }
    if (this.#boatView !== activeView) {
      if (this.#boatView) this.#boatView.visible = false;
      this.#boatView = activeView;
    }
    this.#hideFrom(this.#boatSprites, world.boats.count);
  }

  #drawSensors(world) {
    const overlay = this.#overlay;
    for (let index = 0; index < world.sensorRays.count; index += 1) {
      const ray = world.sensorRays.getAt(index);
      overlay.moveTo(ray.startX, ray.startY);
      overlay.lineTo(ray.endX, ray.endY);
      overlay.stroke({ width: 2, color: ray.blocked ? 0xff0000 : 0x00ff00, alpha: 0.6 });
    }
  }

  #sprite(pool, index) {
    let sprite = pool[index];
    if (!sprite) {
      sprite = new this.#pixi.Sprite();
      pool.push(sprite);
      this.#boatLayer.addChild(sprite);
    }
    sprite.visible = true;
    return sprite;
  }

  #hideFrom(pool, count) {
    for (let index = count; index < pool.length; index += 1) pool[index].visible = false;
  }
}

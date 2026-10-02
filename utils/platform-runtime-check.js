"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

async function main() {
  let dateReads = 0, performanceReads = 0;
  class FixedDate extends Date { static now() { dateReads++; return 1700; } }
  const calls = [];
  const context = {drawImage: (...args) => calls.push(args), getImageData: () => ({data:new Uint8ClampedArray([0,0,0,255])})};
  const canvases = [];
  const runtime = new SourceRuntime({globals:{Date:FixedDate,performance:{now(){performanceReads++;return 50;}},
    document:{createElement(type){assert.equal(type,"canvas");const canvas={getContext(){return context;}};canvases.push(canvas);return canvas;}}}});
  for(const [file,name] of [
    ["src/render/core/canvas_2d_surface.js","Canvas2DSurface"],
    ["src/infrastructure/location/offscreen_canvas_factory.js","OffscreenCanvasFactory"],
    ["src/render/core/image_asset_provider.js","ImageAssetProvider"],
    ["src/infrastructure/location/depth_map_reader.js","DepthMapReader"],
    ["src/infrastructure/location/location_asset_loader.js","LocationAssetLoader"],
    ["src/app/core/game_clock.js","GameClock"],
  ]) runtime.load(file,{expose:[name]});
  const {GameClock,ImageAssetProvider,OffscreenCanvasFactory,LocationAssetLoader} = runtime.context;
  const clock = new GameClock(100);
  const deltas = [clock.tick(100),clock.tick(116),clock.tick(500),clock.tick(490)];
  assert.deepEqual(deltas,[0,16,100,-10]);
  assert.equal(clock.total,106);
  assert.equal(clock.realNow,2140);
  clock.reset(400);
  assert.equal(clock.tick(450),50);
  assert.equal(clock.total,50);
  assert.equal(clock.realNow,2100);
  assert.equal(dateReads,2,"tick/reset must not read the wall clock");
  assert.equal(performanceReads,1,"explicit frame times must not read the host clock");

  const images = [];
  const assets = new ImageAssetProvider({imageFactory:()=>{const image={};images.push(image);return image;},fallbackAssetId:"fallback"});
  const first = assets.preload({fallback:"fallback.png",depth:"depth.png"});
  const duplicate = assets.preload({depth:"depth.png"});
  assert.equal(images.length,2,"duplicate pending assets must reuse the same image and promise");
  assert.equal(assets.isReady("depth"),false);
  assert.equal(assets.tryGet("missing"),null);
  images.forEach(image=>image.onload());
  assert.equal(await first,assets);
  await duplicate;
  assert.equal(assets.tryGet("depth"),images[1]);
  assert.equal(assets.tryGet("missing"),images[0]);
  await assets.preload({depth:"depth.png"});
  assert.equal(images.length,2,"ready assets must not reload");
  const failed = assets.preload({broken:"broken.png"});
  images[2].onerror(new Error("failed image"));
  await assert.rejects(failed,/failed image/);
  const retried = assets.preload({broken:"broken.png"});
  assert.equal(images.length,4,"failed assets must remain retryable");
  images[3].onload();
  await retried;

  const factory = new OffscreenCanvasFactory();
  const surface = factory.createSurface(12.9,0,{willReadFrequently:true});
  assert.equal(canvases[0].width,12);
  assert.equal(canvases[0].height,1);
  surface.drawImage(images[1],0,0);
  assert.equal(calls[0][0],images[1]);
  const preloads = [];
  const loader = new LocationAssetLoader({imageAssets:{preload:async manifest=>preloads.push(manifest),tryGet:()=>images[1]},canvasFactory:factory});
  const result = await loader.load("pond",{bgUrl:"pond.png",depthUrl:"depth.png"},{baseResolution:{width:1,height:1}});
  assert.equal(result.background.assetIds.default,"location:pond:default:pond.png");
  assert.equal(Object.keys(preloads[0]).length,2);
  assert(result.depthReader,"depth data must be created through the injected canvas factory");
  assert.equal(calls.at(-1)[0],images[1]);
  console.log("Platform runtime passed: frame delta clamp/reset and clock read counts; pending/ready/failed asset cache identity; injected canvas and location depth loading.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});

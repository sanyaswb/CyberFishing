"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

function checkLongPressFrames(usePerformance) {
  let now=0,clockReads=0,frameRequests=0,nextFrame=0,styleWrites=0,createdNodes=0,removedNodes=0,fired=0,clicks=0;
  const frames=new Map(),timers=new Map(),listeners=new Map(),styles=new Map();
  const document={
    querySelector(){throw new Error("frame must not query DOM");},
    createElement(tag){assert.equal(tag,"span");createdNodes++;return {
      setAttribute(){},style:{setProperty(key,value){styleWrites++;styles.set(key,value);}},remove(){removedNodes++;},
    };},
  };
  const globals={document,
    Date:class extends Date {static now(){clockReads++;return now;}},
    ...(usePerformance?{performance:{now(){clockReads++;return now;}}}:{}),
    setTimeout(callback,duration){assert.equal(duration,1500);timers.set(1,callback);return 1;},
    clearTimeout(id){timers.delete(id);},
    requestAnimationFrame(callback){frameRequests++;frames.set(++nextFrame,callback);return nextFrame;},
    cancelAnimationFrame(id){frames.delete(id);},
  };
  const runtime=new SourceRuntime({globals});
  runtime.load("src/ui/inventory/inventory_v2_long_press_controller.js",{expose:["InventoryV2LongPressController"]});
  const controller=new runtime.context.InventoryV2LongPressController();
  const element={ownerDocument:document,dataset:{},classList:{add(){},remove(){}},appendChild(){},
    addEventListener(name,callback){listeners.set(name,callback);},
    removeEventListener(name,callback){assert.equal(listeners.get(name),callback);listeners.delete(name);},
  };
  controller.bind(element,{onLongPress(){fired++;},onClick(){clicks++;}});
  assert.equal(listeners.size,7);
  const pointer={pointerId:7,clientX:0,clientY:0,button:0,isPrimary:true};
  listeners.get("pointerdown")(pointer);
  assert.equal(controller.hasActivePress,true);
  assert.equal(createdNodes,1);
  const callback=frames.values().next().value;
  const before={clockReads,frameRequests,styleWrites,createdNodes};
  for(let frame=1;frame<=120;frame++) {
    now=frame*10;
    const [id,current]=frames.entries().next().value;
    assert.equal(current,callback,"progress callback must be reused on every frame");
    frames.delete(id);current();
    assert.equal(frames.size,1,"one scheduled continuation per frame");
  }
  assert.equal(clockReads-before.clockReads,120);
  assert.equal(frameRequests-before.frameRequests,120);
  assert.equal(styleWrites-before.styleWrites,120);
  assert.equal(createdNodes,before.createdNodes,"frames allocate no DOM nodes");
  assert.equal(styles.get("--inventory-v2-long-press-angle"),"288deg");
  assert.equal(fired,0,"RAF progress does not own the press deadline");
  now=1500;timers.get(1)();timers.clear();
  assert.equal(fired,1);
  assert.equal(controller.hasActivePress,false);
  assert.equal(frames.size,0,"the deadline cancels its scheduled frame");
  assert.equal(styles.get("--inventory-v2-long-press-angle"),"360deg");
  let suppressed=0;
  listeners.get("click")({preventDefault(){suppressed++;},stopPropagation(){},stopImmediatePropagation(){}});
  assert.equal(suppressed,1);assert.equal(clicks,0);
  controller.dispose();
  assert.equal(listeners.size,0);assert.equal(removedNodes,1);assert.equal(frames.size,0);assert.equal(timers.size,0);
}

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
    ["src/assets/asset_preload_coordinator.js","AssetPreloadCoordinator"],
    ["src/infrastructure/storage/cache_manager.js","CacheManager"],
  ]) runtime.load(file,{expose:[name]});
  runtime.run('for (const module of ["src/engine/assets/asset_manifest.js", "src/engine/assets/asset_load_result.js"]) Object.assign(globalThis, globalThis.__CYBER_FISHING_COMPAT_RUNTIME__.modules[module]);');
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

  let diagnosticCalls=0;
  const pending=[],ready=new Set();
  const coordinator=new runtime.context.AssetPreloadCoordinator({locationsConfig:{},
    imageAssets:{isReady:id=>ready.has(id),preload:manifest=>new Promise((resolve,reject)=>pending.push({manifest,resolve,reject}))},
    diagnostics:{recordAssetRequestCreated(){diagnosticCalls++;}},
  });
  const makeManifest=(id,critical)=>{const manifest=new runtime.context.AssetManifest();manifest.add(id,id+".png",{critical});return manifest;};
  const firstManifest=makeManifest("shared",true);
  const firstRequest=coordinator.preloadManifest(firstManifest,"first");
  const sharedRequest=coordinator.preloadManifest(firstManifest,"shared");
  assert.equal(pending.length,1);assert.equal(diagnosticCalls,1,"coalesced requests record once");
  ready.add("shared");pending[0].resolve();
  assert.equal((await firstRequest).ok,true);assert.equal((await sharedRequest).ok,true);
  await coordinator.preloadManifest(firstManifest);
  assert.equal(pending.length,1);assert.equal(diagnosticCalls,1,"ready cache does not request or diagnose");
  const optional=coordinator.preloadManifest(makeManifest("optional",false));
  pending.at(-1).reject(new Error("optional failed"));
  assert.equal((await optional).ok,true);
  const critical=coordinator.preloadManifest(makeManifest("critical",true),"critical-scope");
  pending.at(-1).reject(new Error("critical failed"));
  await assert.rejects(critical,error=>error.critical===true&&error.scope==="critical-scope"&&error.result.ok===false);
  const retry=coordinator.preloadManifest(makeManifest("critical",true));
  pending.at(-1).resolve();assert.equal((await retry).ok,true);
  assert.equal(diagnosticCalls,4,"failed pending entries are removed and can retry");

  const saved=new Map([["foreign","keep"]]);
  runtime.context.localStorage={get length(){return saved.size;},key:index=>[...saved.keys()][index],
    setItem:(key,value)=>saved.set(key,value),getItem:key=>saved.get(key)||null,removeItem:key=>saved.delete(key)};
  const CacheManager=runtime.context.CacheManager;
  const save={version:1,items:[{id:"item-1",condition:0.73}],equipped:{rodId:"item-1"}};
  CacheManager.set("save",save);
  assert.equal(saved.get("fishing_game_save"),JSON.stringify(save),"save prefix and JSON bytes are unchanged");
  assert.equal(JSON.stringify(CacheManager.get("save")),JSON.stringify(save));
  assert.notEqual(CacheManager.get("save"),save);
  CacheManager.remove("save");assert.equal(CacheManager.get("save","default"),"default");
  saved.set("fishing_game_broken","invalid JSON");
  const warnings=[];
  runtime.context.console={log(){},warn:(...args)=>warnings.push(args),error:console.error};
  assert.equal(CacheManager.get("broken","safe fallback"),"safe fallback");
  assert.equal(warnings.length,1,"failed reads retain their warning and caller fallback");
  CacheManager.set("one",save);CacheManager.set("two",[]);CacheManager.clearAll();
  assert.deepEqual([...saved],[ ["foreign","keep"] ],"clearAll preserves other applications' keys");

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
  checkLongPressFrames(true);
  checkLongPressFrames(false);
  console.log("Platform runtime passed: frame delta clamp/reset and clock read counts; pending/ready/failed asset cache identity; injected canvas and location depth loading.");
  console.log("Long press passed: 120 frames on performance/Date clocks; same callback, one clock/style/scheduling call per frame, no DOM nodes/queries; deadline, click suppression and listener/frame disposal.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});

"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");



// Exercise original browser widgets over repeated frames and real interaction/disposal paths.
function checkBrowserWidgets() {
  const ids=new Map(),frames=[],timers=new Map(),saved=new Map();let nextTimer=0,clicks=0,disposed=0,queries=0;
  const makeNode=()=>({style:{},children:[],listeners:new Map(),attrs:{},value:'1',min:'0.1',max:'20',clientHeight:120,
    classList:{values:new Set(),add(v){this.values.add(v);},remove(v){this.values.delete(v);},toggle(v,on){if(on)this.add(v);else this.remove(v);}},
    set innerHTML(value){this.html=value;for(const match of value.matchAll(/id="([^"]+)"/g))if(!ids.has(match[1]))ids.set(match[1],makeNode());},
    get innerHTML(){return this.html;},addEventListener(type,fn,opts){const list=this.listeners.get(type)||[];list.push({fn,opts});this.listeners.set(type,list);},
    removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x.fn!==fn));},
    emit(type,event={}){for(const {fn}of this.listeners.get(type)||[])fn({button:0,pointerType:'mouse',pointerId:1,clientX:25,clientY:25,stopPropagation(){},preventDefault(){},target:this,...event});},
    appendChild(node){this.children.push(node);return node;},remove(){this.removed=true;},setAttribute(k,v){this.attrs[k]=v;},
    setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect(){return {left:20,top:20,right:60,bottom:60,width:40,height:40};}});
  const document=makeNode();document.body=makeNode();document.head=makeNode();document.createElement=makeNode;
  document.getElementById=id=>{queries++;assert(ids.has(id),id);return ids.get(id);};
  document.documentElement={requestFullscreen(){document.fullscreenElement={};return Promise.resolve();}};
  document.exitFullscreen=()=>{document.fullscreenElement=null;};
  const runtime=new SourceRuntime({globals:{document,window:{innerWidth:300,innerHeight:200},console:{log(){},warn(){}},
    requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)}});
  const definitions=[['engine_interface','UI_EXCEPTIONS','initEngineInterface'],['ui_event_shield','UIUtils'],['draggable_button','UIDraggableButton'],
    ['game_controls','UIManager'],['chum_controls','ChumUI'],['depth_selector','DepthSelectorUI'],['time_display','TimeDisplayUI'],['hold_charges','HoldChargesUI']];
  for(const [file,...expose]of definitions)runtime.load('src/ui/legacy/'+file+'.js',{expose});
  const c=runtime.context;c.initEngineInterface();assert.equal(document.head.children.length,1);
  let blocked=false;document.emit('contextmenu',{target:{tagName:'DIV',classList:{contains:()=>false},id:''},preventDefault(){blocked=true;}});assert(blocked);
  blocked=false;document.emit('contextmenu',{target:{tagName:'INPUT',classList:{contains:()=>false},id:''},preventDefault(){blocked=true;}});assert(!blocked);
  const button=makeNode(),cache={get:key=>saved.get(key),set:(key,value)=>saved.set(key,value)};
  c.UIUtils.makeSolid(null);const drag=new c.UIDraggableButton(button,()=>clicks++,{ui:{draggableButtons:true,dragHoldTimeMs:10}},{id:'probe',cache});
  assert.equal(button.listeners.get('pointerdown')[0].opts.capture,false,'shield remains bubbling');
  drag.onPointerDown({button:1,pointerType:'mouse',stopPropagation(){}});assert.equal(timers.size,0);
  const point={button:0,pointerType:'mouse',pointerId:1,clientX:25,clientY:25,stopPropagation(){}};
  drag.onPointerDown(point);drag.onPointerUp(point);assert.equal(clicks,1);assert.equal(timers.size,0);
  drag.onPointerDown(point);for(const fn of timers.values())fn();timers.clear();
  for(let frame=0;frame<120;frame++)drag.onPointerMove({...point,clientX:frame*4,clientY:frame*3});
  assert.equal(button.style.left,'260px');assert.equal(button.style.top,'160px');drag.onPointerUp({...point,clientX:476,clientY:357});assert(saved.has('drag_pos_probe'));assert.equal(clicks,1);
  const controls=new c.UIManager({ui:{draggableButtons:false}},{dispose(){disposed++;}},{cache});
  const depth=new c.DepthSelectorUI(),time=new c.TimeDisplayUI(),hold=new c.HoldChargesUI(),chum=new c.ChumUI(()=>clicks++);
  depth.show(20,3,value=>{depth.lastChange=value;});const initialQueries=queries;let circle=null;
  for(let frame=0;frame<120;frame++) {
    controls.updateNetButtonState(frame>=30,frame>=60);controls.updateContinueButtonState(frame>=90);controls.setOutcomeOverlayActive(frame>=100);
    depth.updateMax(frame<60?20:2);depth.updateCastDistance({availableMeters:frame,maximumMeters:20,visible:frame!==119});
    time.update(frame<30?4:frame<60?6:frame<90?12:19);
    hold.update({hasHold:true,max:frame<60?3:4,current:1,isActive:frame%2===0,restoring:[0.5],restoreMaxTime:1});
    if(frame===1)circle=hold.circles[0];if(frame>1&&frame<60)assert.equal(hold.circles[0],circle,'stable capacity reuses DOM circles');
    const state=['disabled','empty','moving','ready','idle','aiming'][frame%6];chum.setState(state,frame%2?'boat':'hand',4);chum.button.emit('click');
    while(frames.length)frames.shift()();
  }
  assert.equal(queries,initialQueries,'updates use cached DOM references');assert.equal(depth.lastChange,2);assert.equal(time.emojiSpan.innerText,'🌇');
  assert.equal(clicks,61,'only enabled chum states dispatch clicks');assert.equal(hold.circles.length,4);
  controls.setScoutingPointerDimmed(true);controls.setScoutingPointerDimmed(false);while(frames.length)frames.shift()();
  controls.hideNetButton();depth.hide();hold.update(null);assert.equal(hold.container.style.display,'none');
  controls.dispose();controls.dispose();depth.dispose();time.dispose();hold.dispose();chum.dispose();assert.equal(disposed,1);assert.equal(timers.size,0);
}

function checkTimeoutScheduler() {
  const { BrowserTimeoutScheduler } = require("../src/platform/browser/time/browser_timeout_scheduler.js");
  const callback = () => {};
  const handle = {};
  const calls = [];
  const host = {
    setTimeout(fn, delay) { assert.strictEqual(this, host); calls.push([fn, delay]); return handle; },
    clearTimeout(value) { assert.strictEqual(this, host); calls.push(value); return "cancelled"; },
  };
  const scheduler = new BrowserTimeoutScheduler(host);
  assert.strictEqual(scheduler.setTimeout(callback, 2500), handle);
  assert.strictEqual(calls[0][0], callback, "the original callback is scheduled without wrapping");
  assert.equal(calls[0][1], 2500);
  assert.equal(scheduler.clearTimeout(handle), "cancelled");
  assert.strictEqual(calls[1], handle);
  const error = new Error("scheduler failure");
  host.setTimeout = function () { assert.strictEqual(this, host); throw error; };
  assert.throws(() => scheduler.setTimeout(callback, 1), thrown => thrown === error, "live host replacement and original errors");
  host.clearTimeout = function (value) { assert.strictEqual(this, host); return value; };
  assert.strictEqual(scheduler.clearTimeout(handle), handle, "cancellation reads the live host method");
}

// Presentation frame consumers share style caches and reused line/layout frames; invalidation reads live config.
function checkVisualFrames() {
  const runtime=new SourceRuntime();
  runtime.load("src/app/core/game_clock.js",{expose:["GameClock"]});
  runtime.run('globalThis.RenderMath = globalThis.__CYBER_FISHING_COMPAT_RUNTIME__.modules["src/engine/rendering/render_math.js"].RenderMath;');
  const definitions=[
    ['src/ui/styles/fight_area_style_resolver.js','FightAreaStyleResolver'],
    ['src/ui/styles/hud_style_resolver.js','HudStyleResolver'],
    ['src/ui/styles/outcome_style_resolver.js','OutcomeStyleResolver'],
    ['src/render/screens/rarity_animation_resolver.js','RarityAnimationResolver'],
    ['src/ui/styles/rarity_visual_resolver.js','RarityVisualResolver'],
    ['src/render/screens/victory_theme_resolver.js','VictoryThemeResolver'],
    ['src/render/screens/victory_layout_resolver.js','VictoryLayoutResolver'],
    ['src/render/fishing/line_visual_state_controller.js','LineVisualStateController'],
    ['src/systems/rod_visual_offset_system.js','RodVisualOffsetSystem'],
  ];
  for(const [path,name] of definitions) runtime.load(path,{expose:[name]});
  const c=runtime.context;
  let fightConfig={color:'red'},hudConfig={bars:{shared:{width:12,dash:[1,2]},tension:{width:20}}},outcomeConfig={panelWidth:450};
  const fight=new c.FightAreaStyleResolver({configProvider:()=>fightConfig});
  const hud=new c.HudStyleResolver({hudStylesProvider:()=>hudConfig});
  const outcome=new c.OutcomeStyleResolver({configProvider:()=>outcomeConfig});
  const fightStyle=fight.resolve(),hudStyle=hud.resolveBarStyle('tension'),outcomeStyle=outcome.resolveVictory();
  assert(Object.isFrozen(fightStyle));assert(Object.isFrozen(fightStyle.lastDashDash));
  assert.equal(hudStyle.width,20);assert.notEqual(hudStyle.dash,hudConfig.bars.shared.dash);
  assert.equal(hud.resolveBarStyle('tension',{overrides:{width:30}}).width,30);
  const animation=new c.RarityAnimationResolver();
  const rarity=new c.RarityVisualResolver({configProvider:()=>({colorStops:[{id:'first',position:0,color:[0,0,0]},{id:'last',position:1,color:[255,255,255]}],uniqueEffects:{pulseDurationMs:1200}}),animationResolver:animation});
  const theme=new c.VictoryThemeResolver({rarityVisualResolver:rarity});
  const ordinary=theme.resolve({level:2,maxLevel:4},0);
  const animated=theme.resolve({level:4,maxLevel:4,isUnique:true},0);
  let layoutCreations=0;
  const layout=new c.VictoryLayoutResolver({diagnostics:{recordVictoryLayoutCreated(){layoutCreations++;}}});
  const firstLayout=layout.resolve({width:1280,height:720,config:outcomeStyle,statCount:3}),panel=firstLayout.panel;
  const line=new c.LineVisualStateController(),rod=new c.RodVisualOffsetSystem();
  let lineFrame=null;
  for(let frame=0;frame<120;frame++) {
    assert.equal(fight.resolve(),fightStyle);assert.equal(hud.resolveBarStyle('tension'),hudStyle);assert.equal(outcome.resolveVictory(),outcomeStyle);
    assert.equal(theme.resolve({level:2,maxLevel:4},frame*16),ordinary);
    assert.equal(theme.resolve({level:4,maxLevel:4,isUnique:true},frame*16),animated);
    const currentLayout=layout.resolve({width:frame<60?1280:360,height:720,config:outcomeStyle,statCount:frame<60?3:7});
    assert.equal(currentLayout,firstLayout);assert.equal(currentLayout.panel,panel);
    const currentLine=line.update({state:frame<40?'waiting':frame<80?'biting':'playing',nowMs:1000+frame*16,castStartTime:1000,inputPulling:frame>=60,hookDepth:3,castDistanceRatio:0.5,tensionRatio:0.7,sinkRate:1,lineConfig:{shrinkPercent:30}});
    if(lineFrame)assert.equal(currentLine,lineFrame);lineFrame=currentLine;
    assert(currentLine.lengthRatio>=0&&currentLine.lengthRatio<=1);assert(Number.isFinite(currentLine.dropOffset));
    rod.update({dtSec:0.016,inputState:{rodControlActive:frame<90,rodControlDirectionX:1,rodControlInputRatio:0.8},fightDebug:{lineCanRelease:frame<40,reelSlip:frame>=40&&frame<80},config:{},canvasWidth:800});
    const screenX=rod.resolveScreenX({baseX:790,canvasWidth:800,config:{}});
    assert(screenX<=784);assert.equal(rod.isClamped(),true);assert(Number.isFinite(rod.getOffsetPx()));
    assert.equal(rod.getFrame().lineMode,frame<40?'free_line':frame<80?'drag_slip':'tight_line');
  }
  assert.equal(layoutCreations,1);assert(lineFrame.straightFactor>0);
  rod.reset();assert.equal(rod.getOffsetPx(),0);assert.equal(rod.isClamped(),false);
  fightConfig={color:'blue'};hudConfig={bars:{shared:{width:40}}};outcomeConfig={panelWidth:600};
  fight.invalidate();hud.invalidate();outcome.invalidate();
  assert.equal(fight.resolve().catchFill,'blue');assert.equal(hud.resolveBarStyle('tension').width,40);assert.equal(outcome.resolveVictory().panelWidth,600);
  assert.notEqual(fight.resolve(),fightStyle);assert.notEqual(hud.resolveBarStyle('tension'),hudStyle);assert.notEqual(outcome.resolveVictory(),outcomeStyle);
  console.log('Visual frames passed: 120 cached styles and ordinary/animated themes; reused layout/line identities, viewport changes, line waiting/biting/playing and rod free/slip/tight/reset states; live config invalidation.');
}

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

// Game loop frames and the browser runtime adapters (cluster 019): one reused frame callback, the clock's deltaTime
// passed through, duplicate-start refusal and stop; DEV flag sources, debug events, audio players, canvas metrics.
async function checkGameLoopAndAdapters() {
  const frames=new Map(),cancelled=[],dispatched=[],errors=[];let nextFrame=0;
  class CustomEventProbe { constructor(type,init){this.type=type;this.detail=init?.detail;} }
  const audios=[];
  class AudioProbe { constructor(src){this.src=src;this.calls=[];audios.push(this);}
    pause(){this.calls.push("pause");} play(){this.calls.push(`play:${this.currentTime}:${this.volume}`);return Promise.resolve();}
    removeAttribute(name){this.calls.push(`remove:${name}`);} load(){this.calls.push("load");} }
  const window={dispatchEvent:event=>{dispatched.push(event);return true;},innerWidth:800,innerHeight:600};
  const fetched=[];
  const runtime=new SourceRuntime({globals:{window,CustomEvent:CustomEventProbe,Audio:AudioProbe,
    fetch:async src=>{fetched.push(src);return {arrayBuffer:async()=>`bytes:${src}`};},
    console:{log(){},warn(){},error:error=>errors.push(error)},
    requestAnimationFrame(callback){frames.set(++nextFrame,callback);return nextFrame;},
    cancelAnimationFrame(id){cancelled.push(id);frames.delete(id);}}});
  runtime.load("src/app/core/game_clock.js",{expose:["GameClock"]});
  runtime.run('globalThis.EventBus = globalThis.__CYBER_FISHING_COMPAT_RUNTIME__.modules["src/engine/events/event_bus.js"].EventBus;');
  runtime.load("src/app/core/game_loop.js",{expose:["GameLoop"]});
  runtime.load("src/app/adapters.js",{expose:["BrowserAudioAdapter","BrowserBufferedAudioPlayer","BrowserDebugAdapter",
    "BrowserEventTargetAdapter","CanvasMetricsProvider","ConfigProvider","DevFlagsProvider"]});
  // Adapters without a classic consumer have no activation: they are read from the cumulative-runtime export.
  const adapters=runtime.run('globalThis.__CYBER_FISHING_COMPAT_RUNTIME__.modules["src/platform/browser/runtime/legacy_runtime_adapters.js"]')||{};
  const {GameLoop,DevFlagsProvider,BrowserDebugAdapter,CanvasMetricsProvider,ConfigProvider,BrowserAudioAdapter}=runtime.context;
  const BrowserEventTargetAdapter=runtime.context.BrowserEventTargetAdapter||adapters.BrowserEventTargetAdapter;
  const json=value=>JSON.stringify(value);

  const clockCalls=[],updates=[];let draws=0;
  const clock={reset(){clockCalls.push("reset");},tick(time){clockCalls.push(time);return time/1000;}};
  const loop=new GameLoop(clock,dt=>updates.push(dt),()=>draws++);
  assert.equal(loop.start(),true);assert.equal(loop.start(),true,"a running loop starts idempotently");
  assert.equal(loop.isRunning,true);assert.equal(frames.size,1);
  const callback=frames.get(1);
  for(let frame=1;frame<=120;frame++) {
    const [id,current]=frames.entries().next().value;
    assert.equal(current,callback,"one frame callback is reused on every frame");
    frames.delete(id);current(frame*16);
    assert.equal(frames.size,1,"one scheduled continuation per frame");
  }
  assert.equal(updates.length,120);assert.equal(draws,120);
  assert.equal(updates[0],0.016);assert.equal(updates[119],1.92,"the clock's deltaTime is passed through unchanged");
  assert.equal(json(clockCalls.slice(0,3)),json(["reset",16,32]));
  const second=new GameLoop(clock,()=>{},()=>{});
  assert.equal(second.start(),false,"a second active loop is refused");
  assert.equal(errors.length,1);assert.equal(dispatched.length,1);
  assert.equal(dispatched[0].type,"cyber-fishing-memory-warning");
  assert.equal(json(dispatched[0].detail.issue),json({code:"duplicate_game_loop_start",severity:"critical",
    message:"[GameLoop] Refused to start a second active game loop."}));
  assert.equal(json(GameLoop.getDiagnostics()),json({activeCount:1,duplicateStartAttempts:1}));
  loop.stop();loop.stop();
  assert.equal(loop.isRunning,false);assert.equal(json(cancelled),json([121]));assert.equal(frames.size,0);
  assert.equal(json(GameLoop.getDiagnostics()),json({activeCount:0,duplicateStartAttempts:1}));
  assert.equal(second.start(),true,"a stopped loop releases the active slot");second.stop();

  const bare=new DevFlagsProvider({config:{}});
  assert.equal(bare.isEnabled("noLineBreak"),false);assert.equal(bare.godModeValue("noLineBreak"),undefined);
  assert.equal(bare.isDebugEnabled(),false,"without DEV sources the provider is inactive");
  const dev=new DevFlagsProvider({config:{debug:{consoleModules:{fish:false}}},
    godModeSource:()=>({noLineBreak:true,fixedBiteChancePercent:40}),debugModulesSource:()=>({fish:true})});
  assert.equal(dev.isEnabled("noLineBreak"),true);assert.equal(dev.isEnabled("fixedBiteChancePercent"),false);
  assert.equal(dev.godModeValue("fixedBiteChancePercent"),40);assert.equal(dev.isDebugEnabled(),true);
  for(const [config,expected] of [[{debug:{overlay:true}},true],[{debug:{events:true}},true],[{logs:{events:true}},true],
    [{debug:{consoleModules:{fish:false}}},false],[{debug:{consoleModules:{fish:true}}},true]]) {
    assert.equal(new DevFlagsProvider({config}).isDebugEnabled(),expected,json(config));
  }

  let debugEnabled=false;const targetEvents=[],received=[];
  const debug=new BrowserDebugAdapter({dispatchEvent:event=>targetEvents.push(event)},()=>debugEnabled);
  const unsubscribe=debug.on("bite",detail=>received.push(detail));
  debug.emit("bite",{n:1});
  assert.equal(received.length+targetEvents.length,0,"disabled debug events are dropped");
  debugEnabled=true;debug.emit("bite",{n:2});
  assert.equal(json(received),json([{n:2}]));assert.equal(targetEvents[0].type,"bite");assert.equal(targetEvents[0].detail.n,2);
  unsubscribe();debug.emit("bite",{n:3});assert.equal(received.length,1);assert.equal(targetEvents.length,2);
  debug.on("bite",detail=>received.push(detail));debug.clear();debug.emit("bite",{n:4});assert.equal(received.length,1);

  const listeners=[];
  const events=new BrowserEventTargetAdapter({addEventListener:(...args)=>listeners.push(["add",...args]),
    removeEventListener:(...args)=>listeners.push(["remove",...args]),dispatchEvent:event=>targetEvents.push(event)});
  const handler=()=>{};const remove=events.add("resize",handler,{passive:true});remove();events.emit("ready",{ok:true});
  assert.equal(json(listeners.map(item=>[item[0],item[1],item[3]])),json([["add","resize",{passive:true}],["remove","resize",{passive:true}]]));
  assert.equal(listeners[1][2],handler);assert.equal(targetEvents.at(-1).type,"ready");

  const canvas={width:1,height:1};
  const metrics=new CanvasMetricsProvider(canvas);metrics.resizeToViewport();
  assert.equal(json([metrics.width,metrics.height]),json([800,600]),"default viewport reads the window size");
  const custom=new CanvasMetricsProvider(canvas,()=>({width:320,height:200}));custom.resizeToViewport();
  assert.equal(json([canvas.width,canvas.height]),json([320,200]));

  const raw={physics:{g:1},debug:{overlay:true},fightPhysicsConfig:{f:1}};
  const provider=new ConfigProvider(raw);
  assert.equal(provider.raw,raw);assert.equal(provider.physics,raw.physics);assert.equal(provider.fightPhysicsConfig,raw.fightPhysicsConfig);
  assert.equal(json([provider.tension,provider.ui,provider.casting,provider.feederConfig]),json([{},{},{},{}]));
  assert.equal(new ConfigProvider({}).fightPhysicsConfig,null);

  const pooled=new BrowserAudioAdapter().createPlayer("splash.mp3");
  assert.equal(pooled.src,"splash.mp3");assert.equal(audios.length,4,"no AudioContext: a pool of four elements");
  await pooled.warm();
  for(let index=0;index<5;index++) pooled.play(index/10);
  assert.equal(json(audios.map(audio=>audio.calls.filter(call=>call.startsWith("play")))),
    json([["play:0:0","play:0:0.4"],["play:0:0.1"],["play:0:0.2"],["play:0:0.3"]]),"the pool cycles its cursor");
  pooled.dispose();assert(audios.every(audio=>audio.calls.slice(-2).join()==="remove:src,load"));

  const graph=[];
  class AudioContextProbe { constructor(){this.state="suspended";this.destination="destination";}
    async decodeAudioData(data){graph.push(`decode:${data}`);return `buffer:${data}`;}
    resume(){graph.push("resume");this.state="running";return Promise.resolve();}
    close(){graph.push("close");this.state="closed";return Promise.resolve();}
    createGain(){const gain={gain:{value:0},connect:target=>graph.push(`gain->${target}`),disconnect(){graph.push("gain-off");}};return gain;}
    createBufferSource(){const source={connect:()=>graph.push("source->gain"),disconnect(){graph.push("source-off");},
      start:at=>graph.push(`start:${at}:${source.buffer}`)};return source;} }
  window.AudioContext=AudioContextProbe;
  const buffered=new BrowserAudioAdapter().createPlayer("reel.mp3");
  buffered.play(0.5);
  await buffered.warm();await Promise.resolve();
  buffered.dispose();
  assert.equal(json(fetched),json(["reel.mp3"]));
  assert.equal(json(graph),json(["decode:bytes:reel.mp3","resume","source->gain","gain->destination",
    "start:0:buffer:bytes:reel.mp3","close"]),"a play before decoding waits for the buffer");
  delete window.AudioContext;
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
  checkBrowserWidgets();
  checkTimeoutScheduler();
  checkVisualFrames();
  checkLongPressFrames(true);
  checkLongPressFrames(false);
  await checkGameLoopAndAdapters();
  console.log("Platform runtime passed: frame delta clamp/reset and clock read counts; pending/ready/failed asset cache identity; injected canvas and location depth loading.");
  console.log("Long press passed: 120 frames on performance/Date clocks; same callback, one clock/style/scheduling call per frame, no DOM nodes/queries; deadline, click suppression and listener/frame disposal.");
  console.log("Game loop and adapters passed: 120 frames with one reused callback and pass-through deltaTime, duplicate start refused and reported, stop cancels; DEV flag sources, debug events, event target, canvas metrics, config provider, pooled and buffered audio.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});

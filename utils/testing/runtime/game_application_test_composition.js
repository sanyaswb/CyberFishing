const assert = require('node:assert/strict');
const { SourceRuntime } = require('../core/source_runtime');

// Real Bootstrap facades and frame orchestration, with deterministic external service ports.
async function checkGameApplicationComposition(diagnostics = true) {
  const errors=[],events=[],disposed=[],warnings=[];
  class FixedDate extends Date { constructor(...args){super(...(args.length?args:[Date.UTC(2026,9,4)]));} static now(){return Date.UTC(2026,9,4);} }
  const source=new SourceRuntime({globals:{Date:FixedDate,performance:{now:()=>0},console:{log(){},error(...args){errors.push(args);}}}});
  source.load('src/engine/math/vector2.js');
  source.importModule('src/bootstrap/production/game_application.js');
  source.importModule('src/platform/browser/diagnostics/console_logger.js');
  for(const name of ['BaitFactory','Net','ConfigProvider','EventLifecycle','FishingCastExposureResolver','GameClock','InventoryItemLocation','RodVisualOffsetSystem','ConsoleLogger']) {
    const owners=source.moduleNamespaces.filter(exports=>Object.hasOwn(exports,name));
    if(owners.length!==1)throw new Error('Expected one canonical export: '+name);
    source.context[name]=owners[0][name];
  }
  source.load('src/game/config/databases/fish_database.js',{expose:['FISH_DB']});
  source.load('src/bootstrap/production/game_application.js',{expose:['GameApplication','GameViewportFacade','GameDebugFacade','GameFishingFacade']});
  function target(){const handlers=new Map();return{handlers,addEventListener(type,fn){const list=handlers.get(type)||[];list.push(fn);handlers.set(type,list);},removeEventListener(type,fn){handlers.set(type,(handlers.get(type)||[]).filter(item=>item!==fn));},emit(type,detail){for(const fn of handlers.get(type)||[])fn({detail});}};}
  const windowTarget=target(),documentTarget=target(),clock={now:1000},bounds={left:0,right:800,top:0,bottom:600};
  const config={ui:{rod:{x:'center'}},casting:{enabled:true},debug:{timeScale:2},locations:{lake:{enabled:true}},physics:{fight:{rodControl:{}}}};
  const input={panDeltaX:3,panDeltaY:9,pointerDown:false,isPulling:false},physics={},biteEnv={},fightDebug={};
  const equipment={rod:{variant:'float',effectiveStats:{hasReel:true}},reel:{effectiveStats:{hasDrag:true}},baits:[{instanceId:'original-bait'}]};
  const net={updateConfig(value){this.config=value;}},rng={next:()=>0.5};
  const projector={screenToVirtual(x,y,out){out.x=x;out.y=y;return out;},virtualToScreen(x,y,out){out.x=x;out.y=y;return out;}};
  const canvasMetrics={width:800,height:600,resizeToViewport(){this.width=900;}};
  let appPorts,freshness,onInventory,stateContext,debugContext,locationFails=false,victoryFails=false,castResult={success:false,reason:'missing_rod'};
  const inventory={getEquipped:()=>equipment,setFreshnessExposureProvider(fn){freshness=fn;},onInventoryChanged(fn){onInventory=fn;return()=>{disposed.push('inventory-listener');onInventory=null;};},setLock(value){this.locked=value;},refreshItemData(){events.push('items');},handleRodRetrieved(context){events.push(['retrieved',context]);},dispose(){disposed.push('inventory');}};
  const stateMachine={currentName:'scouting',currentState:{handleNetClick(){events.push('net-click');}},setState(name,data){this.currentName=name;this.data=data;appPorts.onStateChanged(name);},handleInput(value){assert.equal(value,input);events.push('input');},update(dt,area,context){assert.equal(dt,16);assert.equal(area,bounds);stateContext??=context;assert.equal(context,stateContext);assert.equal(context.env,physics);assert.equal(context.biteEnv,biteEnv);assert.equal(context.input,input);events.push('state');},dispose(){disposed.push('state');}};
  const chumController={isAiming:false,activeBoat:null,ui:{},setAiming(value){this.isAiming=value;},updateUI(){events.push('chum-ui');},refreshActiveHandChum(){events.push('hand-refresh');},handleGlobalBoatControl(value){assert.equal(value,input);events.push('boat');},handleAiming(value,area,dt){assert.equal(value,input);assert.equal(area,bounds);assert.equal(dt,16);events.push('chum-aim');},handleClick(){this.isAiming=true;},toggleAim(){this.isAiming=!this.isAiming;},dispose(){disposed.push('controller');}};
  const loop={start:()=>true,stop(){disposed.push('loop');}};
  const renderCoordinator={render(){events.push('draw');},invalidateStyles(){events.push('styles');}};
  const fightService={tensionMeter:{getDebugData:()=>fightDebug},syncEquipment(value){assert.equal(value,equipment);events.push('equipment');},syncFishRuntime(value){events.push(['fish-runtime',value]);}};
  const assetPreloadCoordinator={preloadFishingAssets:()=>Promise.resolve(),preloadVictoryAssets:()=>victoryFails?Promise.reject(new Error('victory unavailable')):Promise.resolve(),preloadLocation:()=>locationFails?Promise.reject(new Error('location unavailable')):Promise.resolve()};
  const locationResources={map:'same-resource'};
  const runtime={location:{id:'lake',chumCastDistance:300,config:{}},rng,projector,map:{},net,inventory,
    env:{getPhysicsEnv:()=>physics,getSnapshot:()=>({time:5})},input:{getState:()=>input,setDragControlEnabled(value){assert.equal(value,true);},dispose(){disposed.push('input');}},
    ui:{updateNetButtonState(){},dispose(){disposed.push('ui');}},inventoryUI:{updateDynamicProgression(dt){assert.equal(dt,16);events.push('inventory-ui');},open(){events.push('open');},showWarning(message){warnings.push(message);},dispose(){disposed.push('inventory-ui');}},
    chum:{getBoats:()=>[],getChumDataAt:()=>({bonus:1,targets:[]}),dispose(){disposed.push('chum');}},bite:{setFishDatabase(value){assert.equal(value,source.context.FISH_DB);events.push('fish-db');}},
    world:{refreshViewport(){events.push('viewport');},refreshLocationConfig(value,resources){assert.equal(value,config.locations);assert.equal(resources,locationResources);events.push('location');},pan(x,y){assert.equal(x,3);assert.equal(y,0);events.push('pan');},update(dt,scale,area){assert.equal(dt,16);assert.equal(scale,config.debug.timeScale);assert.equal(area,bounds);events.push('world');return{time:5};}},
    rendering:{assetPreloadCoordinator,locationAssetLoader:{load:()=>Promise.resolve(locationResources)}},
    fishing:{consumeWetFeederChum(eq,exposure){assert.equal(eq,equipment);events.push(['wet',exposure]);}},castManager:{update(dt){assert.equal(dt,16);events.push('cast');}},
    equipmentRules:{getMaxHookDepth:()=>8,getRodDisplayName:()=> 'Test rod'},baitRules:{isActiveLure:()=>false},playerCastRules:{canPlayerCast:(eq,boat)=>eq===equipment&&boat===null},
    depthUI:{updateMax(value){assert.equal(value,8);},dispose(){disposed.push('depth');}},timeUI:{update(value){assert.equal(value,5);events.push('time');},dispose(){disposed.push('time');}},holdUI:{dispose(){disposed.push('hold');}}};
  const compositionRoot={create(){throw new Error('Injected runtime must be reused');},createApplicationServices(options){appPorts=options.appPorts;assert.equal(options.runtime,runtime);assert.equal(options.runtimeConfig,config);assert.equal(options.clock,clock);assert.equal(options.rng,rng);return{loop,fightService,debugService:diagnostics === 'malformed' ? {} : diagnostics ? {update(context){debugContext??=context;assert.equal(context,debugContext);assert.equal(context.getEquipment(),equipment);assert.equal(context.getInputState(),input);events.push('debug');}} : null,chumController,stateMachine,renderCoordinator,
    biteEnvironmentService:{getDynamicBounds:()=>bounds,checkWater:(x,y)=>({x,y,depth:2}),getBiteEnvData:()=>biteEnv},castService:{cast(x,y,depth,options){assert.equal(options.equipment,equipment);return castResult;}}};}};
  const debugEvents={emit(type,detail){events.push([type,detail]);},on:()=>()=>{},clear(){disposed.push('debug');}};
  if (diagnostics === 'malformed') {
    assert.throws(() => new source.context.GameApplication({canvas:{},canvasMetrics,config,compositionRoot,devFlags:{isDebugEnabled:()=>true,isEnabled:()=>false},audio:{},debugEvents,windowTarget,documentTarget,runtime,clock,logger:new source.context.ConsoleLogger()}), /optional debugService.update/);
    return;
  }
  const app=new source.context.GameApplication({canvas:{},canvasMetrics,config,compositionRoot,devFlags:{isDebugEnabled:()=>true,isEnabled:()=>false},audio:{},debugEvents,windowTarget,documentTarget,runtime,clock,logger:new source.context.ConsoleLogger()});
  assert.equal(app.clock,clock);assert.equal(app.rng,rng);assert.equal(app.config.raw,config);assert.equal(app.net,net);assert.equal(app.locationId,'lake');assert.equal(app.chumCastDistance,300);assert.equal(app.start(),true);
  assert.equal(source.context.EventLifecycle.getActiveListenerCount(),3);
  const viewport=app.getViewportSize(),rod=app.getRodVirtualPos(bounds),base=app.getBaseRodVirtualPos(bounds);
  for(let frame=0;frame<120;frame++){events.length=0;clock.now+=16;appPorts.update(16);appPorts.draw();assert.equal(app.lastTime,clock.now);assert.equal(app.getViewportSize(),viewport);assert.equal(app.getRodVirtualPos(bounds),rod);assert.equal(app.getBaseRodVirtualPos(bounds),base);assert.deepEqual(events,['pan','world','cast','time','chum-ui','boat','input','state','inventory-ui',...(diagnostics?['debug']:[]),'draw']);}
  assert.equal(app.canPlayerCast(),true);assert.equal(app.getEnvDataForBite(),biteEnv);assert.equal(app.getMaxHookDepth(),8);assert.equal(app.getRodScreenX(),400);assert.equal(app.getScreenOffsetRatio({x:600,y:200}),1); // Preserve the existing null playable-bound clamp.
  windowTarget.emit('resize');assert.equal(app.getViewportSize().width,900);assert.equal(app.getViewportSize(),viewport);
  input.pointerDown=true;events.length=0;app.update(16);assert.equal(events.includes('pan'),false);input.pointerDown=false;
  app.markInvalidCast({x:7,y:8});assert.equal(app.invalidCastMarker.timer,500);for(let frame=0;frame<32;frame++)app.update(16);assert.equal(app.invalidCastMarker,null);
  app.isAimingChum=true;Object.assign(input,{isPulling:true,pullDirection:'left',clickPos:{x:1,y:1},longPressPos:{x:1,y:1},isDoubleClick:true});events.length=0;app.update(16);assert.equal(events.includes('chum-aim'),true);assert.equal(events.includes('input'),false);assert.equal(input.isPulling,false);assert.equal(input.clickPos,null);assert.equal(input.longPressPos,null);assert.equal(input.isDoubleClick,false);app.isAimingChum=false;
  const boat={id:'boat'};app.activeBoat=boat;assert.equal(app.activeBoat,boat);app.activeBoat=null;app.handleChumClick();assert.equal(app.isAimingChum,true);app.toggleChumAim();assert.equal(app.isAimingChum,false);
  for(const reason of ['missing_rod','missing_reel','missing_line']){castResult={success:false,reason};assert.equal(app.castLine(100,200,2),castResult);}assert.equal(warnings.length,3);assert.match(warnings[1],/Test rod/);
  const castFloat={id:'cast-float'};castResult={success:true,floatEntity:castFloat,castDistanceRatio:0.4,castStartTime:clock.now,currentHookDepth:2,nextState:'waiting'};
  app.castLine(100,200,2,{rodScreenX:250});assert.equal(app.float,castFloat);assert.equal(app.castDistanceRatio,0.4);assert.equal(app.currentHookDepth,2);assert.equal(app.gameStateName,'waiting');assert.equal(app.getBaseRodVirtualPos(bounds).x,250);assert.equal(inventory.locked,true);
  clock.now+=100;assert.equal(freshness({location:{kind:'ATTACHED'}}),200);assert.equal(freshness({location:{kind:'INVENTORY'}}),0);config.debug.timeScale=3;assert.equal(freshness({location:{kind:'ATTACHED'}}),300);config.debug.timeScale=2;
  app.setState('playing',{fish:{id:'fish'}});app.update(16);assert.equal(Number.isFinite(fightDebug.rodVisualOffsetX),true);
  events.length=0;await app.setState('victory',{fish:{id:'fish'}});assert.equal(app.gameStateName,'victory');const retrieval=events.find(value=>Array.isArray(value)&&value[0]==='retrieved')[1];assert.equal(retrieval.equipment,equipment);assert.deepEqual(Array.from(retrieval.baitInstanceIds),['original-bait']);assert.equal(Object.isFrozen(retrieval),true);assert.equal(retrieval.exposureToken,'cast:'+app.castStartTime);
  app.setState('waiting');victoryFails=true;await app.setState('victory',{fish:{id:'fish'}});assert.equal(app.gameStateName,'failed');assert.equal(stateMachine.data.reason,'asset_load_failed');victoryFails=false;
  app.setState('scouting');assert.equal(inventory.locked,false);runtime.ui.onNetClick();runtime.ui.onContinueClick();onInventory({equipment});
  documentTarget.emit('config-updated',{path:['ITEM_DB']});documentTarget.emit('config-updated',{path:['FISH_DB']});const fish={id:'runtime-fish'};documentTarget.emit('debug-hooked-fish-updated',{fish});assert.equal(events.some(value=>value[0]==='fish-runtime'&&value[1]===fish),true);
  documentTarget.emit('config-updated',{path:['CONFIG','locations']});await new Promise(resolve=>setImmediate(resolve));assert.equal(events.includes('location'),true);
  locationFails=true;documentTarget.emit('config-updated',{path:['locations']});documentTarget.emit('config-updated',{path:['MAP_DB']});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(errors.map(value=>value[0]),['[Location] Failed to reload location config','[Location] Failed to reload map config']);assert.equal(errors.every(value=>value[1].message==='location unavailable'),true);
  const remove=app.subscribeConfigUpdated(()=>{});assert.equal(source.context.EventLifecycle.getActiveListenerCount(),4);remove();assert.equal(source.context.EventLifecycle.getActiveListenerCount(),3);assert.equal(app.isDebugEnabled(),true);app.emitDebugEvent('test',{id:'same'});assert.equal(typeof app.onDebugEvent('test',()=>{}),'function');
  disposed.length=0;app.dispose();assert.deepEqual(disposed,['loop','state','inventory-listener','input','controller','chum','inventory','inventory-ui','depth','time','hold','ui','debug']);assert.equal(source.context.EventLifecycle.getActiveListenerCount(),0);assert.equal(runtime.ui.onNetClick,null);assert.equal(runtime.ui.onContinueClick,null);assert.equal(onInventory,null);
}
module.exports={checkGameApplicationComposition};

"use strict";

const assert = require("node:assert/strict");
const { SourceRuntime } = require("./testing/core/source_runtime");

// Actual Canvas renderers and composites over reused visible/hidden models and deterministic draw commands.
function checkCanvasScenes() {
  const runtime=new SourceRuntime();runtime.load('src/game/presentation/styles/degradation_color_resolver.js',{expose:['DegradationColorResolver']});
  for(const file of ['render_math','composite_renderer','render_pass'])runtime.load('src/engine/rendering/'+file+'.js');
  const definitions=[["src/game/presentation/hud/hud_bar_renderer.js",'HudBarRenderer'],["src/game/presentation/casting/cast_scene_renderer.js",'CastSceneRenderer'],["src/game/presentation/fishing/fight_area_renderer.js",'FightAreaRenderer'],
    ["src/game/presentation/fishing/float_renderer.js",'FloatRenderer'],["src/game/presentation/fishing/rod_line_renderer.js",'RodLineRenderer'],["src/game/presentation/hud/fight_status_bars_renderer.js",'FightStatusBarsRenderer'],
    ["src/game/presentation/hud/hold_charges_renderer.js",'HoldChargesRenderer'],["src/game/presentation/hud/player_pressure_fatigue_indicator_renderer.js",'PlayerPressureFatigueIndicatorRenderer'],
    ["src/game/presentation/screens/game_over_renderer.js",'GameOverRenderer'],["src/game/presentation/screens/star_rating_renderer.js",'StarRatingRenderer'],["src/game/presentation/screens/victory_renderer.js",'VictoryRenderer'],
    ["src/game/presentation/world/boat_chum_renderer.js",'BoatChumRenderer'],["src/game/presentation/world/world_scene_renderer.js",'WorldSceneRenderer'],["src/game/presentation/fishing/fishing_scene_renderer.js",'FishingSceneRenderer'],
    ["src/game/presentation/hud/fight_hud_renderer.js",'FightHudRenderer'],["src/game/presentation/rendering/casting_render_pass.js",'CastingRenderPass'],["src/game/presentation/rendering/fishing_render_pass.js",'FishingRenderPass'],
    ["src/game/presentation/rendering/hud_render_pass.js",'HudRenderPass'],["src/game/presentation/rendering/outcome_render_pass.js",'OutcomeRenderPass'],["src/game/presentation/rendering/world_render_pass.js",'WorldRenderPass']];
  for(const [file,name]of definitions)runtime.load(file,{expose:[name]});
  const c=runtime.context,commands=[],stack=[],surface={globalAlpha:1};
  const drawMethods=['beginPath','closePath','moveTo','lineTo','arc','ellipse','quadraticCurveTo','rect','clip','fill','stroke','fillRect','strokeRect','fillText','translate','rotate','setLineDash','drawImage','drawCurrentSurface','clear'];
  for(const name of drawMethods)surface[name]=(...args)=>{for(const value of args)if(typeof value==='number')assert(Number.isFinite(value),name+' received a non-finite coordinate');commands.push([name,...args]);};
  surface.save=()=>{stack.push(surface.globalAlpha);commands.push(['save']);};surface.restore=()=>{assert(stack.length>0,'balanced drawing save/restore');surface.globalAlpha=stack.pop();commands.push(['restore']);};
  const textOptions=[],primitives={beginClip(regions){commands.push(['beginClip',regions.count]);return true;},endClip(clipped){commands.push(['endClip',clipped]);},
    roundedRect(...args){commands.push(['roundedRect',...args]);},drawImageCover(...args){commands.push(['imageCover',...args]);},drawFittedText(options){textOptions.push(options);commands.push(['fittedText',options.text,options.x,options.y]);}};
  const image={id:'fish-image'},assets={tryGet:id=>id==='missing'?null:image},style={x:'center',gradient:{},statuses:[{threshold:0,color:'#00ff00'},{threshold:66,color:'#ff0000'}]},styles={resolveBarStyle:()=>style};
  const areaStyle={lastDashFill:'#123',lastDashStroke:'#456',lastDashDash:[4,6],catchFill:'#234',catchStroke:'#567',netStroke:'#789',netFill:'#abc',sectorFill:'#234',sectorClampedFill:'#345',sectorStroke:'#456',sectorClampedStroke:'#567',sectorAxis:'#678',lineRadiusStroke:'#789'};
  const theme={color:[30,120,200],maximumColor:[255,200,0],neutralColor:[90,90,90],glow:{panelAlpha:0.3,panelBlur:4,imageAlpha:0.4,imageBlur:6},background:{alpha:0.4},frameAlpha:0.7,borderWidth:2,isAnimated:false,frameDash:[3,5],frameDashSpeedPxPerSecond:10};
  const bars=new c.HudBarRenderer(surface),cast=new c.CastSceneRenderer({surface,primitives,hudBarRenderer:bars,hudStyleResolver:styles}),fight=new c.FightAreaRenderer({surface,primitives,styleResolver:{resolve:()=>areaStyle}}),
    float=new c.FloatRenderer({surface}),rod=new c.RodLineRenderer({surface}),status=new c.FightStatusBarsRenderer({surface,hudBarRenderer:bars,styleResolver:styles}),
    hold=new c.HoldChargesRenderer({surface}),fatigue=new c.PlayerPressureFatigueIndicatorRenderer({surface}),gameOver=new c.GameOverRenderer({surface}),
    stars=new c.StarRatingRenderer({surface,primitives}),victory=new c.VictoryRenderer({surface,primitives,assets,themeResolver:{resolve:()=>theme},starRatingRenderer:stars}),
    boat=new c.BoatChumRenderer({surface,primitives}),world=new c.WorldSceneRenderer({surface,assets});
  const list=items=>({count:items.length,getAt:index=>items[index]}),points=list([{x:10,y:10},{x:20,y:20},{x:30,y:10}]),empty=list([]),rect={x:10,y:10,width:180,height:50};
  const worldModel={visible:true,backgroundColor:'#123',backgroundLayers:list([{assetId:'scene',alpha:0.6,x:0,y:0,width:800,height:600},{assetId:'missing',alpha:0.2,x:0,y:0,width:800,height:600}]),clipRegions:empty,
    chumZones:list([{x:100,y:100,radiusX:20,radiusY:10,opacity:0.5}]),waypoints:list([{x:200,y:200,scale:1,showIndex:true,index:2}]),
    boats:list([{x:250,y:250,angle:0,fontSize:20,emoji:'boat',barWidth:40,barY:12,barHeight:4,energyColor:'#00ff00',energyRatio:0.5}]),
    sensorRays:list([{startX:250,startY:250,endX:300,endY:300,blocked:false}]),invalidCastMarker:{visible:true,x:200,y:200}};
  const castModel={visible:true,aimingZone:{visible:true,clipRegions:empty,lineY:150,viewportWidth:800,mode:'rod',fillHeight:100},
    accuracyArea:{visible:true,x:200,y:200,radiusX:20,radiusY:10,fillColor:'#123',strokeColor:'#456',lineWidth:2,dash:[2,3]},
    powerAim:{visible:true,screenX:250,originY:500,targetY:150,lineColor:'#123',lineWidth:2,dash:[2,3],dashOffset:1,glowBlur:5,powerRatio:0.5,powerColor:'#456',viewportWidth:800,mode:'rod'}};
  const fightModel={visible:true,clipRegions:empty,lastDashZone:{visible:true,y:100,width:800,height:100},catchZone:{visible:true,kind:'ellipse',x:200,y:200,radiusX:30,radiusY:20,y:200,width:800,height:100,lineY:200},netZone:{visible:true,y:300,width:800,height:50},showSector:true,sectorPoints:points,sectorClamped:false,apexX:20,apexY:20,axisEndX:40,axisEndY:40,showLineRadius:true,lineRadiusPoints:points};
  const fishingModel={visible:true,fightAreas:fightModel,rodLine:{visible:true,rodBaseX:400,rodTopY:450,rodWidth:6,rodHeight:100,lineVisible:true,controlX:350,controlY:350,targetX:250,targetY:200,lineColor:'#123',lineWidth:2},
    float:{visible:true,x:250,y:200,color:'#ff0000',glow:true,glowBlur:4,kind:'float',width:6,height:20,radius:5,radiusX:8,radiusY:4,rotationRad:0.2}};
  const hudModel={visible:true,viewportWidth:800,fishCondition:{visible:true,phase:'stamina',staminaRatio:0.7,staminaValue:'7/10',exhaustionRatio:0.2,exhaustionValue:'2/10'},rodStroke:{visible:true,ratio:0.5,value:'5'},rodControl:{visible:true,ratio:0.5,value:'5',active:true},
    tension:{visible:true,ratio:0.5,pulse:0.5,value:'50%',dragMarkerVisible:true,dragMarkerRatio:0.6},tackleStress:{visible:true,ratio:0.3,label:'Stress',value:'30%'},
    holdCharges:{visible:true,max:3,current:1,active:true,restoringCount:1,restoreProgress:[0.5],viewportWidth:800,viewportHeight:600},
    playerPressureFatigue:{viewportWidth:800,config:{enabled:true,idleVisible:true},state:{stateName:'grace',graceDurationMs:1000,graceElapsedMs:500,fatigueProgress:0.5}}};
  const victoryModel={visible:true,width:800,height:600,nowMs:1000,config:{blurPx:2,panelRadius:10,imageBorderWidth:2,rarityStarGap:7,rarityStarRadius:12},spriteId:'fish',fish:{name:'Test Fish',level:3,rarity:{isResolved:true,halfSteps:3,maxHalfSteps:6,maxStars:3,unitsPerStar:2,isMaximum:false}},layout:{panel:{x:20,y:20,width:500,height:500},padding:20,image:rect,badge:rect,rarity:rect,stats:{x:20,y:200,columns:2,pillWidth:100,pillHeight:20,pillGap:5},claim:rect,release:rect},stats:list([{label:'Weight 1kg',tone:'neutral'},{label:'Level 3'}])};
  const frame={world:worldModel,casting:castModel,fishing:fishingModel,hud:hudModel,outcome:{visible:true,mode:'victory',victory:victoryModel,gameOver:{visible:true,width:800,height:600,title:'LINE SNAPPED',titleColor:'#f00',description:'Tension exceeded capacity'}}};
  const component=(id,order,renderer,key)=>({id,order,renderer,selectModel:model=>key?model[key]:model,isVisible:model=>model.visible!==false});
  const fishing=new c.FishingSceneRenderer({components:[component('rod',2,rod,'rodLine'),component('areas',1,fight,'fightAreas'),component('float',3,float,'float')]}),
    hud=new c.FightHudRenderer({components:[component('status',1,status),component('hold',2,hold,'holdCharges'),component('fatigue',3,fatigue,'playerPressureFatigue')]});
  const passes=[new c.WorldRenderPass({components:[component('world',1,world,'world'),component('boat',2,boat,'world')]}),new c.CastingRenderPass({renderer:cast}),new c.FishingRenderPass({renderer:fishing}),new c.HudRenderPass({renderer:hud}),new c.OutcomeRenderPass({gameOverRenderer:gameOver,victoryRenderer:victory})];
  const sequence=[];const orderPass=new c.WorldRenderPass({components:[component('later',2,{render(){sequence.push('later');}}),component('first',1,{render(){sequence.push('first');}})]});orderPass.render(frame);assert.deepEqual(sequence,['first','later']);
  let expected=null;
  for(let index=0;index<120;index++) {
    commands.length=0;textOptions.length=0;surface.globalAlpha=1;for(const pass of passes)pass.render(frame);world.renderInvalidCastMarker(worldModel.invalidCastMarker);
    assert.equal(stack.length,0);assert.equal(surface.globalAlpha,1);const actual=JSON.stringify(commands);if(expected===null)expected=actual;else assert.equal(actual,expected,'drawing order and arguments repeat exactly');
    assert(commands.some(entry=>entry[0]==='quadraticCurveTo'));assert(commands.some(entry=>entry[0]==='fillText'&&entry[1]==='HOLD'));assert(commands.some(entry=>entry[0]==='fittedText'&&entry[1]==='Test Fish'));
    const unique=new Set(textOptions);assert.equal(unique.size,2,'victory and star renderer each reuse one fitted-text options object');
  }
  for(const kind of ['hooked','lure','feeder','float']){fishingModel.float.kind=kind;float.render(fishingModel.float);}
  fightModel.catchZone.kind='line';fightModel.sectorClamped=true;fight.render(fightModel);theme.isAnimated=true;victoryModel.spriteId='missing';victory.render(victoryModel);
  victoryModel.fish.rarity.isMaximum=true;victoryModel.fish.rarity.halfSteps=6;victory.render(victoryModel);victoryModel.fish.rarity.isResolved=false;victory.render(victoryModel);
  for(const stateName of ['idle','grace','fatigue','recovered']){hudModel.playerPressureFatigue.state.stateName=stateName;fatigue.render(hudModel.playerPressureFatigue);}
  hudModel.tension.ratio=0.2;status.render(hudModel);hudModel.tension.ratio=0.9;status.render(hudModel);frame.outcome.mode='failed';passes[4].render(frame);
  assert(commands.some(entry=>entry[0]==='fillText'&&entry[1]==='LINE SNAPPED'));
  commands.length=0;for(const model of [frame.world,frame.casting,frame.fishing,frame.hud,frame.outcome])model.visible=false;for(const pass of passes)pass.render(frame);assert.equal(commands.length,0,'hidden passes do not draw');
  assert.throws(()=>new c.FloatRenderer({}),/requires surface/);assert.throws(()=>new c.VictoryRenderer({surface,primitives,assets}),/requires themeResolver/);
  assert.equal(stack.length,0);
}

// Repeated render-frame storage and ordering checks; no drawing or gameplay state ownership.
function checkRenderStorage() {
  const runtime=new SourceRuntime();
  runtime.load('src/game/presentation/rendering/reusable_render_list.js', { expose: ['ReusableRenderList'] });
    runtime.load('src/game/presentation/rendering/game_render_frame.js', { expose: ['GameRenderFrame'] });
    runtime.load('src/game/presentation/rendering/render_frame_buffer.js', { expose: ['RenderFrameBuffer'] });
  runtime.load('src/game/presentation/rendering/game_render_order.js',{expose:['GameRenderOrder','RENDER_ORDER','RENDER_SEQUENCE','NO_RENDER_EXPORT']});
  assert.equal(runtime.context.NO_RENDER_EXPORT,undefined,'unknown explicit names do not create exports');
  runtime.load('src/game/presentation/rendering/game_render_intent.js',{expose:['GameRenderIntent']});
  const c=runtime.context, growth=[],diagnostics={recordFrameCreated(){growth.push('frame');},recordBufferGrowth(id){growth.push(id);}};
  const buffer=new c.RenderFrameBuffer({diagnostics}),frame=buffer.current,intent=new c.GameRenderIntent();
  const names=['world.backgroundLayers','world.clipRegions','world.dynamicZones','world.chumZones','world.waypoints','world.boats','world.sensorRays',
    'fishing.fightAreas.clipRegions','fishing.fightAreas.sectorPoints','fishing.fightAreas.lineRadiusPoints','outcome.victory.stats'];
  const lists=names.map(path=>path.split('.').reduce((value,key)=>value[key],frame)),records=lists.map(list=>list.acquire());
  const casting=intent.casting,fishing=intent.fishing,outcome=intent.outcome;
  assert.equal(c.GameRenderOrder.values,c.RENDER_ORDER);assert.equal(c.GameRenderOrder.sequence,c.RENDER_SEQUENCE);
  assert(Object.isFrozen(c.GameRenderOrder.values)&&Object.isFrozen(c.GameRenderOrder.sequence));
  assert.equal(c.GameRenderOrder.compare(100,400),-300);assert.equal(c.GameRenderOrder.compare('bad',null),0);
  const passByName=Object.fromEntries(Array.from(c.RENDER_SEQUENCE,name=>[name,{id:name,render(){}}]));
  const passes=c.GameRenderOrder.createPassList(passByName);assert.deepEqual(Array.from(passes,p=>p.id),['world','casting','fishing','hud','outcome']);
  assert.throws(()=>c.GameRenderOrder.createPassList({}),/requires the "world" pass/);
  for(let index=1;index<=120;index++) {
    const result=index%2?buffer.acquire(index,1/60,'fishing'):buffer.acquire({frameNumber:index,dt:1/30,stateName:'victory'});
    assert.equal(result,frame);assert.equal(buffer.current,frame);assert.equal(frame.frameNumber,index);assert.equal(frame.dt,index%2?1/60:1/30);
    for(let i=0;i<lists.length;i++) {
      const list=lists[i];assert.equal(list.count,0);assert.equal(list.getAt(0),null);assert.equal(list.getAt(-1),null);
      assert.equal(list.acquire(),records[i]);records[i].frame=index;assert.equal(list.count,1);assert.equal(list.getAt('0.7'),records[i]);
      assert.equal(list.getActiveUnchecked(0),records[i]);let visited=0;list.forEachActive((entry,n)=>{assert.equal(entry,records[i]);assert.equal(n,0);visited++;});assert.equal(visited,1);
    }
    frame.world.visible=true;frame.casting.visible=true;frame.casting.aimingZone.visible=true;frame.fishing.float.visible=true;frame.hud.tension.visible=true;frame.outcome.victory.visible=true;
    intent.casting.visible=true;intent.casting.accuracyPreview={};intent.fishing.tensionMeter={};intent.outcome.fish={};intent.stateName='playing';
    assert.equal(intent.reset(),intent);assert.equal(intent.casting,casting);assert.equal(intent.fishing,fishing);assert.equal(intent.outcome,outcome);
    assert.equal(casting.visible,false);assert.equal(casting.accuracyPreview,null);assert.equal(fishing.tensionMeter,null);assert.equal(outcome.fish,null);assert.equal(intent.stateName,'');
  }
  assert.equal(growth.length,1+lists.length,'storage records grow once and are reused across 120 frames');
  frame.reset({dt:-1});assert.equal(frame.dt,0);assert.equal(frame.world.visible,false);assert.equal(frame.casting.visible,false);
  assert.equal(frame.casting.aimingZone.visible,false);assert.equal(frame.fishing.float.visible,false);assert.equal(frame.hud.tension.visible,false);assert.equal(frame.outcome.victory.visible,false);
  const list=new c.ReusableRenderList();assert.equal(list.reset(),list);assert.throws(()=>list.forEachActive(null),/requires callback/);
  const standalone=new c.GameRenderFrame();assert.equal(standalone.reset(8,'invalid',null),standalone);assert.equal(standalone.frameNumber,8);assert.equal(standalone.dt,0);
}

// Version API and original eager mounting phase, including live document replacement and errors.
function checkVersionBadge() {
  const expectedVersion=require('../package.json').version;
  const declaration='src/bootstrap/production/game_version_badge.js';
  for(const readyState of ['loading','complete']) {
    const listeners=[],removed=[],queries=[],styles=[],node={dataset:{},textContent:'',title:''};
    const document={readyState,head:{appendChild(child){styles.push(child);}},
      createElement(tag){assert.equal(tag,'style','badge must not create DOM nodes');return {removed:0,remove(){this.removed+=1;}};},
      getElementById(id){queries.push(id);return id==='missing'?null:node;},addEventListener(type,callback,options){listeners.push({type,callback,options});},
      removeEventListener(type,callback){removed.push({type,callback});}};
    const runtime=new SourceRuntime({globals:{document}});
    runtime.load('src/game/presentation/version/project_version.js',{expose:['PROJECT_VERSION_CONFIG']});
    runtime.load('src/platform/browser/dom/inventory_dom_factory.js',{expose:['InventoryDomFactory']});
    runtime.load(declaration,{expose:['GameVersionBadge']});
    runtime.load('src/platform/browser/runtime/browser_startup_environment.js',{expose:['activateBrowserStartupInterface']});
    const Badge=runtime.context.GameVersionBadge, mount=()=>Badge.mountById();
    // Native startup activation (both pages): mounting waits for DOMContentLoaded once while the document loads.
    assert.equal(queries.length,0);
    const dispose=runtime.context.activateBrowserStartupInterface(document,mount);
    const loaded=listeners.filter(item=>item.type==='DOMContentLoaded');
    if(readyState==='loading'){assert.equal(queries.length,0);assert.equal(loaded.length,1);assert.equal(loaded[0].callback,mount);assert.equal(loaded[0].options.once,true);loaded[0].callback();}
    else assert.equal(loaded.length,0);
    assert.deepEqual(queries,['gameVersionBadge']);assert.equal(node.textContent,`v${expectedVersion} prototype`);assert.equal(node.dataset.version,expectedVersion);
    assert.equal(styles.length,0,'browser startup never injects presentation styles');
    dispose();
    assert.deepEqual(removed.map(item=>item.type).sort(),['DOMContentLoaded','contextmenu','touchstart']);
    assert.equal(removed.find(item=>item.type==='DOMContentLoaded').callback,mount);assert.equal(styles.length,0);
    const mounted=Badge.mountById('custom');
    assert.equal(mounted.element,node);assert.equal(queries.at(-1),'custom');
    assert.equal(Badge.mountById('missing').element,null);
    const noElement=new Badge();noElement.render();assert.equal(noElement.element,null);
    const noConfig=new Badge({element:node,versionConfig:null});noConfig.render();assert.equal(node.dataset.version,expectedVersion);
    const fallback=new Badge({element:node,versionConfig:{}});fallback.render();assert.equal(node.textContent,'vunknown');assert.equal(node.title,'CyberFishing');assert.equal(node.dataset.version,'unknown');
    const custom=new Badge({element:node,versionConfig:{version:'1.2.3',label:'Custom',channel:'test',name:'Example',codename:'case',updatedAt:'2020'}});custom.render();assert.equal(node.textContent,'Custom test');assert.equal(node.title,'Example · case · 2020');
    const replacement={dataset:{}};runtime.context.document={getElementById(id){assert.equal(this,runtime.context.document);assert.equal(id,'replacement');return replacement;}};
    assert.equal(Badge.mountById('replacement').element,replacement,'static mounting resolves the live document');
    delete runtime.context.document;assert.throws(()=>Badge.mountById(),error=>error.name==='ReferenceError'&&error.message==='document is not defined');
    runtime.context.document=undefined;assert.throws(()=>Badge.mountById(),error=>error.name==='TypeError');
  }
}

// Exercise original browser widgets over repeated frames and real interaction/disposal paths.
function checkBrowserWidgets() {
  const ids=new Map(),frames=new Map(),cancelled=[],timers=new Map(),saved=new Map();let nextFrame=0,nextTimer=0,clicks=0,disposed=0,queries=0;
  const drainFrames=()=>{while(frames.size){const [id,fn]=frames.entries().next().value;frames.delete(id);fn();}};
  const makeNode=()=>({style:{setProperty(key,value){this[key]=value;}},children:[],listeners:new Map(),attrs:{},value:'1',min:'0.1',max:'20',clientHeight:120,
    classList:{values:new Set(),contains(v){return this.values.has(v);},add(v){this.values.add(v);},remove(v){this.values.delete(v);},toggle(v,on){if(on)this.add(v);else this.remove(v);}},
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
  document.defaultView={requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},
    cancelAnimationFrame:id=>{cancelled.push(id);frames.delete(id);}};
  const runtime=new SourceRuntime({globals:{document,window:{innerWidth:300,innerHeight:200},console:{log(){},warn(){}},
    ...document.defaultView,
    setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)}});
  const definitions=[["src/platform/browser/dom/engine_interface.js",'UI_EXCEPTIONS','initEngineInterface'],["src/platform/browser/dom/ui_event_shield.js",'UiEventShield'],["src/platform/browser/dom/draggable_button.js",'DraggableButton'],
    ["src/platform/browser/ui/game_controls.js",'GameControls'],["src/platform/browser/ui/chum_controls.js",'ChumControls'],["src/platform/browser/ui/depth_selector.js",'DepthSelector'],["src/platform/browser/ui/time_display.js",'TimeDisplay'],["src/platform/browser/ui/hold_charges.js",'HoldCharges']];
  for(const [file,...expose]of definitions)runtime.load(file,{expose});
  runtime.load('src/game/presentation/hud/hud_labels.js',{expose:['HUD_LABELS']});
  const c=runtime.context;c.initEngineInterface();
  // Player-facing HUD labels are injected the way GameCompositionRoot injects them.
  const {bindConstructorDefaults}=require('./testing/runtime/constructor_defaults');
  for(const name of ['DepthSelector','HoldCharges'])c[name]=bindConstructorDefaults(c[name],{labels:c.HUD_LABELS});assert.equal(document.head.children.length,0,'browser widgets do not inject styles');
  let blocked=false;document.emit('contextmenu',{target:{tagName:'DIV',classList:{contains:()=>false},id:''},preventDefault(){blocked=true;}});assert(blocked);
  blocked=false;document.emit('contextmenu',{target:{tagName:'INPUT',classList:{contains:()=>false},id:''},preventDefault(){blocked=true;}});assert(!blocked);
  const button=makeNode(),cache={get:key=>saved.get(key),set:(key,value)=>saved.set(key,value)};
  c.UiEventShield.makeSolid(null);const drag=new c.DraggableButton(button,()=>clicks++,{ui:{draggableButtons:true,dragHoldTimeMs:10}},{id:'probe',cache});
  assert.equal(button.listeners.get('pointerdown')[0].opts.capture,false,'shield remains bubbling');
  drag.onPointerDown({button:1,pointerType:'mouse',stopPropagation(){}});assert.equal(timers.size,0);
  const point={button:0,pointerType:'mouse',pointerId:1,clientX:25,clientY:25,stopPropagation(){}};
  drag.onPointerDown(point);drag.onPointerUp(point);assert.equal(clicks,1);assert.equal(timers.size,0);
  drag.onPointerDown(point);for(const fn of timers.values())fn();timers.clear();
  assert(button.classList.contains('draggable-control--dragging'),'holding starts shared drag feedback');
  for(let frame=0;frame<120;frame++)drag.onPointerMove({...point,clientX:frame*4,clientY:frame*3});
  assert.equal(button.style.left,'260px');assert.equal(button.style.top,'160px');drag.onPointerUp({...point,clientX:476,clientY:357});assert(saved.has('drag_pos_probe'));assert.equal(clicks,1);
  assert(!button.classList.contains('draggable-control--dragging'),'releasing clears drag feedback');
  const controls=new c.GameControls({ui:{draggableButtons:false}},{dispose(){disposed++;}},{cache,labels:c.HUD_LABELS});
  const depth=new c.DepthSelector(),time=new c.TimeDisplay(),hold=new c.HoldCharges(),chum=new c.ChumControls(()=>clicks++);
  depth.show(20,3,value=>{depth.lastChange=value;});const initialQueries=queries;let circle=null;
  for(let frame=0;frame<120;frame++) {
    controls.updateNetButtonState(frame>=30,frame>=60);controls.updateContinueButtonState(frame>=90);controls.setOutcomeOverlayActive(frame>=100);
    depth.updateMax(frame<60?20:2);depth.updateCastDistance({availableMeters:frame,maximumMeters:20,visible:frame!==119});
    time.update(frame<30?4:frame<60?6:frame<90?12:19);
    hold.update({hasHold:true,max:frame<60?3:4,current:1,isActive:frame%2===0,restoring:[0.5],restoreMaxTime:1});
    if(frame===1)circle=hold.circles[0];if(frame>1&&frame<60)assert.equal(hold.circles[0],circle,'stable capacity reuses DOM circles');
    const state=['disabled','empty','moving','ready','idle','aiming'][frame%6];chum.setState(state,frame%2?'boat':'hand',4);chum.button.emit('click');
    drainFrames();
  }
  assert.equal(queries,initialQueries,'updates use cached DOM references');assert.equal(depth.lastChange,2);assert.equal(time.emojiSpan.innerText,'🌇');
  assert.equal(clicks,61,'only enabled chum states dispatch clicks');assert.equal(hold.circles.length,4);
  assert.equal(hold.textLabel.innerText,'УТРИМАННЯ');assert.equal(depth.distanceValue.innerText,'Закид: 20.0 м','injected HUD labels reach the widgets');
  controls.setScoutingPointerDimmed(true);controls.setScoutingPointerDimmed(false);drainFrames();
  controls.hideNetButton();depth.hide();hold.update(null);assert.equal(hold.container.style.display,'none');
  controls.dispose();controls.dispose();time.dispose();hold.dispose();chum.dispose();assert.equal(disposed,1);assert.equal(timers.size,0);
  let positions=0;
  Object.defineProperty(depth.inputContainer.style,'top',{set(){positions++;},configurable:true});
  depth.show(10,1,()=>{});depth.updateMax(9);depth.updateMax(8);
  assert.equal(frames.size,3,'all normal callbacks remain scheduled');drainFrames();assert.equal(positions,3);
  depth.show(10,1,()=>{});depth.updateMax(9);depth.updateMax(8);
  const pending=[...frames.keys()],lateCallbacks=[...frames.values()],slider=depth.slider,input=depth.input;
  const cancellations=cancelled.length;
  depth.dispose();depth.dispose();
  assert.deepEqual(cancelled.slice(cancellations),pending,'dispose cancels every pending frame, excluding completed frames');
  assert.equal(frames.size,0);assert.equal(depth.isActive,false);
  for(const fn of lateCallbacks)fn();
  slider.emit('input');input.emit('input');input.emit('change');
  depth.show(10,1,()=>{throw Error('disposed callback');});depth.updateMax(9);depth.updateCastDistance({availableMeters:1,maximumMeters:2});depth.hide();
  assert.equal(positions,3,'late callbacks/events and public operations do nothing after dispose');assert.equal(frames.size,0);
  const reentrant=new c.DepthSelector();
  reentrant.show(10,5,()=>reentrant.dispose());reentrant.updateMax(1);
  assert.equal(frames.size,0,'dispose from onChange also prevents subsequent scheduling');
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
  runtime.load("src/platform/browser/time/game_clock.js",{expose:["GameClock"]});
  runtime.load('src/engine/rendering/render_math.js',{expose:['RenderMath']});
  const definitions=[
    ['src/game/presentation/styles/fight_area_style_resolver.js','FightAreaStyleResolver'],
    ['src/game/presentation/styles/hud_style_resolver.js','HudStyleResolver'],
    ['src/game/presentation/styles/outcome_style_resolver.js','OutcomeStyleResolver'],
    ['src/game/presentation/screens/rarity_animation_resolver.js','RarityAnimationResolver'],
    ['src/game/presentation/styles/rarity_visual_resolver.js','RarityVisualResolver'],
    ['src/game/presentation/screens/victory_theme_resolver.js','VictoryThemeResolver'],
    ['src/game/presentation/screens/victory_layout_resolver.js','VictoryLayoutResolver'],
    ['src/game/presentation/fishing/line_visual_state_controller.js','LineVisualStateController'],
    ['src/game/presentation/fishing/rod_visual_offset_system.js','RodVisualOffsetSystem'],
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
  runtime.load("src/platform/browser/dom/inventory_long_press_controller.js",{expose:["InventoryLongPressController"]});
  const controller=new runtime.context.InventoryLongPressController();
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
  assert.equal(styles.get("--inventory-long-press-angle"),"288deg");
  assert.equal(fired,0,"RAF progress does not own the press deadline");
  now=1500;timers.get(1)();timers.clear();
  assert.equal(fired,1);
  assert.equal(controller.hasActivePress,false);
  assert.equal(frames.size,0,"the deadline cancels its scheduled frame");
  assert.equal(styles.get("--inventory-long-press-angle"),"360deg");
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
  runtime.load("src/platform/browser/time/game_clock.js",{expose:["GameClock"]});
  runtime.load('src/engine/events/event_bus.js',{expose:['EventBus']});
  runtime.load("src/platform/browser/runtime/game_loop.js",{expose:["GameLoop"]});
  runtime.load("src/platform/browser/runtime/browser_buffered_audio_player.js", { expose: ["BrowserBufferedAudioPlayer"] });
  runtime.load("src/platform/browser/runtime/browser_audio_adapter.js", { expose: ["BrowserAudioAdapter"] });
  runtime.load("src/platform/browser/runtime/browser_debug_adapter.js", { expose: ["BrowserDebugAdapter"] });
  runtime.load("src/platform/browser/runtime/browser_event_target_adapter.js", { expose: ["BrowserEventTargetAdapter"] });
  runtime.load("src/platform/browser/runtime/canvas_metrics_provider.js", { expose: ["CanvasMetricsProvider"] });
  runtime.load("src/platform/browser/runtime/config_provider.js", { expose: ["ConfigProvider"] });
  runtime.load("src/platform/browser/runtime/dev_flags_provider.js", { expose: ["DevFlagsProvider"] });
  const {GameLoop,DevFlagsProvider,BrowserDebugAdapter,CanvasMetricsProvider,ConfigProvider,BrowserAudioAdapter,BrowserEventTargetAdapter}=runtime.context;
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
  for(const [config,expected] of [[{debug:{overlay:true}},true],[{debug:{events:true}},true],
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
    ["src/platform/browser/canvas/canvas_2d_surface.js","Canvas2DSurface"],
    ["src/platform/browser/canvas/offscreen_canvas_factory.js","OffscreenCanvasFactory"],
    ["src/platform/browser/assets/image_asset_provider.js","ImageAssetProvider"],
    ["src/platform/browser/location/depth_map_reader.js","DepthMapReader"],
    ["src/platform/browser/location/location_asset_loader.js","LocationAssetLoader"],
    ["src/platform/browser/time/game_clock.js","GameClock"],
    ["src/platform/browser/assets/asset_preload_coordinator.js","AssetPreloadCoordinator"],
    ["src/platform/browser/storage/local_storage_cache.js","LocalStorageCache"],
  ]) runtime.load(file,{expose:[name]});
  for (const module of ['src/engine/assets/asset_manifest.js','src/engine/assets/asset_load_result.js']) runtime.load(module);
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
  const LocalStorageCache=runtime.context.LocalStorageCache;
  const save={version:1,items:[{id:"item-1",condition:0.73}],equipped:{rodId:"item-1"}};
  LocalStorageCache.set("save",save);
  assert.equal(saved.get("fishing_game_save"),JSON.stringify(save),"save prefix and JSON bytes are unchanged");
  assert.equal(JSON.stringify(LocalStorageCache.get("save")),JSON.stringify(save));
  assert.notEqual(LocalStorageCache.get("save"),save);
  LocalStorageCache.remove("save");assert.equal(LocalStorageCache.get("save","default"),"default");
  saved.set("fishing_game_broken","invalid JSON");
  const warnings=[];
  runtime.context.console={log(){},warn:(...args)=>warnings.push(args),error:console.error};
  assert.equal(LocalStorageCache.get("broken","safe fallback"),"safe fallback");
  assert.equal(warnings.length,1,"failed reads retain their warning and caller fallback");
  LocalStorageCache.set("one",save);LocalStorageCache.set("two",[]);LocalStorageCache.clearAll();
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
  checkCanvasScenes();
  checkRenderStorage();
  checkVersionBadge();
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

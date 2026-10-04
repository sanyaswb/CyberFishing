const assert = require('node:assert/strict');
const { SourceRuntime } = require('../core/source_runtime');

// Real render builders/coordinator with deterministic state, projection, clock and external ports.
function checkRenderFrameComposition() {
  const runtime=new SourceRuntime();
  runtime.load('src/core/math/vector2.js',{expose:['Vector2']});
  runtime.run('Object.assign(globalThis,globalThis.__CYBER_FISHING_COMPAT_RUNTIME__.modules["src/engine/rendering/render_math.js"]);');
  runtime.load('src/render/core/image_asset_provider.js',{expose:['ImageAssetProvider']});
  runtime.load('src/render/core/render_frame_buffer.js',{expose:['GameRenderFrame','RenderFrameBuffer']});
  runtime.load('src/render/core/render_order.js',{expose:['RenderOrder']});
  runtime.load('src/render/pipeline/game_render_pipeline.js',{expose:['GameRenderPipeline']});
  const definitions=[['boat_chum_render_frame_builder','BoatChumRenderFrameBuilder'],['casting_render_frame_builder','CastingRenderFrameBuilder'],
    ['fight_area_render_frame_builder','FightAreaRenderFrameBuilder'],['fight_hud_frame_builder','FightHudFrameBuilder'],
    ['fishing_equipment_render_model_builder','FishingEquipmentRenderModelBuilder'],['fishing_render_frame_builder','FishingRenderFrameBuilder'],
    ['game_render_frame_builder','GameRenderFrameBuilder'],['landing_area_render_frame_builder','LandingAreaRenderFrameBuilder'],
    ['outcome_render_frame_builder','OutcomeRenderFrameBuilder'],['world_render_frame_builder','WorldRenderFrameBuilder'],['game_render_intent','GameRenderIntent'],['game_render_coordinator','GameRenderCoordinator']];
  for(const [file,name]of definitions)runtime.load('src/app/rendering/'+file+'.js',{expose:[name]});
  const c=runtime.context,metrics={width:800,height:600},clock={now:1000,realNow:1000};
  const projector={getScale:()=>1,getPerspective:()=>({scale:1,squashY:0.5}),virtualToScreen(x,y,out){out.x=x;out.y=y;return out;},screenToVirtual(x,y,out){out.x=x;out.y=y;return out;}};
  const config={canvas:{backgroundColor:'#123'},ui:{rod:{x:'center',yOffset:0},line:{}},tension:{breakThreshold:100},casting:{enabled:true,aimLine:{}},
    debug:{casting:{showChumDistanceLine:true,showAccuracyArea:true}},physics:{fight:{playerPressureFatigue:{visual:{enabled:true,idleVisible:true},recovery:{holdCompleteVisibleMs:100}}}},
    fightPhysicsConfig:{getPixelsPerMeter:()=>50,getPoleFightSectorConfig:()=>({})},locations:{currentLocationId:'test',debugVisuals:true,showPoleFightSector:true,showFightLineRadius:true,showLastDashZone:true,cellSize:40,map:{test:{zones:{castable:[{x:0,y:0,w:20,h:15}]}}}}};
  const background={loaded:true,dynamic:true,width:800,height:600,assetIds:{day:'day',evening:'evening',night:'night',default:'default'},nightOpacity:0.2,eveningOpacity:0};
  const geometry={active:true,originX:400,originY:600,sectorApexX:400,sectorApexY:600,maxAngleFromCenterDeg:30,limitRadiusPx:300,leftBoundaryRadiusIntersectionX:250,leftBoundaryRadiusIntersectionY:340,rightBoundaryRadiusIntersectionX:550,rightBoundaryRadiusIntersectionY:340};
  const debug={poleFightSectorActive:true,poleFightSectorOriginX:400,poleFightSectorOriginY:600,poleFightSectorApexX:400,poleFightSectorApexY:600,poleFightSectorMaxAngleDeg:30,poleFightSectorLimitRadiusPx:300,poleFightSectorLeftBoundaryRadiusIntersectionX:250,poleFightSectorLeftBoundaryRadiusIntersectionY:340,poleFightSectorRightBoundaryRadiusIntersectionX:550,poleFightSectorRightBoundaryRadiusIntersectionY:340,lastDash:{triggerDistanceMeters:1},rodStrokeRatio:0.5,rodStrokeCapacityMeters:2,rodStrokeUnrecoveredMeters:1,rodControlInputRatio:0.5,rodControlInputDirectionX:1,rodControlActive:true,dragSupported:true,dragLimitKg:1,playerPressureFatigueEnabled:true,playerPressureFatigueState:'recovering',playerPressureFatigueProgress:0.5};
  const tension={getDebugData:()=>debug,getTension:()=>50,getTensionKg:()=>1,getEffectiveMaxTackleLoadKg:()=>2,getPulseIntensity:()=>0.2,getStressRatio:()=>0.3,getBreakTargetReason:()=>null,getBreakReason:()=>null};
  const equipment={rod:{variant:'float'},reel:{},float:{effectiveStats:{width:3,length:15}},baits:[{}],feederRig:{}};
  const float={getPosition:()=>({x:250,y:300}),getVisualState:()=>({color:'#f00',scaleY:1,angle:10}),isHooked:()=>false};
  const holdState={hasHold:true,max:3,current:1,isActive:true,restoring:[500],restoreMaxTime:1000};
  const chum={getZones:()=>[{isDelivered:true,isExpired:false,x:100,y:100,baseRadius:40,currentBonus:0.5,baitConfig:{minBonus:0,maxBonus:1}}],getBoats:()=>[{pos:{x:200,y:200},angle:0,energy:50,stats:{maxEnergy:100},config:{emoji:'boat'},state:'deploying',target:{x:300,y:300},waypoints:[{x:350,y:350}],sensorRays:[{startX:200,startY:200,endX:300,endY:300,isBlocked:false}]}]};
  const boatBuilder=new c.BoatChumRenderFrameBuilder({chum,projector,config});
  const worldBuilder=new c.WorldRenderFrameBuilder({map:{getBackgroundRenderData:()=>background},projector,config,canvasMetrics:metrics,boatChumBuilder:boatBuilder,debugBuilder:{buildInto(){}},locationId:'test'});
  const styles={resolveBarStyle:()=>({})},bounds={top:0,bottom:600};let aiming=false;
  const chumSource={isAiming:()=>aiming,getEquipment:()=>({}),getGameStateName:()=> 'casting',getCastDistance:()=>300,getPowerAimVisual:()=>({active:true,mode:'chum',screenX:250,power:0.5}),getAccuracyPreview:()=>({active:true,x:250,y:300,radiusX:10,radiusY:5}),getBounds:()=>bounds,getNow:()=>clock.now};
  const castingBuilder=new c.CastingRenderFrameBuilder({projector,config,canvasMetrics:metrics,hudStyleResolver:styles,chumSource});
  const landingBuilder=new c.LandingAreaRenderFrameBuilder({projector,config,canvasMetrics:metrics,getRodScreenX:()=>400,getNet:()=>({isActive:true,getTriggerVirtualY:bottom=>bottom-100}),landingPolicyResolver:{resolve:()=>({getLandingDistanceMeters:()=>1})}});
  const areaBuilder=new c.FightAreaRenderFrameBuilder({projector,config,canvasMetrics:metrics,getRodScreenX:()=>400,landingAreaBuilder:landingBuilder,sectorGeometry:{resolve:()=>geometry}});
  const hudBuilder=new c.FightHudFrameBuilder({config,canvasMetrics:metrics});
  const equipmentBuilder=new c.FishingEquipmentRenderModelBuilder({projector,canvasMetrics:metrics,clock,config,getRodScreenX:()=>400});
  const lineFrame={lengthRatio:0.8,dropOffset:10,straightFactor:0.5};let lineContext=null;
  const fishingBuilder=new c.FishingRenderFrameBuilder({inventory:{getEquipped:()=>equipment},projector,canvasMetrics:metrics,clock,config,equipmentRules:{isSpinning:eq=>eq.rod.variant==='spinning',isFeeder:eq=>eq.rod.variant==='feeder'},baitRules:{getSinkRate:()=>1},getFloat:()=>float,getInputState:()=>({isPulling:true}),getCastDistanceRatio:()=>0.5,getCurrentHookDepth:()=>2,getHoldState:()=>holdState,lineVisualState:{update(context){if(lineContext)assert.equal(context,lineContext);lineContext=context;return lineFrame;}},fightAreaBuilder:areaBuilder,hudBuilder,equipmentModelBuilder:equipmentBuilder});
  const victoryConfig={},layout={id:'layout'};
  const outcomeBuilder=new c.OutcomeRenderFrameBuilder({canvasMetrics:metrics,clock,styleResolver:{resolveVictory:()=>victoryConfig},layoutResolver:{resolve:()=>layout},assetIdForSource:(source,namespace)=>c.ImageAssetProvider.assetIdForSource(source,namespace)});
  const builder=new c.GameRenderFrameBuilder({canvasMetrics:metrics,projector,worldBuilder,castingBuilder,fishingBuilder,outcomeBuilder});
  const order=[],passes=['world','casting','fishing','hud','outcome'].map(id=>({id,render(frame){assert.equal(frame.frameNumber,Math.floor(clock.now/16));order.push(id);}})),pipeline=new c.GameRenderPipeline({passes});
  assert.equal(pipeline.getPassCount(),5);assert.equal(pipeline.getPassIdAt(-1),null);assert.equal(pipeline.getPassIdAt(5),null);const passIds=['old'];assert.equal(pipeline.copyPassIdsInto(passIds),passIds);assert.deepEqual(passIds,['world','casting','fishing','hud','outcome']);assert.throws(()=>pipeline.copyPassIdsInto({}),/requires array/);assert.throws(()=>new c.GameRenderPipeline({passes:[passes[0],passes[0]]}),/Duplicate render pass id/);
  let intentIdentity=null,state='playing',invalidations=0;
  const machine={getRenderState(intent){if(intentIdentity)assert.equal(intent,intentIdentity);intentIdentity=intent;intent.stateName=state;
    Object.assign(intent.casting,{visible:true,zoneVisible:true,powerVisible:true,virtualBottomY:600,maxDistance:300,mode:'rod',nowMs:clock.now,bounds,accuracyPreview:{active:true,x:250,y:300,radiusX:10,radiusY:5},visual:{active:true,mode:'rod',screenX:250,power:0.5}});
    Object.assign(intent.fishing,{visible:true,state,bottom:600,startTime:0,tensionMeter:tension,fishCondition:{maxStamina:10,currentStamina:7,maxEndurance:10,currentExhaustion:2,phase:'stamina'}});
    Object.assign(intent.outcome,{visible:true,mode:'victory',fish:{id:'test',name:'Test Fish',level:2,weight:1,imagePath:'fish.png',rarity:{isResolved:true,halfSteps:3,maxHalfSteps:6},victoryStats:[{label:'Level 2'}]}});}};
  const buffer=new c.RenderFrameBuffer(),coordinator=new c.GameRenderCoordinator({stateMachine:machine,frameBuffer:buffer,frameBuilder:builder,pipeline,getBounds:()=>bounds,getInvalidCastMarker:()=>({x:250,y:300,timeLeft:1}),isDebugEnabled:()=>true,invalidateStyles:()=>invalidations++});
  let record=null,fishRecord=null,restoreProgress=null,contextFrame=null;
  for(let index=1;index<=120;index++) {
    clock.now=clock.realNow=index*16;order.length=0;const frame=coordinator.render(0.016);assert.equal(frame,buffer.current);assert.equal(frame.dt,0.016);assert.equal(frame.viewport.width,800);assert.equal(frame.world.chumZones.count,1);assert.equal(frame.world.boats.count,1);assert.equal(frame.world.waypoints.count,2);assert.equal(frame.world.sensorRays.count,1);
    assert.equal(frame.fishing.float.kind,'float');assert.equal(frame.fishing.fightAreas.netZone.visible,true);assert.equal(frame.fishing.fightAreas.sectorPoints.count,66);assert.equal(frame.fishing.fightAreas.lineRadiusPoints.count,65);assert.equal(frame.hud.fishCondition.staminaRatio,0.7);assert.equal(frame.hud.holdCharges.restoreProgress[0],0.5);
    assert.equal(frame.outcome.victory.spriteId,'fish:fish.png');assert.equal(frame.outcome.victory.stats.count,4);assert.equal(frame.outcome.victory.layout,layout);assert.deepEqual(order,['world','casting','fishing','hud','outcome']);
    if(record){assert.equal(frame.world.boats.getAt(0),record);assert.equal(frame.outcome.victory.fish,fishRecord);assert.equal(frame.hud.holdCharges.restoreProgress,restoreProgress);assert.equal(frame,contextFrame);}else{record=frame.world.boats.getAt(0);fishRecord=frame.outcome.victory.fish;restoreProgress=frame.hud.holdCharges.restoreProgress;contextFrame=frame;}
  }
  for(const next of ['waiting','biting']){state=next;clock.now+=16;clock.realNow=clock.now;const frame=coordinator.render(0.016);assert.equal(frame.hud.visible,false);assert.equal(frame.fishing.visible,true);}
  aiming=true;state='playing';debug.playerPressureFatigueState='idle';clock.now+=16;const frame=coordinator.render(0.016);assert.equal(frame.casting.powerAim.mode,'chum');assert.equal(frame.hud.playerPressureFatigue.state.stateName,'recovered');
  coordinator.invalidateStyles();assert.equal(invalidations,1);
  for(const reason of ['line','rod','reel','leader','hook','net_escape']){frame.reset();outcomeBuilder.buildInto({target:frame.outcome,intent:{visible:true,mode:'failed',reason}});assert(frame.outcome.gameOver.title);}
  const defaultOutcome=new c.OutcomeRenderFrameBuilder({canvasMetrics:metrics,clock,styleResolver:{resolveVictory:()=>victoryConfig},layoutResolver:{resolve:()=>layout}});
  for(const imagePath of [' spaced.png ','   ',42]){frame.reset();defaultOutcome.buildInto({target:frame.outcome,intent:{visible:true,mode:'victory',fish:{imagePath}}});assert.equal(frame.outcome.victory.spriteId,c.ImageAssetProvider.assetIdForSource(imagePath,'fish'),'old constructor default preserves source ID values');}
  const originalId=c.ImageAssetProvider.assetIdForSource;c.ImageAssetProvider.assetIdForSource=(source,namespace)=>originalId(source,namespace)+':live';frame.reset();outcomeBuilder.buildInto({target:frame.outcome,intent:{visible:true,mode:'victory',fish:{imagePath:'fish.png'}}});assert.equal(frame.outcome.victory.spriteId,'fish:fish.png:live','injected production callback preserves live Platform method lookup');c.ImageAssetProvider.assetIdForSource=originalId;
  assert.throws(()=>new c.GameRenderCoordinator({}),/requires stateMachine/);
}

module.exports={checkRenderFrameComposition};

const assert = require('node:assert/strict');
const { SourceRuntime } = require('../core/source_runtime');

// Exercise the real controller, UI and power aim against deterministic external ports.
function checkChumComposition() {
  const nodes=[];
  const document={createElement(){const node={style:{},events:{},addEventListener(type,fn){this.events[type]=fn;},remove(){this.removed=true;}};nodes.push(node);return node;},body:{appendChild(){}}};
  const runtime=new SourceRuntime({globals:{document,console:{log(){}}}});
  runtime.load('src/ui/legacy/chum_controls.js',{expose:['ChumUI']});
  runtime.run('Object.assign(globalThis,globalThis.__CYBER_FISHING_COMPAT_RUNTIME__.modules["src/game/application/casting/cast_power_aim.js"]);');
  runtime.load('src/app/chum.js',{expose:['ChumController']});
  const bounds={left:0,right:800,top:0,bottom:600},clock={now:1000},boats=[],drops=[],consumed=[],warnings=[],invalid=[];
  const hand={id:'hand',instanceId:'hand-1',quantity:3};
  const equipped={handChum:hand,delivery:null,deliveryChums:[{id:'first'},null,{id:'second'}]};
  let state='waiting',water=true,canCast=true,hidden=0;
  const config={casting:{enabled:false,handChumAccuracyPx:0,travelDelayMinMs:10,travelDelayMaxMs:10}};
  const projector={screenToVirtual(x,y,out={}){out.x=x;out.y=y;return out;},virtualToScreen(x,y,out={}){out.x=x;out.y=y;return out;},getScale:()=>1,getPerspective:()=>({scale:1,squashY:1})};
  const chum={getBoats:()=>boats,deployBait(x,y,id,boat){drops.push([x,y,id,boat]);if(boat){boat.state='deploying';boat.waypoints.push({x,y});}},
    spawnIdleBoat(x,y){const boat={pos:{x,y},state:'idle',remainingSections:2,waypoints:[],setTarget(x,y){this.pos.x=x;this.pos.y=y;}};boats.push(boat);return boat;},
    removeBoat(boat){boats.splice(boats.indexOf(boat),1);}};
  const controller=new runtime.context.ChumController({inventory:{getEquipped:()=>equipped},chum,projector,inventoryUI:{showWarning(message){warnings.push(message);}},
    fishing:{consumeHandChum(item){consumed.push(item);return true;},consumeDeliveryChum(index){consumed.push(index);}},location:{chumCastDistance:300},clock,config,
    rng:{next:()=>0.5},getViewportSize:()=>({width:800,height:600}),panViewport(){},depthUI:{hide(){hidden++;}},getDynamicBounds:()=>bounds,
    getRodVirtualPos:()=>({x:400,y:600}),checkWater:()=>water?{depth:2}:null,markInvalidCast(pos){invalid.push(pos);},canPlayerCast:()=>canCast,getGameStateName:()=>state});
  const input={clickPos:null};controller.updateUI();assert.equal(controller.ui.button.innerText,'🍞(3)');
  controller.handleClick();assert.equal(controller.isAiming,true);assert.equal(hidden,1);
  input.clickPos={x:400,y:500};controller.handleAiming(input,bounds,16);assert.equal(input.clickPos,null);assert.equal(drops.length,0);
  clock.now+=250;input.clickPos={x:400,y:450};controller.handleAiming(input,bounds,16);
  assert.deepEqual(drops[0].slice(0,3),[400,450,'hand']);assert.equal(consumed[0],hand);assert.equal(controller.isAiming,false);
  controller.setAiming(true);clock.now+=250;input.clickPos={x:400,y:100};controller.handleAiming(input,bounds,16);
  assert.equal(invalid.length,1);assert.match(warnings[0],/Занадто далеко/);
  water=false;controller.setAiming(true);clock.now+=250;input.clickPos={x:400,y:450};controller.handleAiming(input,bounds,16);assert.equal(invalid.length,2);water=true;
  equipped.handChum=null;controller.refreshActiveHandChum();controller.handleClick();assert.match(warnings.at(-1),/немає прикормки/);
  controller.updateUI();assert.equal(controller.ui.currentState,'empty');equipped.handChum=hand;controller.refreshActiveHandChum();
  config.casting.enabled=true;controller.setAiming(true);clock.now+=250;
  const drag={pointerDown:true,pointerStart:{x:400,y:450},pointerCurrent:{x:400,y:550},clickPos:null};
  let visual;
  for(let frame=0;frame<120;frame++){controller.handleAiming(drag,bounds,16);controller.updateUI();const current=controller.getPowerAimVisualState();visual??=current;assert.equal(current,visual);assert.equal(current.mode,'chum');assert.equal(controller.getPowerAimAccuracyPreview(bounds).active,true);}
  controller.handleAiming({pointerReleased:true,pointerRelease:{x:400,y:550},clickPos:null},bounds,16);
  const beforeDrop=drops.length;controller.handleAiming(input,bounds,10000);assert.equal(drops.length,beforeDrop+1);assert.equal(consumed.at(-1).instanceId,'hand-1');assert.equal(controller.isAiming,false);
  controller.setAiming(true);clock.now+=250;controller.handleAiming({pointerDown:true,pointerStart:{x:400,y:550},pointerCurrent:{x:400,y:550}},bounds,16);
  controller.handleAiming({pointerReleased:true,pointerRelease:{x:400,y:550}},bounds,16);assert.equal(controller.isAiming,false);
  equipped.delivery={effectiveStats:{manualControl:true,sections:2,hasAutoReturn:true}};
  controller.handleClick();const boat=controller.activeBoat;assert.equal(boat,boats[0]);assert.equal(boat.remainingSections,2);
  clock.now+=250;input.clickPos={x:300,y:400};controller.handleAiming(input,bounds,16);assert.equal(consumed.at(-1),0);
  controller.updateUI();assert.equal(controller.ui.currentState,'moving');assert.equal(controller.isAiming,false);
  boat.state='waiting';boat.waypoints=[];controller.updateUI();assert.equal(controller.ui.currentState,'ready');
  controller.handleClick();assert.equal(boat.remainingSections,1);assert.equal(consumed.at(-1),0);boat.state='waiting';
  controller.handleClick();assert.equal(consumed.at(-1),2);assert.equal(boat.state,'returning');assert.equal(boat.remainingSections,0);
  boat.state='waiting';input.clickPos={x:600,y:200};controller.handleGlobalBoatControl(input);assert.equal(input.clickPos,null);assert.equal(boat.pos.x,600);
  state='playing';input.clickPos={x:500,y:300};controller.handleGlobalBoatControl(input);assert.notEqual(input.clickPos,null);state='waiting';
  boat.state='drifting';canCast=false;controller.handleGlobalBoatControl(input);assert.equal(input.clickPos,null);canCast=true;
  boat.pos={x:400,y:590};input.clickPos={x:400,y:590};controller.handleGlobalBoatControl(input);assert.equal(boats.length,0);
  equipped.delivery.effectiveStats.manualControl=false;controller.setAiming(true);const auto=controller.activeBoat;clock.now+=250;
  input.clickPos={x:200,y:300};controller.handleAiming(input,bounds,16);controller.setAiming(false);auto.waypoints=[];auto.remainingSections=2;
  input.clickPos={x:600,y:100};controller.handleGlobalBoatControl(input);assert.equal(input.clickPos,null);assert.equal(consumed.at(-1),0);
  controller.setAiming(true);boats[0].state='returning';controller.updateUI();assert.equal(controller.isAiming,false);
  controller.activeBoat=auto;assert.equal(controller.activeBoat,auto);
  const ui=controller.ui;controller.dispose();assert.equal(controller.ui,null);assert.equal(controller.activeBoat,null);assert.equal(ui.button,null);assert.equal(nodes[0].removed,true);
}

module.exports={checkChumComposition};

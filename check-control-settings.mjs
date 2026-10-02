import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const original=fs.readFileSync('docs/game.js','utf8');
function setup(storage=new Map(),blocked=false){
  const elements=new Map(),events={};
  const ctx=new Proxy({}, {get:(target,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):target[key]||(()=>{})});
  const element=id=>{if(!elements.has(id)){const attributes=new Map(),classes=new Set();elements.set(id,{id,hidden:false,style:{setProperty(){},removeProperty(){}},classList:{toggle(){},add(x){classes.add(x);},remove(x){classes.delete(x);}},setAttribute(k,v){attributes.set(k,String(v));},getAttribute:k=>attributes.get(k),addEventListener(type,fn){events[id+':'+type]=fn;},getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:id==='joystick'?110:390,height:id==='joystick'?110:420}),setPointerCapture(){},focus(){}});}return elements.get(id);};
  const sandbox={console,Image:class{},ResizeObserver:class{observe(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},document:{getElementById:element,querySelector:()=>element('label'),addEventListener(){}},window:{devicePixelRatio:1,addEventListener(type,fn){events[type]=fn;},localStorage:{getItem(k){if(blocked)throw Error('storage blocked');return storage.get(k)||null;},setItem(k,v){if(blocked)throw Error('storage blocked');storage.set(k,v);}}}};
  vm.createContext(sandbox);vm.runInContext(original.replace(/\}\)\(\);\s*$/,`globalThis.qa={start,pause,update,setMode,spawn,moveFish,spawnSpecial,moveSpecial,get:()=>({state,elapsed,players,fish,specials,mobileSensitivity,mobileMoveSpeed,joystickSide,settingsOpen}),prepare:()=>{fish=[];specials=[];pickups=[];players.forEach(p=>{p.invulnerable=999;});}};})();`),sandbox);
  const t=sandbox.qa;
  const reset=()=>{t.start();t.prepare();return t.get().players[0];};
  const sensitivity=value=>events['mobileSensitivity:input']({target:{value:String(value)}});
  const speed=value=>events['mobileMoveSpeed:input']({target:{value:String(value)}});
  const pointer=(id,x=90.2,y=55)=>({pointerId:id,button:0,clientX:x,clientY:y,preventDefault(){}});
  const stickDistance=value=>{speed(value);sensitivity(100);const p=reset(),x=p.x;events['joystick:pointerdown'](pointer(1));t.update(.1);events['joystick:pointerup'](pointer(1));return p.x-x;};
  return {t,events,elements,storage,reset,sensitivity,speed,pointer,stickDistance};
}
const g=setup();assert.equal(g.t.get().mobileSensitivity,70);assert.equal(g.t.get().joystickSide,'left');
const slow=g.stickDistance(30),normal=g.stickDistance(100),fast=g.stickDistance(150);
assert.ok(Math.abs(normal-23)<1e-9&&Math.abs(slow/normal-.3)<1e-9&&Math.abs(fast/normal-1.5)<1e-9,'Slider scales real joystick movement across its full range');
g.speed(50);g.sensitivity(30);let p=g.reset(),x=p.x;
g.events['touchRight:pointerdown'](g.pointer(2));g.t.update(.1);assert.ok(Math.abs(p.x-x-11.5)<1e-9,'Direction buttons use the same sensitivity');
p=g.reset();x=p.x;g.events['ocean:pointerdown']({...g.pointer(3,350,210),pointerType:'touch'});g.t.update(.1);assert.ok(Math.abs(p.x-x-11.5)<1e-9,'Touch dragging uses the same sensitivity');
p=g.reset();x=p.x;g.events['ocean:pointermove']({...g.pointer(3,350,210),pointerType:'mouse'});g.t.update(.1);assert.ok(Math.abs(p.x-x-23)<1e-9,'Desktop mouse speed is unchanged');
p=g.reset();x=p.x;g.events.keydown({key:'d',preventDefault(){}});g.t.update(.1);g.events.keyup({key:'d'});assert.ok(Math.abs(p.x-x-23)<1e-9,'Physical keyboard speed is unchanged');
p=g.reset();x=p.x;g.events['touchDash:pointerdown'](g.pointer(4));g.t.update(.1);assert.ok(Math.abs(p.x-x-20.7)<1e-9,'Standalone mobile dash retains its boost at the chosen sensitivity');
// Opening settings freezes gameplay and releases movement; closing returns to the prior state.
p=g.reset();g.events['joystick:pointerdown'](g.pointer(5));g.events['controlSettings:click']();const before=g.t.get().elapsed;
assert.equal(g.t.get().state,'paused');assert.equal(g.elements.get('controlSettingsPanel').hidden,false);
g.events.keydown({key:'r',preventDefault(){}});g.events.keydown({key:'d',preventDefault(){}});g.t.update(5);assert.equal(g.t.get().elapsed,before);
g.events['stickRight:click']();assert.equal(g.elements.get('gameShell').getAttribute('data-stick-side'),'right');
assert.equal(g.elements.get('stickRight').getAttribute('aria-pressed'),'true');
g.events['closeSettings:click']();assert.equal(g.t.get().state,'playing');x=p.x;g.t.update(.1);assert.equal(p.x,x,'Changing settings cannot leave a held stick or physical key moving');
g.t.pause();g.events['controlSettings:click']();g.events.keydown({key:'Escape',preventDefault(){}});assert.equal(g.t.get().state,'paused','Previously paused games remain paused');
// User settings survive reloads and resets; bad/blocked storage never prevents startup.
const reloaded=setup(g.storage);assert.equal(reloaded.t.get().mobileSensitivity,30);assert.equal(reloaded.t.get().mobileMoveSpeed,50);assert.equal(reloaded.t.get().joystickSide,'right');
reloaded.events['resetControls:click']();assert.equal(reloaded.t.get().mobileSensitivity,70);assert.equal(reloaded.t.get().joystickSide,'left');
const defaults=setup(g.storage);assert.equal(defaults.t.get().mobileSensitivity,70);assert.equal(defaults.t.get().joystickSide,'left');
for(const saved of ['bad json','null','{"sensitivity":-1,"speed":-1,"side":"bad"}','{"sensitivity":"100","speed":"100","side":"bad"}']){const invalid=setup(new Map([['fish-feast-mobile-settings',saved]]));assert.equal(invalid.t.get().mobileSensitivity,70);assert.equal(invalid.t.get().mobileMoveSpeed,70);assert.equal(invalid.t.get().joystickSide,'left');}
const blocked=setup(new Map(),true);blocked.sensitivity(30);blocked.events['stickRight:click']();assert.equal(blocked.t.get().mobileSensitivity,30);assert.equal(blocked.t.get().joystickSide,'right');
const duo=setup();duo.speed(50);duo.t.setMode('duo');duo.t.start();duo.t.prepare();const [a,b]=duo.t.get().players;const ax=a.x,bx=b.x;
duo.events['touchRight:pointerdown'](duo.pointer(6));duo.events.keydown({key:'ArrowRight',preventDefault(){}});duo.t.update(.1);
assert.ok(Math.abs(a.x-ax-11.5)<1e-9&&Math.abs(b.x-bx-23)<1e-9,'2P keyboard does not change 1P sensitivity');
// Sensitivity changes partial-stick response, independently of full-stick player speed.
g.speed(100);const partial=[];
for(const sensitivity of [30,100,150]){g.sensitivity(sensitivity);p=g.reset();x=p.x;g.events['joystick:pointerdown'](g.pointer(8,72.6,55));g.t.update(.1);partial.push(p.x-x);g.events['joystick:pointerup'](g.pointer(8));p=g.reset();x=p.x;g.events['joystick:pointerdown'](g.pointer(8));g.t.update(.1);assert.ok(Math.abs(p.x-x-23)<1e-9,'Full stick always reaches the selected speed');}
assert.ok(partial[0]<partial[1]&&partial[1]<partial[2],'Lower sensitivity softens small stick movements');
// Both sliders affect only the player, never NPC swimming speeds or lanes.
g.reset();g.t.spawn(true);g.t.spawnSpecial(0);const f=g.t.get().fish[0],special=g.t.get().specials[0];
for(const speed of [30,150]){g.speed(speed);g.sensitivity(speed);f.x=0;special.x=0;g.t.moveFish(f,.1);g.t.moveSpecial(special,.1);assert.ok(Math.abs(f.x-f.dir*f.speed*.1)<1e-9);assert.ok(Math.abs(special.x-special.dir*special.speed*.1)<1e-9);}
console.log('PASS: independent player speed and stick sensitivity, buttons/drag/dash scaling, unchanged NPC/desktop/2P movement, settings pause/resume, right-side choice, persistence/reset and blocked/invalid storage.');

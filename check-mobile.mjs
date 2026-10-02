import assert from 'node:assert/strict';
import {t,events,viewport,elements,browserEnv,textCalls} from './check-game.mjs';
const {document,window}=browserEnv;
const pointer=id=>({pointerId:id,button:0,preventDefault(){}});
const down=(key,id)=>events[key+':pointerdown'](pointer(id));
const up=(key,id)=>events[key+':pointerup'](pointer(id));
const reset=()=>{viewport.width=350;viewport.height=330;t.resize();t.start();t.clearFish();t.get().player.invulnerable=999;return t.get().player;};

for(const [key,dx,dy] of [['touchUp',0,-1],['touchDown',0,1],['touchLeft',-1,0],['touchRight',1,0]]){
  const p=reset(),x=p.x,y=p.y;down(key,1);t.update(.1);
  assert.equal(Math.sign(p.x-x),dx);assert.equal(Math.sign(p.y-y),dy);
  assert.equal(elements.get(key).getAttribute('aria-pressed'),'true');
  up(key,1);const stopped=[p.x,p.y];t.update(.1);assert.deepEqual([p.x,p.y],stopped,'Releasing a direction stops ordinary movement');
}
let p=reset(),x=p.x,y=p.y;down('touchUp',1);down('touchRight',2);t.update(.1);
assert.ok(p.x>x&&p.y<y);assert.ok(Math.abs(Math.hypot(p.x-x,p.y-y)-23)<1e-8,'Diagonal input is normalized');
events['touchUp:pointercancel'](pointer(1));y=p.y;t.update(.05);assert.equal(p.y,y,'Cancelling one finger leaves only the other direction');
events['touchRight:lostpointercapture'](pointer(2));x=p.x;t.update(.05);assert.equal(p.x,x,'Lost capture does not leave a stuck direction');

p=reset();down('touchRight',10);down('touchRight',11);up('touchRight',10);x=p.x;t.update(.05);assert.ok(p.x>x,'A second finger on the same direction remains active');up('touchRight',11);
p=reset();down('touchLeft',3);down('touchRight',4);x=p.x;t.update(.05);assert.equal(p.x,x,'Opposing directions cancel');up('touchLeft',3);up('touchRight',4);
p=reset();down('touchRight',5);events.keydown({key:'d',preventDefault(){}});up('touchRight',5);x=p.x;t.update(.05);assert.ok(p.x>x,'Releasing touch does not release a physical key');events.keyup({key:'d'});
down('touchRight',6);events.keydown({key:'d',preventDefault(){}});events.keyup({key:'d'});x=p.x;t.update(.05);assert.ok(p.x>x,'Releasing a physical key does not release touch');up('touchRight',6);

p=reset();down('touchUp',7);down('touchDash',8);y=p.y;t.update(.1);assert.ok(y-p.y>40,'Direction and dash work with separate fingers');assert.equal(p.dashCooldown,5.9);assert.equal(elements.get('touchDash').disabled,true);assert.equal(elements.get('touchCooldown').textContent,'6秒');
t.pause();assert.equal(elements.get('touchUp').disabled,true);assert.equal(elements.get('touchUp').getAttribute('aria-pressed'),'false');t.pause();p.dashTime=0;const stopped=[p.x,p.y];t.update(.05);assert.deepEqual([p.x,p.y],stopped,'Pause clears held touches');
p=reset();down('touchLeft',9);events.orientationchange();x=p.x;t.update(.05);assert.equal(p.x,x,'Rotation clears held touches');
down('touchRight',10);viewport.width=600;viewport.height=240;t.resize();x=p.x;t.update(.05);assert.equal(p.x,x,'Resizing clears held touches');
down('touchRight',11);events.blur();assert.equal(t.get().state,'paused');t.pause();x=p.x;t.update(.05);assert.equal(p.x,x,'Leaving the browser clears held touches');

t.eat({score:1900,x:0,y:0});t.setMode('duo');t.start();t.clearFish();const [a,b]=t.get().players;const bx=b.x;down('touchLeft',12);t.update(.05);assert.equal(b.x,bx,'Mobile controls belong only to 1P');
for(let i=0;i<3;i++){a.invulnerable=0;t.hit('fish',false,a);}assert.equal(a.outcome,'over');assert.equal(t.get().state,'playing');assert.equal(elements.get('touchLeft').disabled,true);assert.equal(elements.get('touchDash').disabled,true);assert.equal(elements.get('touchLeft').getAttribute('aria-pressed'),'false');
events.keydown({key:'ArrowRight',preventDefault(){}});t.update(.05);events.keyup({key:'ArrowRight'});assert.ok(b.x>bx,'2P continues independently after 1P leaves');
t.eat({score:1900,x:0,y:0},b);t.setMode('solo');

reset();const shell=elements.get('gameShell');let requests=0,locks=0,unlocks=0;
window.innerWidth=350;window.innerHeight=700;
window.screen={orientation:{async lock(direction){assert.equal(direction,'landscape');locks++;},unlock(){unlocks++;}}};
shell.requestFullscreen=async()=>{requests++;document.fullscreenElement=shell;events['document:fullscreenchange']();};
document.exitFullscreen=async()=>{document.fullscreenElement=null;events['document:fullscreenchange']();};
await events['wideScreen:click']();assert.equal(requests,1);assert.equal(locks,1);assert.ok(shell.classList.contains('is-expanded'));assert.ok(document.body.classList.contains('game-focused'));assert.equal(elements.get('wideScreen').textContent,'退出全屏');
await events['wideScreen:click']();assert.equal(unlocks,1);assert.ok(!shell.classList.contains('is-expanded'));assert.ok(!document.body.classList.contains('game-focused'));
shell.requestFullscreen=async()=>{throw Error('unsupported');};await events['wideScreen:click']();assert.ok(shell.classList.contains('is-expanded'),'Rejected fullscreen requests retain a playable expanded view');assert.match(elements.get('toast').textContent,/将手机横过来/);assert.equal(locks,1,'Rejected fullscreen does not attempt orientation locking');await events['wideScreen:click']();
delete shell.requestFullscreen;await events['wideScreen:click']();assert.ok(shell.classList.contains('is-expanded'),'Browsers without the Fullscreen API still get the expanded view');await events['wideScreen:click']();

for(const [width,height] of [[320,260],[390,420],[600,240],[667,220]]){
  viewport.width=width;viewport.height=height;t.resize();t.start();t.clearFish();t.eat({score:1890,x:0,y:0});t.draw();
  const g=t.get(),p=g.player,r=t.screenRadius(p.r);assert.ok(r>0&&Number.isFinite(r));assert.ok(p.x>=r*1.2&&p.x<=g.W-r*1.2&&p.y>=r*.8+10&&p.y<=g.H-r*.8-8,'High-level players remain confined after rotation');
}
textCalls.length=0;t.draw();assert.ok(!textCalls.some(([s])=>s==='! 即将冲锋'),'Charge warnings are removed');
console.log('PASS: four touch directions, normalized diagonals, simultaneous dash, multi-touch release/cancel/capture, physical-key independence, pause/rotation/blur resets, 1P isolation, fullscreen and orientation fallback, narrow and landscape confinement.');

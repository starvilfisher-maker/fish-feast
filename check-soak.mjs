import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const original=fs.readFileSync('docs/game.js','utf8');
const dimensions=new Map(['fish-atlas.png','special-atlas.png','more-fish-atlas.png'].map(name=>{const data=fs.readFileSync('docs/'+name);return [name,[data.readUInt32BE(16),data.readUInt32BE(20)]];}));
let frames=0,draws=0,maxFish=0,maxParticles=0,maxPopups=0,rounds=0;
for(const mode of ['solo','duo'])for(const seed of [7,42,2026]){
  let randomState=seed;const random=()=>{randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;return (randomState>>>0)/4294967296;};
  const math=Object.create(Math);math.random=random;
  const elements=new Map(),events={},viewport={width:1100,height:520};
  const ctx=new Proxy({},{get:(target,key)=>{
    if(key==='createLinearGradient')return ()=>({addColorStop(){}});
    if(key==='drawImage')return (img,sx,sy,sw,sh,dx,dy,dw,dh)=>{for(const n of [sx,sy,sw,sh,dx,dy,dw,dh])assert.ok(Number.isFinite(n));assert.ok(sx>=0&&sy>=0&&sx+sw<=img.naturalWidth&&sy+sh<=img.naturalHeight,'Every sprite crop fits its real atlas');assert.ok(dw>0&&dh>0);draws++;};
    return Reflect.get(target,key)||((...args)=>{for(const n of args.filter(a=>typeof a==='number'))assert.ok(Number.isFinite(n),'Canvas coordinates remain finite');});
  }});
  function element(id){if(!elements.has(id))elements.set(id,{textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(type,fn){events[id+':'+type]=fn;},getBoundingClientRect:()=>({...viewport,left:0,top:0}),focus(){},getContext:()=>ctx});return elements.get(id);}
  const sandbox={Math:math,console,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame(){},ResizeObserver:class{observe(){}},Image:class{set src(name){[this.naturalWidth,this.naturalHeight]=dimensions.get(name);this.complete=true;}},document:{getElementById:element,querySelector:()=>element('label'),addEventListener(type,fn){events['document:'+type]=fn;}},window:{devicePixelRatio:2,addEventListener(type,fn){events[type]=fn;}}};
  vm.createContext(sandbox);vm.runInContext(original.replace(/\}\)\(\);\s*$/,`globalThis.qa={start,setMode,update,draw,eat,resize,pause,get:()=>({state,players,fish,specials,pickups,particles,popups,W,H,sizeScale})};})();`),sandbox);
  const t=sandbox.qa;t.setMode(mode);t.start();t.eat({score:710,x:0,y:0},t.get().players[0]);
  for(let frame=0;frame<10800;frame++){
    if(t.get().state!=='playing'){t.start();rounds++;}
    const active=t.get().players.filter(p=>p.outcome==='playing');for(const p of active)p.invulnerable=2;
    if(frame%40===0){for(const key of ['a','s','d','w','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'])events.keyup({key});for(const key of ['a','s','d','w','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].filter(()=>random()<.3))events.keydown({key,preventDefault(){}});}
    if(frame%240===0)events.keydown({key:random()<.5?' ':'Shift',preventDefault(){}});
    if(frame>0&&frame%1800===0){t.eat({bonus:1,x:0,y:0},active[Math.floor(random()*active.length)]);}
    if(frame%900===0){const small=(frame/900)%2===1;viewport.width=small?320:1100;viewport.height=small?350:520;t.resize();}
    if(frame%1300===0){t.pause();const paused=JSON.stringify(t.get());t.update(1);assert.equal(JSON.stringify(t.get()),paused,'Pause freezes the entire simulated world');t.pause();}
    t.update(1/60);frames++;if(frame%30===0)t.draw();
    const g=t.get();assert.ok(g.fish.length<=34&&g.specials.length<=1&&g.pickups.length<=1);maxFish=Math.max(maxFish,g.fish.length);maxParticles=Math.max(maxParticles,g.particles.length);maxPopups=Math.max(maxPopups,g.popups.length);
    assert.ok(g.particles.length<800&&g.popups.length<80,'Effects stay bounded over repeated rounds');
    for(const p of g.players){for(const key of ['x','y','r','score','level','lives','shieldTime','dashCooldown'])assert.ok(Number.isFinite(p[key]),'Player state remains finite');assert.ok(p.lives>=0&&p.lives<=3&&p.level>=0&&p.level<10&&p.r>=20&&p.r<=180);const r=p.r*g.sizeScale;assert.ok(p.x>=r*1.2-.001&&p.x<=g.W-r*1.2+.001&&p.y>=r*.8+10-.001&&p.y<=g.H-r*.8-8+.001,'Both player bodies stay within the resized field');}
    for(const f of [...g.fish,...g.specials,...g.pickups])for(const key of ['x','y','baseY'])assert.ok(Number.isFinite(f[key]),'Swimming and charge positions stay finite');
  }
}
console.log(JSON.stringify({status:'PASS',simulatedMinutes:frames/60/60,frames,spriteDraws:draws,restartedRounds:rounds,maxFish,maxParticles,maxPopups,seeds:3,modes:2}));

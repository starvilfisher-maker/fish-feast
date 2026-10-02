import assert from 'node:assert/strict';
import {t,viewport,setRandom} from './check-game.mjs';

const seeded=seed=>()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
const sizes=[20,27,36,47,62,82,103,128,153,180];
const distribution=(seed,level,mode='solo',elapsed=0)=>{
  t.setMode(mode);t.start();t.setElapsed(elapsed);
  const players=t.get().players;players[0].level=level;players[0].r=sizes[level];
  setRandom(seeded(seed));
  const radii=[];
  for(let i=0;i<2000;i++){t.clearFish();t.spawn();radii.push(t.get().fish[0].r);}
  return radii;
};

viewport.width=1100;viewport.height=520;t.resize();
const rates=[];
for(const seed of [7,42,2026]){
  const opening=distribution(seed,0);
  for(const level of [2,6,8])assert.deepEqual(distribution(seed,level),opening,'Fish sizes do not follow player growth');
  assert.deepEqual(distribution(seed,0,'duo'),opening,'A second player does not change size selection');
  assert.deepEqual(distribution(seed,6,'duo',240),opening,'Outside sea events, elapsed time does not change size selection');
  assert.equal(new Set(opening).size,t.get().species.length,'All fixed fish sizes can appear at level one');
  const big=opening.filter(r=>r>=55).length/opening.length;
  const small=opening.filter(r=>r<=18).length/opening.length;
  assert.ok(big>.16&&big<.24,'Large encounters are reduced to about 20 percent');
  assert.ok(small>.40&&small<.50,'Small prey remains available');
  rates.push({seed,largeFishPercent:Math.round(big*100),smallFishPercent:Math.round(small*100)});
  const rush=distribution(seed,0,'solo',135);
  assert.ok(rush.filter(r=>r>=55).length>opening.filter(r=>r>=55).length,'Hunting tides increase large-fish encounters');
}

for(const width of [1100,350,600])for(const mode of ['solo','duo'])for(const seed of [7,42,2026]){
  viewport.width=width;t.resize();t.setMode(mode);setRandom(seeded(seed));t.start();
  const g=t.get(),limit=width<650?1:2;
  assert.equal(g.fish.length,12);
  assert.ok(g.fish.filter(f=>f.r>=55).length>=1&&g.fish.filter(f=>f.r>=55).length<=limit,'Opening large fish are capped');

  assert.ok(g.fish.filter(f=>f.r<=18).length>=3,'Every opening has small prey');
  for(const f of g.fish)for(const p of g.players){
    assert.ok(Math.hypot(f.x-p.x,f.y-p.y)>=t.screenRadius(f.r+p.r)+100,'Opening fish do not overlap either player or the safety buffer');
  }
  for(let i=0;i<100;i++)t.spawn();
  assert.ok(t.get().fish.filter(f=>f.r>=100).length<=1,'One giant maximum');assert.ok(t.get().fish.filter(f=>f.r>=55).length<=limit,'All large fish share a density cap');
}
setRandom(Math.random);
console.log(JSON.stringify({status:'PASS',version:'v1.2',spawnRates:rates}));
console.log('PASS: fixed size distribution, early large fish, all sizes at level one, opening safety, small prey, giant caps, duo independence and hunting tides.');

import assert from 'node:assert/strict';
import {t,viewport} from './check-game.mjs';
viewport.width=1100;viewport.height=520;t.resize();t.start();t.clearFish();
for(const species of t.get().species)for(const dir of [-1,1]){
  t.spawn(true,species);const f=t.get().fish.at(-1);Object.assign(f,{x:500,y:200,baseY:200,dir});
  const initialY=f.y;
  for(const elapsed of [0,50,135,240]){t.setElapsed(elapsed);const x=f.x;t.moveFish(f,.1);assert.equal(Math.sign(f.x-x),dir);assert.equal(f.y,initialY);assert.equal(f.baseY,initialY);assert.equal(f.dir,dir);}
}
for(const type of [0,1])for(const dir of [-1,1]){
  t.spawnSpecial(type);const f=t.get().specials.at(-1);Object.assign(f,{x:500,y:200,baseY:200,dir});
  for(let i=0;i<100;i++){const x=f.x;t.moveSpecial(f,.1);assert.equal(Math.sign(f.x-x),dir);assert.equal(f.y,200);assert.equal(f.dir,dir);}
}
console.log('PASS: every fish size and both special species stay at a fixed height and continue in one horizontal direction, including currents and hunting tides.');

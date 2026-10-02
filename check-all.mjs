import {spawnSync} from 'node:child_process';
for(const args of [['--check','docs/game.js'],['check-spawns.mjs'],['check-challenge.mjs'],['check-duo.mjs'],['check-independent.mjs'],['check-review.mjs'],['check-soak.mjs']]){
  const result=spawnSync(process.execPath,args,{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
console.log('PASS: all gameplay, interaction, independent outcomes, rendering and soak checks.');

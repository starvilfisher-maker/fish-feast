import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const original=fs.readFileSync('docs/game.js','utf8');
const source=original.replace(/\}\)\(\);\s*$/,`globalThis.qa={sprite,draw,spawnSpecial,atlas,extraAtlas,specialAtlas};})();`);
function setup(){
  const images=[],calls=[],elements=new Map();
  const ctx=new Proxy({}, {get:(target,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):target[key]||((...args)=>calls.push([key,...args])),set:(target,key,value)=>{target[key]=value;calls.push([key,value]);return true;}});
  const element=id=>{if(!elements.has(id))elements.set(id,{style:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(){},getBoundingClientRect:()=>({width:390,height:360,left:0,top:0}),getContext:()=>ctx});return elements.get(id);};
  const sandbox={console,Image:class{constructor(){images.push(this);}},ResizeObserver:class{observe(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},window:{devicePixelRatio:2,addEventListener(){}},document:{getElementById:element,querySelector:()=>element('label'),addEventListener(){}}};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);
  const load=(image,width=1536,height=1024)=>{image.naturalWidth=width;image.naturalHeight=height;image.complete=true;image.onload();};
  return {t:sandbox.qa,images,calls,load};
}
function assertFallback(g,index,extra){
  g.calls.length=0;g.t.sprite(index,100,100,20,1,0,extra);
  assert.ok(g.calls.some(([key])=>key==='fill'),'Fish are drawn before images arrive');
  assert.ok(!g.calls.some(([key])=>key==='drawImage'||key==='fillText'),'Unavailable species never borrow another atlas or an emoji');
  return JSON.stringify(g.calls);
}
// Slow mobile loading: every species remains distinct, then switches to its own atlas.
const pending=setup(),fallbacks=new Set();
for(const extra of [false,true])for(let i=0;i<6;i++)fallbacks.add(assertFallback(pending,i,extra));
assert.equal(fallbacks.size,12,'All twelve player/species fallback drawings have different visual commands');
pending.load(pending.images[0]);
assertFallback(pending,0,true);
pending.calls.length=0;pending.t.sprite(2,100,100,20,1);
assert.equal(pending.calls.find(([key])=>key==='drawImage')[1],pending.images[0]);
pending.load(pending.images[2]);
for(let i=0;i<6;i++){
  pending.calls.length=0;pending.t.sprite(i,100,100,20,-1,0,true);
  const [,image,sx,sy,sw,sh]=pending.calls.find(([key])=>key==='drawImage');
  assert.equal(image,pending.images[2],'Extra fish use only their own atlas');
  assert.ok(sx>=0&&sy>=0&&sx+sw<=image.naturalWidth&&sy+sh<=image.naturalHeight);
}
pending.load(pending.images[1],1774,887);pending.t.spawnSpecial(0);pending.t.draw();
assert.ok(pending.calls.some(([key,image])=>key==='drawImage'&&image===pending.images[1]),'Special creatures use their separate atlas');
// Missing base artwork does not prevent extra species from using their loaded artwork.
const partial=setup();partial.load(partial.images[2]);assertFallback(partial,1,false);
partial.calls.length=0;partial.t.sprite(3,100,100,20,1,0,true);
assert.equal(partial.calls.find(([key])=>key==='drawImage')[1],partial.images[2]);
// Unsupported WebP or network error falls back to PNG; a failed PNG retries once.
const errors=setup();errors.images[0].onerror();
const png=errors.images.at(-1);assert.equal(png.src,'fish-atlas.png');errors.load(png);
errors.calls.length=0;errors.t.sprite(3,100,100,20,1);
assert.equal(errors.calls.find(([key])=>key==='drawImage')[1],png);
errors.images[2].onerror();const firstPng=errors.images.at(-1);firstPng.onerror();
const retry=errors.images.at(-1);assert.match(retry.src,/more-fish-atlas\.png\?.*retry=1/);
const count=errors.images.length;retry.onerror();assert.equal(errors.images.length,count,'Retries stop after three requests per atlas');assertFallback(errors,5,true);
// Invalid/undecoded images never reach drawImage.
const invalid=setup();invalid.load(invalid.images[0],0,0);assert.equal(invalid.images.at(-1).src,'fish-atlas.png');assertFallback(invalid,4,false);
for(const name of ['fish-atlas','more-fish-atlas','special-atlas']){
  const webp=fs.readFileSync(`docs/${name}.webp`),png=fs.readFileSync(`docs/${name}.png`);
  assert.equal(webp.toString('ascii',0,4),'RIFF');assert.equal(webp.toString('ascii',8,12),'WEBP');
  assert.ok(webp.length<png.length*.3,'Mobile artwork stays under 30% of the original download');
}
console.log('PASS: twelve distinct fallbacks, late/partial image loading, correct species crops, WebP-to-PNG recovery, bounded retries and compressed mobile artwork.');

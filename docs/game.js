'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('ocean'), ctx = canvas.getContext('2d'), gameShell=$('gameShell');
  const fullscreenTarget=document.documentElement||gameShell;
  const atlas = new Image(); atlas.src = 'fish-atlas.png';
  const specialAtlas = new Image(); specialAtlas.src = 'special-atlas.png';
  const extraAtlas = new Image(); extraAtlas.src = 'more-fish-atlas.png';
  const extraCrops = [[0,0,512,465],[512,0,512,480],[1024,0,512,480],[0,465,512,559],[512,480,496,544],[1008,480,528,544]];
  const names = ['海底新朋友','灵巧小猎手','珊瑚探索家','深海冒险家','海洋大玩家','海域守护者','巨浪征服者','深海巨无霸','远洋霸主','海洋之王'];
  const thresholds = [0,32,88,180,312,480,710,1010,1400,1900], sizes = [20,27,36,47,62,82,103,128,153,180];
  const MAX_LEVEL=names.length-1;
  const zones=['≈ 浅海 · 第一段旅程','≈ 珊瑚海 · 渐渐长大','≈ 蓝海 · 探索更远','≈ 深海 · 勇敢前行','≈ 远洋 · 迎接挑战','≈ 暗礁海 · 巨兽出没','≈ 洋流带 · 征服巨浪','≈ 深海沟 · 巨无霸之旅','≈ 无尽海 · 远洋霸主','≈ 海洋 · 你的主场'];
  const specialTypes = [
    {name:'星光水母',sprite:0,bonus:.65,color:'#d8b7ff',speed:66},
    {name:'金色海马',sprite:1,bonus:1,color:'#ffe18a',speed:92}
  ];
  const species = [
    {name:'蓝尾鱼',sprite:1,r:12,score:1,speed:42},
    {name:'粉红鱼',sprite:2,r:18,score:2,speed:51},
    {name:'小丑鱼',sprite:0,extra:true,r:15,score:2,speed:54},
    {name:'蝶鱼',sprite:1,extra:true,r:24,score:3,speed:47},
    {name:'河豚',sprite:2,extra:true,r:30,score:5,speed:35},
    {name:'蓝纹鱼',sprite:3,r:28,score:4,speed:62},
    {name:'神仙鱼',sprite:4,extra:true,r:38,score:6,speed:58},
    {name:'灯笼鱼',sprite:4,r:40,score:8,speed:70},
    {name:'狮子鱼',sprite:3,extra:true,r:52,score:10,speed:53},
    {name:'赤鲨',sprite:5,r:55,score:12,speed:77},
    {name:'赤鲨',sprite:5,r:70,score:18,speed:84},
    {name:'锤头鲨',sprite:5,extra:true,r:90,score:24,speed:91},
    {name:'巨型赤鲨',sprite:5,r:110,score:32,speed:82},
    {name:'巨型锤头鲨',sprite:5,extra:true,r:130,score:45,speed:85},
    {name:'深海巨鲨',sprite:5,extra:true,r:160,score:65,speed:78}
  ];
  const makePlayer=(id,x,y)=>({id,x,y,r:sizes[0],dir:id===1?1:-1,score:0,level:0,lives:3,invulnerable:2,shieldTime:0,slowTime:0,dashTime:0,dashCooldown:0,combo:0,comboTime:0,bestCombo:0,pointer:null,outcome:'playing',finishedAt:null});
  let state='ready', W=1100,H=520,last=0,clock=0,elapsed=0,mode='solo';
  let player=makePlayer(1,550,270),players=[player];
  let fish=[],particles=[],popups=[],spawnClock=0,keys=new Set(),touchDirections=new Map();
  const directionButtons=[['touchUp','w'],['touchLeft','a'],['touchDown','s'],['touchRight','d']];
  let expanded=false,fullscreenBusy=false,orientationLocked=false;
  let rotated=false,joystickPointer=null,joystickVector={x:0,y:0},controlMode='joystick';
  try{if(window.localStorage?.getItem('fish-feast-control')==='buttons')controlMode='buttons';}catch{}
  let specials=[],specialClock=0,nextSpecial=25;
  let pickups=[],pickupClock=0,nextPickup=18;
  let sizeScale=1;
  let soundEnabled=false,audioContext=null,toastTimer=0,dragging=false;
  const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const bubbles=Array.from({length:35},()=>({x:Math.random(),y:Math.random(),r:rand(1.3,4.5),speed:rand(.01,.045)}));
  const screenRadius=r=>r*sizeScale;
  const activePlayers=()=>players.filter(p=>p.outcome==='playing');
  const oceanLevel=()=>Math.max(0,...(activePlayers().length?activePlayers():players).map(p=>p.level));
  const pressure=()=>Math.min(1.5,oceanLevel()*.08+elapsed/240);
  function seaEvent(){const phase=Math.floor(elapsed/45);return phase>0&&elapsed%45<10?{kind:phase%3===0?'rush':'current',dir:phase%2?1:-1}:null;}
  const inflated=f=>state!=='ready'&&f.name==='河豚'&&(elapsed+f.phase*2)%10<2.7;
  const fishRadius=f=>f.r*(inflated(f)?1.35:1);
  const canEat=(f,p=player)=>!inflated(f)&&fishRadius(f)<=p.r*.9;
  const dangerous=(f,p=player)=>inflated(f)||fishRadius(f)>p.r*1.08;
  function confinePlayer(p=player){const r=screenRadius(p.r);p.x=clamp(p.x,r*1.2,W-r*1.2);p.y=clamp(p.y,r*.8+10,H-r*.8-8);}
  function clearJoystick(){joystickPointer=null;joystickVector={x:0,y:0};$('joystickKnob').style.transform='translate(0px,0px)';}
  function clearTouch(){touchDirections.clear();clearJoystick();for(const [id] of directionButtons)$(id).setAttribute('aria-pressed','false');}
  function clearInput(){keys.clear();clearTouch();dragging=false;players.forEach(p=>p.pointer=null);}
  function resize(){const box=canvas.getBoundingClientRect();const oldW=W,oldH=H;W=Math.max(1,rotated?box.height:box.width);H=Math.max(1,rotated?box.width:box.height);if(W!==oldW||H!==oldH)clearInput();sizeScale=Math.max(.01,Math.min(1,(W-24)/(sizes[MAX_LEVEL]*2.8),(H-40)/(sizes[MAX_LEVEL]*2.3)));const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);players.forEach(p=>{p.x=p.x/oldW*W;p.y=p.y/oldH*H;p.pointer=null;confinePlayer(p);});fish.forEach(f=>{f.x=f.x/oldW*W;f.y=f.y/oldH*H;f.baseY=f.baseY/oldH*H;});specials.forEach(f=>{f.x=f.x/oldW*W;f.y=f.y/oldH*H;f.baseY=f.baseY/oldH*H;});pickups.forEach(p=>{p.x=p.x/oldW*W;p.y=p.y/oldH*H;p.baseY=p.baseY/oldH*H;});}
  new ResizeObserver(resize).observe(canvas);
  function spawn(initial=false,forced=null){
    const giantCount=fish.filter(f=>f.r>=100).length,largeCount=fish.filter(f=>f.r>=55).length;
    // Fixed size groups keep the ocean independent of either player's growth.
    const rush=seaEvent()?.kind==='rush',roll=Math.random();
    const small=roll<(rush?.35:.45),medium=roll<(rush?.65:.80),large=roll<(rush?.94:.96);
    const largeLimit=(W<650?1:2)+(rush?1:0);
    const pool=species.filter(s=>small?s.r<=18:medium||largeCount>=largeLimit?s.r>18&&s.r<55:large||giantCount>=1?s.r>=55&&s.r<100:s.r>=100);
    const s=forced||pool[Math.floor(rand(0,pool.length))],dir=Math.random()<.5?1:-1,fr=screenRadius(s.r);
    let x=initial?rand(30,W-30):(dir===1?-fr*3:W+fr*3),y=rand(fr*.82+38,H-fr*.82-20);
    if(initial&&players.some(p=>Math.hypot(x-p.x,y-p.y)<fr+screenRadius(p.r)+100)){x=dir===1?-fr*3:W+fr*3;}
    fish.push({...s,x,y,baseY:y,dir,phase:rand(0,6.28),speed:s.speed*rand(.85,1.3),wobble:rand(3,12)});
  }
  function populate(){
    fish=[];
    for(const s of species.filter(s=>s.r<=18))spawn(true,s);
    for(const r of [24,28,38,55])spawn(true,species.find(s=>s.r===r));
    while(fish.length<12)spawn(true);
  }
  function spawnSpecial(typeIndex=Math.random()<.75?0:1){
    const type=specialTypes[typeIndex],dir=Math.random()<.5?1:-1,x=dir===1?-60:W+60,y=rand(75,H-65);
    specials.push({...type,x,y,baseY:y,r:17,dir,phase:rand(0,6.28),wobble:typeIndex===0?14:7});
    toast(`${type.name}游来了！游走前吃到它`);
    tone(820,.16);
  }
  function moveSpecial(f,dt){
    f.x+=f.dir*f.speed*(seaEvent()?.kind==='current'?1.2:1)*dt;
    f.y=f.baseY;
  }
  function moveFish(f,dt){
    const active=state==='playing';
    let speed=f.speed*(active?1+pressure()*.32:1)*(seaEvent()?.kind==='current'?1.2:1);
    f.x+=f.dir*speed*dt;f.y=f.baseY;
  }
  function dash(p=player){if(state!=='playing'||p.outcome!=='playing'||p.dashCooldown>0)return false;p.dashTime=.7;p.dashCooldown=6;tone(420,.12);return true;}
  function spawnPickup(){
    const target=activePlayers()[0]||player,x=target.x<W/2?W*.75:W*.25,y=rand(75,H-70);
    pickups.push({kind:'shield',x,y,baseY:y,r:18,dir:Math.random()<.5?1:-1,phase:rand(0,6.28),life:15});
  }
  function collectPickup(p,who=player){
    if(who.outcome!=='playing'||p.kind!=='shield')return;
    who.shieldTime=8;toast(`${who.id}P 获得护盾！8秒内抵挡一次伤害`);
    burst(p.x,p.y,'#a8efff',16);tone(760,.15);ui();
  }
  function hit(reason,poison=false,p=player){
    if(state!=='playing'||p.outcome!=='playing'||p.invulnerable>0)return false;
    p.combo=0;p.comboTime=0;
    if(p.shieldTime>0){p.shieldTime=0;p.invulnerable=.9;burst(p.x,p.y,'#a8efff',22);toast(`${p.id}P 护盾挡住了一次伤害！`);ui();return true;}
    p.lives--;p.invulnerable=1.6;p.dashTime=0;if(poison)p.slowTime=2;
    burst(p.x,p.y,'#ffb2a0',20);tone(130,.2,'triangle');ui();
    if(p.lives<=0)finishPlayer(p,false);else toast(`${p.id}P ${reason}`);return true;
  }
  function ui(){
    for(const p of players){
      const suffix=p.id===1?'':'2';
      $('score'+suffix).textContent=p.score;$('level'+suffix).textContent=p.level+1;$('levelName'+suffix).textContent=p.outcome==='over'?'已出局':p.outcome==='won'?'已通关 · 海洋之王':names[p.level];
      $('lives'+suffix).textContent=Array.from({length:3},(_,i)=>i<p.lives?'♥':'♡').join(' ');$('lives'+suffix).setAttribute('aria-label',`${p.id}P剩余${p.lives}条生命`);
      const base=thresholds[p.level],target=thresholds[Math.min(p.level+1,MAX_LEVEL)],progress=p.level===MAX_LEVEL?100:clamp((p.score-base)/(target-base)*100,0,100);
      $('growthFill'+suffix).style.width=progress+'%';$('growth'+suffix).setAttribute('aria-valuenow',Math.round(progress));
      $('growthText'+suffix).textContent=p.outcome==='over'?'已出局':p.outcome==='won'?'已通关':`${p.score-base} / ${target-base}`;
      $('comboStatus'+suffix).textContent=p.outcome!=='playing'?`${p.id}P ${p.outcome==='won'?'已通关':'已出局'} · 用时 ${formatTime(p.finishedAt)}`:p.combo>=2?`${p.id}P ${p.combo} 连吃 · 最高 ${p.bestCombo}`:p.id===2?'方向键移动 · Shift冲刺':'连吃5条鱼可刷新冲刺';
      $('shieldStatus'+suffix).hidden=p.shieldTime<=0;$('shieldStatus'+suffix).textContent=`护盾 ${Math.ceil(p.shieldTime)}s`;
      $('slowStatus'+suffix).hidden=p.slowTime<=0;
      $('dash'+suffix).disabled=state!=='playing'||p.outcome!=='playing'||p.dashCooldown>0;$('dash'+suffix).textContent=p.outcome!=='playing'?`${p.id}P ${p.outcome==='won'?'已通关':'已出局'}`:p.dashCooldown>0?`${mode==='duo'?p.id+'P ':''}冲刺 ${Math.ceil(p.dashCooldown)}s`:`${mode==='duo'?p.id+'P ':''}冲刺 · ${p.id===2?'Shift':'空格'}`;
      $('dash'+suffix).title=mode==='solo'?'空格或Shift冲刺，冷却6秒':`${p.id}P ${p.id===2?'Shift':'空格'}冲刺，冷却6秒`;
    }
    $('time').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
    const duo=mode==='duo';$('partnerPanel').hidden=!duo;$('partnerGrowth').hidden=!duo;
    $('growthLabel').textContent=duo?'1P 下一次成长':'下一次成长';$('growthTarget').textContent=duo?'独立成长，独立胜负':'目标：成为 10 级海洋之王';
    document.querySelector('.level-caption').textContent=duo?'1P · 金色 · WASD':'成长等级';
    $('fieldHint').textContent=duo?'1P 金色 · WASD + 空格　|　2P 蓝色 · 方向键 + Shift':'你是金色的小鱼 ◆';
    canvas.setAttribute('aria-label',duo?'双人游戏区域，各自独立胜负。1P用WASD，空格冲刺；2P用方向键，Shift冲刺。P暂停。':'游戏区域。移动鼠标、方向键或WASD控制小鱼。空格冲刺，P暂停。');
    $('soloMode').setAttribute('aria-pressed',String(!duo));$('duoMode').setAttribute('aria-pressed',String(duo));
    $('modeHelp').textContent=duo?'1P WASD + 空格；2P 方向键 + Shift。各3生命，不可补充；各自10级通关，一人出局或通关，另一人继续。':'鼠标 / 键盘；手机按住方向键或拖动，支持横屏。3条生命，不可补充';
    $('modePicker').hidden=state==='paused';$('modeHelp').hidden=state==='paused';
    const mobile=window.matchMedia?.('(pointer: coarse), (max-width: 850px), (max-width: 1200px) and (max-height: 600px) and (orientation: landscape)')?.matches??W<580;
    gameShell.setAttribute('data-mode',mode);gameShell.setAttribute('data-state',state);
    gameShell.setAttribute('data-controls',controlMode);
    $('directionPad').hidden=controlMode!=='buttons';$('joystick').hidden=controlMode!=='joystick';
    $('joystick').disabled=state!=='playing'||player.outcome!=='playing';
    $('controlSwitch').textContent=controlMode==='joystick'?'切换方向键':'切换圆盘';
    $('controlSwitch').setAttribute('aria-pressed',String(controlMode==='buttons'));
    $('mobileHint').innerHTML=controlMode==='joystick'?'圆盘可向任意角度游动<br>可同时按冲刺':'按住方向按钮游动<br>可同时按冲刺';
    $('fieldHint').hidden=state!=='playing';$('touchPause').hidden=!mobile||state!=='playing';
    for(const [id] of directionButtons)$(id).disabled=state!=='playing'||player.outcome!=='playing';
    $('touchDash').disabled=$('dash').disabled;
    $('touchDashLabel').textContent=player.outcome==='playing'?'冲刺':player.outcome==='won'?'已通关':'已出局';
    $('touchCooldown').textContent=state==='paused'?'已暂停':state!=='playing'?'开始后可用':player.dashCooldown>0?Math.ceil(player.dashCooldown)+'秒':'就绪';
    $('pause').title=state==='paused'?'继续游戏（P）':'暂停游戏（P）';
    document.querySelector('.ocean-label').textContent=zones[oceanLevel()];
    const event=seaEvent();$('eventStatus').textContent=event?(event.kind==='rush'?'猎食潮 · 小心捕食者':`急流向${event.dir>0?'右':'左'} · 注意漂移`):'平静海域';
    $('eventStatus').classList.toggle('active',!!event);
  }
  function setMode(value){if(!['solo','duo'].includes(value)||!['ready','won','over'].includes(state))return;const finished=state==='won'||state==='over';mode=value;players=[makePlayer(1,W*(mode==='duo'?.35:.5),H*.5)];player=players[0];if(mode==='duo')players.push(makePlayer(2,W*.65,H*.5));if(finished){state='ready';elapsed=0;spawnClock=0;specials=[];specialClock=0;pickups=[];pickupClock=0;particles=[];popups=[];clearInput();clearTimeout(toastTimer);$('toast').classList.remove('visible');populate();showOverlay('准备好探索海底了吗？','从小鱼，到海洋之王。','吃掉比你小的鱼，躲开比你大的鱼。每一口，都是成长。','开始游玩','吃小鱼长大，目标10级');}ui();}
  function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),1900);}
  function tone(freq,duration=.09,type='sine',gain=.045){if(!soundEnabled)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type=type;o.frequency.setValueAtTime(freq,audioContext.currentTime);g.gain.setValueAtTime(gain,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration);}catch{}}
  function start(){elapsed=0;spawnClock=0;specials=[];specialClock=0;nextSpecial=25;pickups=[];pickupClock=0;nextPickup=18;particles=[];popups=[];clearTimeout(toastTimer);$('toast').classList.remove('visible');players=[makePlayer(1,W*(mode==='duo'?.35:.5),H*.5)];player=players[0];if(mode==='duo')players.push(makePlayer(2,W*.65,H*.5));clearInput();populate();state='playing';$('overlay').hidden=true;$('pause').disabled=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','暂停游戏');$('fieldHint').hidden=false;canvas.focus({preventScroll:true});ui();tone(520);}
  function showOverlay(eyebrow,title,text,button,note=''){ $('overlayEyebrow').textContent=eyebrow;$('overlayTitle').textContent=title;$('overlayText').textContent=text;$('start').innerHTML=button+' <span>▷</span>';$('startNote').textContent=note;$('overlay').hidden=false;$('overlay').scrollTop=0;}
  function formatTime(seconds){return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(Math.floor(seconds%60)).padStart(2,'0');}
  function summary(){return players.map(p=>`${mode==='duo'?p.id+'P · ':''}${p.outcome==='won'?'已通关':p.outcome==='over'?'已出局':'游动中'} · 得分 ${p.score} · 等级 ${p.level+1} · 最高连吃 ${p.bestCombo} · 用时 ${formatTime(p.finishedAt??elapsed)}`).join('；');}
  function pause(){if(state==='playing'){state='paused';clearInput();showOverlay('休息一下，海洋等你','暂停游动',summary(),'继续游戏','按 P 或点击按钮继续');$('pause').textContent='▷';$('pause').setAttribute('aria-label','继续游戏');}else if(state==='paused'){state='playing';$('overlay').hidden=true;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','暂停游戏');canvas.focus({preventScroll:true});}ui();}
  function finishPlayer(p,win){
    if(p.outcome!=='playing')return;
    p.outcome=win?'won':'over';p.finishedAt=elapsed;p.pointer=null;p.shieldTime=0;p.slowTime=0;p.dashTime=0;p.comboTime=0;p.combo=0;if(p.id===1)clearTouch();
    toast(`${p.id}P ${win?'已通关！':'已出局。'}${activePlayers().length?'另一位玩家继续游动':''}`);
    ui();if(activePlayers().length===0)finish(players.some(who=>who.outcome==='won'));
  }
  function finish(win){state=win?'won':'over';clearInput();$('pause').disabled=true;ui();showOverlay(mode==='duo'?'各自的旅程，各自的成绩':win?'第十级 · 成长完成':'每一次探索，都是新的成长',mode==='duo'?'本局游动结束':win?'你是海洋之王！':'这次旅程结束了',summary(),'再游一次',mode==='duo'?'两人的胜负分别结算，下一局重新出发。':win?'从小鱼到大鱼，你做到了。':'先找体型更小的鱼，慢慢长大。');tone(win?880:150,.3);}
  function burst(x,y,color,count=12){for(let i=0;i<count;i++)particles.push({x,y,vx:rand(-80,80),vy:rand(-80,80),life:.7,max:.7,r:rand(2,5),color});}
  function eat(f,p=player){
    if(state!=='playing'||p.outcome!=='playing')return;
    const gain=f.bonus?Math.ceil((thresholds[p.level+1]-thresholds[p.level])*f.bonus):f.score;
    p.score+=gain;burst(f.x,f.y,f.color||'#c5fff1',f.bonus?24:12);popups.push({x:f.x,y:f.y,text:(mode==='duo'?p.id+'P ':'')+(f.bonus?'成长 +':'+')+gain,life:1,color:f.color||'#dcfff1'});tone(580+Math.min(p.score,120)*4);
    if(f.bonus)toast(`${p.id}P ${f.name}！成长值 +${gain}`);
    else{p.combo=p.comboTime>0?p.combo+1:1;p.comboTime=3;p.bestCombo=Math.max(p.bestCombo,p.combo);if(p.combo%5===0){p.dashCooldown=0;toast(`${p.id}P ${p.combo} 连吃！冲刺已就绪`);}}
    while(p.level<MAX_LEVEL&&p.score>=thresholds[p.level+1]){p.level++;p.r=sizes[p.level];p.invulnerable=Math.max(p.invulnerable,1.3);burst(p.x,p.y,'#ffd76e',24);toast(`${p.id}P 升级！${p.level+1}级 · ${names[p.level]}`);tone(940,.18);}
    const fraction=p.level===MAX_LEVEL?0:clamp((p.score-thresholds[p.level])/(thresholds[p.level+1]-thresholds[p.level]),0,1);
    p.r=sizes[p.level]+(sizes[Math.min(p.level+1,MAX_LEVEL)]-sizes[p.level])*fraction;
    confinePlayer(p);ui();if(p.level===MAX_LEVEL)finishPlayer(p,true);
  }
  function update(dt){
    clock+=dt;for(const b of bubbles){b.y-=b.speed*dt;if(b.y<-.02){b.y=1.05;b.x=Math.random();}}
    if(state==='paused'||state==='won'||state==='over')return;
    if(state==='playing'){
      elapsed+=dt;for(const p of activePlayers()){for(const timer of ['invulnerable','shieldTime','slowTime','dashTime','dashCooldown','comboTime'])p[timer]=Math.max(0,p[timer]-dt);if(p.comboTime===0)p.combo=0;}
    }
    for(let i=fish.length-1;i>=0;i--){const f=fish[i];moveFish(f,dt);if(f.x<-screenRadius(f.r)*4||f.x>W+screenRadius(f.r)*4)fish.splice(i,1);}
    spawnClock+=dt;if(spawnClock>(state==='playing'?Math.max(.45,.75-pressure()*.18):.95)&&fish.length<(W<580?24:34)){spawn();spawnClock=0;}
    if(state==='ready')return;
    specialClock+=dt;
    if(specialClock>=nextSpecial&&specials.length===0){spawnSpecial();specialClock=0;nextSpecial=rand(35,50);}
    for(const f of specials)moveSpecial(f,dt);
    specials=specials.filter(f=>f.x>-90&&f.x<W+90);
    pickupClock+=dt;if(pickupClock>=nextPickup&&pickups.length===0){spawnPickup();pickupClock=0;nextPickup=rand(26,38);}
    for(const p of pickups){p.life-=dt;p.x+=p.dir*20*dt;p.y=p.baseY+Math.sin(clock*2+p.phase)*9;}pickups=pickups.filter(p=>p.life>0&&p.x>-40&&p.x<W+40);
    for(const p of activePlayers()){
      const arrows=p.id===2||mode==='solo',letters=p.id===1;
      const held=key=>keys.has(key)||(p.id===1&&Array.from(touchDirections.values()).includes(key));
      const keyX=(arrows&&held('arrowright')||letters&&held('d')?1:0)-(arrows&&held('arrowleft')||letters&&held('a')?1:0),keyY=(arrows&&held('arrowdown')||letters&&held('s')?1:0)-(arrows&&held('arrowup')||letters&&held('w')?1:0);
      const moveSpeed=(230+p.level*8)*(p.dashTime>0?1.8:1)*(p.slowTime>0?.55:1);
      if(p.id===1&&Math.hypot(joystickVector.x,joystickVector.y)>0){p.x+=joystickVector.x*moveSpeed*dt;p.y+=joystickVector.y*moveSpeed*dt;p.pointer=null;if(Math.abs(joystickVector.x)>.05)p.dir=joystickVector.x>0?1:-1;}
      else if(keyX||keyY){const n=Math.hypot(keyX,keyY);p.x+=keyX/n*moveSpeed*dt;p.y+=keyY/n*moveSpeed*dt;p.pointer=null;if(keyX)p.dir=keyX>0?1:-1;}
      else if(p.pointer){const dist=Math.hypot(p.pointer.x-p.x,p.pointer.y-p.y);if(dist>3){const step=Math.min(dist,moveSpeed*dt);const dx=(p.pointer.x-p.x)/dist;p.x+=dx*step;p.y+=(p.pointer.y-p.y)/dist*step;if(Math.abs(dx)>.05)p.dir=dx>0?1:-1;}}
      else if(p.dashTime>0)p.x+=p.dir*moveSpeed*dt;
      const event=seaEvent();if(event?.kind==='current')p.x+=(W<580?26:45)*event.dir*dt;
      confinePlayer(p);
    }
    // A shared creature or item belongs to the closest eligible player and is consumed once.
    const nearest=(item,eligible)=>eligible.sort((a,b)=>Math.hypot(item.x-a.x,item.y-a.y)-Math.hypot(item.x-b.x,item.y-b.y))[0];
    for(let i=pickups.length-1;i>=0;i--){const item=pickups[i],who=nearest(item,activePlayers().filter(p=>Math.hypot(item.x-p.x,item.y-p.y)<item.r+screenRadius(p.r)*.8));if(who){pickups.splice(i,1);collectPickup(item,who);}}
    for(let i=specials.length-1;i>=0;i--){const f=specials[i],who=nearest(f,activePlayers().filter(p=>((f.x-p.x)/((f.r+screenRadius(p.r))*1.05))**2+((f.y-p.y)/((f.r+screenRadius(p.r))*.75))**2<1));if(who){specials.splice(i,1);eat(f,who);if(state!=='playing')break;}}
    if(state!=='playing')return;
    for(let i=fish.length-1;i>=0;i--){
      const f=fish[i],touching=activePlayers().filter(p=>{const rx=screenRadius(fishRadius(f)+p.r)*1.05,ry=screenRadius(fishRadius(f)+p.r)*.60;return ((f.x-p.x)/rx)**2+((f.y-p.y)/ry)**2<1;});
      const who=nearest(f,touching.filter(p=>canEat(f,p)));
      if(who){fish.splice(i,1);eat(f,who);}
      else for(const p of touching){if(dangerous(f,p))hit(inflated(f)?'河豚鼓起了！小心尖刺':f.name==='狮子鱼'?'被狮子鱼刺伤！减速2秒':'小心捕食者！短暂无敌中',f.name==='狮子鱼',p);if(state!=='playing')break;}
      if(state!=='playing')break;
    }
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
    for(const p of popups){p.y-=35*dt;p.life-=dt;}popups=popups.filter(p=>p.life>0);
    ui();
  }
  function sprite(index,x,y,r,dir,phase=0,extra=false){
    ctx.save();ctx.translate(x,y);ctx.scale(dir,1);ctx.rotate(Math.sin(clock*2+phase)*.035);
    if(extra&&extraAtlas.complete&&extraAtlas.naturalWidth){const crop=extraCrops[index];ctx.drawImage(extraAtlas,...crop,-r*1.55,-r*1.05,r*3.1,r*2.1);}
    else if(atlas.complete&&atlas.naturalWidth){const sw=atlas.naturalWidth/3,sh=atlas.naturalHeight/2;ctx.drawImage(atlas,(index%3)*sw,Math.floor(index/3)*sh,sw,sh,-r*1.85,-r*1.23,r*3.7,r*2.46);}
    else{ctx.font=`${r*2.4}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.scale(-1,1);ctx.fillText(index===0?'🐠':'🐟',0,0);}
    ctx.restore();
  }
  function draw(){
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#52cbd3');bg.addColorStop(.45,'#198fac');bg.addColorStop(1,'#12516f');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=.045;ctx.fillStyle='#e3ffff';for(let i=0;i<6;i++){const x=i*W/5+Math.sin(clock*.12+i)*20;ctx.beginPath();ctx.moveTo(x-25,0);ctx.lineTo(x+35,0);ctx.lineTo(x+200,H);ctx.lineTo(x-10,H);ctx.fill();}ctx.restore();
    for(const b of bubbles){ctx.strokeStyle='#b4f5fa35';ctx.lineWidth=1;ctx.beginPath();ctx.arc(b.x*W,b.y*H,b.r,0,Math.PI*2);ctx.stroke();}
    for(const f of fish){
      const r=screenRadius(fishRadius(f));
      sprite(f.sprite,f.x,f.y,r,f.dir,f.phase,f.extra);
      const visible=f.x+r*1.55>0&&f.x-r*1.55<W;
      if(visible&&f.r>=100){ctx.fillStyle='#ffb6a8';ctx.font='600 14px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(f.name,clamp(f.x,65,W-65),f.y-r*.95-9);}
      if(visible&&inflated(f)){ctx.fillStyle='#ffdf8b';ctx.font='700 14px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText('鼓起！别碰',clamp(f.x,65,W-65),f.y-r*1.1-12);}
    }
    for(const f of specials){
      ctx.save();
      if(specialAtlas.complete&&specialAtlas.naturalWidth){const sw=specialAtlas.naturalWidth/2,sh=specialAtlas.naturalHeight;ctx.save();ctx.translate(f.x,f.y);ctx.scale(f.dir*(1+Math.sin(clock*3+f.phase)*.025),1+Math.cos(clock*3+f.phase)*.025);ctx.drawImage(specialAtlas,f.sprite*sw,0,sw,sh,-f.r*1.9,-f.r*2.3,f.r*3.8,f.r*4.6);ctx.restore();}
      else{ctx.font='30px sans-serif';ctx.textAlign='center';ctx.fillText(f.sprite===0?'🪼':'✨',f.x,f.y+10);}
      ctx.shadowBlur=0;ctx.fillStyle=f.color;ctx.textAlign='center';ctx.font='600 14px "Microsoft YaHei",sans-serif';if(f.x+f.r*1.9>0&&f.x-f.r*1.9<W)ctx.fillText(f.name,clamp(f.x,60,W-60),f.y-f.r*2.4-7);ctx.restore();
    }
    for(const p of pickups){ctx.save();ctx.globalAlpha=p.life<3?.5+.5*Math.abs(Math.sin(clock*5)):1;ctx.fillStyle='#daf7ff';ctx.strokeStyle='#96e4ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,22,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#288db1';ctx.textAlign='center';ctx.font='700 25px sans-serif';ctx.fillText('◇',p.x,p.y+9);ctx.font='600 12px "Microsoft YaHei",sans-serif';ctx.fillStyle='#e6fbff';ctx.fillText('护盾',p.x,p.y-30);ctx.restore();}
    if(state!=='ready')for(const p of players){
      const r=screenRadius(p.r);
      if(p.outcome!=='playing'){ctx.fillStyle=p.outcome==='won'?'#ffe29b':'#d5ecf3';ctx.font='700 14px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(`${p.id}P · ${p.outcome==='won'?'已通关 ★':'已出局'}`,p.x,p.y);continue;}
      ctx.save();if(p.invulnerable>0)ctx.globalAlpha=.55+.45*Math.abs(Math.sin(clock*10));
      if(p.id===2)ctx.filter='hue-rotate(155deg) saturate(1.2)';sprite(0,p.x,p.y,r,p.dir);ctx.restore();
      if(p.shieldTime>0){const rx=Math.min(r*1.75+4,p.x-2,W-p.x-2),ry=Math.min(r*1.1+4,p.y-2,H-p.y-2);ctx.save();ctx.strokeStyle='#a5eeff';ctx.shadowColor='#83dcff';ctx.shadowBlur=12;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
      if(p.dashTime>0){ctx.strokeStyle=p.id===2?'#c3f7ffaa':'#fff4bbaa';ctx.lineWidth=2;for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(p.x-p.dir*r*1.2,p.y+i*r*.28);ctx.lineTo(p.x-p.dir*(r*1.8+25),p.y+i*r*.28);ctx.stroke();}}
      ctx.fillStyle=p.id===2?'#c2f4ff':'#ffe29b';ctx.font='700 13px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(`${mode==='duo'?p.id+'P · '+(p.level+1)+'级':'你'}${p.shieldTime>0?' ◇':''}${p.level===MAX_LEVEL?' ★':''}`,p.x,p.y-r*1.2-7);
    }
    for(const p of particles){ctx.globalAlpha=p.life/p.max;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    for(const p of popups){ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y);}ctx.globalAlpha=1;
  }
  function frame(t){const dt=Math.min((t-last)/1000,.035)||0;last=t;update(dt);draw();requestAnimationFrame(frame);}
  function setExpanded(value){
    expanded=value;gameShell.classList.toggle('is-expanded',value);
    document.body?.classList.toggle('game-focused',value);
    $('wideScreen').textContent=value?'退出全屏':'横屏游玩';
    updateWideLayout();clearInput();resize();
  }
  function updateWideLayout(){
    rotated=expanded&&window.innerHeight>window.innerWidth;
    gameShell.classList.toggle('is-rotated',rotated);
    gameShell.style.setProperty('--wide-width',window.innerHeight+'px');
    gameShell.style.setProperty('--wide-height',window.innerWidth+'px');
    for(const [property,value] of Object.entries({width:window.innerHeight+'px',height:window.innerWidth+'px',transform:'translate(-50%,-50%) rotate(90deg)',inset:'auto',left:'50%',top:'50%'})){
      if(rotated)gameShell.style.setProperty(property,value,'important');else gameShell.style.removeProperty(property);
    }
  }
  function unlockOrientation(){if(orientationLocked){try{window.screen?.orientation?.unlock?.();}catch{}orientationLocked=false;}}
  async function toggleWideScreen(){
    if(fullscreenBusy)return;fullscreenBusy=true;$('wideScreen').disabled=true;
    try{
      if(expanded){
        if(document.fullscreenElement&&document.exitFullscreen){try{await document.exitFullscreen();}catch{}}
        unlockOrientation();setExpanded(false);
      }else{
        setExpanded(true);
        if(window.innerWidth>=window.innerHeight){
          try{await fullscreenTarget.requestFullscreen?.();}catch{}
          if(document.fullscreenElement&&window.screen?.orientation?.lock){
            try{await window.screen.orientation.lock('landscape');orientationLocked=true;}catch{}
          }
        }
        updateWideLayout();
      }
    }finally{fullscreenBusy=false;$('wideScreen').disabled=false;resize();ui();}
  }
  for(const [id,key] of directionButtons){
    const button=$(id);
    const release=e=>{touchDirections.delete(e.pointerId);touchDirections.delete('keyboard:'+id);button.setAttribute('aria-pressed',String(Array.from(touchDirections.values()).includes(key)));};
    button.addEventListener('pointerdown',e=>{
      if(state!=='playing'||player.outcome!=='playing'||e.button>0)return;
      e.preventDefault();touchDirections.set(e.pointerId,key);player.pointer=null;dragging=false;
      button.setPointerCapture(e.pointerId);button.setAttribute('aria-pressed','true');
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
    button.addEventListener('contextmenu',e=>e.preventDefault());
    button.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();if(state==='playing'&&player.outcome==='playing'){touchDirections.set('keyboard:'+id,key);player.pointer=null;button.setAttribute('aria-pressed','true');}}});
    button.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();release(e);}});
    button.addEventListener('blur',()=>release({}));
  }
  const mobileDash=()=>{dash(player);ui();};
  $('controlSwitch').addEventListener('click',()=>{clearInput();controlMode=controlMode==='joystick'?'buttons':'joystick';try{window.localStorage?.setItem('fish-feast-control',controlMode);}catch{}ui();});
  function moveJoystick(e){
    const box=$('joystick').getBoundingClientRect();let dx=e.clientX-box.left-box.width/2,dy=e.clientY-box.top-box.height/2;
    if(rotated)[dx,dy]=[dy,-dx];
    const radius=Math.min(box.width,box.height)*.32,distance=Math.hypot(dx,dy),magnitude=Math.min(1,distance/radius);
    joystickVector=distance<6?{x:0,y:0}:{x:dx/distance*magnitude,y:dy/distance*magnitude};
    $('joystickKnob').style.transform=`translate(${joystickVector.x*radius}px,${joystickVector.y*radius}px)`;
  }
  $('joystick').addEventListener('pointerdown',e=>{if(state!=='playing'||player.outcome!=='playing'||joystickPointer!==null||e.button>0)return;e.preventDefault();clearTouch();joystickPointer=e.pointerId;player.pointer=null;dragging=false;$('joystick').setPointerCapture(e.pointerId);moveJoystick(e);});
  $('joystick').addEventListener('pointermove',e=>{if(e.pointerId===joystickPointer){e.preventDefault();moveJoystick(e);}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(event,e=>{if(e.pointerId===joystickPointer)clearJoystick();});
  $('joystick').addEventListener('contextmenu',e=>e.preventDefault());
  $('touchDash').addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();mobileDash();});
  $('touchDash').addEventListener('click',e=>{if(!e.detail)mobileDash();});
  $('wideScreen').addEventListener('click',toggleWideScreen);
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&!fullscreenBusy){unlockOrientation();setExpanded(false);}clearInput();resize();ui();});
  window.addEventListener('orientationchange',()=>{updateWideLayout();clearInput();resize();ui();});
  window.addEventListener('resize',()=>{updateWideLayout();clearInput();resize();ui();});
  $('start').addEventListener('click',()=>state==='paused'?pause():start());$('pause').addEventListener('click',pause);$('touchPause').addEventListener('click',pause);$('dash').addEventListener('click',()=>{dash();canvas.focus({preventScroll:true});ui();});
  $('soloMode').addEventListener('click',()=>setMode('solo'));$('duoMode').addEventListener('click',()=>setMode('duo'));
  $('dash2').addEventListener('click',()=>{if(players[1])dash(players[1]);canvas.focus({preventScroll:true});ui();});
  $('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound').innerHTML=soundEnabled?'♫':'♫<span class="off-mark">/</span>';$('sound').setAttribute('aria-label',soundEnabled?'关闭音效':'开启音效');$('sound').title=soundEnabled?'关闭音效':'开启音效';tone(660);});
  function point(e){const b=canvas.getBoundingClientRect();return rotated?{x:e.clientY-b.top,y:b.right-e.clientX}:{x:e.clientX-b.left,y:e.clientY-b.top};}
  canvas.addEventListener('pointermove',e=>{if(state==='playing'&&player.outcome==='playing'&&(e.pointerType==='mouse'||dragging))player.pointer=point(e);});
  canvas.addEventListener('pointerdown',e=>{if(state==='playing'&&player.outcome==='playing'){clearTouch();dragging=true;player.pointer=point(e);canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointerup',e=>{dragging=false;if(e.pointerType!=='mouse')player.pointer=null;});canvas.addEventListener('pointercancel',()=>{dragging=false;player.pointer=null;});canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')player.pointer=null;});
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)){if(state==='playing'){e.preventDefault();keys.add(k);}}if(!e.repeat){if(k==='p'||k==='escape')pause();if(k==='r'&&state!=='ready')start();if((k===' '||k==='shift')&&state==='playing'){e.preventDefault();dash(k==='shift'&&mode==='duo'?players[1]:player);ui();}else if((k==='enter'||k===' ')&&e.target===canvas){e.preventDefault();if(state==='paused')pause();else if(state!=='playing')start();}}});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{clearInput();if(state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});
  resize();populate();ui();requestAnimationFrame(frame);
})();

import{WORLD,RULESET,RADII,SCHOOLS,emptyState,makeQueue,draw,resolveDrop,clampX,stateKey}from'./engine.js';
import{createPlayback,samplePlayback}from'./playback.js';
import{INITIAL_SCORE,remainingScore,formatScore,parseBestScore}from'./scoring.js';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let state=emptyState(),queue=[],rng=1,seed=1,phase='human',turn='human',humanMoves=0,aim=210,dragging=false,paused=false,worker=null,requestId=0,pendingBot=null,animation=null,renderBalls=[],moveLog=[],maxLevel=-1,best=null,sound=false,audio=null,toastTimer;
let botStats=null,previewAim=null,hovered=false;
const MIN_BOT_THINK_MS=1500;
let thinkElapsed=0,thinkStarted=0;
const sprites=new Map();let paintPending=false;
function requestPaint(){paintPending=true;}
const images=SCHOOLS.map((s,i)=>{const im=new Image();im.onload=()=>{sprites.delete(i*2);sprites.delete(i*2+1);requestPaint();};im.src=`./assets/badges/${s.id}.svg`;return im;});
const BEST_SCORE_KEY='no-szu-best-score-v06';
try{best=parseBestScore(localStorage.getItem(BEST_SCORE_KEY));}catch{}
const chain=$('school-chain');SCHOOLS.forEach((s,i)=>{const li=document.createElement('li');li.title=`第 ${i+1} 级 · ${s.name}`;const img=document.createElement('img');img.src=`./assets/badges/${s.id}.svg`;img.alt=s.name;const label=document.createElement('span');label.textContent=s.short;li.append(img,label);chain.append(li);});
function newSeed(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]||20261010;}
function reset(fixedSeed){
 requestId++;worker?.terminate();worker=null;pendingBot=null;previewAim=null;animation=null;
 seed=fixedSeed||newSeed();const q=makeQueue(seed);queue=q.levels;rng=q.seed;
 state=emptyState();renderBalls=[];moveLog=[];humanMoves=0;maxLevel=-1;turn='human';phase='human';paused=false;aim=210;botStats=null;
 $('result').hidden=true;$('pause-panel').hidden=true;$('empty-hint').hidden=false;
 sync();paint();
}
function advanceQueue(){queue.shift();const d=draw(rng);queue.push(d.level);rng=d.seed;}
function sync(){
 const isHuman=turn==='human';$('turn-dot').classList.toggle('bot',!isHuman);
 const labels={human:'轮到你了',thinking:'电脑思考中…',animating:isHuman?'你的球':'电脑的球',botaim:'电脑出手',ended:state.winner==='human'?'你赢了！':'电脑赢了',error:'暂时卡住了'};
 $('turn-label').textContent=paused?'暂停':labels[phase]||'轮到你了';
 $('turn-number').textContent=`第 ${state.moves+(phase==='ended'?0:1)} 手`;
 $('human-moves').textContent=humanMoves;
 syncScore();$('bot-thinking').hidden=phase!=='thinking'||paused;
 for(const b of state.balls)maxLevel=Math.max(maxLevel,b.level);
 [...chain.children].forEach((li,i)=>li.classList.toggle('reached',i<=maxLevel));
 $('best-record').textContent=best===null?'—':formatScore(best.deducted);
 // The canvas shows queue[0]. Each forecast excludes that current ball.
 $('next-previews').hidden=phase==='ended';
 for(const [actor,label] of [['human','你的下一颗'],['bot','电脑的下一颗']]){
  const school=SCHOOLS[queue[actor===turn?2:1]],image=$(`${actor}-next`);
  image.src=`./assets/badges/${school.id}.svg`;image.alt=`${label}：${school.name}`;image.title=school.name;
 }
 $('move-hint').textContent=phase==='error'?'点重试继续':'堆过红线就赢';
 $('pause').disabled=phase==='ended';$('pause').setAttribute('aria-label',paused?'继续游戏':'暂停游戏');canvas.style.cursor=phase==='human'&&!paused?'crosshair':'default';
}
function syncScore(){
 const cost=animation?.score??state.score,score=remainingScore(cost).toLocaleString('en-US'),deduction=`（-${cost.toLocaleString('en-US')}）`;
 if($('merge-score').textContent!==score)$('merge-score').textContent=score;
 if($('merge-cost').textContent!==deduction)$('merge-cost').textContent=deduction;
}
function presentMerges(){
 let changed=false;
 while(animation.nextEvent<animation.events.length&&animation.events[animation.nextEvent].step+1<=animation.playback.step){
  const event=animation.events[animation.nextEvent++];animation.score+=2**event.level;changed=true;
  if(!reduced)playTone(event.level);
 }
 if(changed)syncScore();
}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function drawBallArt(ctx,b,ghost=false){
 const r=RADII[b.level],school=SCHOOLS[b.level];ctx.save();
 ctx.beginPath();ctx.arc(b.x,b.y,r,0,Math.PI*2);ctx.fillStyle=ghost?'#f7eee1':'#fffef8';
 if(!ghost){ctx.shadowColor='#173a2c22';ctx.shadowBlur=4;ctx.shadowOffsetY=2;}ctx.fill();ctx.shadowColor='transparent';
 ctx.lineWidth=ghost?1:1.6;ctx.strokeStyle=school.color;if(ghost)ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([]);
 const im=images[b.level];const inset=r*.19;
 if(im.complete&&im.naturalWidth){const ratio=im.naturalWidth/im.naturalHeight;let w=(r-inset)*2,h=w;if(ratio>1)h=w/ratio;else w=h*ratio;ctx.drawImage(im,b.x-w/2,b.y-h/2,w,h);}
 else{ctx.font=`600 ${Math.max(9,r*.45)}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=school.color;ctx.fillText(school.short,b.x,b.y);}
 ctx.restore();
}
function drawBall(b,alpha=1,ghost=false){
 const key=b.level*2+Number(ghost);let sprite=sprites.get(key);
 if(!sprite){
  const size=(RADII[b.level]+10)*2,bitmap=document.createElement('canvas');bitmap.width=bitmap.height=size*2;
  const surface=bitmap.getContext('2d');surface.scale(2,2);drawBallArt(surface,{level:b.level,x:size/2,y:size/2},ghost);
  sprite={bitmap,size};sprites.set(key,sprite);
 }
 ctx.globalAlpha=alpha;ctx.drawImage(sprite.bitmap,b.x-sprite.size/2,b.y-sprite.size/2,sprite.size,sprite.size);ctx.globalAlpha=1;
}
function landingY(x,l){const r=RADII[l];let y=WORLD.height-r;for(const b of state.balls){const rr=RADII[b.level]+r,dx=Math.abs(x-b.x);if(dx<rr)y=Math.min(y,b.y-Math.sqrt(rr*rr-dx*dx));}return Math.max(WORLD.spawnY,y);}
function paint(){
 paintPending=false;
 ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,WORLD.width,WORLD.height);
 ctx.strokeStyle='#da345caa';ctx.lineWidth=1.5;ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(0,WORLD.line);ctx.lineTo(WORLD.width,WORLD.line);ctx.stroke();ctx.setLineDash([]);
 ctx.fillStyle='#b6264b';ctx.font=`${Math.max(12,12*WORLD.width/(canvas.clientWidth||420))}px "Microsoft YaHei", sans-serif`;ctx.textAlign='left';ctx.fillText('红线',13,WORLD.line+20);
 // The small ticks are the container's functional height ruler.
 ctx.strokeStyle='#c5cbbc';ctx.lineWidth=.8;for(let y=144;y<600;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(5,y);ctx.moveTo(415,y);ctx.lineTo(420,y);ctx.stroke();}
 for(const b of renderBalls)drawBall(b,phase==='ended'?.65:1);
 if((phase==='human'||phase==='thinking'||phase==='botaim')&&!paused){
  const x=phase==='human'?aim:previewAim??210,l=queue[0],r=RADII[l];
  if(phase==='human'||phase==='botaim'){
   const yy=landingY(x,l);ctx.save();ctx.strokeStyle=turn==='human'?'#bd3a2965':'#203d3570';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(x,WORLD.spawnY+r+4);ctx.lineTo(x,yy-r-5);ctx.stroke();ctx.restore();
   if((dragging||hovered||phase==='botaim')&&state.balls.length)drawBall({x,y:yy,level:l},.23,true);
  }
  drawBall({x,y:Math.max(WORLD.spawnY,r+3),level:l},phase==='thinking'?.65:1);
 }
 if(animation){const current=animation.playback.step;for(const e of animation.events){const age=current-(e.step+1);if(age>=0&&age<25){const alpha=1-age/25;ctx.strokeStyle=SCHOOLS[e.level].color;ctx.globalAlpha=alpha*.65;ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,RADII[e.level]+age*.8,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}}}
}
function playTone(level){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=240*Math.pow(1.15,level);gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.2);}catch{}}
function doDrop(x,actor,stats=null){
 if(paused||state.winner)return;
 phase='animating';turn=actor;previewAim=null;$('empty-hint').hidden=true;
 const level=queue[0],out=resolveDrop(state,level,x,{record:true});
 if(actor==='human')humanMoves++;
 moveLog.push({actor,level,x:clampX(x,level),...(stats?{search:stats}:{}),expectedState:stateKey(out.state)});
 animation={...out,playback:createPlayback(out),elapsed:0,duration:Math.max(450,Math.min(3100,out.steps*1000/90)),nextEvent:0,score:state.score};renderBalls=samplePlayback(animation.playback,0);sync();requestPaint();
}
function finishDrop(){
 const out=animation;animation=null;state=out.state;renderBalls=state.balls;advanceQueue();
 if(state.winner){phase='ended';finishGame();return;}
 turn=turn==='human'?'bot':'human';phase=turn==='human'?'human':'thinking';sync();paint();if(turn==='bot')startBot();
}
function startBot(){
 phase='thinking';pendingBot=null;thinkElapsed=0;thinkStarted=performance.now();sync();const token=++requestId;
 try{
  if(!worker){worker=new Worker(new URL('./bot-worker.js',import.meta.url),{type:'module'});worker.onerror=()=>botError();}
  worker.onmessage=({data})=>{
   if(data.requestId!==requestId||turn!=='bot'||phase!=='thinking')return;
   if(data.type==='error'){botError();return;}
   if(data.type==='progress'){botStats=data.stats;return;}
   if(data.type==='result'){pendingBot=data;botStats=data.stats;if(!paused)showBotChoice();}
  };
  worker.postMessage({requestId:token,state,current:queue[0],preview:queue.slice(1),budgetMs:2200});
  setTimeout(()=>{if(token===requestId&&phase==='thinking'&&!pendingBot)botError();},12000);
 }catch{botError();}
}
function showBotChoice(){if(!pendingBot||paused||(phase==='thinking'&&thinkElapsed+performance.now()-thinkStarted<MIN_BOT_THINK_MS))return;phase='botaim';previewAim=pendingBot.x;sync();paint();const token=requestId;setTimeout(()=>{if(token!==requestId||phase!=='botaim')return;if(paused)return;const p=pendingBot;pendingBot=null;doDrop(p.x,'bot',p.stats);},reduced?150:600);}
function botError(){phase='error';worker?.terminate();worker=null;$('pause-panel').hidden=false;$('pause-panel').querySelector('strong').textContent='暂时卡住了';$('resume').textContent='重试';sync();}
function finishGame(){
 const win=state.winner==='human';$('result-stamp').textContent=win?'你赢了':'电脑赢了';$('result-title').textContent=win?'你赢了！':'合成深大了';
 $('result-copy').textContent=`剩余分数 ${formatScore(state.score)}`;
 if(win&&(best===null||state.score<best.deducted)){best={score:remainingScore(state.score),deducted:state.score};try{localStorage.setItem(BEST_SCORE_KEY,JSON.stringify(best));}catch{}}
 $('result').hidden=false;sync();paint();
}
function setPaused(value){
 if(phase==='ended')return;
 if(phase==='thinking'&&paused!==value){if(value)thinkElapsed+=performance.now()-thinkStarted;else thinkStarted=performance.now();}
 paused=value;const error=phase==='error';$('pause-panel').hidden=!value&&!error;
 $('pause-panel').querySelector('strong').textContent=error?'暂时卡住了':'暂停';$('resume').textContent=error?'重试':'继续';sync();paint();
 if(!value&&pendingBot&&(phase==='thinking'||phase==='botaim'))showBotChoice();
}
let lastTime=0;function tick(time){const delta=Math.min(70,time-lastTime||0);lastTime=time;
 if(phase==='thinking'&&pendingBot&&!paused)showBotChoice();
 if(animation&&!paused){animation.elapsed+=delta;const t=Math.min(1,animation.elapsed/animation.duration);renderBalls=samplePlayback(animation.playback,t);presentMerges();paint();if(t>=1)finishDrop();}
 else if(paintPending)paint();
 requestAnimationFrame(tick);
}
function pointerX(event){const box=canvas.getBoundingClientRect();return clampX((event.clientX-box.left)/box.width*WORLD.width,queue[0]);}
canvas.addEventListener('pointerdown',event=>{if(phase!=='human'||paused)return;event.preventDefault();canvas.focus({preventScroll:true});dragging=true;aim=pointerX(event);canvas.setPointerCapture(event.pointerId);paint();});
canvas.addEventListener('pointermove',event=>{if(phase!=='human'||paused)return;hovered=true;aim=pointerX(event);requestPaint();});
canvas.addEventListener('pointerleave',()=>{hovered=false;if(!dragging)paint();});
canvas.addEventListener('pointerup',event=>{if(!dragging)return;dragging=false;if(phase==='human'&&!paused)doDrop(pointerX(event),'human');});
canvas.addEventListener('pointercancel',()=>{dragging=false;paint();});
canvas.addEventListener('keydown',event=>{if(phase!=='human'||paused)return;if(['ArrowLeft','ArrowRight',' ','Enter'].includes(event.key)){event.preventDefault();if(event.key==='ArrowLeft'||event.key==='ArrowRight'){aim=clampX(aim+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?2:10),queue[0]);hovered=true;paint();}else doDrop(aim,'human');}});
$('pause').onclick=()=>setPaused(!paused);$('resume').onclick=()=>{if(phase==='error'){$('pause-panel').hidden=true;paused=false;startBot();}else setPaused(false);};
const dialogWasPaused=new Map();function openDialog(id){dialogWasPaused.set(id,paused);if(phase!=='ended')setPaused(true);$(id).showModal();}
for(const id of['rules-dialog','restart-dialog'])$(id).addEventListener('close',()=>{if(!dialogWasPaused.get(id)&&phase!=='ended')setPaused(false);});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('rules-button').onclick=()=>openDialog('rules-dialog');$('restart').onclick=()=>{if(!state.moves&&!animation)reset();else openDialog('restart-dialog');};
$('confirm-restart').onclick=()=>{$('restart-dialog').close();reset();};$('again').onclick=()=>reset();$('same-seed').onclick=()=>reset(seed);
$('sound').onclick=()=>{sound=!sound;$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'关闭音效':'开启音效');$('sound-lines').setAttribute('d',sound?'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14':'m16 9 5 6m0-6-5 6');if(sound)playTone(3);};
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2500);}
function replayPayload(){const committed=animation?.state??state;return{version:RULESET,seed,physics:WORLD,radii:RADII,moves:moveLog,winner:committed.winner,humanMoves,score:committed.score,initialScore:INITIAL_SCORE,remainingScore:remainingScore(committed.score),stateKey:stateKey(committed),pendingAnimation:!!animation};}
$('export-replay').onclick=()=>{const payload=replayPayload();const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`no-szu-${seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('回放已保存');};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase!=='ended'&&phase!=='error')setPaused(true);});
reset();requestAnimationFrame(tick);

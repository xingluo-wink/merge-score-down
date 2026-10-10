// The renderer, bot and tests all use this deterministic circle solver.
export const WORLD={width:420,height:620,line:92,spawnY:28,dt:1/90,maxSteps:480};
export const RULESET='no-szu-0.6';
export const RADII=[18,24,31,40,49,60,72,85,100,115,132];
export const SCHOOLS=[
 {id:'scut',name:'华南理工大学',short:'华工',color:'#c64e36'},
 {id:'sysu',name:'中山大学',short:'中大',color:'#246d51'},
 {id:'whu',name:'武汉大学',short:'武大',color:'#548cab'},
 {id:'nju',name:'南京大学',short:'南大',color:'#87629b'},
 {id:'ustc',name:'中国科学技术大学',short:'中科大',color:'#286ca4'},
 {id:'zju',name:'浙江大学',short:'浙大',color:'#388eb0'},
 {id:'sjtu',name:'上海交通大学',short:'上交',color:'#bc4143'},
 {id:'fdu',name:'复旦大学',short:'复旦',color:'#3867a2'},
 {id:'pku',name:'北京大学',short:'北大',color:'#a83d46'},
 {id:'thu',name:'清华大学',short:'清华',color:'#76518b'},
 {id:'szu',name:'深圳大学',short:'深大',color:'#ae345b'}
];
export const DRAW_WEIGHTS=[.34,.30,.23,.13];
export function randomStep(seed){let x=seed>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0;}
export function draw(seed){const next=randomStep(seed||1),r=next/4294967296;let sum=0;for(let i=0;i<DRAW_WEIGHTS.length;i++){sum+=DRAW_WEIGHTS[i];if(r<sum)return{seed:next,level:i};}return{seed:next,level:3};}
export function makeQueue(seed,count=3){const levels=[];for(let i=0;i<count;i++){const d=draw(seed);seed=d.seed;levels.push(d.level);}return{seed,levels};}
export function emptyState(){return{balls:[],nextId:1,score:0,merges:0,moves:0,winner:null};}
export function cloneState(s){return{...s,balls:s.balls.map(b=>({...b}))};}
export function clampX(x,level){const r=RADII[level];return Math.min(WORLD.width-r-1,Math.max(r+1,Number.isFinite(x)?x:WORLD.width/2));}
export function makeBall(id,level,x,y){return{id,level,x,y,vx:0,vy:0};}
export function heightOf(s){return s.balls.length?Math.max(0,...s.balls.map(b=>WORLD.height-b.y+RADII[b.level])):0;}
export function stateKey(s){return s.balls.map(b=>`${b.id}:${b.level}:${b.x.toFixed(4)}:${b.y.toFixed(4)}`).join('|');}
function mergeContacts(s,events,step){
 let again=true;
 while(again){again=false;outer:for(let i=0;i<s.balls.length;i++){const a=s.balls[i];if(a.level===10)continue;for(let j=i+1;j<s.balls.length;j++){const b=s.balls[j];if(a.level!==b.level)continue;const sum=RADII[a.level]*2,dx=b.x-a.x,dy=b.y-a.y;if(dx*dx+dy*dy>(sum+.15)**2)continue;
 const level=a.level+1,r=RADII[level],c=makeBall(s.nextId++,level,Math.max(r,Math.min(WORLD.width-r,(a.x+b.x)/2)),Math.min(WORLD.height-r,(a.y+b.y)/2));
 c.vx=(a.vx+b.vx)*.35;c.vy=Math.min(90,(a.vy+b.vy)*.35);
 s.balls.splice(j,1);s.balls.splice(i,1,c);s.score+=2**level;s.merges++;
 if(events)events.push({step,x:c.x,y:c.y,level});
 if(level===10)s.winner='bot';again=true;break outer;
 }}}
}
function stepPhysics(s,events,step){
 const bs=s.balls,dt=WORLD.dt,old=bs.map(b=>[b.x,b.y]);
 for(const b of bs){b.vx*=.996;b.vy+=1550*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;}
 mergeContacts(s,events,step);
 for(let it=0;it<5;it++){
  for(let i=0;i<s.balls.length;i++){
   const a=s.balls[i],ra=RADII[a.level];
   if(a.x<ra){a.x=ra;a.vx=Math.abs(a.vx)*.08;}if(a.x>WORLD.width-ra){a.x=WORLD.width-ra;a.vx=-Math.abs(a.vx)*.08;}
   if(a.y>WORLD.height-ra){a.y=WORLD.height-ra;a.vy=Math.abs(a.vy)<45?0:-Math.abs(a.vy)*.07;a.vx*=.88;}
   for(let j=i+1;j<s.balls.length;j++){
    const b=s.balls[j],rb=RADII[b.level],dx=b.x-a.x,dy=b.y-a.y,sum=ra+rb;
    if(Math.abs(dx)>sum||Math.abs(dy)>sum)continue;
    const d2=dx*dx+dy*dy;if(d2>=sum*sum)continue;
    let d=Math.sqrt(d2),nx=d>.0001?dx/d:((a.id%2)?1:-1),ny=d>.0001?dy/d:0;
    const ia=1/(ra*ra),ib=1/(rb*rb),inv=1/(ia+ib),penetration=Math.max(0,sum-d-.025)*.85;
    a.x-=nx*penetration*ia*inv;a.y-=ny*penetration*ia*inv;b.x+=nx*penetration*ib*inv;b.y+=ny*penetration*ib*inv;
    const rvx=b.vx-a.vx,rvy=b.vy-a.vy,vn=rvx*nx+rvy*ny;
    if(vn<0){const impulse=-(Math.abs(vn)>55?1.08:1)*vn*inv;
     a.vx-=impulse*nx*ia;a.vy-=impulse*ny*ia;b.vx+=impulse*nx*ib;b.vy+=impulse*ny*ib;
     const vt=-rvx*ny+rvy*nx,fr=Math.max(-impulse*.13,Math.min(impulse*.13,-vt*inv));
     a.vx+=fr*ny*ia;a.vy-=fr*nx*ia;b.vx-=fr*ny*ib;b.vy+=fr*nx*ib;
    }
   }
  }
 }
 mergeContacts(s,events,step);
 let movement=99;if(bs.length===s.balls.length&&old.length===s.balls.length){movement=0;for(let i=0;i<s.balls.length;i++)movement=Math.max(movement,Math.abs(s.balls[i].x-old[i][0]),Math.abs(s.balls[i].y-old[i][1]));}
 return movement;
}
export function resolveDrop(input,level,x,{record=false}={}){
 if(!Number.isInteger(level)||level<0||level>3)throw new Error('Only public draw levels 0–3 can be dropped.');
 const s=cloneState(input),events=record?[]:null,frames=record?[]:null,frameSteps=record?[]:null;
 if(s.winner)return{state:s,frames:frames||[],frameSteps:frameSteps||[],events:events||[],steps:0};
 s.balls.push(makeBall(s.nextId++,level,clampX(x,level),Math.max(WORLD.spawnY,RADII[level]+3)));s.moves++;
 const capture=step=>{const frame=s.balls.map(b=>({id:b.id,level:b.level,x:b.x,y:b.y}));if(frameSteps.at(-1)===step)frames[frames.length-1]=frame;else{frames.push(frame);frameSteps.push(step);}};
 if(record)capture(0);
 let quiet=0,steps=0;
 for(let n=0;n<WORLD.maxSteps;n++){
  const eventCount=events?.length;
  const movement=stepPhysics(s,events,n);steps=n+1;
  if(record&&(n%3===0||events.length!==eventCount))capture(steps);
  quiet=movement<.16?quiet+1:0;
  if(s.winner|| (n>65&&quiet>=22))break;
 }
 for(const b of s.balls){b.vx=0;b.vy=0;const r=RADII[b.level];b.x=Math.max(r,Math.min(WORLD.width-r,b.x));b.y=Math.min(WORLD.height-r,b.y);}
 if(!s.winner&&s.balls.some(b=>b.y-RADII[b.level]<WORLD.line))s.winner='human';
 if(record)capture(steps);
 return{state:s,frames:frames||[],frameSteps:frameSteps||[],events:events||[],steps};
}
export function evaluate(s){
 if(s.winner==='bot')return 1e9;if(s.winner==='human')return-1e9;
 if(!s.balls.length)return 0;
 const heights=new Float64Array(22);let area=0,buried=0,pair=0,progress=0;
 for(const b of s.balls){const r=RADII[b.level];area+=Math.PI*r*r;progress+=2**b.level*(1+b.level*.08);
  for(let i=0;i<heights.length;i++){const dx=(i+.5)*WORLD.width/heights.length-b.x;if(Math.abs(dx)<r)heights[i]=Math.max(heights[i],WORLD.height-b.y+Math.sqrt(r*r-dx*dx));}
  if(b.level<=3){let cover=0;for(const a of s.balls)if(a.id!==b.id&&a.y<b.y&&Math.abs(a.x-b.x)<RADII[a.level]+r*.3)cover++;buried+=Math.min(3,cover)*(4-b.level);}
  for(const a of s.balls)if(a.id>b.id&&a.level===b.level){const d=Math.hypot(a.x-b.x,a.y-b.y);pair+=Math.max(0,1-(d-2*r)/WORLD.width)*(1+b.level*.6);}
 }
 const max=heightOf(s),mean=heights.reduce((a,b)=>a+b,0)/heights.length;
 let rough=0;for(let i=1;i<heights.length;i++)rough+=Math.abs(heights[i]-heights[i-1]);
 const voidArea=Math.max(0,mean*WORLD.width-area),danger=Math.max(0,max-350);
 return progress*.26+pair*6-max*5-mean*2.5-area*.007-rough*.24-voidArea*.009-buried*7-danger*danger*.085;
}
export function candidateXs(s,level,count=21){
 const r=RADII[level],lo=r+1,hi=WORLD.width-r-1,xs=[];
 for(let i=0;i<count;i++)xs.push(lo+(hi-lo)*i/(count-1));
 const surface=s.balls.filter(b=>!s.balls.some(a=>a.id!==b.id&&a.y<b.y&&Math.abs(a.x-b.x)<RADII[a.level]*.8));
 for(const b of surface){xs.push(b.x);if(b.level===level)xs.push(b.x-r*.55,b.x+r*.55);}
 const sorted=xs.map(x=>clampX(x,level)).sort((a,b)=>a-b),out=[];
 for(const x of sorted)if(!out.length||x-out.at(-1)>5)out.push(x);
 return out;
}

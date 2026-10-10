import{resolveDrop,evaluate,candidateXs,RADII,WORLD}from'./engine.js';

// Bounded adversarial beam search. Only current + two publicly visible draws enter here.
export function chooseMove(state,current,preview,{budgetMs=1800,maxSimulations=1400,now=()=>performance.now(),onProgress=()=>{}}={}){
 const started=now();let simulations=0,allCovered=false,expandedRoots=0,coveredRoots=0;
 const expired=()=>simulations>=maxSimulations||now()-started>budgetMs;
 function simulate(s,l,x){simulations++;const out=resolveDrop(s,l,x).state;return{s:out,x,value:evaluate(out)};}
 const roots=[];
 for(const x of candidateXs(state,current,23)){
  const r=simulate(state,current,x);r.base=r.value;r.worst=Infinity;r.threats=[];r.covered=0;roots.push(r);
  if(r.s.winner==='bot')return finish(r,'合成已就位',1);
 }
 roots.sort((a,b)=>b.base-a.base);
 let viable=roots.filter(r=>!r.s.winner).slice(0,8);
 if(!viable.length)return finish(roots[0],'尝试最后一个落点',1);
 // Fully evaluate immediate wins, then share reply work across an eight-root beam.
 // This is selective search, not proof that every possible drop has been checked.
 const actions=viable.map(r=>candidateXs(r.s,preview[0],15));
 expandedRoots=viable.length;
 let depth=1;
 for(let i=0;i<Math.max(...actions.map(x=>x.length));i++){
  let completed=true;
  for(let j=0;j<viable.length;j++){
   const r=viable[j];if(i>=actions[j].length||r.worst<=-1e9)continue;
   if(expired()){completed=false;break;}
   const t=simulate(r.s,preview[0],actions[j][i]);r.threats.push(t);r.covered++;r.worst=Math.min(r.worst,t.value);
  }
  if(!completed)break;
  if(i===Math.max(...actions.map(x=>x.length))-1)allCovered=true;
 }
 const covered=viable.filter((r,i)=>r.covered===actions[i].length||r.worst<=-1e9);
 coveredRoots=covered.length;
 if(!covered.length){const fallback=viable.find(r=>r.worst>-1e9)||viable[0];return finish(fallback,'先保持场地有空间',1);}
 const safeCovered=covered.filter(r=>r.worst>-1e9);
 if(safeCovered.length)viable=safeCovered;
 else if(covered.length===viable.length)viable=covered;
 else{const notFatal=viable.filter(r=>r.worst>-1e9);if(notFatal.length)viable=notFatal;}
 for(const r of viable){r.value=r.worst;r.threats.sort((a,b)=>a.value-b.value);}
 viable.sort((a,b)=>b.value-a.value);
 if(covered.length)depth=2;
 let best=viable[0];onProgress({simulations,depth,elapsed:now()-started});
 // Third ply uses the second public preview draw. Improve a common shortlist
 // only if the whole iteration completes, so differing horizons cannot bias selection.
 const finalists=viable.slice(0,3),deep=[];
 for(const r of finalists){
  if(expired()||r.worst<=-1e9||!r.threats.length)break;
  let worstRecovery=Infinity,complete=true;
  for(const t of r.threats.slice(0,3)){
   if(t.s.winner==='bot'){worstRecovery=Math.min(worstRecovery,1e9);continue;}
   let recovery=-Infinity;
   for(const x of candidateXs(t.s,preview[1],13)){
    if(expired()){complete=false;break;}
    const result=simulate(t.s,preview[1],x);recovery=Math.max(recovery,result.value);
    if(recovery>=1e9)break;
   }
   if(!complete)break;
   worstRecovery=Math.min(worstRecovery,recovery);
  }
  if(!complete)break;
  deep.push({...r,value:worstRecovery});
 }
 if(deep.length===finalists.length&&deep.length){deep.sort((a,b)=>b.value-a.value);best=deep[0];depth=3;}
 const onePly=roots[0];
 let reason='留出下一手的空间';
 if(best.s.merges>state.merges)reason='接住这一手，继续合成';
 if(Math.abs(best.x-onePly.x)>20&&onePly.worst<-1e8)reason='先拆掉你的爆仓机会';
 else if(Math.abs(best.x-onePly.x)>30&&depth>=2)reason='防住下一手的卡位';
 if(best.worst<=-1e9)reason='局面很危险，仍在找出路';
 return finish(best,reason,depth);
 function finish(r,reason,d){return{x:r.x,reason,stats:{simulations,depth:d,elapsedMs:Math.round(now()-started),rootCandidates:roots.length,expandedRoots,coveredRoots,tacticalCoverage:allCovered&&coveredRoots===expandedRoots,coverageScope:'selected-root-beam'},predicted:r.s};}
}
export function sabotageMove(s,level,policy='highest'){
 if(policy==='left')return RADII[level]+1;
 if(policy==='right')return WORLD.width-RADII[level]-1;
 if(policy==='highest')return s.balls.length?[...s.balls].sort((a,b)=>(a.y-RADII[a.level])-(b.y-RADII[b.level]))[0].x:WORLD.width/2;
 const options=candidateXs(s,level,19).map(x=>({x,value:evaluate(resolveDrop(s,level,x).state)}));
 options.sort((a,b)=>a.value-b.value);return options[0].x;
}

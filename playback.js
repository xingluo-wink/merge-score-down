// Interpolate presentation only; never feed rendered positions back into physics.
export function createPlayback({frames,frameSteps,steps}){
 return{frames,frameSteps,steps,index:0,maps:frames.map(frame=>new Map(frame.map(b=>[b.id,b]))),balls:[],step:0};
}
export function samplePlayback(playback,progress){
 const {frames,frameSteps,maps,balls}=playback;
 const step=Math.max(0,Math.min(1,progress))*playback.steps;playback.step=step;
 let i=playback.index;
 while(i+1<frames.length&&frameSteps[i+1]<=step)i++;
 while(i>0&&frameSteps[i]>step)i--;
 playback.index=i;
 const from=frames[i],next=Math.min(i+1,frames.length-1),span=frameSteps[next]-frameSteps[i];
 const fraction=span?Math.max(0,Math.min(1,(step-frameSteps[i])/span)):0;
 balls.length=from.length;
 for(let j=0;j<from.length;j++){
  const a=from[j],b=maps[next].get(a.id),out=balls[j]??={};
  out.id=a.id;out.level=a.level;
  // A merged ball gets a new ID. Switch at its recorded event, without morphing
  // a removed ball into an unrelated survivor or showing both generations.
  out.x=b?a.x+(b.x-a.x)*fraction:a.x;
  out.y=b?a.y+(b.y-a.y)*fraction:a.y;
 }
 return balls;
}

import{chooseMove}from'./ai.js';
self.onmessage=({data})=>{
 try{const{requestId,state,current,preview,budgetMs}=data;const result=chooseMove(state,current,preview,{budgetMs,onProgress:stats=>self.postMessage({type:'progress',requestId,stats})});self.postMessage({type:'result',requestId,...result});}
 catch(error){self.postMessage({type:'error',requestId:data.requestId,message:error.message});}
};

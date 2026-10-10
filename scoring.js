// Keep engine.score as cumulative merge cost for physics, search and old replays.
// README derives a 27,400-point upper bound for the larger, non-overlapping circles.
// 35,000 leaves about 28% headroom for that deliberately loose model.
export const INITIAL_SCORE=35000;
export function remainingScore(mergePoints){return Math.max(0,INITIAL_SCORE-mergePoints);}
export function formatScore(mergePoints){return `${remainingScore(mergePoints).toLocaleString('en-US')}（-${mergePoints.toLocaleString('en-US')}）`;}
export function parseBestScore(raw){
 try{const record=JSON.parse(raw);if(record&&Number.isSafeInteger(record.deducted)&&record.deducted>=0&&record.score===remainingScore(record.deducted))return{score:record.score,deducted:record.deducted};}catch{}
 return null;
}

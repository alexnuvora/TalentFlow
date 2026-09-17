export function providerConfig(get){const key=get('AI_API_KEY')||get('OPENAI_API_KEY');const model=get('AI_MODEL')||get('OPENAI_MODEL');const raw=(get('AI_BASE_URL')||'https://api.openai.com/v1').trim();if(!key?.trim()||!model?.trim())throw new Error('AI_API_KEY and AI_MODEL must be configured');const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('AI_BASE_URL must be a clean HTTPS URL');url.pathname=url.pathname.replace(/\/+$/,'');if(!url.pathname.endsWith('/chat/completions'))url.pathname+='/chat/completions';return{key:key.trim(),model:model.trim(),url:url.toString()}}
const text=v=>{if(typeof v==='string')return v.trim();if(v==null)return'';if(typeof v==='number'||typeof v==='boolean')return String(v);if(typeof v==='object'){for(const k of ['text','value','description','evidence','question','strength','gap','title','summary','reason']){if(typeof v[k]==='string'&&v[k].trim())return v[k].trim()}try{return JSON.stringify(v)}catch{return String(v)}}return String(v)};
const list=v=>{const a=Array.isArray(v)?v:(v==null?[]:[v]);return a.map(text).filter(Boolean).slice(0,30).map(x=>x.slice(0,4000))};
export function parseReport(raw){let content=raw?.choices?.[0]?.message?.content;if(Array.isArray(content))content=content.map(x=>typeof x==='string'?x:x?.text||'').join('');if(typeof content!=='string')throw new Error('Missing response content');content=content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();const start=content.indexOf('{'),end=content.lastIndexOf('}');if(start<0||end<start)throw new Error('Missing JSON object');return validateReport(JSON.parse(content.slice(start,end+1)))}
export function validateReport(value){
 if(!value||!Number.isInteger(value.score)||value.score<0||value.score>100||typeof value.summary!=='string'||!value.summary.trim()||value.summary.length>8000)throw new Error('Invalid report');
 const result={score:value.score,summary:value.summary};
 for(const key of ['strengths','gaps','interview_questions','evidence']){
  if(!Array.isArray(value[key])||value[key].length>30||!value[key].every(x=>typeof x==='string'&&x.length<=4000))throw new Error('Invalid evidence list');
  result[key]=value[key];
 }
 return result;
}

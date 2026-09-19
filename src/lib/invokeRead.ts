import {supabase} from './supabase';

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export async function invokeRead<T=any>(name:string,body:Record<string,unknown>,attempts=2){
  let last:any;
  for(let attempt=1;attempt<=attempts;attempt++){
    const result=await supabase.functions.invoke<T>(name,{body});
    if(!result.error)return result;
    last=result;
    const message=String(result.error?.message||'');
    const transient=/failed to fetch|network|timeout|fetch/i.test(message);
    if(!transient||attempt===attempts)return result;
    await sleep(350*attempt);
  }
  return last;
}

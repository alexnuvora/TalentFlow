const json=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))};
export default async function handler(req,res){
 if(req.method==='GET')return json(res,200,{ok:true,service:'staff-mail',runtime:'vercel-node'});
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
 try{
  const mod=await import('./staff-mail-core.mjs');
  if(typeof mod.default!=='function')return json(res,500,{error:'Mailbox core handler is unavailable.'});
  return await mod.default(req,res);
 }catch(error){
  console.error('staff-mail bootstrap',error);
  return json(res,500,{error:'Mailbox server bootstrap failed: '+String(error?.message||error)});
 }
}

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const allowedOrigins=new Set(['https://www.vorlen.co.uk','https://vorlen.co.uk','http://localhost:5173','http://127.0.0.1:5173']);
const corsFor=(req:Request)=>{const origin=req.headers.get('Origin')||'';return{'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'https://www.vorlen.co.uk','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}};
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsFor(req),'Content-Type':'application/json','Cache-Control':'no-store'}});

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsFor(req)});
 if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer '))return json(req,{error:'Authentication required'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const service=createClient(url,serviceKey);
  const{data:{user},error:authError}=await userDb.auth.getUser();
  if(authError||!user)return json(req,{error:'Authentication required'},401);
  const{data:profile,error:profileError}=await service.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profile?.company_id||!['owner','manager'].includes(profile.role))return json(req,{error:'Manager access required'},403);

  const body=await req.json().catch(()=>({}));
  const candidateId=String(body?.candidate_id||'').trim();
  if(!candidateId)return json(req,{error:'Candidate is required'},400);

  const{data:candidate,error:candidateError}=await service.from('candidates')
    .select('id,email,resume_path,statutory_retain_until,erased_at')
    .eq('id',candidateId).eq('company_id',profile.company_id).maybeSingle();
  if(candidateError)throw candidateError;
  if(!candidate)return json(req,{error:'Candidate not found'},404);
  if(candidate.erased_at)return json(req,{ok:true,already_erased:true});
  if(candidate.statutory_retain_until&&Date.parse(candidate.statutory_retain_until)>Date.now()){
    return json(req,{error:`Candidate is under a statutory retention hold until ${candidate.statutory_retain_until}. The record cannot be erased yet.`},409);
  }

  const{data:requestRow,error:requestError}=await service.from('privacy_requests').insert({
    company_id:profile.company_id,
    candidate_id:candidateId,
    email:candidate.email,
    request_type:'erasure',
    status:'verified',
    notes:'Manager-initiated candidate removal from the Vorlen candidate workspace.'
  }).select('id').single();
  if(requestError||!requestRow)throw requestError||new Error('Erasure audit request could not be created');

  const{data:files,error:fileError}=await userDb.rpc('candidate_privacy_files',{p_request:requestRow.id});
  if(fileError)throw fileError;
  const names=(files||[]).map((f:any)=>f.name).filter(Boolean);
  for(let i=0;i<names.length;i+=100){
    const{error:removeError}=await service.storage.from('candidate-resumes').remove(names.slice(i,i+100));
    if(removeError)throw removeError;
  }

  const{data:result,error:eraseError}=await userDb.rpc('candidate_privacy_operation',{p_request:requestRow.id,p_action:'erase'});
  if(eraseError)throw eraseError;
  return json(req,{ok:true,result});
 }catch(e){
  console.error('manager-candidate-erasure',e);
  return json(req,{error:e instanceof Error?e.message:'Candidate could not be erased. No successful erasure has been recorded.'},500);
 }
});
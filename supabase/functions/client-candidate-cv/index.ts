import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const cors={'Access-Control-Allow-Origin':'https://www.vorlen.co.uk','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const auth=req.headers.get('Authorization')||'';
    if(!auth.startsWith('Bearer '))return json({error:'Authentication required'},401);
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const udb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const db=createClient(url,service);
    const{data:{user}}=await udb.auth.getUser();
    if(!user)return json({error:'Authentication required'},401);
    const{data:p}=await db.from('profiles').select('company_id,role,client_id').eq('id',user.id).maybeSingle();
    if(!p?.company_id||p.role!=='viewer'||!p.client_id)return json({error:'Client access required'},403);
    const submissionId=String((await req.json())?.submission_id||'');
    if(!submissionId)return json({error:'Submission required'},400);
    const{data:s}=await db.from('candidate_submissions').select('id,candidate_id,status,candidate_authorisation').eq('id',submissionId).eq('company_id',p.company_id).eq('client_id',p.client_id).maybeSingle();
    if(!s||['draft','withdrawn','approved_to_send'].includes(String(s.status)))return json({error:'Submission not available'},404);
    if(!String(s.candidate_authorisation||'').trim())return json({error:'Candidate sharing authorisation is not recorded.'},403);
    const{data:c}=await db.from('candidates').select('full_name,resume_path,cv_url').eq('id',s.candidate_id).eq('company_id',p.company_id).maybeSingle();
    if(!c)return json({error:'Candidate not found'},404);
    if(c.resume_path){
      const{data:signed,error}=await db.storage.from('candidate-resumes').createSignedUrl(c.resume_path,300,{download:c.full_name?c.full_name+' CV':undefined});
      if(error||!signed?.signedUrl)return json({error:'CV could not be opened.'},500);
      return json({url:signed.signedUrl,expires_in:300});
    }
    if(c.cv_url&&/^https:\/\//i.test(c.cv_url))return json({url:c.cv_url,expires_in:null});
    return json({error:'No CV is available for this candidate.'},404);
  }catch(e){console.error('client-candidate-cv',e);return json({error:'CV could not be opened.'},500)}
});

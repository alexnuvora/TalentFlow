import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
const origins=new Set(['https://www.vorlen.co.uk','https://vorlen.co.uk','http://localhost:5173','http://127.0.0.1:5173']);
const reply=(req:Request,data:unknown,status=200)=>Response.json(data,{status,headers:{'Access-Control-Allow-Origin':origins.has(req.headers.get('Origin')||'')?req.headers.get('Origin')!:'https://www.vorlen.co.uk','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'}});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return reply(req,{});if(req.method!=='POST')return reply(req,{error:'Method not allowed'},405);
 try{
 const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))return reply(req,{error:'Authentication required'},401);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}}),db=createClient(url,key);
 const{data:{user},error:authErr}=await userDb.auth.getUser();if(authErr||!user)return reply(req,{error:'Authentication required'},401);
 const body=await req.json().catch(()=>({})),id=String(body?.candidate_id||''),action=String(body?.action||'');
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)||!['view','download'].includes(action))return reply(req,{error:'Valid candidate and action required'},400);
 const{data:p,error:pe}=await db.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();
 if(pe||!p?.company_id)return reply(req,{error:'Access denied'},403);
 const{data:c,error:ce}=await db.from('candidates').select('id,resume_path').eq('id',id).eq('company_id',p.company_id).is('erased_at',null).maybeSingle();
 if(ce||!c?.resume_path)return reply(req,{error:'CV not available'},404);
 let permitted=['owner','manager'].includes(p.role);
 if(['partner','recruiter'].includes(p.role)){
 const{data:a,error:ae}=await db.from('partner_assignments').select('id').eq('company_id',p.company_id).eq('candidate_id',id).eq('partner_id',user.id).is('completed_at',null).limit(1).maybeSingle();
 if(ae)return reply(req,{error:'Access could not be verified'},403);
 permitted=!!a;
 if(p.role==='partner'){
 const[{data:pp},{data:o}]=await Promise.all([
 db.from('partner_profiles').select('active,specialism').eq('company_id',p.company_id).eq('user_id',user.id).maybeSingle(),
 db.from('partner_onboarding').select('status').eq('company_id',p.company_id).eq('partner_id',user.id).maybeSingle()]);
 permitted=permitted&&pp?.active===true&&o?.status==='active'&&['candidate_sourcer','hybrid'].includes(pp?.specialism||'');
 }
 }
 if(!permitted)return reply(req,{error:'Not authorised to access this CV'},403);
 const path=String(c.resume_path);
 if(!path.startsWith(p.company_id+'/'+id+'/')||!/\.(pdf|docx)$/i.test(path))return reply(req,{error:'CV location integrity check failed'},409);
 const{data:signed,error:se}=await db.storage.from('candidate-resumes').createSignedUrl(path,60,{download:action==='download'});
 if(se||!signed?.signedUrl)return reply(req,{error:'CV could not be opened'},503);
 const{error:audit}=await db.from('compliance_audit_log').insert({company_id:p.company_id,event_type:action==='download'?'candidate_cv_downloaded':'candidate_cv_viewed',new_state:{actor_id:user.id,candidate_id:id,role:p.role,action}});
 if(audit){console.error('candidate-cv-access audit',audit.message);return reply(req,{error:'CV access audit unavailable'},503)}
 return reply(req,{url:signed.signedUrl,expires_in:60});
 }catch(e){console.error('candidate-cv-access',e);return reply(req,{error:'CV could not be opened'},500)}
});
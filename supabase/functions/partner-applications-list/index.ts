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
    if(!profile?.company_id||profile.role!=='partner')return json(req,{error:'Partner access required'},403);

    const[{data:partner,error:partnerError},{data:onboarding,error:onboardingError},{data:processing,error:processingError}]=await Promise.all([
      service.from('partner_profiles').select('active,specialism').eq('user_id',user.id).eq('company_id',profile.company_id).maybeSingle(),
      service.from('partner_onboarding').select('status').eq('partner_id',user.id).eq('company_id',profile.company_id).maybeSingle(),
      service.rpc('candidate_processing_allowed',{p_company_id:profile.company_id})
    ]);
    if(partnerError)throw partnerError;if(onboardingError)throw onboardingError;if(processingError)throw processingError;
    const candidateCapable=['candidate_sourcer','hybrid'].includes(partner?.specialism||'');const clientCloser=['lead_closer','hybrid'].includes(partner?.specialism||'');if(!partner?.active||onboarding?.status!=='active'||(!candidateCapable&&!clientCloser))return json(req,{error:'Recruitment delivery access required'},403);
    if(processing!==true)return json(req,{error:'Candidate processing is not currently active.'},409);

    const{data:assignments,error:assignmentError}=await service.from('partner_assignments')
      .select('candidate_id,job_id')
      .eq('company_id',profile.company_id)
      .eq('partner_id',user.id)
      .is('completed_at',null);
    if(assignmentError)throw assignmentError;

    const candidateIds=candidateCapable?[...new Set((assignments||[]).map(a=>a.candidate_id).filter(Boolean))] as string[]:[];
    const jobIds=[...new Set((assignments||[]).map(a=>a.job_id).filter(Boolean))] as string[];
    if(!candidateIds.length&&!jobIds.length)return json(req,{applications:[]});

    const queries:Promise<any>[]=[];
    if(candidateIds.length)queries.push(service.from('applications').select('id,candidate_id,job_id,status,source,submitted_at').eq('company_id',profile.company_id).in('candidate_id',candidateIds).order('submitted_at',{ascending:false}));
    if(jobIds.length)queries.push(service.from('applications').select('id,candidate_id,job_id,status,source,submitted_at').eq('company_id',profile.company_id).in('job_id',jobIds).order('submitted_at',{ascending:false}));
    const results=await Promise.all(queries);
    for(const result of results)if(result.error)throw result.error;

    const appMap=new Map<string,any>();
    for(const result of results)for(const app of result.data||[])appMap.set(app.id,app);
    let apps=[...appMap.values()].sort((a,b)=>new Date(b.submitted_at).getTime()-new Date(a.submitted_at).getTime());
    if(clientCloser&&!candidateCapable&&apps.length){
      const{submissionRows,error:submissionError}=await (async()=>{const r=await service.from('candidate_submissions').select('candidate_id,job_id').eq('company_id',profile.company_id).in('job_id',jobIds).in('status',['submitted','reviewing','approved','rejected','interview_requested']);return{submissionRows:r.data||[],error:r.error}})();
      if(submissionError)throw submissionError;
      const submittedKeys=new Set(submissionRows.map((s:any)=>s.candidate_id+'|'+s.job_id));
      apps=apps.filter(a=>submittedKeys.has(a.candidate_id+'|'+a.job_id));
    }
    if(!apps.length)return json(req,{applications:[]});

    const appCandidateIds=[...new Set(apps.map(a=>a.candidate_id).filter(Boolean))] as string[];
    const appJobIds=[...new Set(apps.map(a=>a.job_id).filter(Boolean))] as string[];
    const[{data:candidates,error:candidateError},{data:jobs,error:jobError}]=await Promise.all([
      service.from('candidates').select('id,full_name,email').eq('company_id',profile.company_id).in('id',appCandidateIds),
      service.from('jobs').select('id,client_id,title,status').eq('company_id',profile.company_id).in('id',appJobIds)
    ]);
    if(candidateError)throw candidateError;if(jobError)throw jobError;

    const clientIds=[...new Set((jobs||[]).map(j=>j.client_id).filter(Boolean))] as string[];
    const{data:clients,error:clientError}=clientIds.length
      ?await service.from('clients').select('id,company_name').eq('company_id',profile.company_id).in('id',clientIds)
      :{data:[],error:null};
    if(clientError)throw clientError;

    const candidateMap=new Map((candidates||[]).map(c=>[c.id,c]));
    const jobMap=new Map((jobs||[]).map(j=>[j.id,j]));
    const clientMap=new Map((clients||[]).map(c=>[c.id,c]));

    const applications=apps.map(app=>{
      const job=jobMap.get(app.job_id)||null;
      const candidateAssigned=candidateIds.includes(app.candidate_id);
      const vacancyAssigned=jobIds.includes(app.job_id);
      return{
        id:app.id,
        status:app.status,
        source:app.source,
        submitted_at:app.submitted_at,
        scope:candidateAssigned&&vacancyAssigned?'candidate_and_vacancy':candidateAssigned?'candidate':candidateCapable?'vacancy':'client_submission',
        candidate:(()=>{const c=candidateMap.get(app.candidate_id)||null;if(!c)return null;return candidateAssigned||candidateCapable?c:{id:c.id,full_name:c.full_name}})(),
        job:job?{id:job.id,title:job.title,status:job.status,client:clientMap.get(job.client_id)||null}:null
      };
    });
    return json(req,{applications});
  }catch(e){
    console.error('partner-applications-list',e);
    return json(req,{error:'Unable to load partner applications'},500);
  }
});
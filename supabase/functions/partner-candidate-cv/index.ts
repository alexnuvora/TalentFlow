import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const auth=req.headers.get('Authorization')||'';
    if(!auth.startsWith('Bearer '))return json({error:'Authentication required'},401);

    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const db=createClient(url,service);

    const{data:{user}}=await userDb.auth.getUser();
    if(!user)return json({error:'Authentication required'},401);

    const{data:profile}=await userDb.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();
    if(!profile||profile.role!=='partner')return json({error:'Partner access required'},403);

    const[{data:pp},{data:onboarding},{data:processing}]=await Promise.all([
      db.from('partner_profiles').select('specialism,active').eq('user_id',user.id).eq('company_id',profile.company_id).maybeSingle(),
      db.from('partner_onboarding').select('status').eq('partner_id',user.id).eq('company_id',profile.company_id).maybeSingle(),
      db.rpc('candidate_processing_allowed',{p_company:profile.company_id})
    ]);
    if(!pp?.active||onboarding?.status!=='active'||!['candidate_sourcer','hybrid'].includes(pp.specialism||''))return json({error:'Recruiter or Hybrid Partner access required'},403);
    if(processing!==true)return json({error:'Candidate processing is not active'},409);

    const form=await req.formData();
    const candidateId=String(form.get('candidate_id')||'');
    const file=form.get('file');
    const sourceEvidence=String(form.get('source_evidence')||'').trim();
    if(!candidateId)return json({error:'Candidate is required'},400);
    if(!(file instanceof File))return json({error:'CV file is required'},400);
    if(sourceEvidence.length<10)return json({error:'Record how the candidate provided or authorised this CV.'},400);
    if(file.size<=0||file.size>10*1024*1024)return json({error:'CV must be between 1 byte and 10 MB'},400);

    const name=file.name.toLowerCase();
    const ext=name.endsWith('.pdf')?'pdf':name.endsWith('.docx')?'docx':'';
    const allowedMime=ext==='pdf'?['application/pdf','application/octet-stream']:['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'];
    if(!ext||!allowedMime.includes(file.type||'application/octet-stream'))return json({error:'Only PDF or DOCX CV files are supported'},400);

    const[{data:assigned},{data:candidate}]=await Promise.all([
      db.from('partner_assignments').select('id').eq('company_id',profile.company_id).eq('partner_id',user.id).eq('candidate_id',candidateId).is('completed_at',null).limit(1).maybeSingle(),
      db.from('candidates').select('id,full_name,resume_path').eq('id',candidateId).eq('company_id',profile.company_id).is('erased_at',null).maybeSingle()
    ]);
    if(!assigned)return json({error:'Assigned candidate access required'},403);
    if(!candidate)return json({error:'Candidate not found'},404);

    const path=`${profile.company_id}/${candidateId}/${crypto.randomUUID()}.${ext}`;
    const bytes=new Uint8Array(await file.arrayBuffer());
    const{error:uploadError}=await db.storage.from('candidate-resumes').upload(path,bytes,{contentType:file.type||allowedMime[0],upsert:false});
    if(uploadError)return json({error:'CV upload failed',detail:uploadError.message},500);

    const{error:updateError}=await db.from('candidates').update({resume_path:path,updated_at:new Date().toISOString()}).eq('id',candidateId).eq('company_id',profile.company_id);
    if(updateError){
      await db.storage.from('candidate-resumes').remove([path]);
      return json({error:'Candidate CV could not be linked',detail:updateError.message},500);
    }

    await db.from('candidate_source_records').insert({
      company_id:profile.company_id,
      candidate_id:candidateId,
      provider:'partner_cv_upload',
      source_url:null,
      metadata:{file_name:file.name,file_type:ext,source_evidence:sourceEvidence,previous_resume_path:candidate.resume_path||null},
      imported_by:user.id
    });

    await db.from('activity_log').insert({
      company_id:profile.company_id,
      candidate_id:candidateId,
      actor_id:user.id,
      event_type:'partner_cv_uploaded',
      detail:'Partner uploaded a candidate-provided CV for controlled recruitment use.'
    });

    return json({ok:true,candidate_id:candidateId,resume_path:path,file_name:file.name});
  }catch(e){
    return json({error:e instanceof Error?e.message:'CV upload failed'},500);
  }
});
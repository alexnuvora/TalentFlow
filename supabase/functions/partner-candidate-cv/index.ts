import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const allowedOrigins=new Set(['https://www.vorlen.co.uk','https://vorlen.co.uk','http://localhost:5173','http://127.0.0.1:5173']);
const corsFor=(req:Request)=>{const origin=req.headers.get('Origin')||'';return{'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'https://www.vorlen.co.uk','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}};
const json=(req:Request,b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...corsFor(req),'Content-Type':'application/json','Cache-Control':'no-store'}});

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsFor(req)});
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
  try{
    const auth=req.headers.get('Authorization')||'';
    if(!auth.startsWith('Bearer '))return json(req,{error:'Authentication required'},401);

    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userDb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const db=createClient(url,service);

    const{data:{user}}=await userDb.auth.getUser();
    if(!user)return json(req,{error:'Authentication required'},401);

    const{data:profile}=await userDb.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();
    if(!profile||profile.role!=='partner')return json(req,{error:'Partner access required'},403);

    const[{data:pp},{data:onboarding},{data:processing}]=await Promise.all([
      db.from('partner_profiles').select('specialism,active').eq('user_id',user.id).eq('company_id',profile.company_id).maybeSingle(),
      db.from('partner_onboarding').select('status').eq('partner_id',user.id).eq('company_id',profile.company_id).maybeSingle(),
      db.rpc('candidate_processing_allowed',{p_company_id:profile.company_id})
    ]);
    if(!pp?.active||onboarding?.status!=='active'||!['candidate_sourcer','hybrid'].includes(pp.specialism||''))return json(req,{error:'Recruiter or Hybrid Partner access required'},403);
    if(processing!==true)return json(req,{error:'Candidate processing is not active'},409);

    const form=await req.formData();
    const candidateId=String(form.get('candidate_id')||'');
    const file=form.get('file');
    const sourceEvidence=String(form.get('source_evidence')||'').trim();
    if(!candidateId)return json(req,{error:'Candidate is required'},400);
    if(!(file instanceof File))return json(req,{error:'CV file is required'},400);
    if(sourceEvidence.length<10)return json(req,{error:'Record how the candidate provided or authorised this CV.'},400);
    if(file.size<=0||file.size>5*1024*1024)return json(req,{error:'CV must be between 1 byte and 5 MB'},400);

    const name=file.name.toLowerCase();
    const ext=name.endsWith('.pdf')?'pdf':name.endsWith('.docx')?'docx':'';
    const canonicalMime=ext==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const allowedMime=ext==='pdf'?['application/pdf','application/octet-stream']:['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/octet-stream'];
    if(!ext||!allowedMime.includes(file.type||'application/octet-stream'))return json(req,{error:'Only PDF or DOCX CV files are supported'},400);

    const[{data:assigned},{data:candidate}]=await Promise.all([
      db.from('partner_assignments').select('id').eq('company_id',profile.company_id).eq('partner_id',user.id).eq('candidate_id',candidateId).is('completed_at',null).limit(1).maybeSingle(),
      db.from('candidates').select('id,full_name,resume_path').eq('id',candidateId).eq('company_id',profile.company_id).is('erased_at',null).maybeSingle()
    ]);
    if(!assigned)return json(req,{error:'Assigned candidate access required'},403);
    if(!candidate)return json(req,{error:'Candidate not found'},404);

    const path=`${profile.company_id}/${candidateId}/${crypto.randomUUID()}.${ext}`;
    const bytes=new Uint8Array(await file.arrayBuffer());
    const isPdf=bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
    const isZip=bytes.length>=4&&bytes[0]===0x50&&bytes[1]===0x4b&&[0x03,0x05,0x07].includes(bytes[2])&&[0x04,0x06,0x08].includes(bytes[3]);
    if((ext==='pdf'&&!isPdf)||(ext==='docx'&&!isZip))return json(req,{error:'The selected file does not appear to be a valid '+ext.toUpperCase()+' document.'},400);

    // Always store with the canonical MIME type. Some browsers report DOCX/PDF as
    // application/octet-stream, while this private bucket intentionally allow-lists
    // document MIME types only.
    const{error:uploadError}=await db.storage.from('candidate-resumes').upload(path,bytes,{contentType:canonicalMime,upsert:false});
    if(uploadError){
      console.error('partner-candidate-cv storage upload failed',{candidateId,code:uploadError.name,message:uploadError.message});
      return json(req,{error:'CV upload failed'},500);
    }

    const{data:sourceRow,error:sourceError}=await db.from('candidate_source_records').insert({
      company_id:profile.company_id,
      candidate_id:candidateId,
      provider:'partner_cv_upload',
      source_url:null,
      metadata:{file_name:file.name,file_type:ext,source_evidence:sourceEvidence,previous_resume_path:candidate.resume_path||null,storage_path:path},
      imported_by:user.id
    }).select('id').single();
    if(sourceError||!sourceRow){
      console.error('partner-candidate-cv provenance insert failed',{candidateId,message:sourceError?.message||'Source record was not created'});
      await db.storage.from('candidate-resumes').remove([path]);
      return json(req,{error:'CV provenance could not be recorded'},500);
    }

    // candidates has no updated_at column in the production schema. Keep this write
    // limited to resume_path so PostgREST does not reject the update with PGRST204.
    const{error:updateError}=await db.from('candidates').update({resume_path:path}).eq('id',candidateId).eq('company_id',profile.company_id);
    if(updateError){
      console.error('partner-candidate-cv candidate link failed',{candidateId,message:updateError.message});
      await db.from('candidate_source_records').delete().eq('id',sourceRow.id);
      await db.storage.from('candidate-resumes').remove([path]);
      return json(req,{error:'Candidate CV could not be linked'},500);
    }

    const{error:auditError}=await db.from('activity_log').insert({
      company_id:profile.company_id,
      candidate_id:candidateId,
      actor_id:user.id,
      event_type:'partner_cv_uploaded',
      detail:'Partner uploaded a candidate-provided CV for controlled recruitment use.',
      metadata:{candidate_source_record_id:sourceRow.id}
    });
    if(auditError){
      console.error('partner-candidate-cv audit insert failed',{candidateId,message:auditError.message});
      await db.from('candidates').update({resume_path:candidate.resume_path||null}).eq('id',candidateId).eq('company_id',profile.company_id);
      await db.from('candidate_source_records').delete().eq('id',sourceRow.id);
      await db.storage.from('candidate-resumes').remove([path]);
      return json(req,{error:'CV upload could not be audit-logged'},500);
    }

    let previousCvCleanupPending=false;
    if(candidate.resume_path&&candidate.resume_path!==path){
      const{error:cleanupError}=await db.storage.from('candidate-resumes').remove([candidate.resume_path]);
      if(cleanupError){
        previousCvCleanupPending=true;
        console.error('partner-candidate-cv previous file cleanup failed',{candidateId,message:cleanupError.message});
        await db.from('compliance_audit_log').insert({company_id:profile.company_id,event_type:'candidate_cv_previous_file_cleanup_failed',new_state:{candidate_id:candidateId,partner_user_id:user.id,previous_resume_path:candidate.resume_path,replacement_resume_path:path,error:cleanupError.message}});
      }
    }
    return json(req,{ok:true,candidate_id:candidateId,resume_path:path,file_name:file.name,previous_cv_cleanup_pending:previousCvCleanupPending});
  }catch(e){
    console.error('partner-candidate-cv unhandled error',e);
    return json(req,{error:'CV upload failed'},500);
  }
});
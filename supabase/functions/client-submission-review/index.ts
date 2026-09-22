import {createClient} from 'npm:@supabase/supabase-js@2.116.0';

const cors={'Access-Control-Allow-Origin':'https://www.vorlen.co.uk','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const json=(x:any,s=200)=>Response.json(x,{status:s,headers:{...cors,'Cache-Control':'no-store'}});
const hash=async(v:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const clean=(s:string)=>s.replace(/\r/g,'').replace(/[\t ]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,60000);
const escRx=(s:string)=>s.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');
async function bytesHash(bytes:Uint8Array){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function extractPdf(bytes:Uint8Array){const DOMMatrix=(await import('npm:@thednp/dommatrix@2.0.12')).default;globalThis.DOMMatrix=DOMMatrix as any;(globalThis as any).process=undefined;try{Object.defineProperty(globalThis.navigator,'platform',{value:'Linux',configurable:true})}catch{}const pdfjs=await import('npm:pdfjs-dist@5.4.149');pdfjs.GlobalWorkerOptions.workerSrc=import.meta.resolve('npm:pdfjs-dist@5.4.149/build/pdf.worker.mjs');const doc=await pdfjs.getDocument({data:bytes,useWorkerFetch:false,isEvalSupported:false}).promise;const parts:string[]=[];try{let chars=0;for(let i=1;i<=doc.numPages&&chars<60000;i++){const page=await doc.getPage(i),tc=await page.getTextContent(),text=tc.items.map((x:any)=>typeof x?.str==='string'?x.str:'').join(' ');parts.push(text);chars+=text.length;page.cleanup()}}finally{await doc.destroy()}return clean(parts.join('\n'))}
async function extractCv(file:Blob,path:string){const bytes=new Uint8Array(await file.arrayBuffer());if(path.toLowerCase().endsWith('.pdf'))return{bytes,text:await extractPdf(bytes)};if(path.toLowerCase().endsWith('.docx')){const mammoth=await import('npm:mammoth@1.8.0');const r=await mammoth.extractRawText({buffer:bytes});return{bytes,text:clean(String(r.value||''))}}throw new Error('Unsupported CV format.')}
function redact(text:string,c:any){let out=text;for(const v of [c.email,c.phone,c.linkedin_url,c.postal_address]){const x=String(v||'').trim();if(x.length>=4)out=out.replace(new RegExp(escRx(x),'gi'),'[withheld by Vorlen]')}out=out.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email withheld by Vorlen]');out=out.replace(/(?:https?:\/\/|www\.)\S+/gi,'[web/profile link withheld by Vorlen]');out=out.replace(/(?:\+?44\s?\(?(?:0\)?\s?)?|0)(?:7\d{3}|1\d{3}|2\d)\s?\d{3,4}\s?\d{3,4}/g,'[phone withheld by Vorlen]');out=out.replace(/\b(?:\+?44\s?(?:\(0\)\s?)?|0)7[\dxX\s().-]{7,}\b/g,'[phone withheld by Vorlen]');const lines=out.split('\n').map(x=>x.trim()).filter(Boolean),safe:string[]=[];for(let line of lines){if(/^(e-?mail|phone|mobile|tel(?:ephone)?|linkedin|website|web|address|contact)\s*[:|-]/i.test(line))line='Direct contact details withheld by Vorlen';if(safe[safe.length-1]===line)continue;safe.push(line)}return clean(safe.join('\n'))}
async function safeCv(db:any,s:any,c:any){if(!c.resume_path)return null;const{data:file,error}=await db.storage.from('candidate-resumes').download(c.resume_path);if(error||!file)return null;const ex=await extractCv(file,c.resume_path),sourceHash=await bytesHash(ex.bytes);if(s.client_safe_cv_text&&s.client_safe_cv_source_hash===sourceHash&&s.client_safe_cv_redaction_version==='v2')return s.client_safe_cv_text;const text=redact(ex.text,c);if(text.length<80)return null;await db.from('candidate_submissions').update({client_safe_cv_text:text,client_safe_cv_generated_at:new Date().toISOString(),client_safe_cv_source_hash:sourceHash,client_safe_cv_redaction_version:'v2'}).eq('id',s.id);return text}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,db=createClient(url,service);
    const u=new URL(req.url);
    const body=req.method==='POST'?await req.json().catch(()=>({})):{};
    const token=String(body.token||u.searchParams.get('token')||'').trim();
    if(token.length<32)return json({error:'This review link is invalid.'},401);
    const tokenHash=await hash(token);
    const{data:t}=await db.from('client_submission_review_tokens').select('*').eq('token_hash',tokenHash).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
    if(!t)return json({error:'This review link has expired or been revoked.'},401);
    const{data:s}=await db.from('candidate_submissions').select('id,company_id,client_id,job_id,candidate_id,application_id,recruiter_summary,status,client_feedback,client_decision,submitted_at,candidate_authorisation,client_safe_cv_text,client_safe_cv_source_hash,client_safe_cv_redaction_version').eq('id',t.submission_id).eq('company_id',t.company_id).single();
    if(!s)return json({error:'Candidate submission is unavailable.'},404);
    if(req.method==='POST'&&body.action){
      const action=String(body.action),feedback=String(body.feedback||'').trim().slice(0,5000);
      const status=action==='request_interview'?'interview_requested':action==='progress'?'client_approved':action==='reject'?'client_rejected':action==='feedback'?s.status:null;
      if(!status)return json({error:'Invalid review action.'},400);
      const patch:any={status,client_feedback:feedback||s.client_feedback,client_feedback_at:feedback?new Date().toISOString():null,updated_at:new Date().toISOString()};
      if(action!=='feedback'){patch.client_decision=action;patch.client_decision_at=new Date().toISOString();patch.reviewed_at=new Date().toISOString()}
      await db.from('candidate_submissions').update(patch).eq('id',s.id);
      if(s.application_id&&action!=='feedback'){const ast=action==='request_interview'?'interview_requested':action==='progress'?'client_approved':'rejected';await db.from('applications').update({status:ast}).eq('id',s.application_id).eq('company_id',s.company_id)}
      return json({ok:true,status});
    }
    const [{data:c},{data:j},{data:cl},{data:co}]=await Promise.all([
      db.from('candidates').select('full_name,location,email,phone,linkedin_url,postal_address,resume_path').eq('id',s.candidate_id).single(),
      db.from('jobs').select('title,location,employment_type').eq('id',s.job_id).single(),
      db.from('clients').select('company_name').eq('id',s.client_id).single(),
      db.from('companies').select('name,legal_name').eq('id',s.company_id).single()
    ]);
    let cvText:null|string=null;
    if(String(s.candidate_authorisation||'').trim())cvText=await safeCv(db,s,c);
    await db.from('client_submission_review_tokens').update({last_viewed_at:new Date().toISOString()}).eq('id',t.id);
    if(cvText)await db.from('compliance_audit_log').insert({company_id:s.company_id,event_type:'client_safe_cv_viewed_token',new_state:{client_id:s.client_id,submission_id:s.id,candidate_id:s.candidate_id}});
    return json({submission:{id:s.id,status:s.status,recruiter_summary:s.recruiter_summary,client_feedback:s.client_feedback,client_decision:s.client_decision,submitted_at:s.submitted_at},candidate:{full_name:c?.full_name,location:c?.location,cv_text:cvText},job:j,client:cl,agency:{name:co?.name||co?.legal_name||'Recruitment team'}});
  }catch(e){console.error('client-submission-review',e);return json({error:e instanceof Error?e.message:'Unable to open candidate review.'},500)}
});
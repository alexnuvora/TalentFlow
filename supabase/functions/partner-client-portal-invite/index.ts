import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const shell=(name:string,link:string)=>`<!doctype html><html><body style="margin:0;background:#f2f5f3;font-family:Arial,sans-serif;color:#10201d"><table role="presentation" width="100%"><tr><td style="padding:34px 16px"><table role="presentation" width="100%" style="max-width:620px;margin:auto;background:#fff;border:1px solid #d9e2de"><tr><td style="padding:28px 34px;background:#10201d;color:#fff"><div style="font-size:19px;font-weight:800;letter-spacing:4px">VORLEN</div><div style="margin-top:5px;font-size:10px;letter-spacing:1.7px;color:#8fe3c2">CLIENT WORKSPACE</div></td></tr><tr><td style="padding:36px 34px"><h1 style="margin:0 0 22px">Your secure Vorlen client workspace</h1><p style="font-size:15px;line-height:1.7">Hello ${esc(name||'there')},</p><p style="font-size:15px;line-height:1.7">Vorlen has prepared secure workspace access for your recruitment activity.</p><p style="margin:26px 0"><a href="${link}" style="display:inline-block;padding:13px 20px;background:#0b6b55;color:#fff;text-decoration:none;font-weight:700;border-radius:999px">Open client workspace</a></p><p style="color:#667972;font-size:13px;line-height:1.6">Use this secure link to set up or access your account.</p></td></tr></table></td></tr></table></body></html>`;

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))return json({error:'Authentication required'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const udb=createClient(url,anon,{global:{headers:{Authorization:auth}}});const{data:{user}}=await udb.auth.getUser();if(!user)return json({error:'Authentication required'},401);
  const db=createClient(url,service);const body=await req.json();const clientId=String(body.client_id||'');
  const{data:me}=await db.from('profiles').select('company_id,role').eq('id',user.id).maybeSingle();if(!me||me.role!=='partner')return json({error:'Partner access required'},403);
  const [{data:pp},{data:o},{data:a},{data:c}]=await Promise.all([
   db.from('partner_profiles').select('specialism,active').eq('user_id',user.id).eq('company_id',me.company_id).maybeSingle(),
   db.from('partner_onboarding').select('status').eq('partner_id',user.id).eq('company_id',me.company_id).maybeSingle(),
   db.from('partner_assignments').select('id').eq('partner_id',user.id).eq('company_id',me.company_id).eq('client_id',clientId).is('completed_at',null).limit(1).maybeSingle(),
   db.from('clients').select('id,company_name,contact_name,email,status,terms_accepted_at').eq('id',clientId).eq('company_id',me.company_id).maybeSingle()
  ]);
  if(!pp?.active||o?.status!=='active'||!['lead_closer','hybrid'].includes(pp?.specialism||'')||!a)return json({error:'Assigned Lead Closer or Hybrid Partner access required'},403);
  if(!c)return json({error:'Client not found'},404);
  if(!c.terms_accepted_at||c.status!=='active')return json({error:'Client portal access can be invited after the client has accepted Terms of Business and is active.'},409);
  if(!c.email)return json({error:'Client email is required'},400);

  const{data:profiles}=await db.from('profiles').select('id,role,client_id').eq('company_id',me.company_id);
  const{data:users}=await db.auth.admin.listUsers({page:1,perPage:1000});
  const existing=(users?.users||[]).find((x:any)=>String(x.email||'').toLowerCase()===String(c.email).toLowerCase());
  const existingProfile=existing?(profiles||[]).find((p:any)=>p.id===existing.id):null;
  if(existingProfile&&(existingProfile.role!=='viewer'||existingProfile.client_id!==c.id))return json({error:'This email already has different workspace access.'},409);

  const base='https://www.vorlen.co.uk';let invited:any=existing||null;let created=false;let rawLink:any;
  if(existing&&existingProfile){
    const{data,error}=await db.auth.admin.generateLink({type:'magiclink',email:c.email,options:{redirectTo:base+'/client'}});if(error||!data?.properties)return json({error:error?.message||'Could not generate client access link.'},400);rawLink=data;
  }else{
    const{data,error}=await db.auth.admin.generateLink({type:'invite',email:c.email,options:{redirectTo:base+'/reset-password',data:{full_name:c.contact_name||c.company_name,invited_role:'viewer'}}});if(error||!data?.user||!data?.properties)return json({error:error?.message||'Could not generate client invitation.'},400);
    invited=data.user;rawLink=data;created=true;
    const{error:pe}=await db.from('profiles').upsert({id:invited.id,company_id:me.company_id,full_name:c.contact_name||c.company_name,role:'viewer',client_id:c.id});if(pe){await db.auth.admin.deleteUser(invited.id);return json({error:'Client portal profile could not be created.'},500)}
  }
  const token=rawLink.properties?.hashed_token||(()=>{try{return new URL(rawLink.properties?.action_link||'').searchParams.get('token')||''}catch{return''}})();
  if(!token){if(created&&invited?.id){await db.from('profiles').delete().eq('id',invited.id);await db.auth.admin.deleteUser(invited.id)}return json({error:'Could not create secure client access link.'},500)}
  const type=created?'invite':'email',next=created?'/reset-password':'/client';const link=`${base}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent(next)}`;
  const key=Deno.env.get('RESEND_API_KEY');if(!key)return json({error:'Client invitation email is not configured.'},503);
  const er=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from:'Vorlen <contact@vorlen.co.uk>',to:[c.email],reply_to:'contact@vorlen.co.uk',subject:'Your Vorlen client workspace',html:shell(c.contact_name||c.company_name,link)})});
  const ej=await er.json().catch(()=>({}));if(!er.ok){if(created&&invited?.id){await db.from('profiles').delete().eq('id',invited.id);await db.auth.admin.deleteUser(invited.id)}return json({error:'Unable to send client portal invitation.',detail:ej?.message||'Email provider rejected the request'},502)}
  return json({ok:true,message:existingProfile?'Client portal access link sent.':'Client portal invitation sent.',email_id:ej?.id||null});
 }catch(e){return json({error:e instanceof Error?e.message:'Client portal invitation failed'},500)}
});
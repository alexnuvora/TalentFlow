import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const shell=(name:string,link:string)=>`<!doctype html><html><body style="margin:0;background:#f2f5f3;font-family:Arial,sans-serif;color:#10201d"><table role="presentation" width="100%"><tr><td style="padding:34px 16px"><table role="presentation" width="100%" style="max-width:620px;margin:auto;background:#fff;border:1px solid #d9e2de"><tr><td style="padding:28px 34px;background:#10201d;color:#fff"><div style="font-size:19px;font-weight:800;letter-spacing:4px">VORLEN</div><div style="margin-top:5px;font-size:10px;letter-spacing:1.7px;color:#8fe3c2">CLIENT WORKSPACE</div></td></tr><tr><td style="padding:36px 34px"><h1 style="margin:0 0 22px">Your secure Vorlen client workspace</h1><p style="font-size:15px;line-height:1.7">Hello ${esc(name||'there')},</p><p style="font-size:15px;line-height:1.7">Vorlen has prepared secure workspace access for your recruitment activity.</p><p style="margin:26px 0"><a href="${link}" style="display:inline-block;padding:13px 20px;background:#0b6b55;color:#fff;text-decoration:none;font-weight:700;border-radius:999px">Open client workspace</a></p><p style="color:#667972;font-size:13px;line-height:1.6">Use this secure link to set up or access your account.</p></td></tr></table></td></tr></table></body></html>`;

async function findAuthUserByEmail(db:any,email:string){
  const needle=email.trim().toLowerCase();
  for(let page=1;page<=20;page++){
    const{data,error}=await db.auth.admin.listUsers({page,perPage:1000});
    if(error)throw error;
    const users=data?.users||[];
    const hit=users.find((x:any)=>String(x.email||'').trim().toLowerCase()===needle);
    if(hit)return hit;
    if(users.length<1000)break;
  }
  return null;
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer '))return json({error:'Authentication required'},401);

  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const udb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const{data:{user}}=await udb.auth.getUser();
  if(!user)return json({error:'Authentication required'},401);

  const db=createClient(url,service);
  const body=await req.json();

  const{data:me}=await db.from('profiles').select('company_id,role,client_id').eq('id',user.id).maybeSingle();
  if(!me)return json({error:'Workspace access required'},403);
  const managerAccess=['owner','manager'].includes(me.role);
  const clientId=me.role==='viewer'?String(me.client_id||''):String(body.client_id||'');
  if(!clientId)return json({error:'Client id is required'},400);
  const{data:selfMembership}=me.role==='viewer'?await db.from('client_portal_memberships').select('portal_role,status').eq('user_id',user.id).eq('client_id',clientId).eq('company_id',me.company_id).maybeSingle():{data:null};
  const clientAdminAccess=me.role==='viewer'&&selfMembership?.status==='active'&&selfMembership?.portal_role==='admin';

  const [{data:pp},{data:o},{data:a},{data:c}]=await Promise.all([
   db.from('partner_profiles').select('specialism,active').eq('user_id',user.id).eq('company_id',me.company_id).maybeSingle(),
   db.from('partner_onboarding').select('status').eq('partner_id',user.id).eq('company_id',me.company_id).maybeSingle(),
   db.from('partner_assignments').select('id').eq('partner_id',user.id).eq('company_id',me.company_id).eq('client_id',clientId).is('completed_at',null).limit(1).maybeSingle(),
   db.from('clients').select('id,company_name,contact_name,email,status,terms_accepted_at').eq('id',clientId).eq('company_id',me.company_id).maybeSingle()
  ]);

  const partnerAccess=me.role==='partner'&&!!pp?.active&&o?.status==='active'&&['lead_closer','hybrid'].includes(pp?.specialism||'')&&!!a;
  if(!managerAccess&&!partnerAccess&&!clientAdminAccess){
    return json({error:'Owner, manager, assigned Lead Closer/Hybrid Partner, or client admin access required'},403);
  }
  if(!c)return json({error:'Client not found'},404);
  if(!c.terms_accepted_at||c.status!=='active')return json({error:'Client portal access can be invited after the client has accepted Terms of Business and is active.'},409);
  if(!c.email)return json({error:'Client email is required'},400);

  const requestedRole=String(body.portal_role||'hiring_manager');
  const canChoosePortalRole=managerAccess||clientAdminAccess;
  const portalRole=canChoosePortalRole&&['admin','hiring_manager','reviewer','read_only'].includes(requestedRole)?requestedRole:'hiring_manager';
  let inviteName=String(c.contact_name||c.company_name);
  let normalizedEmail=String(c.email).trim().toLowerCase();

  if(clientAdminAccess){
    inviteName=String(body.full_name||'').trim();
    normalizedEmail=String(body.email||'').trim().toLowerCase();
    if(inviteName.length<2||inviteName.length>200)return json({error:'Client member name is required.'},400);
  }else if(managerAccess&&body.contact_id){
    const{data:contact}=await db.from('client_recruitment_contacts')
      .select('name,email')
      .eq('id',String(body.contact_id))
      .eq('client_id',c.id)
      .eq('company_id',me.company_id)
      .maybeSingle();
    if(!contact?.email)return json({error:'Selected client contact does not have an email address.'},400);
    normalizedEmail=String(contact.email).trim().toLowerCase();
    inviteName=String(contact.name||c.company_name);
  }

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))return json({error:'Client contact email is invalid.'},400);

  const existing=await findAuthUserByEmail(db,normalizedEmail);
  const existingProfile=existing?(await db.from('profiles').select('id,company_id,role,client_id').eq('id',existing.id).maybeSingle()).data:null;

  if(existingProfile){
    if(existingProfile.company_id!==me.company_id||existingProfile.role!=='viewer'||existingProfile.client_id!==c.id){
      return json({error:'This email already has different workspace access.'},409);
    }
  }

  const base='https://www.vorlen.co.uk';
  let account:any=existing||null;
  let rawLink:any=null;
  let createdAuth=false;
  let createdProfile=false;
  let linkType:'invite'|'email'='email';

  if(existing){
    if(!existingProfile){
      const{error:pe}=await db.from('profiles').insert({
        id:existing.id,
        company_id:me.company_id,
        full_name:inviteName,
        role:'viewer',
        client_id:c.id
      });
      if(pe)return json({error:'Client portal profile could not be created.'},500);
      createdProfile=true;
    }
    const{data,error}=await db.auth.admin.generateLink({
      type:'magiclink',
      email:normalizedEmail,
      options:{redirectTo:base+'/client'}
    });
    if(error||!data?.properties){
      if(createdProfile)await db.from('profiles').delete().eq('id',existing.id);
      return json({error:error?.message||'Could not generate client access link.'},400);
    }
    rawLink=data;
    linkType='email';
  }else{
    const{data,error}=await db.auth.admin.generateLink({
      type:'invite',
      email:normalizedEmail,
      options:{redirectTo:base+'/reset-password',data:{full_name:inviteName,invited_role:'viewer'}}
    });
    if(error||!data?.user||!data?.properties)return json({error:error?.message||'Could not generate client invitation.'},400);
    account=data.user;
    rawLink=data;
    createdAuth=true;
    linkType='invite';

    const{error:pe}=await db.from('profiles').insert({
      id:account.id,
      company_id:me.company_id,
      full_name:inviteName,
      role:'viewer',
      client_id:c.id
    });
    if(pe){
      await db.auth.admin.deleteUser(account.id);
      return json({error:'Client portal profile could not be created.'},500);
    }
    createdProfile=true;
  }

  const{data:existingMembership}=await db.from('client_portal_memberships')
    .select('id,portal_role,status')
    .eq('user_id',account.id)
    .maybeSingle();

  const{error:membershipError}=await db.from('client_portal_memberships').upsert({
    company_id:me.company_id,
    client_id:c.id,
    user_id:account.id,
    email:normalizedEmail,
    full_name:inviteName,
    portal_role:portalRole,
    status:'active',
    created_by:user.id,
    updated_at:new Date().toISOString()
  },{onConflict:'user_id'});
  if(membershipError){
    if(createdProfile&&account?.id)await db.from('profiles').delete().eq('id',account.id);
    if(createdAuth&&account?.id)await db.auth.admin.deleteUser(account.id);
    return json({error:'Client portal membership could not be created.'},500);
  }

  const token=rawLink.properties?.hashed_token||(()=>{try{return new URL(rawLink.properties?.action_link||'').searchParams.get('token')||''}catch{return''}})();
  if(!token){
    if(existingMembership?.id){
      await db.from('client_portal_memberships').update({portal_role:existingMembership.portal_role,status:existingMembership.status,updated_at:new Date().toISOString()}).eq('id',existingMembership.id);
    }else{
      await db.from('client_portal_memberships').delete().eq('user_id',account.id);
    }
    if(createdProfile&&account?.id)await db.from('profiles').delete().eq('id',account.id);
    if(createdAuth&&account?.id)await db.auth.admin.deleteUser(account.id);
    return json({error:'Could not create secure client access link.'},500);
  }

  const next=linkType==='invite'?'/reset-password':'/client';
  const link=`${base}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=${encodeURIComponent(linkType)}&next=${encodeURIComponent(next)}`;

  const key=Deno.env.get('RESEND_API_KEY');
  if(!key){
    if(existingMembership?.id){
      await db.from('client_portal_memberships').update({portal_role:existingMembership.portal_role,status:existingMembership.status,updated_at:new Date().toISOString()}).eq('id',existingMembership.id);
    }else{
      await db.from('client_portal_memberships').delete().eq('user_id',account.id);
    }
    if(createdProfile&&account?.id)await db.from('profiles').delete().eq('id',account.id);
    if(createdAuth&&account?.id)await db.auth.admin.deleteUser(account.id);
    return json({error:'Client invitation email is not configured.'},503);
  }

  const er=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({
      from:'Vorlen <contact@vorlen.co.uk>',
      to:[normalizedEmail],
      reply_to:'contact@vorlen.co.uk',
      subject:'Your Vorlen client workspace',
      html:shell(inviteName,link)
    })
  });
  const ej=await er.json().catch(()=>({}));
  if(!er.ok){
    if(existingMembership?.id){
      await db.from('client_portal_memberships').update({portal_role:existingMembership.portal_role,status:existingMembership.status,updated_at:new Date().toISOString()}).eq('id',existingMembership.id);
    }else{
      await db.from('client_portal_memberships').delete().eq('user_id',account.id);
    }
    if(createdProfile&&account?.id)await db.from('profiles').delete().eq('id',account.id);
    if(createdAuth&&account?.id)await db.auth.admin.deleteUser(account.id);
    return json({error:'Unable to send client portal invitation.',detail:ej?.message||'Email provider rejected the request'},502);
  }

  return json({
    ok:true,
    message:existingProfile?'Client portal access link sent.':'Client portal invitation sent.',
    portal_role:portalRole,
    email_id:ej?.id||null
  });
 }catch(e){
  return json({error:e instanceof Error?e.message:'Client portal invitation failed'},500);
 }
});
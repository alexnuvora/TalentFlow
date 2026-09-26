import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'
};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const shell=(title:string,body:string)=>`<!doctype html><html><body style="margin:0;background:#f2f5f3;font-family:Arial,Helvetica,sans-serif;color:#10201d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:34px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #d9e2de"><tr><td style="padding:28px 34px;background:#10201d"><div style="font-size:19px;font-weight:800;letter-spacing:4px;color:#fff">VORLEN</div><div style="margin-top:5px;font-size:10px;letter-spacing:1.7px;color:#8fe3c2">SECURE RECRUITMENT WORKSPACE</div></td></tr><tr><td style="padding:36px 34px"><h1 style="margin:0 0 22px;font-size:28px;line-height:1.15;color:#10201d">${title}</h1>${body}</td></tr><tr><td style="padding:22px 34px;border-top:1px solid #e4ebe8;color:#6a7b75;font-size:11px;line-height:1.6">Vorlen · VORLEN T/A IVY AND PEARLS LTD · Company No. 17387520<br><a href="https://www.vorlen.co.uk" style="color:#0b6b55">www.vorlen.co.uk</a> · contact@vorlen.co.uk</td></tr></table></td></tr></table></body></html>`;

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    const auth=req.headers.get('Authorization');
    if(!auth)return json({error:'Authentication required'},401);

    const url=Deno.env.get('SUPABASE_URL')!;
    const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const udb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const{data:{user}}=await udb.auth.getUser();
    if(!user)return json({error:'Authentication required'},401);

    const db=createClient(url,service);
    const{data:me}=await db.from('profiles').select('company_id,role').eq('id',user.id).single();
    if(!me||!['owner','manager'].includes(me.role))return json({error:'Owner or manager access required'},403);

    const b=await req.json();

    if(b.action==='list'){
      const{data:p}=await db.from('profiles').select('id,full_name,role,client_id,created_at').eq('company_id',me.company_id);
      const{data:u}=await db.auth.admin.listUsers({page:1,perPage:1000});
      const m=new Map((u?.users||[]).map((x:any)=>[x.id,x.email]));
      return json({users:(p||[]).map((x:any)=>({...x,email:m.get(x.id)||''})),health:{database:true,email:!!Deno.env.get('RESEND_API_KEY'),ai:!!(Deno.env.get('AI_API_KEY')||Deno.env.get('OPENAI_API_KEY'))}});
    }

    if(b.action==='invite'){
      const email=String(b.email||'').trim().toLowerCase();
      const role=String(b.role||'recruiter');
      const fullName=String(b.full_name||'').trim();
      const partnerSpecialism=String(b.partner_specialism||'b2b_advisor');
      if(role==='partner'&&!['b2b_advisor','lead_closer','candidate_sourcer','hybrid'].includes(partnerSpecialism))return json({error:'Valid partner specialism required'},400);
      if(!/^\S+@\S+\.\S+$/.test(email)||!['owner','manager','recruiter','partner','viewer'].includes(role))return json({error:'Valid email and role required'},400);
      if(role==='owner'&&me.role!=='owner')return json({error:'Only an owner can invite another owner'},403);
      if(role==='viewer'&&!b.client_id)return json({error:'Client required'},400);

      if(role==='viewer'){
        const{data:client}=await db.from('clients').select('id,company_name').eq('id',b.client_id).eq('company_id',me.company_id).maybeSingle();
        if(!client)return json({error:'Client does not belong to this workspace'},400);
      }

      const{data:profiles}=await db.from('profiles').select('id,role,client_id').eq('company_id',me.company_id);
      const{data:users}=await db.auth.admin.listUsers({page:1,perPage:1000});
      const existing=(users?.users||[]).find((x:any)=>String(x.email||'').toLowerCase()===email);
      const existingProfile=existing?(profiles||[]).find((p:any)=>p.id===existing.id):null;

      if(existingProfile&&(existingProfile.role!==role||(role==='viewer'&&existingProfile.client_id!==b.client_id))){
        return json({error:'This email already has different access in this workspace',code:'already_has_workspace_access',user_id:existing.id,role:existingProfile.role},409);
      }

      const configured='https://www.vorlen.co.uk';
      const requestOrigin=req.headers.get('origin')||'';
      const allowed=/^https:\/\/(?:www\.)?vorlen\.co\.uk$/i.test(requestOrigin)?requestOrigin:'';
      const base=configured||allowed||'https://vorlen.co.uk';
      const resendKey=Deno.env.get('RESEND_API_KEY');
      if(!resendKey)return json({error:'Portal invitation email is not configured.'},503);

      let invitedUser:any=existing||null;
      let actionLink='';
      const workspaceTarget=role==='viewer'?'/client':role==='partner'?'/dashboard/partner-onboarding':'/dashboard';
      const vorlenConfirm=(link:any,type:string,next:string)=>{const raw=link?.properties?.hashed_token||(()=>{try{return new URL(link?.properties?.action_link||'').searchParams.get('token')||''}catch{return''}})();if(!raw)return'';return `${base}/auth/confirm?token_hash=${encodeURIComponent(raw)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent(next)}`};
      let created=false;
      let message=role==='partner'?'Partner invitation sent.':role==='viewer'?'Client portal invitation sent.':'Workspace invitation sent.';

      if(existing&&existingProfile){
        const{data:link,error:linkError}=await db.auth.admin.generateLink({type:'magiclink',email,options:{redirectTo:`${base}${workspaceTarget}`}});
        if(linkError||!link?.properties?.action_link)return json({error:linkError?.message||'Could not generate a secure Vorlen access link.'},400);
        actionLink=vorlenConfirm(link,'email',workspaceTarget);
        if(!actionLink)return json({error:'Could not create a secure Vorlen access link.'},500);
        message=role==='partner'?'Partner workspace access link sent.':role==='viewer'?'Client portal access link sent.':'Workspace access link sent.';
      }else{
        const{data:link,error:linkError}=await db.auth.admin.generateLink({
          type:'invite',
          email,
          options:{redirectTo:`${base}/reset-password`,data:{full_name:fullName,invited_role:role}}
        });
        if(linkError||!link?.user||!link?.properties?.action_link)return json({error:linkError?.message||'Could not generate client invitation.'},400);
        invitedUser=link.user;
        actionLink=vorlenConfirm(link,'invite','/reset-password');
        if(!actionLink){await db.auth.admin.deleteUser(link.user.id);return json({error:'Could not create a secure Vorlen invitation link.'},500)}
        created=true;

        const{error:profileError}=await db.from('profiles').upsert({
          id:invitedUser.id,
          company_id:me.company_id,
          full_name:fullName||null,
          role,
          client_id:role==='viewer'?b.client_id:null
        });
        if(profileError){
          await db.auth.admin.deleteUser(invitedUser.id);
          return json({error:'Profile creation failed'},500);
        }
      }

      if(role==='partner'){
        const{data:existingOnboarding}=await db.from('partner_onboarding').select('partner_id').eq('partner_id',invitedUser.id).eq('company_id',me.company_id).maybeSingle();
        if(!existingOnboarding){
          const{error:partnerInitError}=await db.rpc('service_initialise_partner_onboarding',{
            p_company:me.company_id,
            p_partner:invitedUser.id,
            p_specialism:partnerSpecialism
          });
          if(partnerInitError){
            if(created&&invitedUser?.id){
              await db.from('profiles').delete().eq('id',invitedUser.id).eq('company_id',me.company_id);
              await db.auth.admin.deleteUser(invitedUser.id);
            }
            return json({error:'Partner onboarding could not be initialised.',detail:partnerInitError.message},500);
          }
        }
      }

      const subject=role==='partner'
        ?(existingProfile?'Your Vorlen partner workspace access':'You have been invited to the Vorlen Partner Network')
        :role==='viewer'
          ?(existingProfile?'Your Vorlen client portal access':'You have been invited to the Vorlen client portal')
          :(existingProfile?'Your Vorlen workspace access':'You have been invited to Vorlen');
      const html=role==='partner'
        ?(existingProfile
          ?shell('Your Vorlen partner workspace',`<p style="font-size:15px;line-height:1.7">Hello ${esc(fullName||'there')},</p><p style="font-size:15px;line-height:1.7">A fresh secure link has been generated for your Vorlen partner workspace.</p><p style="margin:26px 0"><a href="${actionLink}" style="display:inline-block;padding:13px 20px;background:#0b6b55;color:#fff;text-decoration:none;font-weight:700;border-radius:999px">Open partner workspace</a></p><p style="color:#667972;font-size:13px;line-height:1.6">If onboarding is not complete, Vorlen will take you directly to the remaining agreement and profile steps.</p>`)
          :shell('Welcome to the Vorlen Partner Network',`<p style="font-size:15px;line-height:1.7">Hello ${esc(fullName||'there')},</p><p style="font-size:15px;line-height:1.7">You have been invited to work with Vorlen as an independent recruitment partner. Set your password, review and accept the partner agreement, complete your partner details, then Vorlen will activate your operational workspace.</p><p style="margin:26px 0"><a href="${actionLink}" style="display:inline-block;padding:13px 20px;background:#0b6b55;color:#fff;text-decoration:none;font-weight:700;border-radius:999px">Accept partner invitation</a></p><p style="color:#667972;font-size:13px;line-height:1.6">The invitation is time-limited. If it expires, ask your Vorlen contact for a new invitation.</p>`))
        :role==='viewer'
          ?(existingProfile
            ?shell('Your Vorlen client portal',`<p style="font-size:15px;line-height:1.7">Hello ${esc(fullName||'there')},</p><p style="font-size:15px;line-height:1.7">A fresh secure link has been generated for your client workspace.</p><p style="margin:26px 0"><a href="${actionLink}" style="display:inline-block;padding:13px 20px;background:#0b6b55;color:#fff;text-decoration:none;font-weight:700;border-radius:999px">Open client portal</a></p>`)
            :shell('You have been invited to Vorlen',`<p style="font-size:15px;line-height:1.7">Hello ${esc(fullName||'there')},</p><p style="font-size:15px;line-height:1.7">You have been invited to a secure Vorlen client workspace.</p><p style="margin:26px 0"><a href="${actionLink}" style="display:inline-block;padding:13px 20px;background:#0b6b55;color:#fff;text-decoration:none;font-weight:700;border-radius:999px">Accept invitation</a></p>`))
          :(existingProfile
            ?shell('Your Vorlen workspace',`<p style="font-size:15px;line-height:1.7">Hello ${esc(fullName||'there')},</p><p style="font-size:15px;line-height:1.7">A fresh secure link has been generated for your Vorlen workspace.</p><p style="margin:26px 0"><a href="${actionLink}" style="display:inline-block;padding:13px 20px;background:#0b6b55;color:#fff;text-decoration:none;font-weight:700;border-radius:999px">Open workspace</a></p>`)
            :shell('You have been invited to Vorlen',`<p style="font-size:15px;line-height:1.7">Hello ${esc(fullName||'there')},</p><p style="font-size:15px;line-height:1.7">You have been invited to the secure Vorlen recruitment workspace.</p><p style="margin:26px 0"><a href="${actionLink}" style="display:inline-block;padding:13px 20px;background:#0b6b55;color:#fff;text-decoration:none;font-weight:700;border-radius:999px">Accept invitation</a></p>`));

      const mail=await fetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{Authorization:'Bearer '+resendKey,'Content-Type':'application/json'},
        body:JSON.stringify({
          from:'Vorlen <contact@vorlen.co.uk>',
          to:[email],
          reply_to:'contact@vorlen.co.uk',
          subject,
          html
        })
      });
      const mailBody=await mail.json().catch(()=>({}));
      if(!mail.ok){
        if(created&&invitedUser?.id){
          await db.from('profiles').delete().eq('id',invitedUser.id).eq('company_id',me.company_id);
          await db.auth.admin.deleteUser(invitedUser.id);
        }
        return json({error:'Unable to send the Vorlen invitation.',detail:mailBody?.message||mailBody?.name||'Email provider rejected the request'},mail.status>=400&&mail.status<500?424:502);
      }

      return json({ok:true,user_id:invitedUser.id,message,email_id:mailBody?.id||null,access_link_resent:!!existingProfile});
    }

    if(b.action==='delete'){
      if(me.role!=='owner')return json({error:'Only the CEO/owner can delete workspace users'},403);
      const targetId=String(b.user_id||'').trim();
      if(!targetId)return json({error:'user_id required'},400);
      if(targetId===user.id)return json({error:'You cannot delete your own CEO/owner account'},409);

      const{data:target,error:targetError}=await db.from('profiles')
        .select('id,full_name,role,client_id')
        .eq('id',targetId)
        .eq('company_id',me.company_id)
        .maybeSingle();
      if(targetError)return json({error:targetError.message},400);
      if(!target)return json({error:'Workspace user not found'},404);

      if(target.role==='owner'){
        const{count}=await db.from('profiles').select('id',{count:'exact',head:true}).eq('company_id',me.company_id).eq('role','owner');
        if((count||0)<=1)return json({error:'The workspace must keep at least one owner'},409);
      }

      if(target.role==='partner'){
        const{data:onboarding,error:onboardingReadError}=await db.from('partner_onboarding').select('status').eq('partner_id',target.id).eq('company_id',me.company_id).maybeSingle();
        if(onboardingReadError)return json({error:'Partner status could not be checked.',detail:onboardingReadError.message},400);
        if(onboarding&&onboarding.status!=='terminated'){
          const{error:terminateError}=await db.from('partner_onboarding').update({
            status:'terminated',
            reviewed_by:user.id,
            reviewed_at:new Date().toISOString(),
            updated_at:new Date().toISOString()
          }).eq('partner_id',target.id).eq('company_id',me.company_id);
          if(terminateError)return json({error:'Partner relationship could not be terminated before deletion.',detail:terminateError.message},409);
        }
      }

      const{error:authDeleteError}=await db.auth.admin.deleteUser(target.id);
      if(authDeleteError){
        return json({
          error:'This user could not be hard-deleted because retained audit, financial or recruitment records still reference the account.',
          detail:authDeleteError.message,
          code:'retained_records_block_delete'
        },409);
      }

      return json({ok:true,user_id:target.id,message:`Deleted ${target.full_name||'workspace user'} and removed their login access.`});
    }

    if(b.action==='role'){
      if(!['owner','manager','recruiter','partner','viewer'].includes(b.role))return json({error:'Invalid role'},400);
      const partnerSpecialism=String(b.partner_specialism||'b2b_advisor');
      if(b.role==='partner'&&!['b2b_advisor','lead_closer','candidate_sourcer','hybrid'].includes(partnerSpecialism))return json({error:'Valid partner specialism required'},400);
      const{data:target}=await db.from('profiles').select('id,role,client_id').eq('id',b.user_id).eq('company_id',me.company_id).maybeSingle();
      if(!target)return json({error:'Workspace user not found'},404);
      if(target.role==='owner'&&me.role!=='owner')return json({error:'Only an owner can change an owner account'},403);
      if(b.role==='owner'&&me.role!=='owner')return json({error:'Only an owner can assign the owner role'},403);
      if(target.role==='owner'&&b.role!=='owner'){
        const{count}=await db.from('profiles').select('id',{count:'exact',head:true}).eq('company_id',me.company_id).eq('role','owner');
        if((count||0)<=1)return json({error:'The workspace must keep at least one owner'},409);
      }
      if(b.role==='viewer'&&!b.client_id)return json({error:'Client required for viewer access'},400);

      let priorPartnerStatus:string|null=null;
      if(target.role==='partner'&&b.role!=='partner'){
        const{data:onboarding}=await db.from('partner_onboarding').select('status').eq('partner_id',target.id).eq('company_id',me.company_id).maybeSingle();
        priorPartnerStatus=onboarding?.status||null;
        if(onboarding&&onboarding.status!=='terminated'){
          if(me.role!=='owner')return json({error:'Only the CEO/owner can convert an active partner account to another workspace role.'},403);
          const{error:terminateError}=await db.from('partner_onboarding').update({
            status:'terminated',
            reviewed_by:user.id,
            reviewed_at:new Date().toISOString(),
            updated_at:new Date().toISOString()
          }).eq('partner_id',target.id).eq('company_id',me.company_id);
          if(terminateError)return json({error:'Partner relationship could not be terminated before the role change.',detail:terminateError.message},400);
        }
      }
      if(target.role!=='partner'&&b.role==='partner'){
        const{data:oldPartner}=await db.from('partner_onboarding').select('status').eq('partner_id',target.id).eq('company_id',me.company_id).maybeSingle();
        if(oldPartner?.status==='terminated'){
          return json({error:'This account has a terminated partner relationship. Create and approve a new partner engagement before restoring partner access.'},409);
        }
      }

      const{error}=await db.from('profiles').update({role:b.role,client_id:b.role==='viewer'?b.client_id:null}).eq('id',b.user_id).eq('company_id',me.company_id);
      if(error){
        if(target.role==='partner'&&b.role!=='partner'&&priorPartnerStatus&&priorPartnerStatus!=='terminated'){
          await db.from('partner_onboarding').update({status:priorPartnerStatus,updated_at:new Date().toISOString()}).eq('partner_id',target.id).eq('company_id',me.company_id);
        }
        return json({error:error.message},400);
      }

      if(b.role==='partner'&&target.role!=='partner'){
        const{error:initError}=await db.rpc('service_initialise_partner_onboarding',{
          p_company:me.company_id,
          p_partner:b.user_id,
          p_specialism:partnerSpecialism
        });
        if(initError){
          await db.from('profiles').update({role:target.role,client_id:target.client_id||null}).eq('id',b.user_id).eq('company_id',me.company_id);
          return json({error:'Partner onboarding could not be initialised.',detail:initError.message},500);
        }
      }
      return json({ok:true});
    }

    return json({error:'Invalid action'},400);
  }catch(e){
    return json({error:e instanceof Error?e.message:'Admin action failed'},500);
  }
});

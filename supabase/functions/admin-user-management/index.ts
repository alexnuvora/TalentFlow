import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'
};
const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

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
      let created=false;
      let message='Client portal invitation sent.';

      if(existing&&existingProfile){
        const{data:link,error:linkError}=await db.auth.admin.generateLink({type:'magiclink',email,options:{redirectTo:`${base}/client`}});
        if(linkError||!link?.properties?.action_link)return json({error:linkError?.message||'Could not generate a secure client access link.'},400);
        actionLink=link.properties.action_link;
        message='Client portal access link sent.';
      }else{
        const{data:link,error:linkError}=await db.auth.admin.generateLink({
          type:'invite',
          email,
          options:{redirectTo:`${base}/reset-password`,data:{full_name:fullName,invited_role:role}}
        });
        if(linkError||!link?.user||!link?.properties?.action_link)return json({error:linkError?.message||'Could not generate client invitation.'},400);
        invitedUser=link.user;
        actionLink=link.properties.action_link;
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

      const subject=existingProfile?'Your Vorlen client portal access':'You have been invited to the Vorlen client portal';
      const html=existingProfile
        ?`<p>Hello ${esc(fullName||'there')},</p><p>A fresh secure link has been generated for your Vorlen client portal.</p><p><a href="${actionLink}">Open client portal</a></p><p>If you were not expecting this email, you can ignore it.</p><p>Kind regards,<br>Vorlen</p>`
        :`<p>Hello ${esc(fullName||'there')},</p><p>You have been invited to the Vorlen client portal.</p><p><a href="${actionLink}">Accept invitation and set your password</a></p><p>This secure link is time-limited. If it expires, ask Vorlen to send a new invitation.</p><p>Kind regards,<br>Vorlen</p>`;

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
        return json({error:'Unable to send the client portal invitation.',detail:mailBody?.message||mailBody?.name||'Email provider rejected the request'},mail.status>=400&&mail.status<500?424:502);
      }

      return json({ok:true,user_id:invitedUser.id,message,email_id:mailBody?.id||null,access_link_resent:!!existingProfile});
    }

    if(b.action==='role'){
      if(!['owner','manager','recruiter','partner','viewer'].includes(b.role))return json({error:'Invalid role'},400);
      const{data:target}=await db.from('profiles').select('id,role').eq('id',b.user_id).eq('company_id',me.company_id).maybeSingle();
      if(!target)return json({error:'Workspace user not found'},404);
      if(target.role==='owner'&&me.role!=='owner')return json({error:'Only an owner can change an owner account'},403);
      if(b.role==='owner'&&me.role!=='owner')return json({error:'Only an owner can assign the owner role'},403);
      if(target.role==='owner'&&b.role!=='owner'){
        const{count}=await db.from('profiles').select('id',{count:'exact',head:true}).eq('company_id',me.company_id).eq('role','owner');
        if((count||0)<=1)return json({error:'The workspace must keep at least one owner'},409);
      }
      if(b.role==='viewer'&&!b.client_id)return json({error:'Client required for viewer access'},400);
      const{error}=await db.from('profiles').update({role:b.role,client_id:b.role==='viewer'?b.client_id:null}).eq('id',b.user_id).eq('company_id',me.company_id);
      if(error)return json({error:error.message},400);
      return json({ok:true});
    }

    return json({error:'Invalid action'},400);
  }catch(e){
    return json({error:e instanceof Error?e.message:'Admin action failed'},500);
  }
});

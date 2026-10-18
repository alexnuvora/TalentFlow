import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
const allowed=new Set(['https://www.vorlen.co.uk','https://vorlen.co.uk']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Access-Control-Allow-Origin':allowed.has(origin)?origin:'https://www.vorlen.co.uk','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 if(!allowed.has(origin))return reply({error:'Origin not allowed'},403);
 try{
  const b=await req.json();
  const name=String(b.name||'').trim().slice(0,150),email=String(b.email||'').trim().toLowerCase().slice(0,250),company=String(b.company||'').trim().slice(0,200),reason=String(b.reason||''),message=String(b.message||'').trim().slice(0,5000),roleTitle=String(b.role_title||'').trim().slice(0,180),sourcePage=String(b.source_page||'').trim().slice(0,150),utmSource=String(b.utm_source||'').trim().slice(0,80),utmCampaign=String(b.utm_campaign||'').trim().slice(0,80);
  if(b.website)return reply({ok:true});
  if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||!['employer','candidate','partner'].includes(reason)||message.length<15)return reply({error:'Please provide a valid name, email, enquiry type and at least 15 characters of detail.'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const since=new Date(Date.now()-15*60*1000).toISOString();
  const {count,error:rateError}=await db.from('public_enquiries').select('id',{head:true,count:'exact'}).eq('email',email).gte('created_at',since);
  if(rateError)throw rateError;
  if((count||0)>=3)return reply({error:'Please wait before submitting another enquiry or email contact@vorlen.co.uk.'},429);
  const {data,error}=await db.from('public_enquiries').insert({name,email,company:company||null,reason,message,role_title:roleTitle||null,source_page:sourcePage||null,utm_source:utmSource||null,utm_campaign:utmCampaign||null}).select('id').single();
  if(error)throw error;
  const apiKey=Deno.env.get('RESEND_API_KEY');
  if(apiKey){
   try{
    const er=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({from:Deno.env.get('VORLEN_ENQUIRY_FROM')||'Vorlen Enquiries <notifications@vorlen.co.uk>',to:['contact@vorlen.co.uk'],reply_to:email,subject:'New Vorlen '+reason+' enquiry',text:'Name: '+name+'\nEmail: '+email+'\nCompany: '+company+'\nVacancy: '+roleTitle+'\nType: '+reason+'\nSource: '+sourcePage+'\n\n'+message})});
    await db.from('public_enquiries').update({notification_status:er.ok?'sent':'failed',notification_error:er.ok?null:'Provider returned '+er.status}).eq('id',data.id);
   }catch{await db.from('public_enquiries').update({notification_status:'failed',notification_error:'Notification transport error'}).eq('id',data.id)}
  }
  return reply({ok:true,reference:data.id});
 }catch(e){console.error('public-enquiry',e);return reply({error:'Unable to save your enquiry. Please email contact@vorlen.co.uk.'},500)}
});
import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';

const started=process.env.VORLEN_E2E_STARTED_AT||new Date(Date.now()-15*60_000).toISOString();
const ended=new Date().toISOString();
const out={window:{started,ended},browser:'See Playwright report/test-results for console, page errors and HTTP 4xx/5xx.',database:{},supabaseLogs:{},vercel:{}};

async function databaseChecks(){
  const url=process.env.VORLEN_SUPABASE_URL;
  const key=process.env.VORLEN_SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key){out.database={status:'skipped',reason:'Supabase service-role credentials not configured'};return}
  const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await sb.from('outbound_deliveries')
    .select('id,kind,provider,status,last_error,created_at,sent_at')
    .gte('created_at',started)
    .order('created_at',{ascending:false})
    .limit(200);
  if(error){out.database={status:'error',error:error.message};return}
  const failed=(data||[]).filter(x=>x.last_error||['failed','bounced','rejected'].includes(String(x.status||'').toLowerCase()));
  out.database={status:failed.length?'failures_found':'ok',outbound_delivery_failures:failed};
}

async function supabaseLogChecks(){
  const token=process.env.SUPABASE_ACCESS_TOKEN;
  const url=process.env.VORLEN_SUPABASE_URL||'';
  const ref=process.env.SUPABASE_PROJECT_REF||url.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if(!token||!ref){out.supabaseLogs={status:'skipped',reason:'SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_REF not configured'};return}
  const queries={
    api_errors:`select timestamp, toInt32OrZero(log_attributes['response.status_code']) as status, log_attributes['request.method'] as method, log_attributes['request.path'] as path, event_message from logs where source='edge_logs' and toInt32OrZero(log_attributes['response.status_code'])>=400 order by timestamp desc limit 200`,
    function_errors:`select timestamp, source, severity_text, event_message from logs where source in ('function_edge_logs','function_logs') and (severity_text in ('ERROR','FATAL') or match(lower(event_message),'error|exception|failed')) order by timestamp desc limit 200`,
    postgres_errors:`select timestamp, log_attributes['parsed.sql_state_code'] as sqlstate, log_attributes['parsed.user_name'] as role, event_message from logs where source='postgres_logs' and (log_attributes['parsed.sql_state_code']!='' or log_attributes['parsed.error_severity'] in ('ERROR','FATAL','PANIC')) order by timestamp desc limit 200`
  };
  const result={status:'ok'};
  for(const [name,sql] of Object.entries(queries)){
    const u=new URL('https://api.supabase.com/v1/projects/'+ref+'/analytics/endpoints/logs.all');
    u.searchParams.set('sql',sql);u.searchParams.set('iso_timestamp_start',started);u.searchParams.set('iso_timestamp_end',ended);
    const res=await fetch(u,{headers:{Authorization:'Bearer '+token}});
    const body=await res.text();
    if(!res.ok){result[name]={status:'error',http_status:res.status,body:body.slice(0,1000)};result.status='partial';continue}
    try{result[name]=JSON.parse(body)}catch{result[name]=body.slice(0,5000)}
  }
  out.supabaseLogs=result;
}

async function vercelChecks(){
  const token=process.env.VERCEL_TOKEN,projectId=process.env.VERCEL_PROJECT_ID,teamId=process.env.VERCEL_TEAM_ID;
  if(!token||!projectId){out.vercel={status:'skipped',reason:'VERCEL_TOKEN/VERCEL_PROJECT_ID not configured'};return}
  const q=new URLSearchParams({projectId,target:'production',limit:'1'});
  if(teamId)q.set('teamId',teamId);
  const dr=await fetch('https://api.vercel.com/v13/deployments?'+q,{headers:{Authorization:'Bearer '+token}});
  if(!dr.ok){out.vercel={status:'error',stage:'deployments',http_status:dr.status,body:(await dr.text()).slice(0,1000)};return}
  const deployments=(await dr.json()).deployments||[];
  const deployment=deployments[0];
  if(!deployment){out.vercel={status:'error',stage:'deployments',message:'No production deployment found'};return}
  const eq=new URLSearchParams();
  if(teamId)eq.set('teamId',teamId);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12_000);
  try{
    const er=await fetch('https://api.vercel.com/v3/deployments/'+deployment.uid+'/events?'+eq,{
      headers:{Authorization:'Bearer '+token,Accept:'application/stream+json'},
      signal:controller.signal
    });
    const body=await er.text();
    const lines=body.split('\n').filter(Boolean).slice(-500);
    const events=[];
    for(const line of lines){try{events.push(JSON.parse(line))}catch{}}
    const bad=events.filter(e=>{
      const txt=JSON.stringify(e).toLowerCase();
      return txt.includes('"level":"error"')||txt.includes('exception')||txt.includes('unhandled')||txt.includes('"status":500')||txt.includes('"statuscode":500');
    });
    out.vercel={status:er.ok?(bad.length?'runtime_errors_found':'ok'):'error',deployment:{uid:deployment.uid,url:deployment.url,state:deployment.state,created:deployment.created},runtime_errors:bad.slice(0,100),http_status:er.status};
  }catch(e){
    out.vercel={status:'partial',deployment:{uid:deployment.uid,url:deployment.url,state:deployment.state,created:deployment.created},reason:'Runtime log stream timed out or was unavailable: '+String(e?.message||e)};
  }finally{clearTimeout(timer)}
}

await Promise.allSettled([databaseChecks(),supabaseLogChecks(),vercelChecks()]);
fs.writeFileSync('production-e2e-observability.json',JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));

const hardFailures=
  out.database?.status==='error'||
  out.supabaseLogs?.status==='error'||
  out.vercel?.status==='error'||
  (out.database?.outbound_delivery_failures?.length||0)>0;
if(hardFailures)process.exitCode=1;

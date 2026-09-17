import fs from 'node:fs/promises';
import path from 'node:path';
import {loadEnv} from 'vite';
import {escapeHtml as esc,safeSlug,plainText,jobSchema} from './seo-utils.mjs';
const env={...loadEnv('production',process.cwd(),''),...process.env},dist=path.resolve('dist');
const base=String(env.VITE_APP_URL||'https://talentflow-nu-neon.vercel.app').replace(/\/$/,'');
if(new URL(base).protocol!=='https:')throw new Error('VITE_APP_URL must use HTTPS');
const template=await fs.readFile(path.join(dist,'index.html'),'utf8');
async function jobs(){
 if(!env.VITE_SUPABASE_URL||!env.VITE_SUPABASE_ANON_KEY)return [];
 const fields='slug,title,description,requirements,location,employment_type,application_mode,created_at';
 try{const r=await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/jobs?select=${encodeURIComponent(fields)}&status=eq.published&order=created_at.desc&limit=1000`,{headers:{apikey:env.VITE_SUPABASE_ANON_KEY},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error('Public jobs returned '+r.status);const data=await r.json();if(!Array.isArray(data))throw new Error('Invalid job response');return data.filter(j=>safeSlug(j.slug));
 }catch(e){if(env.CI==='true'){console.warn('SEO job snapshot unavailable:',e.message);return [];}throw e;}
}
function page(title,description,route,body,schema){
 const metadata=`<meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${esc(base+route)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(base+route)}"><meta name="twitter:card" content="summary"><script type="application/ld+json" data-talentflow-schema>${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`;
 return template.replace(/<title>[\s\S]*?<\/title>/,'<title>'+esc(title)+'</title>').replace(/<meta\b[^>]*(?:name|property)=["'](?:description|robots|og:[^"']*|twitter:[^"']*)["'][^>]*>/gi,'').replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi,'').replace('</head>',metadata+'</head>').replace('<div id="root"></div>',`<div id="root">${body}</div>`);
}
async function write(route,html){const dir=path.join(dist,...route.split('/').filter(Boolean));await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'index.html'),html);}
const rows=await jobs();
await write('/',page('TalentFlow | Recruitment operations software','Manage candidates, client submissions, interviews, placements and billing in one workspace.','/', '<main><h1>Run the recruitment desk. Not the admin around it.</h1><p>TalentFlow is recruitment operations software for agencies.</p><h2>Connected recruitment workflows</h2><p>Manage jobs, applications, candidate screening, client submissions, interviews, placements and recruitment invoices.</p><h2>Plans</h2><ul><li>Starter: £49/month — 1 recruiter, 10 active jobs, 2,500 candidates.</li><li>Growth: £99/month — 5 recruiters, 50 active jobs, 25,000 candidates and automations.</li><li>Scale: £199/month — 15 recruiters, 200 active jobs and 100,000 candidates.</li></ul><a href="/signup">Start a 14-day free trial</a><a href="/careers">Browse opportunities</a><a href="/privacy">Privacy</a></main>',{'@context':'https://schema.org','@type':'SoftwareApplication',name:'TalentFlow',applicationCategory:'BusinessApplication',operatingSystem:'Web',url:base,offers:[49,99,199].map(price=>({'@type':'Offer',price,priceCurrency:'GBP'}))}));

await write('/careers',page('Recruitment opportunities | TalentFlow Careers','Browse current roles and talent pools published by recruitment teams.','/careers',`<main><h1>Find your next opportunity</h1><ul>${rows.map(j=>`<li><a href="/careers/${j.slug}">${esc(j.title)}</a> — ${esc(j.location||'Location flexible')}${j.application_mode==='register_interest'?' · Register interest':''}</li>`).join('')}</ul><noscript>Enable JavaScript to search and apply.</noscript></main>`,{'@context':'https://schema.org','@type':'CollectionPage',name:'TalentFlow Careers',url:base+'/careers'}));
for(const j of rows){const route='/careers/'+j.slug;await write(route,page(j.title+' | TalentFlow Careers',plainText(j.description).slice(0,155),route,`<main><a href="/careers">All opportunities</a><h1>${esc(j.title)}</h1><p>${esc(j.location)}</p>${j.application_mode==='register_interest'?'<p>Register interest in a talent pool. This is not a confirmed vacancy or client submission.</p>':''}<h2>About the opportunity</h2><p>${esc(plainText(j.description))}</p><h2>Requirements</h2><ul>${(Array.isArray(j.requirements)?j.requirements:[]).map(x=>'<li>'+esc(x)+'</li>').join('')}</ul><noscript>Enable JavaScript to apply securely.</noscript></main>`,jobSchema(j,base+route)));}
const routes=['/','/careers','/privacy','/candidate-terms','/accessibility',...rows.map(j=>'/careers/'+j.slug)];
await fs.writeFile(path.join(dist,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(r=>'<url><loc>'+esc(base+r)+'</loc></url>').join('')}</urlset>`);
await fs.writeFile(path.join(dist,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
console.log(`SEO: ${rows.length} public opportunity snapshots; private routes excluded from sitemap.`);

import fs from 'node:fs/promises';
import path from 'node:path';
import {loadEnv} from 'vite';

const env={...loadEnv('production',process.cwd(),''),...process.env};
const dist=path.resolve('dist');
const base=String(env.VITE_APP_URL||'https://www.vorlen.co.uk').replace(/\/$/,'');
const sb=env.VITE_SUPABASE_URL;
const key=env.VITE_SUPABASE_ANON_KEY;
const RELEASE_LASTMOD='2026-09-22';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xml=s=>esc(s);
const strip=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

async function jobs(){
  if(!sb||!key)return[];
  const fields='slug,title,description,location,employment_type,commission_text,salary_min,salary_max,application_mode,created_at,updated_at';
  const url=`${sb}/rest/v1/jobs?select=${encodeURIComponent(fields)}&status=eq.published&order=created_at.desc`;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const r=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(8000)});
      if(r.ok)return await r.json();
      console.warn('SEO build: public jobs unavailable',r.status,`attempt ${attempt}/3`);
    }catch(e){
      console.warn('SEO build: public jobs fetch failed',e instanceof Error?e.message:String(e),`attempt ${attempt}/3`);
    }
    if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*500));
  }
  console.warn('SEO build: continuing without dynamic job pages; runtime careers remain available.');
  return[];
}

function inject(html,{title,description,canonical,jsonLd}){
  const image=`${base}/vorlen-logo.svg`;
  const tags=`<meta name="description" content="${esc(description)}"/><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"/><link rel="canonical" href="${esc(canonical)}"/><link rel="alternate" hreflang="en-GB" href="${esc(canonical)}"/><link rel="alternate" hreflang="x-default" href="${esc(canonical)}"/><meta property="og:type" content="website"/><meta property="og:site_name" content="Vorlen"/><meta property="og:locale" content="en_GB"/><meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(description)}"/><meta property="og:url" content="${esc(canonical)}"/><meta property="og:image" content="${esc(image)}"/><meta property="og:image:alt" content="Vorlen — UK permanent recruitment agency"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${esc(title)}"/><meta name="twitter:description" content="${esc(description)}"/><meta name="twitter:image" content="${esc(image)}"/>${jsonLd?`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g,'\\u003c')}</script>`:''}`;
  return html
    .replace(/<title>.*?<\/title>/s,`<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/g,'')
    .replace(/<link rel="canonical"[^>]*>/g,'')
    .replace('</head>',`${tags}</head>`);
}

async function writeRoute(route,html){
  const parts=route.split('/').filter(Boolean).map(x=>{
    const v=decodeURIComponent(x);
    if(!/^[a-z0-9][a-z0-9_-]{0,120}$/i.test(v))throw new Error('Unsafe route slug');
    return v;
  });
  const dir=path.join(dist,...parts);
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'index.html'),html);
}

const template=await fs.readFile(path.join(dist,'index.html'),'utf8');
const rows=await jobs();
const organization={'@id':`${base}/#organization`};
const service=(name,route,description,area='United Kingdom')=>({
  '@context':'https://schema.org','@type':'Service',name,serviceType:name,provider:organization,
  areaServed:{'@type':'AdministrativeArea',name:area},url:`${base}${route}`,description
});

const staticPages=[
  {route:'/careers',title:'Open recruitment opportunities | Vorlen Careers',description:'Browse current permanent recruitment opportunities and apply securely through Vorlen Careers.',lastmod:RELEASE_LASTMOD,jsonLd:{'@context':'https://schema.org','@type':'CollectionPage',name:'Vorlen Careers',url:`${base}/careers`,description:'Current permanent recruitment opportunities published through Vorlen.',isPartOf:{'@id':`${base}/#website`},mainEntity:{'@type':'ItemList',itemListElement:rows.slice(0,50).map((j,i)=>({'@type':'ListItem',position:i+1,url:`${base}/careers/${encodeURIComponent(j.slug)}`,name:j.title}))}}},
  {route:'/contact',title:'Contact Vorlen | UK Permanent Recruitment',description:'Talk to Vorlen about a permanent vacancy, candidate query or recruitment partnership.',lastmod:RELEASE_LASTMOD,jsonLd:{'@context':'https://schema.org','@type':'ContactPage',name:'Contact Vorlen',url:`${base}/contact`,about:organization}},
  {route:'/employers',title:'Recruitment for Employers | Vorlen',description:'Permanent recruitment for UK employers with focused candidate sourcing, human-reviewed introductions and connected recruitment delivery.',lastmod:RELEASE_LASTMOD,jsonLd:service('Permanent recruitment for employers','/employers','Permanent recruitment for UK employers with focused candidate sourcing, human-reviewed introductions and connected recruitment delivery.')},
  {route:'/candidates',title:'For Candidates | Vorlen Recruitment',description:'Explore permanent opportunities through Vorlen with clear role information, secure applications, human review and connected interview activity.',lastmod:RELEASE_LASTMOD,jsonLd:service('Candidate recruitment services','/candidates','Candidate recruitment services for people exploring permanent opportunities in the United Kingdom.')},
  {route:'/services/permanent-recruitment',title:'Permanent Recruitment Services UK | Vorlen',description:'UK permanent recruitment covering vacancy briefing, candidate sourcing, human-reviewed assessment, introductions, interviews and placement support.',lastmod:RELEASE_LASTMOD,jsonLd:service('Permanent recruitment','/services/permanent-recruitment','Permanent recruitment covering vacancy briefing, candidate sourcing, assessment, introductions, interviews and placement support.')},
  {route:'/services/candidate-sourcing',title:'Candidate Sourcing Services UK | Vorlen',description:'Focused candidate sourcing for defined permanent vacancies, combining proactive search with human-reviewed assessment before client introduction.',lastmod:RELEASE_LASTMOD,jsonLd:service('Candidate sourcing','/services/candidate-sourcing','Focused candidate sourcing for defined permanent vacancies, with human review before client introduction.')},
  {route:'/services/recruitment-for-smes',title:'Recruitment for SMEs UK | Vorlen',description:'Permanent recruitment support for UK SMEs that need structured external hiring support without building a large internal recruitment function.',lastmod:RELEASE_LASTMOD,jsonLd:service('Recruitment for small and medium-sized businesses','/services/recruitment-for-smes','Permanent recruitment support for small and medium-sized UK employers.')},
  {route:'/partners',title:'Vorlen Recruitment Partner Network',description:'Learn about Vorlen’s selective partner network for experienced recruitment and business-development professionals working under formal terms and controls.',lastmod:RELEASE_LASTMOD,jsonLd:service('Recruitment partner network','/partners','Selective recruitment partner network for experienced recruitment and business-development professionals.')},
  {route:'/locations/manchester',title:'Recruitment Agency Manchester | Permanent Recruitment | Vorlen',description:'Permanent recruitment support for Manchester employers with focused sourcing, human-reviewed candidate assessment and connected recruitment delivery.',lastmod:RELEASE_LASTMOD,jsonLd:service('Permanent recruitment in Manchester','/locations/manchester','Permanent recruitment support for employers hiring in Manchester.','Manchester, United Kingdom')},
  {route:'/locations/greater-manchester',title:'Recruitment Agency Greater Manchester | Vorlen',description:'Permanent recruitment across Greater Manchester with clear vacancy briefs, focused sourcing and human-reviewed candidate introductions.',lastmod:RELEASE_LASTMOD,jsonLd:service('Permanent recruitment in Greater Manchester','/locations/greater-manchester','Permanent recruitment support for employers across Greater Manchester.','Greater Manchester, United Kingdom')},
  {route:'/privacy',title:'Privacy notice | Vorlen',description:'How Vorlen handles personal information across recruitment, client and partner activity.',lastmod:''},
  {route:'/candidate-terms',title:'Work-seeker terms | Vorlen',description:'Terms on which Vorlen provides permanent recruitment work-finding services to candidates.',lastmod:''},
  {route:'/accessibility',title:'Accessibility | Vorlen',description:'Vorlen accessibility information for candidates, clients and recruitment workspace users.',lastmod:''}
];

for(const page of staticPages){
  await writeRoute(page.route,inject(template,{title:page.title,description:page.description,canonical:`${base}${page.route}`,jsonLd:page.jsonLd}));
}

for(const j of rows){
  const description=strip(j.description||`Apply for ${j.title}${j.location?` in ${j.location}`:''}.`).slice(0,155);
  const canonical=`${base}/careers/${encodeURIComponent(j.slug)}`;
  const schema=j.application_mode==='register_interest'
    ?{'@context':'https://schema.org','@type':'WebPage',name:j.title,description:strip(j.description||j.title),url:canonical}
    :{'@context':'https://schema.org','@type':'JobPosting',title:j.title,description:strip(j.description||j.title),datePosted:j.created_at,dateModified:j.updated_at||j.created_at,employmentType:j.employment_type,url:canonical,directApply:true,jobLocation:j.location?{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:j.location,addressCountry:'GB'}}:undefined};
  if(j.application_mode!=='register_interest'&&(j.salary_min||j.salary_max)){
    schema.baseSalary={'@type':'MonetaryAmount',currency:'GBP',value:{'@type':'QuantitativeValue',minValue:j.salary_min||undefined,maxValue:j.salary_max||undefined,unitText:'YEAR'}};
  }
  await writeRoute(`/careers/${j.slug}`,inject(template,{title:`${j.title} | Vorlen Careers`,description,canonical,jsonLd:schema}));
}

const urls=[
  ['/',RELEASE_LASTMOD],
  ...staticPages.map(p=>[p.route,p.lastmod]),
  ...rows.map(j=>[`/careers/${j.slug}`,j.updated_at||j.created_at||''])
];
const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u,d])=>`  <url><loc>${xml(base+u)}</loc>${d?`<lastmod>${xml(new Date(d).toISOString())}</lastmod>`:''}</url>`).join('\n')}\n</urlset>\n`;
await fs.writeFile(path.join(dist,'sitemap.xml'),sitemap);
await fs.writeFile(path.join(dist,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /login\nDisallow: /client\nDisallow: /candidate?\nDisallow: /review/\nDisallow: /terms/accept\nSitemap: ${base}/sitemap.xml\n`);
console.log(`SEO build: generated ${rows.length} job pages and ${urls.length} sitemap URLs`);

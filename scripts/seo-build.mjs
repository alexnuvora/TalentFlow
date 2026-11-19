import fs from 'node:fs/promises';
import path from 'node:path';
import {loadEnv} from 'vite';
import {crawlLinks,crawlDetails,guideSlug,guideIntro,guideQuestions,guideChecklist,homeMeta} from './seo-content.mjs';

const env={...loadEnv('production',process.cwd(),''),...process.env};
const dist=path.resolve('dist');
const base='https://www.vorlen.co.uk';
const sb=env.VITE_SUPABASE_URL;
const key=env.VITE_SUPABASE_ANON_KEY;
const RELEASE_LASTMOD='2026-11-19';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xml=s=>esc(s);
const strip=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();

async function jobs(){
  if(!sb||!key)return[];
  const fields='slug,title,description,location,employment_type,commission_text,salary_min,salary_max,application_mode,created_at';
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

crawlDetails[guideSlug]=[...guideIntro,...guideQuestions.map(({q,a})=>`${q} ${a}`),...guideChecklist];

function crawlBody(title,description,canonical){
  const path=new URL(canonical).pathname.replace(/\/$/,'')||'/';
  const details=crawlDetails[path]||[
    'Vorlen is a UK permanent recruitment agency. We take the brief, source the candidates, screen them, and stand behind every introduction.',
    "Fees are agreed in writing before any search starts. Every shortlist comes with the recruiter's reasoning, not just CVs."
  ];
  const links=crawlLinks.map(([href,label])=>`<a href="${href}">${esc(label)}</a>`).join(' · ');
  return `<main><h1>${esc(title.replace(/\s*\|\s*Vorlen.*$/i,''))}</h1><p>${esc(description)}</p><h2>Permanent recruitment support</h2><p>${esc(details[0])}</p><p>${esc(details[1])}</p>${path===guideSlug?`<section aria-label="Employer questions and answers"><h2>Choosing an agency: honest answers</h2>${details.slice(2).map((x)=>`<p>${esc(x)}</p>`).join('')}</section>`:''}<h2>More from Vorlen</h2><nav aria-label="Recruitment services">${links}</nav></main>`;
}
function inject(html,{title,description,canonical,jsonLd}){
  const image=`${base}/vorlen-logo.svg`;
  const tags=`<meta name="description" content="${esc(description)}"/><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"/><link rel="canonical" href="${esc(canonical)}"/><link rel="alternate" hreflang="en-GB" href="${esc(canonical)}"/><link rel="alternate" hreflang="x-default" href="${esc(canonical)}"/><meta property="og:type" content="website"/><meta property="og:site_name" content="Vorlen"/><meta property="og:locale" content="en_GB"/><meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(description)}"/><meta property="og:url" content="${esc(canonical)}"/><meta property="og:image" content="${esc(image)}"/><meta property="og:image:alt" content="Vorlen — UK permanent recruitment agency"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${esc(title)}"/><meta name="twitter:description" content="${esc(description)}"/><meta name="twitter:image" content="${esc(image)}"/>${jsonLd?`<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g,'\\u003c')}</script>`:''}`;
  return html
    .replace(/<title>.*?<\/title>/s,`<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/g,'')
    .replace(/<meta (?:name|property)="(?:robots|googlebot|bingbot|og:[^"]+|twitter:[^"]+)"[^>]*>/g,'')
    .replace(/<link rel="canonical"[^>]*>/g,'')
    .replace(/<link rel="alternate" hreflang="(?:en-GB|x-default)"[^>]*>/g,'')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'')
    .replace('</head>',`${tags}</head>`)
    .replace('<div id="root"></div>',`<div id="root">${crawlBody(title,description,canonical)}</div>`);
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

const homePage={title:homeMeta.title,description:homeMeta.description,jsonLd:[{'@context':'https://schema.org','@type':['Organization','EmploymentAgency'],'@id':`${base}/#organization`,name:'Vorlen',legalName:homeMeta.legalName,url:`${base}/`,logo:`${base}/vorlen-logo.svg`,email:'contact@vorlen.co.uk',areaServed:{'@type':'Country',name:'United Kingdom'},identifier:{'@type':'PropertyValue',propertyID:'UK Company Number',value:'17387520'},address:{'@type':'PostalAddress',streetAddress:'Piccadilly Business Centre, Unit C Aldow Enterprise Park, Blackett Street',addressLocality:'Manchester',postalCode:'M12 6AE',addressCountry:'GB'},sameAs:['https://www.linkedin.com/company/vorlen/'],description:homeMeta.orgDescription},{'@context':'https://schema.org','@type':'WebSite','@id':`${base}/#website`,name:'Vorlen',url:`${base}/`,publisher:{'@id':`${base}/#organization`}}]};

const guideJsonLd={'@context':'https://schema.org','@graph':[{'@type':'Article','@id':`${base}${guideSlug}#article`,headline:'Choosing a Recruitment Agency: Fees, Shortlists and Questions to Ask',description:'A practical guide to choosing a UK recruitment agency, comparing fees, candidate assessment, shortlists and replacement terms.',mainEntityOfPage:`${base}${guideSlug}`,publisher:organization,author:{'@id':`${base}/#organization`}},{'@type':'FAQPage',mainEntity:guideQuestions.map(({q,a})=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}]};

const staticPages=[
  {route:'/our-approach',title:'How Vorlen Assesses Candidates | Recruitment Methodology',description:'How Vorlen defines a vacancy, sources candidates, reviews job-related evidence, records recruiter judgement and shares candidate information with permission.',lastmod:RELEASE_LASTMOD,jsonLd:{'@context':'https://schema.org','@type':'WebPage',name:'Vorlen candidate assessment methodology',url:`${base}/our-approach`,about:organization}},
  {route:'/careers',title:'Open recruitment opportunities | Vorlen Careers',description:'Browse current permanent recruitment opportunities and apply securely through Vorlen Careers.',lastmod:RELEASE_LASTMOD,jsonLd:{'@context':'https://schema.org','@type':'CollectionPage',name:'Vorlen Careers',url:`${base}/careers`,description:'Current permanent recruitment opportunities published through Vorlen.',isPartOf:{'@id':`${base}/#website`},mainEntity:{'@type':'ItemList',itemListElement:rows.slice(0,50).map((j,i)=>({'@type':'ListItem',position:i+1,url:`${base}/careers/${encodeURIComponent(j.slug)}`,name:j.title}))}}},
  {route:guideSlug,title:'Choosing a Recruitment Agency: Fees, Shortlists and Questions to Ask | Vorlen',description:'A practical guide to choosing a UK recruitment agency: what fees should look like, what to ask about shortlists, screening and replacement terms, and the answers that separate good agencies from the rest.',lastmod:RELEASE_LASTMOD,jsonLd:guideJsonLd},
  {route:'/guides/employer-recruitment-questions',title:'Recruitment Agency Fees and Hiring FAQs UK | Vorlen',description:'Plain-English answers for UK employers about recruitment agency fees, hiring timelines, vacancy briefs and choosing a permanent recruitment partner.',lastmod:RELEASE_LASTMOD,jsonLd:{'@context':'https://schema.org','@type':'WebPage',name:'UK employer recruitment questions',url:`${base}/guides/employer-recruitment-questions`,about:organization}},
  {route:'/contact',title:'Contact Vorlen | UK Permanent Recruitment',description:'Talk to Vorlen about a permanent vacancy, candidate query or recruitment partnership.',lastmod:RELEASE_LASTMOD,jsonLd:{'@context':'https://schema.org','@type':'ContactPage',name:'Contact Vorlen',url:`${base}/contact`,about:organization}},
  {route:'/employers',title:'Recruitment Agency for Employers UK | Vorlen',description:'UK recruitment agency for permanent hiring: we take your brief, source the market, screen every candidate ourselves and introduce the people worth your time.',lastmod:RELEASE_LASTMOD,jsonLd:service('Permanent recruitment for employers','/employers','Permanent recruitment for UK employers: brief-led sourcing, human-reviewed introductions and interview coordination through to offer.')},
  {route:'/candidates',title:'For Candidates | Vorlen Recruitment',description:'Browse permanent opportunities, read what the job actually involves, and apply online. Your application goes to a recruiter, not a queue.',lastmod:RELEASE_LASTMOD,jsonLd:service('Candidate recruitment services','/candidates','Recruitment services for people exploring permanent opportunities in the United Kingdom.')},
  {route:'/services/permanent-recruitment',title:'UK Permanent Recruitment Agency | Vorlen',description:'Permanent recruitment, brief to placement: sourcing, screening, introductions with reasoning, and interview coordination through to offer.',lastmod:RELEASE_LASTMOD,jsonLd:service('Permanent recruitment','/services/permanent-recruitment','Permanent recruitment covering vacancy briefing, sourcing, assessment, introductions, interviews and placement support.')},
  {route:'/services/candidate-sourcing',title:'Candidate Sourcing Services UK | Vorlen',description:'Proactive candidate sourcing for defined permanent vacancies. We go out and find people, including the ones not actively applying anywhere, then screen before you see them.',lastmod:RELEASE_LASTMOD,jsonLd:service('Candidate sourcing','/services/candidate-sourcing','Proactive candidate sourcing for defined permanent vacancies, with human screening before client introduction.')},
  {route:'/services/recruitment-for-smes',title:'SME Recruitment Agency UK | Vorlen',description:'External recruitment capacity for UK SMEs: one good hire at a time, written fee terms, human-reviewed introductions, no fixed overhead.',lastmod:RELEASE_LASTMOD,jsonLd:service('Recruitment for small and medium-sized businesses','/services/recruitment-for-smes','Permanent recruitment support for small and medium-sized UK employers.')},
  {route:'/sectors/technology',title:'Technology Recruitment Agency UK & Manchester | Vorlen',description:'Permanent technology recruitment for UK and Manchester employers: software, data, cloud, infrastructure, product and technology leadership roles.',lastmod:RELEASE_LASTMOD,jsonLd:service('Technology recruitment','/sectors/technology','Permanent technology recruitment for employers hiring software, data, cloud, infrastructure, product and technology leadership talent.')},
  {route:'/sectors/sales-business-development',title:'Sales Recruitment Agency UK & Manchester | Vorlen',description:'Permanent sales and business development recruitment, built around your buyer, deal cycle, territory and package structure.',lastmod:RELEASE_LASTMOD,jsonLd:service('Sales and business development recruitment','/sectors/sales-business-development','Permanent sales and business development recruitment for UK employers.')},
  {route:'/sectors/finance-accounting',title:'Finance & Accounting Recruitment Agency UK | Vorlen',description:'Permanent finance and accounting recruitment UK-wide, from transactional finance through qualified accountants to finance leadership.',lastmod:RELEASE_LASTMOD,jsonLd:service('Finance and accounting recruitment','/sectors/finance-accounting','Permanent finance and accounting recruitment for UK employers.')},
  {route:'/sectors/engineering',title:'Engineering Recruitment Agency UK & Manchester | Vorlen',description:'Permanent engineering recruitment for UK and Greater Manchester employers, with briefs grounded in discipline, systems and site reality.',lastmod:RELEASE_LASTMOD,jsonLd:service('Engineering recruitment','/sectors/engineering','Permanent engineering recruitment for UK employers.')},
  {route:'/partners',title:'Vorlen Recruitment Partner Network',description:'Vorlen runs a selective partner network for experienced recruiters and business developers. Formal terms, onboarding and approval before anyone works a client.',lastmod:RELEASE_LASTMOD,jsonLd:service('Recruitment partner network','/partners','Selective recruitment partner network for experienced recruitment and business-development professionals.')},
  {route:'/locations/manchester',title:'Permanent Recruitment Agency Manchester | Vorlen',description:'Manchester-based recruitment agency for permanent vacancies: local market knowledge, honest advice on when to widen the search, human-reviewed shortlists.',lastmod:RELEASE_LASTMOD,jsonLd:service('Permanent recruitment in Manchester','/locations/manchester','Permanent recruitment support for employers hiring in Manchester.','Manchester, United Kingdom')},
  {route:'/locations/greater-manchester',title:'Recruitment Agency Greater Manchester | Vorlen',description:'Permanent recruitment across Greater Manchester, shaped around workplace location and commute rather than the borough on the envelope.',lastmod:RELEASE_LASTMOD,jsonLd:service('Permanent recruitment in Greater Manchester','/locations/greater-manchester','Permanent recruitment support for employers across Greater Manchester.','Greater Manchester, United Kingdom')},
  {route:'/privacy',title:'Privacy notice | Vorlen',description:'How Vorlen handles personal information across recruitment, client and partner activity.',lastmod:''},
  {route:'/candidate-terms',title:'Work-seeker terms | Vorlen',description:'Terms on which Vorlen provides permanent recruitment work-finding services to candidates.',lastmod:''},
  {route:'/accessibility',title:'Accessibility | Vorlen',description:'Vorlen accessibility information for candidates, clients and recruitment workspace users.',lastmod:''}
];

const homeHtml=inject(template,{title:homePage.title,description:homePage.description,canonical:`${base}/`,jsonLd:homePage.jsonLd});
await fs.writeFile(path.join(dist,'index.html'),homeHtml);

for(const page of staticPages){
  await writeRoute(page.route,inject(template,{title:page.title,description:page.description,canonical:`${base}${page.route}`,jsonLd:page.jsonLd}));
}

for(const j of rows){
  const description=strip(j.description||`Apply for ${j.title}${j.location?` in ${j.location}`:''}.`).slice(0,155);
  const canonical=`${base}/careers/${encodeURIComponent(j.slug)}`;
  const schema=j.application_mode==='register_interest'
    ?{'@context':'https://schema.org','@type':'WebPage',name:j.title,description:strip(j.description||j.title),url:canonical}
    :{'@context':'https://schema.org','@type':'JobPosting',title:j.title,description:strip(j.description||j.title),datePosted:j.created_at,dateModified:j.updated_at||j.created_at,validThrough:j.valid_through||undefined,employmentType:({full_time:'FULL_TIME',part_time:'PART_TIME',contract:'CONTRACTOR',temporary:'TEMPORARY',internship:'INTERN'}[String(j.employment_type||'').toLowerCase()]||j.employment_type),url:canonical,directApply:true,identifier:{'@type':'PropertyValue',name:'Vorlen vacancy reference',value:j.slug},hiringOrganization:{'@type':'Organization','@id':`${base}/#organization`,name:'VORLEN LTD',sameAs:'https://www.linkedin.com/company/vorlen/'},jobLocation:j.location?{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:j.location,addressCountry:'GB'}}:undefined};
  if(j.application_mode!=='register_interest'&&(j.salary_min||j.salary_max)){
    schema.baseSalary={'@type':'MonetaryAmount',currency:'GBP',value:{'@type':'QuantitativeValue',minValue:j.salary_min||undefined,maxValue:j.salary_max||undefined,unitText:'YEAR'}};
  }
  await writeRoute(`/careers/${j.slug}`,inject(template,{title:`${j.title} | Vorlen Careers`,description,canonical,jsonLd:schema}));
}

const urls=[
  ['/',RELEASE_LASTMOD],
  ...staticPages.map(p=>[p.route,p.lastmod]),
  ...rows.map(j=>[`/careers/${j.slug}`,j.created_at||''])
];
const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u,d])=>`  <url><loc>${xml(base+u)}</loc>${d?`<lastmod>${xml(new Date(d).toISOString())}</lastmod>`:''}</url>`).join('\n')}\n</urlset>\n`;
await fs.writeFile(path.join(dist,'sitemap.xml'),sitemap);
await fs.writeFile(path.join(dist,'llms.txt'),`# Vorlen

> Vorlen is a UK permanent recruitment agency operated by VORLEN LTD (Company No. 17387520). It supports employers with permanent hiring through vacancy briefing, focused candidate sourcing, human-reviewed assessment, candidate introductions and interview coordination.

## Official company information
- Website: ${base}/
- Legal name: VORLEN LTD
- Company number: 17387520
- Registered office: Piccadilly Business Centre, Unit C Aldow Enterprise Park, Blackett Street, Manchester, M12 6AE, United Kingdom
- Contact: mailto:contact@vorlen.co.uk
- LinkedIn: https://www.linkedin.com/company/vorlen/

## Important pages
- [For employers](${base}/employers): permanent recruitment support and employer enquiries.
- [Permanent recruitment](${base}/services/permanent-recruitment): brief-to-placement service.
- [Candidate sourcing](${base}/services/candidate-sourcing): proactive sourcing and recruiter-led review.
- [Candidate assessment methodology](${base}/our-approach): how vacancy criteria, evidence review and human decisions work.
- [Recruitment for SMEs](${base}/services/recruitment-for-smes): permanent hiring support for small and medium-sized businesses.
- [Technology recruitment](${base}/sectors/technology): permanent technology roles.
- [Engineering recruitment](${base}/sectors/engineering): permanent engineering roles.
- [Finance and accounting recruitment](${base}/sectors/finance-accounting): permanent finance roles.
- [Sales and business development recruitment](${base}/sectors/sales-business-development): permanent commercial roles.
- [Manchester](${base}/locations/manchester): recruitment support in Manchester.
- [Greater Manchester](${base}/locations/greater-manchester): regional recruitment support.
- [Careers](${base}/careers): published opportunities and applications.
- [Choosing a recruitment agency](${base}/guides/choosing-a-recruitment-agency): employer guide to agency selection and terms.
- [Contact](${base}/contact): contact Vorlen.
- [Privacy](${base}/privacy): privacy information.

## Vacancy data
Current public vacancies are listed on the Careers page and published as individual pages. Machine-readable JobPosting data is generated only for published vacancies; talent-pool or register-interest pages are not represented as live jobs.

## Editorial and evidence policy
Vorlen does not publish invented recruiter credentials, client results, candidate outcomes, testimonials, ratings or third-party endorsements. Named recruiter biographies and professional credentials are published only after identity, role and claims are verified. Candidate decisions remain human-led; technology may support organisation of evidence but does not make final recruitment decisions.

## Site discovery
- Sitemap: ${base}/sitemap.xml
- Robots: ${base}/robots.txt
`);
await fs.writeFile(path.join(dist,'robots.txt'),`User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /login\nDisallow: /client\nDisallow: /candidate?\nDisallow: /review/\nDisallow: /terms/accept\nSitemap: ${base}/sitemap.xml\n`);
console.log(`SEO build: generated ${rows.length} job pages and ${urls.length} sitemap URLs`);

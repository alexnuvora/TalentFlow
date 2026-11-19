import fs from 'node:fs/promises';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
import {loadEnv} from 'vite';
import {crawlLinks,crawlDetails,crawlFaqs,guideSlug,guideIntro,guideQuestions,guideChecklist,homeMeta} from './seo-content.mjs';
import {publicJobSlug} from '../src/lib/publicJobSlug.mjs';

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
  const fields='id,slug,title,description,location,employment_type,commission_text,salary_min,salary_max,application_mode,created_at,requirements,start_date_text,duration_text,duties,work_days_hours,required_qualifications,expenses_text,minimum_remuneration_text,pay_interval,notice_period';
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

const FONT={
A:'01110/10001/10001/11111/10001/10001/10001',B:'11110/10001/10001/11110/10001/10001/11110',C:'01111/10000/10000/10000/10000/10000/01111',D:'11110/10001/10001/10001/10001/10001/11110',E:'11111/10000/10000/11110/10000/10000/11111',F:'11111/10000/10000/11110/10000/10000/10000',G:'01111/10000/10000/10111/10001/10001/01111',H:'10001/10001/10001/11111/10001/10001/10001',I:'11111/00100/00100/00100/00100/00100/11111',J:'00111/00010/00010/00010/10010/10010/01100',K:'10001/10010/10100/11000/10100/10010/10001',L:'10000/10000/10000/10000/10000/10000/11111',M:'10001/11011/10101/10101/10001/10001/10001',N:'10001/11001/10101/10011/10001/10001/10001',O:'01110/10001/10001/10001/10001/10001/01110',P:'11110/10001/10001/11110/10000/10000/10000',Q:'01110/10001/10001/10001/10101/10010/01101',R:'11110/10001/10001/11110/10100/10010/10001',S:'01111/10000/10000/01110/00001/00001/11110',T:'11111/00100/00100/00100/00100/00100/00100',U:'10001/10001/10001/10001/10001/10001/01110',V:'10001/10001/10001/10001/10001/01010/00100',W:'10001/10001/10001/10101/10101/10101/01010',X:'10001/10001/01010/00100/01010/10001/10001',Y:'10001/10001/01010/00100/00100/00100/00100',Z:'11111/00001/00010/00100/01000/10000/11111',
'0':'01110/10001/10011/10101/11001/10001/01110','1':'00100/01100/00100/00100/00100/00100/01110','2':'01110/10001/00001/00010/00100/01000/11111','3':'11110/00001/00001/01110/00001/00001/11110','4':'00010/00110/01010/10010/11111/00010/00010','5':'11111/10000/10000/11110/00001/00001/11110','6':'01110/10000/10000/11110/10001/10001/01110','7':'11111/00001/00010/00100/01000/01000/01000','8':'01110/10001/10001/01110/10001/10001/01110','9':'01110/10001/10001/01111/00001/00001/01110',
'&':'01010/10101/10100/01000/10101/10010/01101','-':'00000/00000/00000/11111/00000/00000/00000','/':'00001/00010/00010/00100/01000/01000/10000',':':'00000/00100/00100/00000/00100/00100/00000','.':'00000/00000/00000/00000/00000/00100/00100'
};
function crc32(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function pngChunk(type,data){const name=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([len,name,data,crc])}
function makeSocialPng(title){
  const w=1200,h=630,pixels=Buffer.alloc(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const t=(x/w*.55+y/h*.45),i=(y*w+x)*4;pixels[i]=Math.round(16+20*t);pixels[i+1]=Math.round(40+38*t);pixels[i+2]=Math.round(32+27*t);pixels[i+3]=255}
  const rect=(x,y,rw,rh,color)=>{for(let yy=Math.max(0,y);yy<Math.min(h,y+rh);yy++)for(let xx=Math.max(0,x);xx<Math.min(w,x+rw);xx++){const i=(yy*w+xx)*4;pixels[i]=color[0];pixels[i+1]=color[1];pixels[i+2]=color[2];pixels[i+3]=255}};
  const draw=(text,x,y,scale,color,maxWidth=1050)=>{let cx=x;for(const ch of String(text).toUpperCase()){if(ch===' '){cx+=scale*4;continue}const rows=(FONT[ch]||FONT['-']).split('/');if(cx+scale*6>x+maxWidth)break;for(let ry=0;ry<7;ry++)for(let rx=0;rx<5;rx++)if(rows[ry][rx]==='1')rect(cx+rx*scale,y+ry*scale,scale,scale,color);cx+=scale*6}};
  // restrained decorative geometry and a clear branded hierarchy
  rect(76,96,76,5,[199,216,183]);draw('VORLEN',76,126,5,[199,216,183]);draw('UK PERMANENT RECRUITMENT',76,205,3,[219,229,221]);
  const words=String(title).replace(/\s*\|\s*Vorlen.*$/i,'').toUpperCase().split(/\s+/),lines=[];let line='';
  for(const word of words){if((line+' '+word).trim().length>25&&line){lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);
  lines.slice(0,3).forEach((value,i)=>draw(value,76,278+i*68,7,[248,247,242],1040));
  rect(76,505,1048,2,[130,161,143]);draw('HUMAN REVIEWED RECRUITMENT  /  CLEAR BRIEFS  /  WRITTEN TERMS',76,535,2,[227,235,229],1040);
  const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){const row=y*(w*4+1);raw[row]=0;pixels.copy(raw,row+1,y*w*4,(y+1)*w*4)}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0))]);
}
async function writeSocialCard(route,title){
  const slug=(route==='/'?'home':route.replace(/^\//,'').replace(/[^a-z0-9]+/gi,'-').replace(/-$/,'')).slice(0,90);
  const dir=path.join(dist,'social');await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,`${slug}.png`),makeSocialPng(title));
  return `/social/${slug}.png`;
}
function metaDescription(value,max=155){
  const text=strip(value).replace(/\s+/g,' ').trim();
  if(text.length<=max)return text;
  const candidate=text.slice(0,max+1);
  const boundary=candidate.lastIndexOf(' ');
  const cut=(boundary>=110?candidate.slice(0,boundary):candidate.slice(0,max)).replace(/[,:;—-]+$/,'').trim();
  return /[.!?]$/.test(cut)?cut:cut+'…';
}

function crawlBody(title,description,canonical,bodyDetails,job){
  const route=new URL(canonical).pathname.replace(/\/$/,'')||'/';
  const details=bodyDetails?.length?bodyDetails:(crawlDetails[route]||[]);
  const safeDetails=details.length?details:[
    'Vorlen is a UK permanent recruitment agency. We take a clear vacancy brief, source candidates and review relevant evidence before making introductions.',
    'Commercial terms are agreed in writing before a search begins. Employers retain responsibility for the final hiring decision.'
  ];
  const related={
    '/employers':[['/services/permanent-recruitment','Permanent recruitment'],['/guides/employer-recruitment-questions','Employer hiring FAQs'],['/contact','Discuss a vacancy']],
    '/guides/employer-recruitment-questions':[['/employers','Recruitment for employers'],['/services/recruitment-for-smes','Recruitment for SMEs'],['/contact','Discuss your vacancy']],
    '/sectors/engineering':[['/services/permanent-recruitment','Permanent recruitment'],['/locations/manchester','Manchester recruitment'],['/contact','Discuss an engineering vacancy']],
    '/sectors/technology':[['/services/permanent-recruitment','Permanent recruitment'],['/locations/manchester','Manchester recruitment'],['/contact','Discuss a technology vacancy']],
    '/sectors/finance-accounting':[['/services/permanent-recruitment','Permanent recruitment'],['/sectors/sales-business-development','Sales recruitment'],['/contact','Discuss a finance vacancy']],
    '/sectors/sales-business-development':[['/services/permanent-recruitment','Permanent recruitment'],['/sectors/finance-accounting','Finance recruitment'],['/contact','Discuss a sales vacancy']],
    '/locations/manchester':[['/locations/greater-manchester','Greater Manchester recruitment'],['/sectors/engineering','Engineering recruitment'],['/contact','Discuss a Manchester vacancy']],
    '/locations/greater-manchester':[['/locations/manchester','Manchester recruitment'],['/sectors/engineering','Engineering recruitment'],['/contact','Discuss a local vacancy']]
  }[route]||crawlLinks;
  const links=related.map(([href,label])=>`<a href="${href}">${esc(label)}</a>`).join(' · ');
  const heading=route.startsWith('/sectors/')?'How we approach this specialism':route.startsWith('/services/')?'What the service includes':route.startsWith('/locations/')?'Recruitment in this area':route.startsWith('/careers/')?'Role information':route===guideSlug?'Choosing a recruitment agency':route==='/our-approach'?'How candidate assessment works':'How Vorlen works';
  const paragraphs=safeDetails.map(x=>`<p>${esc(x)}</p>`).join('');
  const vacancy=route.startsWith('/careers/');
  const requirements=Array.isArray(job?.requirements)?job.requirements.filter(Boolean):[];
  const vacancySections=vacancy?[
    job?.duties?`<section><h2>Responsibilities</h2><p>${esc(job.duties)}</p></section>`:'',
    requirements.length?`<section><h2>Candidate requirements</h2><ul>${requirements.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:'',
    job?.work_days_hours?`<section><h2>Working pattern</h2><p>${esc(job.work_days_hours)}</p></section>`:'',
    job?.required_qualifications?`<section><h2>Qualifications</h2><p>${esc(job.required_qualifications)}</p></section>`:'',
    job?.minimum_remuneration_text?`<section><h2>Pay and benefits</h2><p>${esc(job.minimum_remuneration_text)}</p></section>`:''
  ].filter(Boolean).join(''):'';
  const faq=(crawlFaqs[route]||[]).map(({q,a})=>`<section><h3>${esc(q)}</h3><p>${esc(a)}</p></section>`).join('');
  const status=vacancy?(job?.application_mode==='register_interest'?'This is a register-interest opportunity. Submit your details to express interest.':'Applications are being accepted for this published vacancy. Use the application form below.'):'';
  return `<main><h1>${esc(title.replace(/\s*\|\s*Vorlen.*$/i,''))}</h1><p>${esc(metaDescription(description))}</p><section><h2>${esc(heading)}</h2>${paragraphs}</section>${vacancySections}${status?`<p><strong>${esc(status)}</strong></p>`:''}${faq?'<section><h2>Employer questions</h2>'+faq+'</section>':''}<h2>Explore more from Vorlen</h2><nav aria-label="Related recruitment pages">${links}</nav></main>`;
}
function inject(html,{title,description,canonical,jsonLd,image,bodyDetails,job}){
  const socialImage=`${base}${image||'/social/home.svg'}`;
  const tags=`<meta name="description" content="${esc(metaDescription(description))}"/><meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"/><link rel="canonical" href="${esc(canonical)}"/><link rel="alternate" hreflang="en-GB" href="${esc(canonical)}"/><link rel="alternate" hreflang="x-default" href="${esc(canonical)}"/><meta property="og:type" content="website"/><meta property="og:site_name" content="Vorlen"/><meta property="og:locale" content="en_GB"/><meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(metaDescription(description))}"/><meta property="og:url" content="${esc(canonical)}"/><meta property="og:image" content="${esc(socialImage)}"/><meta property="og:image:type" content="image/png"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:image:alt" content="${esc(title)} — Vorlen UK recruitment"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${esc(title)}"/><meta name="twitter:description" content="${esc(description)}"/><meta name="twitter:image" content="${esc(socialImage)}"/>${jsonLd?`<script id="seo-jsonld" type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g,'\\u003c')}</script>`:''}`;
  return html
    .replace(/<title>.*?<\/title>/s,`<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/g,'')
    .replace(/<meta (?:name|property)="(?:robots|googlebot|bingbot|og:[^"]+|twitter:[^"]+)"[^>]*>/g,'')
    .replace(/<link rel="canonical"[^>]*>/g,'')
    .replace(/<link rel="alternate" hreflang="(?:en-GB|x-default)"[^>]*>/g,'')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'')
    .replace('</head>',`${tags}</head>`)
    .replace('<div id="root"></div>',`<div id="root">${crawlBody(title,description,canonical,bodyDetails,job)}</div>`);
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

const homePage={title:homeMeta.title,description:homeMeta.description,jsonLd:[{'@context':'https://schema.org','@type':['Organization','EmploymentAgency'],'@id':`${base}/#organization`,name:'Vorlen',legalName:homeMeta.legalName,url:`${base}/`,logo:`${base}/vorlen-logo.svg`,email:'contact@vorlen.co.uk',areaServed:{'@type':'Country',name:'United Kingdom'},identifier:{'@type':'PropertyValue',propertyID:'UK Company Number',value:'17387520'},address:{'@type':'PostalAddress',streetAddress:'Piccadilly Business Centre, Unit C Aldow Enterprise Park, Blackett Street',addressLocality:'Manchester',postalCode:'M12 6AE',addressCountry:'GB'},sameAs:['https://www.linkedin.com/company/vorlen/','https://find-and-update.company-information.service.gov.uk/company/17387520'],description:homeMeta.orgDescription},{'@context':'https://schema.org','@type':'WebSite','@id':`${base}/#website`,name:'Vorlen',url:`${base}/`,publisher:{'@id':`${base}/#organization`}}]};

const guideJsonLd={'@context':'https://schema.org','@graph':[{'@type':'Article','@id':`${base}${guideSlug}#article`,headline:'Choosing a Recruitment Agency: Fees, Shortlists and Questions to Ask',description:'A practical guide to choosing a UK recruitment agency, comparing fees, candidate assessment, shortlists and replacement terms.',mainEntityOfPage:`${base}${guideSlug}`,publisher:organization,author:{'@id':`${base}/#organization`}},{'@type':'FAQPage',mainEntity:guideQuestions.map(({q,a})=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}]};

const staticPages=[
  {route:'/our-approach',title:'How Vorlen Assesses Candidates | Recruitment Methodology',description:'How Vorlen defines a vacancy, sources candidates, reviews job-related evidence, records recruiter judgement and shares candidate information with permission.',lastmod:RELEASE_LASTMOD,jsonLd:{'@context':'https://schema.org','@type':'WebPage',name:'Vorlen candidate assessment methodology',url:`${base}/our-approach`,about:organization}},
  {route:'/careers',title:'Open recruitment opportunities | Vorlen Careers',description:'Browse current permanent recruitment opportunities and apply securely through Vorlen Careers.',lastmod:RELEASE_LASTMOD,jsonLd:{'@context':'https://schema.org','@type':'CollectionPage',name:'Vorlen Careers',url:`${base}/careers`,description:'Current permanent recruitment opportunities published through Vorlen.',isPartOf:{'@id':`${base}/#website`},mainEntity:{'@type':'ItemList',itemListElement:rows.slice(0,50).map((j,i)=>({'@type':'ListItem',position:i+1,url:`${base}/careers/${encodeURIComponent(publicJobSlug(j))}`,name:j.title}))}}},
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
  {route:'/privacy',title:'Privacy notice | Vorlen',description:'How Vorlen handles personal information across recruitment, client and partner activity.',lastmod:'',jsonLd:{'@context':'https://schema.org','@type':'WebPage',name:'Vorlen privacy notice',url:`${base}/privacy`,about:organization}},
  {route:'/candidate-terms',title:'Work-seeker terms | Vorlen',description:'Terms on which Vorlen provides permanent recruitment work-finding services to candidates.',lastmod:'',jsonLd:{'@context':'https://schema.org','@type':'WebPage',name:'Vorlen work-seeker terms',url:`${base}/candidate-terms`,about:organization}},
  {route:'/accessibility',title:'Accessibility | Vorlen',description:'Vorlen accessibility information for candidates, clients and recruitment workspace users.',lastmod:'',jsonLd:{'@context':'https://schema.org','@type':'WebPage',name:'Vorlen accessibility information',url:`${base}/accessibility`,about:organization}}
];

const homeImage=await writeSocialCard('/',homePage.title);
const homeHtml=inject(template,{title:homePage.title,description:homePage.description,canonical:`${base}/`,jsonLd:homePage.jsonLd,image:homeImage});
await fs.writeFile(path.join(dist,'index.html'),homeHtml);

for(const page of staticPages){
  const image=await writeSocialCard(page.route,page.title);
  await writeRoute(page.route,inject(template,{title:page.title,description:page.description,canonical:`${base}${page.route}`,jsonLd:page.jsonLd,image}));
}

for(const j of rows){
  const publicSlug=publicJobSlug(j);
  const description=metaDescription(j.description||`Apply for ${j.title}${j.location?` in ${j.location}`:''}.`);
  const canonical=`${base}/careers/${encodeURIComponent(publicSlug)}`;
  const pageTitle=`${j.title} | Vorlen Careers`;
  const schema=j.application_mode==='register_interest'
    ?{'@context':'https://schema.org','@type':'WebPage',name:j.title,description:strip(j.description||j.title),url:canonical}
    :{'@context':'https://schema.org','@type':'JobPosting',title:j.title,description:strip(j.description||j.title),datePosted:j.created_at,url:canonical,directApply:true,identifier:{'@type':'PropertyValue',name:'Vorlen vacancy reference',value:publicSlug},hiringOrganization:{'@type':'Organization',name:'confidential'},employmentType:({permanent:'FULL_TIME',full_time:'FULL_TIME',part_time:'PART_TIME',contract:'CONTRACTOR',temporary:'TEMPORARY',internship:'INTERN'}[String(j.employment_type||'').toLowerCase()]||'FULL_TIME'),jobLocation:j.location?{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:j.location,addressCountry:'GB'}}:undefined};
  if(j.application_mode!=='register_interest'&&(j.salary_min||j.salary_max)){
    schema.baseSalary={'@type':'MonetaryAmount',currency:'GBP',value:{'@type':'QuantitativeValue',minValue:j.salary_min||undefined,maxValue:j.salary_max||undefined,unitText:'YEAR'}};
  }
  const image=await writeSocialCard(`/careers/${publicSlug}`,pageTitle);
  const bodyDetails=strip(j.description||'').split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean);
  await writeRoute(`/careers/${publicSlug}`,inject(template,{title:pageTitle,description,canonical,jsonLd:schema,image,bodyDetails,job:j}));
  if(j.slug&&j.slug!==publicSlug){
    const legacy=`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${esc(canonical)}"><meta http-equiv="refresh" content="0;url=${esc(canonical)}"><title>Vacancy moved | Vorlen Careers</title></head><body><p>This vacancy has a new address. <a href="${esc(canonical)}">Continue to the anonymised vacancy page</a>.</p></body></html>`;
    await writeRoute(`/careers/${j.slug}`,legacy);
  }
}

const urls=[
  ['/',RELEASE_LASTMOD],
  ...staticPages.map(p=>[p.route,p.lastmod]),
  ...rows.map(j=>[`/careers/${publicJobSlug(j)}`,j.created_at||''])
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
- LinkedIn: https://www.linkedin.com/company/vorlen/\n- Companies House: https://find-and-update.company-information.service.gov.uk/company/17387520

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

type Seo={title:string;description:string;path?:string;robots?:string;jsonLd?:unknown;image?:string};
const CANONICAL='https://www.vorlen.co.uk';
const base=()=>String(import.meta.env.VITE_APP_URL||CANONICAL).replace(/\/$/,'');
function meta(name:string,content:string,property=false){if(!content)return;const attr=property?'property':'name';let el=document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement|null;if(!el){el=document.createElement('meta');el.setAttribute(attr,name);document.head.appendChild(el)}el.content=content}
function link(rel:string,href:string,hreflang?:string){let selector=`link[rel="${rel}"]`;if(hreflang)selector+=`[hreflang="${hreflang}"]`;let el=document.head.querySelector(selector) as HTMLLinkElement|null;if(!el){el=document.createElement('link');el.rel=rel;if(hreflang)el.hreflang=hreflang;document.head.appendChild(el)}el.href=href}
export function setSeo({title,description,path=location.pathname,robots='index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',jsonLd,image='/vorlen-logo.svg'}:Seo){
  const canonical=`${base()}${path}`;
  const social=image.startsWith('http')?image:`${base()}${image}`;
  document.title=title;
  meta('description',description);meta('robots',robots);meta('googlebot',robots);meta('bingbot',robots);
  meta('og:title',title,true);meta('og:description',description,true);meta('og:type','website',true);meta('og:site_name','Vorlen',true);meta('og:locale','en_GB',true);meta('og:url',canonical,true);meta('og:image',social,true);meta('og:image:alt','Vorlen — UK permanent recruitment',true);
  meta('twitter:card','summary_large_image');meta('twitter:title',title);meta('twitter:description',description);meta('twitter:image',social);
  meta('google-site-verification',String(import.meta.env.VITE_GOOGLE_SITE_VERIFICATION||''));meta('msvalidate.01',String(import.meta.env.VITE_BING_SITE_VERIFICATION||''));
  link('canonical',canonical);link('alternate',canonical,'en-GB');link('alternate',canonical,'x-default');
  document.getElementById('page-jsonld')?.remove();
  if(jsonLd){const s=document.createElement('script');s.id='page-jsonld';s.type='application/ld+json';s.text=JSON.stringify(jsonLd);document.head.appendChild(s)}
}
export const noIndex='noindex,nofollow,noarchive,nosnippet';
export function orgSchema(){
  const url=base();
  return {'@context':'https://schema.org','@graph':[
    {'@type':['Organization','EmploymentAgency'],'@id':`${url}/#organization`,name:'Vorlen',alternateName:'VORLEN T/A IVY AND PEARLS LTD',legalName:'IVY AND PEARLS LTD',url,logo:`${url}/vorlen-logo.svg`,email:'contact@vorlen.co.uk',areaServed:{'@type':'Country',name:'United Kingdom'},identifier:{'@type':'PropertyValue',propertyID:'UK Company Number',value:'17387520'},description:'UK permanent recruitment agency helping employers source, assess and hire candidates with human-reviewed recruitment delivery.',knowsAbout:['Permanent recruitment','Candidate sourcing','Candidate screening','Employer recruitment','Recruitment partnerships'],contactPoint:[{'@type':'ContactPoint',contactType:'customer service',email:'contact@vorlen.co.uk',areaServed:'GB',availableLanguage:'English'}]},
    {'@type':'WebSite','@id':`${url}/#website`,name:'Vorlen',url,publisher:{'@id':`${url}/#organization`},inLanguage:'en-GB',description:'Vorlen permanent recruitment for UK employers, candidates and recruitment partners.'}
  ]};
}

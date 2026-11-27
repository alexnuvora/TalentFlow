// In-memory attribution for a public-site visit; no cookies, storage or tracking requests.
export function publicSourcePath(path) {
  if(typeof path!=='string'||path.length>150)return '';
  return /^\/$|^\/(about|employers|our-approach|contact|candidates|partners|careers|privacy|accessibility|candidate-terms)$|^\/(services|sectors|locations|guides|tools|careers|campaign)\/[a-z0-9-]+$/.test(path)?path:'';
}
const tag=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_.+ -]{0,79}$/i.test(value)?value:'';
export function nextPublicAttribution(previous,pathname,search='',referrer='',origin='') {
  const path=publicSourcePath(pathname);
  if(!path)return null;
  const params=new URLSearchParams(search);
  const source=tag(params.get('utm_source')),campaign=tag(params.get('utm_campaign'));
  // Explicitly tagged visits start a new attribution record. Never preserve full URLs or click IDs.
  if(source||campaign)return {source_page:path,utm_source:source,utm_campaign:campaign};
  if(previous)return previous;
  let entry=path,referral='';
  try{
    const ref=new URL(referrer);
    if(ref.origin===origin&&path==='/contact')entry=publicSourcePath(ref.pathname)||path;
    if(ref.origin!==origin&&['www.google.com','google.com','www.google.co.uk','google.co.uk'].includes(ref.hostname))referral='google-referral';
    if(ref.origin!==origin&&['www.bing.com','bing.com'].includes(ref.hostname))referral='bing-referral';
  }catch{}
  return {source_page:entry,utm_source:referral,utm_campaign:''};
}
let current=null;
export function recordPublicVisit(pathname,search,referrer,origin){
  current=nextPublicAttribution(current,pathname,search,referrer,origin);
}
export function getPublicAttribution(pathname,search,referrer,origin){
  return nextPublicAttribution(current,pathname,search,referrer,origin)||{source_page:'/contact',utm_source:'',utm_campaign:''};
}

// Consent preferences are versioned; no optional measurement before an affirmative choice.
export const CONSENT_KEY = 'vorlen_privacy_v1';
export const CONSENT_VERSION = 1;
export const CONSENT_TTL = 180 * 24 * 60 * 60 * 1000;
export const CONSENT_EVENT = 'vorlen:privacy-change';
export const OPEN_SETTINGS = 'vorlen:privacy-open';
const paths = new Set(['/', '/about', '/employers', '/our-approach', '/contact', '/candidates', '/partners', '/careers',
 '/services/permanent-recruitment', '/services/candidate-sourcing', '/services/recruitment-for-smes',
 '/sectors/technology','/sectors/sales-business-development','/sectors/finance-accounting','/sectors/engineering',
 '/sectors/hgv-driver-recruitment','/sectors/transport-logistics-recruitment-cheshire','/sectors/telesales-recruitment',
 '/sectors/childrens-residential-care-recruitment','/sectors/electrical-design-engineer-recruitment',
 '/locations/manchester','/locations/greater-manchester','/guides/employer-recruitment-questions',
 '/guides/choosing-a-recruitment-agency','/guides/how-to-hire-hgv-drivers','/tools/recruitment-fee-calculator','/tools/recruitment-brief-template']);
export function analyticsPath(path) {
 if (typeof path !== 'string' || path.length > 160) return '';
 if (paths.has(path)) return path;
 if (/^\/careers\/[a-z0-9-]+$/.test(path)) return '/careers/opportunity';
 if (/^\/campaign\/[a-z0-9-]+$/.test(path)) return '/campaign/opportunity';
 return '';
}
export function isPublicPrivacyPage(path) {
 return Boolean(analyticsPath(path)) || ['/privacy','/accessibility','/candidate-terms'].includes(path);
}
export function parseConsent(raw, now=Date.now()) {
 try {
  const v = JSON.parse(raw || 'null');
  if (!v || v.version !== CONSENT_VERSION || typeof v.analytics !== 'boolean' ||
    !Number.isFinite(v.savedAt) || v.savedAt > now || now-v.savedAt >= CONSENT_TTL) return null;
  return {version:CONSENT_VERSION, analytics:v.analytics, savedAt:v.savedAt};
 } catch { return null; }
}
let memory=null, volatileOnly=false;
export function readConsent() {
 if (typeof window==='undefined') return null;
 if(volatileOnly)return parseConsent(JSON.stringify(memory));
 try { return parseConsent(window.localStorage.getItem(CONSENT_KEY)); }
 catch { return parseConsent(JSON.stringify(memory)); }
}
export function saveConsent(analytics) {
 if (typeof window==='undefined') return null;
 const value={version:CONSENT_VERSION,analytics:analytics===true,savedAt:Date.now()};
 memory=value;
 try { window.localStorage.setItem(CONSENT_KEY,JSON.stringify(value)); volatileOnly=false; } catch { volatileOnly=true; /* page-memory fallback */ }
 window.dispatchEvent(new Event(CONSENT_EVENT));
 return value;
}
export function analyticsAllowed(path) {
 return Boolean(analyticsPath(path) && readConsent()?.analytics === true);
}
export const SOURCE_VALUES=['direct-or-unknown','google','bing','facebook','instagram','linkedin','other'];
export function trafficSource(search='', referrer='') {
 const value=(new URLSearchParams(search).get('utm_source')||'').toLowerCase();
 const known={google:'google',bing:'bing',facebook:'facebook',fb:'facebook',instagram:'instagram',ig:'instagram',linkedin:'linkedin'};
 if (Object.hasOwn(known,value)) return known[value];
 if (value) return 'other';
 try {
  const host=new URL(referrer).hostname.toLowerCase().replace(/^www\./,'');
  if (['vorlen.co.uk'].includes(host)) return 'direct-or-unknown';
  if (/^google\.(com|co\.uk)$/.test(host)) return 'google';
  if (host==='bing.com') return 'bing';
  for (const [domain,source] of [['facebook.com','facebook'],['instagram.com','instagram'],['linkedin.com','linkedin']]) {
   if (host===domain || host.endsWith('.'+domain)) return source;
  }
  return 'other';
 } catch { return 'direct-or-unknown'; }
}
export function validAnalyticsEvent(body) {
 if(!body || typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='event,page,source') return false;
 const {event,page,source}=body;
 if (!['page_view','employer_enquiry','candidate_application','interest_registered'].includes(event) ||
   !SOURCE_VALUES.includes(source) || !analyticsPath(page) || analyticsPath(page)!==page) return false;
 if(event==='employer_enquiry') return page==='/contact';
 if(event==='candidate_application'||event==='interest_registered') return page==='/careers/opportunity';
 return true;
}
